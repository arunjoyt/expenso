# In-app Assistant: LangGraph agent in a standalone service, confirm-gated writes, proactive Insights

**Status: accepted (2026-09-09).** Supersedes most of [ADR 0004](0004-chat-via-tool-calling.md) and amends [ADR 0002](0002-receipt-extraction-via-vision-llm.md), [ADR 0003](0003-receipt-extraction-tracking.md), [ADR 0005](0005-chat-via-mcp-connector-alternative.md), [ADR 0006](0006-chat-driven-manual-entry-mcp-connector.md). Settled in a grill-with-docs session; the full decision log lives in the session plan.

## Context

ADR 0004 designed the in-app Chat as deliberately shallow — a hand-rolled OpenAI tool-calling loop, 4 read-only tools, one bounded loop per message, synchronous, `gpt-4o-mini` — and was deferred so the Phase 5 MCP connector (ADR 0005/0006) could ship first. Phase 5 shipped. Phase 4 (Receipt extraction) was never started.

Revisiting Phase 6, the decision is to **not** build ADR 0004 as written and instead build a full-agentic in-app **Assistant**: an agent that answers questions, manages the ledger, handles receipts conversationally, and runs proactively on a schedule. ADR 0004's own text named the trigger for this: *"revisit this if the tool count or interaction complexity actually grows (write actions, multi-agent handoffs)."* Write actions, multi-step workflows, and human-in-the-loop confirmation are exactly that growth.

## Decision

### Terminology

**Assistant** is the umbrella — the interactive **Chat** surface plus proactive **Insights**. "Chat" narrows to "the interactive thread surface of the Assistant" and no longer means read-only Q&A. This overrides `docs/GLOSSARY.md`'s `_Avoid_: Assistant`.

### A standalone service, not Frappe code

The agent runs in a **new standalone repository `expenso-assistant`**, structured like the sibling `contract-intelligence` project — its own `docker-compose`, CI, and deploy. The container stack is: the app (a **FastMCP** server + the LangGraph agent, one process), **one Postgres** (the LangGraph checkpointer *and* the Langfuse database), a **Langfuse v2** container, and nginx. Frappe carries **zero** `langgraph`/`langchain`/`openai` dependencies and holds **no** LLM API key.

Every LLM call in the whole product now originates in this service — including receipt vision, which moves out of Frappe (see the ADR 0002 amendment).

### LangGraph framework, hand-rolled FastAPI serving

The agent is a **LangGraph** state-graph (MIT-licensed framework). The packaged `langgraph-api` server is Elastic-licensed and is **not** used. Instead, two thin FastAPI endpoints serve it: one runs `graph.astream_events()` and forwards events as **SSE**, one is `/resume` and calls `graph.ainvoke(Command(resume=…))`. The frontend reads the SSE stream directly — **not** `@langchain/langgraph-sdk`.

The stream works one "leg" at a time: it streams until the graph either completes or hits an `interrupt` (checkpointed to Postgres). An `interrupt` ends the stream with a `needs_confirmation` event carrying the run id and the confirm-card payload; the Member responds via `/resume`, and a new SSE stream carries the continuation.

LangGraph over a hand-rolled loop: write actions, multi-step workflows, and durable human-in-the-loop pause/resume are real complexity the checkpointer + `interrupt` model handles directly. LangChain's model abstraction is kept as the **cheap provider-swap insurance** ADR 0002 describes — not used as a runtime switch. v1 ships on OpenAI with the model id and its pricing as a coupled hardcoded constant in the service's `config.py`.

### One tool definition, two consumers

A single **`tools.py`** module defines the tool set once — plain typed async functions over the Frappe REST client. Two consumers bind to it:

- the **LangGraph agent** binds the functions **directly** as LangChain tools — no MCP protocol in the agent's path;
- the **FastMCP server** registers the same functions for external Claude/ChatGPT connectors.

The FastMCP server is therefore a **pure external adapter** — it can be disabled (unmounted) with zero effect on the in-app Assistant. This replaces the in-process `frappe-mcp` server (`expenso/mcp.py`), which is deleted along with its dependency — closing the `frappe-mcp` pin/spec-lag issues (#86/#88/#89). See the 2026-09-10 update.

The tool functions call **back into Frappe's REST API as the Member** — the caller's bearer token is passed through, `validate_oauth()` → `frappe.set_user()` runs unchanged, and every existing `permission_query_conditions` / `has_permission` hook applies. **No new Frappe auth code.** Family-scoping is still free; the agent still has no path to construct its own query (ADR 0004's argument survives).

### Auth

Frappe stays the OAuth **authorization server**; the service is a **resource server**.

- **Interactive:** the logged-in frontend calls a light whitelisted mint endpoint (`expenso.assistant.auth.mint_assistant_token` — session-authenticated, creates a short-lived `OAuth Bearer Token` row for `frappe.session.user`, the shape `test_mcp.py::_make_bearer_token` already uses), scoped `expenso:read` always and `expenso:write` for the confirm-gated tools. The token is passed to the service and passed through to the tool functions on each Frappe REST call.
- **Proactive:** the Frappe scheduler mints a **read-scoped** per-Member token and POSTs the service.
- **External connector:** unchanged OAuth Authorization Code flow, new connector URL.

No shared secrets; no new `auth_hooks`.

### Capabilities and the confirm step

The agent's write tools: `create/update/delete_expense`, `create/update/delete_income`, `add_category`, `add_source`, `set_budget`. It may **recommend** but never execute `rename/delete_category` or `rename/delete_source` — those rewrite the meaning of historical rows or cascade-delete Budgets, and their safety comes from being done on Settings with the whole list in view.

**Every interactive write confirms.** For the in-app path a proposal node raises a LangGraph `interrupt` directly (the agent's write tools never execute inline), which the frontend renders as a confirm card — **batched per turn** (one card for the agent's whole proposed action set), showing the **literal row(s)** and a **before→after diff** for updates. (External connectors get the same gate via MCP elicitation on the FastMCP adapter — the external client renders its own confirm UI.) The Member confirms the set, deselects rows, or cancels. More than one card per turn only when a later step needs an earlier write's result. This diverges from ADR 0006's "immediate write, no review" — justified because in-app a confirm is one tap, not an app switch.

Confirmed Assistant writes carry **no "unreviewed external write" marker** — the Member reviewed the exact values, so they are indistinguishable from manual entries. A new neutral **`entry_method`** field (`manual` / `assistant` / `connector` / `receipt`) on Expense/Income records provenance, orthogonal to the connector's `is_external_write` flag.

**Disambiguation** ("that coffee expense") is not the LLM's to solve. The agent narrows to candidates via reads; the confirm card shows the real rows and the Member picks the exact target. Ambiguous references → the agent asks in-thread rather than firing a speculative card. A **concurrency guard** on the row `modified` timestamp (a new `if_modified_since` parameter on the `update_*`/`delete_*` whitelisted methods) rejects a stale write and forces a re-read + re-propose.

### Proactive Insights

Scheduled runs get a **read-only toolset** — `READ_TOOLS` only, never bound alongside the write tools. This is a binding-level guarantee, not a confirmation-level one: the model cannot even *name* a write tool in a proactive run, so there is nothing for `route()` to send to `propose`. **v1 proactive runs never propose or write anything** — output is always an **Insight** message in the Member's thread, never a pending proposal (see the 2026-09-11 P7-S2 update; this reverses the "wanted action becomes a pending proposal" framing this section originally had).

One run per Member (threads are private per-Member). v1 jobs, the first `scheduler_events` in `hooks.py`: a **monthly summary** (1st of the month, covering the month just ended, unconditional — always worth saying, even "nothing spent") and a **budget-drift check** (weekly, current month). Budget-drift re-warns every week a Category remains `Warning`/`Exceeded` — **there is no dedup marker in v1** (see the 2026-09-11 P7-S2 update). Insights land as thread messages, tagged so the Assistant tab can render them distinctly from an ordinary reply; the Assistant nav tab carries an **unread badge** as the nudge — no push notifications (the GLOSSARY Realtime rule holds). (The badge was on a floating chat bubble in the 2026-09-09 design — see the 2026-09-10 P6-S6 update.)

Both jobs are scheduled **off-hours** (e.g. early-morning cron), deliberately: a proactive run is a multi-step graph that can occupy the event loop for tens of seconds, and the single `app` process (one FastMCP server + agent, per the stack above) also serves the live chat SSE streams. Off-hours scheduling is the mitigation — at two Members the odds of a proactive run overlapping a live chat turn are already low, and the schedule removes them. If proactive volume ever grows, move these to a separate worker rather than relaxing the timing.

### Persistence boundary

- **Conversation threads** live in the **LangGraph checkpointer's Postgres**, outright. There is **no `Chat Message` DocType** — this reverses ADR 0004's persistence model. The frontend reads history and streams from the service. "Clear chat" deletes the LangGraph thread.
- **Full step traces** live in **Langfuse only** (retention ~30–60 days). There is no `Chat Run` / `Assistant Run` DocType.
- **Every LLM call is recorded only as a Langfuse trace** — tagged with the Member (`user_id`), `feature`, and thread, with cost attached explicitly. (`metadata.family` was dropped — see the 2026-09-10 P6-S5 update.) **There is no `LLM Call Log` DocType and Frappe stores nothing about the Assistant** (this reverses an earlier version of this bullet — see the 2026-09-10 update). Admin cost/latency visibility is the Langfuse dashboards; receipt-accuracy is a Langfuse score.
- **Receipt images are never stored** — not on the Expense, not in the thread, no Frappe `File`. The image is transient in the browser/run state during the session and discarded after processing; the thread keeps a text marker.

### Observability

**Langfuse v2, self-hosted, Postgres-only** (as `contract-intelligence` runs it), loopback-bound and browsed via SSH tunnel. This reverses ADR 0003's "no third-party observability" **for the self-hosted case only** — the data stays on our infra and the UI is never publicly exposed. Hosted-SaaS observability (LangSmith, Helicone proxy) stays rejected for the data-residency reason ADR 0003 gave.

Langfuse is not just the trace viewer — it is the **only** record of every LLM call (there is no `LLM Call Log`; see the 2026-09-10 update). Every trace is tagged `user_id` = Member / `metadata.feature` / `session_id` = thread, with the generation cost set explicitly from the `config.py` pricing constant. Admin cost/latency/token dashboards, per-Member daily-cap counts, and receipt-accuracy scores all read from this. (`metadata.family` was dropped — see the 2026-09-10 P6-S5 update.)

### Cost bounds

Per-run: LangGraph `recursion_limit` + a max-tool-calls cap + a wall-clock cap. Exceeding any → an error to the caller, no partial turn persisted. These in-process caps are the real runaway guard. Per-Member daily caps (chat / receipt / write) are computed from Langfuse — today's trace count for that `user_id` + `feature` — and **fail open** if Langfuse is unreachable (the per-run caps still bound the run). There is **no app-level monthly spend cap**; a hard monthly spend limit set on the OpenAI account is the money backstop. See the 2026-09-10 update.

### Phase 5 cutover

`frappe-mcp` is replaced outright — `expenso/mcp.py` and the dependency are deleted. Members re-add the connector once with the new URL. The `OAuth Client`, `expenso:read`/`expenso:write` scopes, `Allowed Roles`, and OAuth-enabling patches all carry over unchanged.

## Consequences

- **Chat history leaves Frappe Desk.** Admin conversation debugging happens in Langfuse. The LangGraph Postgres is its own backup target, alongside the Langfuse Postgres.
- **Receipts and the Assistant now require the service to be up**, not just Frappe + an API key. ADR 0002's "extraction failure never blocks manual Expense creation" covers the degraded case.
- **Beta dependencies in the critical path:** none for the in-app path since the 2026-09-10 update — the agent binds tool functions directly and raises `interrupt()` from a proposal node. `langchain[mcp]` and MCP elicitation now live only on the FastMCP external adapter, which is not on the in-app path and can be disabled.
- **Langfuse v2 is on a deprecation path.** Pinned; migrate only if it breaks.
- **The production host runs a second container stack** alongside the Frappe bench.
- **"Clear chat" is not a full-deletion guarantee** — it deletes the LangGraph thread, but the Langfuse traces for those turns (with their cost data) persist to the retention window. See the 2026-09-10 update.
- **Token lifetime vs. long confirm waits** is an open detail: a minted token can expire while a turn sits on a confirm card or a proposal sits for days. Resolved during implementation (longer resume-leg TTL, refresh, or re-mint-on-resume).

---

**Update (2026-09-10): the Assistant keeps no metering store in Frappe. `LLM Call Log` is not built.**

Revisiting P6-S1 before any Phase 6 code: `LLM Call Log` was the *only* Frappe-resident Assistant artifact, and every reason [ADR 0003](0003-receipt-extraction-tracking.md) gave for putting call-tracking in Frappe was already reversed by this ADR — a second container stack now exists, Langfuse is now the admin trace surface, and every LLM call (vision included) moved to the service. Keeping the DocType meant the service POSTing every call into Frappe over `record_llm_call` *and* reading those rows back to enforce its own caps — Frappe sitting on the Assistant's own rate-limiting hot path.

- **No `LLM Call Log` DocType, no `record_llm_call`, no `get_my_llm_cost`.** Frappe stores nothing about the Assistant. The `langfuse_trace_id` round-trip and the Desk → Langfuse jump are gone — there is no Desk list to jump from.
- **Langfuse is the sole record of every call.** Each trace the service emits carries `user_id` = the Member, `metadata.feature` (`chat` / `receipt` / `insights`), `session_id` = the thread id, and **cost attached explicitly on the generation** from the `config.py` pricing constant — not Langfuse's built-in model-price table. This tagging is a P6-S5 requirement. (`metadata.family` was in the original list and was dropped — see the 2026-09-10 P6-S5 update.)
  - The OpenAI API returns **token counts, not a cost** — `prompt_tokens` / `completion_tokens` plus `prompt_tokens_details.cached_tokens` and `completion_tokens_details.reasoning_tokens`. The service computes cost itself, so the `config.py` "pricing constant" is a small per-model rate table — `{input, cached_input, output}` per 1M tokens — with cached input billed at its discounted rate and reasoning tokens billed as output. A model swap is one reviewed commit to that table (the ADR 0003 audit-trail-via-code-diff reasoning).
- **Admin cost/latency/token visibility is the Langfuse dashboards.** No Frappe Number Cards, no Script Reports. `#68` / `#72` are dropped. P6-S5 ships the trace tagging + explicit cost that the dashboards read; standing up the saved views themselves is **deferred to P7-S2** (2026-09-10 P6-S5 update), where reporting is the focus.
- **Receipt extraction accuracy is a Langfuse score.** At `/resume` the service diffs the proposed field values (held in the checkpointed `interrupt` payload) against what the Member confirmed and posts `receipt_accuracy_{amount,date,category,notes}` scores on the receipt trace. ADR 0003's `null`-field exclusion and exact-string `notes` rule are unchanged. Nothing is stored for this outside Langfuse.
- **Caps.** The per-run `recursion_limit` / max-tool-calls / wall-clock caps stay in-process and are the real runaway guard. Per-Member daily caps (chat / receipt / write) are computed from Langfuse for that `user_id` and day — chat and receipt by trace `feature`, writes by counting confirmed write tool-call spans; **the check fails open if Langfuse is unreachable.** Daily and month-to-date windows sit well inside Langfuse's retention, so retention is not a constraint here.
- **No app-level `MONTHLY_SPEND_CAP`.** The money backstop is a hard monthly spend limit set on the OpenAI account dashboard, which shuts the key off. Removed from `config.py` and the service env.
- **The Member-facing "usage this month" (Settings) is dropped for v1** (`#73` deferred). Members don't pay per call — one shared key, admin-capped — so a personal-cost readout is informational-only and can wait for real demand.

`entry_method` on Expense/Income is unaffected — it is ledger provenance, not LLM telemetry, and stays in Frappe. P6-S1 shrinks to `entry_method` + backfill patch + promoting `list_categories` / `list_sources` into `api.py` + the `if_modified_since` concurrency guard.

Recorded in place rather than as a new ADR: nothing was built, and this is a direct correction to the "Persistence boundary" and "Cost bounds" sections above — the same way ADR 0003 was refined pre-code.

---

**Update (2026-09-10): the agent binds tool functions directly; the MCP server is a pure external adapter.**

The 2026-09-09 design routed the co-located agent to its own FastMCP server via `langchain[mcp]` (beta) and surfaced write confirmations through an MCP-elicitation → LangGraph-`interrupt` bridge (also beta). Both betas sat on the in-app critical path for no structural gain — the tools are thin wrappers over Frappe REST either way.

- **A single `tools.py` module** of plain typed async functions over the Frappe REST client is the one tool definition. The **LangGraph agent binds these functions directly** as LangChain tools — no MCP protocol, no `langchain[mcp]`, in the agent's path.
- **The FastMCP server registers the same functions** for external ChatGPT/Claude connectors, with MCP elicitation on the write tools (the external client renders its own confirm UI). It is a **pure external adapter**: mounted at `/mcp`, gated by a config flag, and disabling it has **zero** effect on the in-app Assistant. The in-app Assistant could ship before the connector, or run with it off.
- **In-app write confirmation** is a proposal node that raises `interrupt()` directly with the batched confirm-card payload; `/resume` carries the Member's decision and the graph then executes the approved subset by calling the `tools.py` functions. No elicitation bridge.
- **`langchain[mcp]` and MCP elicitation are still used** — but only inside the FastMCP adapter, off the in-app path. Adopting a more mature in-process MCP bridge later is possible but not needed.
- Both consumers derive their schemas from the same typed function signatures (Pydantic / type hints), so "define once" holds without a shared MCP schema layer.

The one accepted cost: the confirm-gate logic exists in two forms — a graph `interrupt` for in-app, MCP elicitation for connectors — but they are genuinely different surfaces with different UIs, and both call the same underlying write functions.

Recorded in place for the same reason as the block above: pre-code, a direct refinement of "One tool definition, two consumers" and "Capabilities and the confirm step".

---

**Update (2026-09-10, P6-S5): `metadata.family` is dropped from the trace tags.**

Every trace tag needs a source the service can reach. `user_id`, `feature` and `session_id` all come from the run's own inputs (the introspected token's Member, the endpoint, the thread id). `metadata.family` does not — Frappe's token introspection returns `sub` only when a `User Social Login` row exists and never returns the Family, so the tag would force a new cross-repo identity path (a whitelisted `assistant_context` endpoint, or extending the mint response) for a v1 with one Family and two Members.

- **The tag set is now `user_id` = Member / `metadata.feature` / `session_id` = thread.** No `metadata.family`.
- **Nothing in v1 consumes per-Family attribution.** Daily caps key on `user_id` + `feature`; receipt-accuracy is per-trace; the only consumer that would slice by Family is an admin dashboard, and an admin can map Member → Family in Desk out-of-band the rare times that matters. Trace retention is 30–60 days, so there is no long-lived history to lose.
- **Revisit if** `expenso-assistant` grows a need to know the Family for *behaviour* (not just telemetry) — at that point the service has a real reason to resolve it and the tag is nearly free to re-add. P7-S2's proactive runs are explicitly one-per-Member and do not create that need.

Recorded in place: pre-code, a direct correction to "Observability" and the "Persistence boundary" telemetry bullet.

---

**Update (2026-09-10, P6-S3): the connector write-confirm is the SEP-2322 guard pattern, not server-initiated elicitation.**

The MCP `2026-07-28` spec era (which FastMCP 4.x negotiates by default) **removed server-initiated elicitation** — a tool can no longer push a prompt to the client mid-call. The sanctioned replacement is the SEP-2322 **guard pattern**: on first invocation a write tool returns an `InputRequiredResult` ("confirm this change?"); the connector renders its own confirm UI, re-invokes the tool with the answer, and the tool reads `ctx.input_responses` before touching Frappe. `request_state` carries the proposed-action summary across the round-trip.

- **The intent is unchanged** — every external-connector write is confirmed by the Member before it fires. Only the wire mechanism moved. Everywhere this ADR (and ARCHITECTURE / IMPLEMENTATION_PLAN / TEST_PLAN) says "MCP elicitation on the writes", read "SEP-2322 input-required confirmation".
- **The in-app path is untouched** — it never used MCP; it raises LangGraph `interrupt()` from a proposal node (the block above).
- **`langchain[mcp]` is no longer implied anywhere.** The agent binds `tools.py` directly (previous update); the FastMCP adapter registers the same functions and gates writes with the guard pattern. No beta MCP bridge in the product.
- **Scope check still precedes the confirm round-trip** — a token missing `expenso:write` is rejected before the first `InputRequiredResult`.
- If a connector only speaks a pre-`2026-07-28` era (classic `elicitation/create`), its writes degrade to "not supported"; reads are unaffected and `MCP_ENABLED=false` disables the adapter entirely. Revisit only if a connector we care about is stuck on the old era.

Recorded in place: pre-cutover, a direct correction to "Capabilities and the confirm step" forced by an external spec change.

---

**Update (2026-09-10, P6-S6): the Chat surface is an "Assistant" tab, not a floating bubble.**

The 2026-09-09 design put Chat behind a **floating bubble on every screen, stacked directly above the FAB**, opening a full-screen overlay. Building P6-S6, that was reconsidered and reversed.

- **Chat is reached from a 5th bottom-nav tab, labelled "Assistant"** (Feed / Analytics / Budget / Settings / Assistant), routing to a normal screen — not an overlay, not a floating affordance. The bubble↔FAB stacking (z-index, "clear gap", one-thumb reach) was the fiddliest part of the streak for the least gain: the overlay was full-screen anyway, so the bubble's "invoke without leaving the screen" advantage was mostly notional. A routed screen is less code and removes a class of layout divergence.
- **The tab is "Assistant", not "Chat".** It also hosts proactive **Insights** and pending proposals (the unread badge fires for those, P7-S2/P6-S7), so the tab represents the whole **Assistant** capability, not just the conversational surface. "Chat" stays the term for the thread mechanic — one continuous thread, "Clear chat" unchanged.
- **The FAB becomes global on every screen *except* the Assistant tab** (which has its own pinned input). This narrows the GLOSSARY's "widens it to every screen".
- **The unread badge moves from the bubble to the Assistant nav item.** Same rule (unseen Insight / pending proposal), same no-push-notifications constraint.

Frontend mechanics settled here (were "resolved during implementation" open details):

- **Service URL** reaches the frontend via Frappe's boot context — `window.assistant_url` from `frappe.conf.get("expenso_assistant_url")`; empty ⇒ the tab shows an "Assistant isn't configured" notice instead of erroring.
- **Cross-origin.** The frontend (Frappe origin) calls the service (`https://assistant.<site>`, separate origin). The service gains a `CORSMiddleware` with a configurable `allowed_cors_origins` list — a companion change in the `expenso-assistant` repo, since P6-S6 is otherwise `[FE]`-only.
- **SSE transport** is `fetch()` + `ReadableStream`, not `EventSource` — the bearer token rides an `Authorization` header, which `EventSource` cannot set. A ~30-line frame parser in `useAssistant.js`; no new dependency.
- **Token.** P6-S6 mints **read-only** (`mint_assistant_token(write=False)`); the `expenso:write` scope is added in P6-S7 with the confirm card. Minted lazily on first tab open, cached in composable module scope, re-minted on 401 or near-expiry.

Recorded in place: pre-code, a direct reversal of the bubble/overlay presentation in "Terminology" and "Proactive Insights" and a resolution of the "Token lifetime" open detail. The agent/service architecture is unchanged.

---

**Update (2026-09-10, P6-S7): the write leg — confirm mechanics, and the daily write cap becomes a per-turn batch cap.**

Building P6-S7 (agent writes + confirm card), these details of "Capabilities and the confirm step" were settled, and one decision from the "Cost bounds" section reversed.

**Confirm mechanics (refinements, not reversals):**

- **Interception is by tool-call kind.** The real `WRITE_TOOLS` are bound to the model (so it produces correctly-typed args). `route()` sends a message with **any** write tool-call to a new `propose` node; read-only calls still go to `tools`. The `propose` node gathers every write call in that message, raises `interrupt(payload)`, and on `Command(resume=…)` calls the `tools.py` write functions for the approved subset — one `ToolMessage` per original call (approved → result, deselected → "skipped by the member"). The system prompt tells the model to read targets first and put all writes for a request in one message with no reads mixed in.
- **The diff's "before" comes from the tool history.** The `propose` node reads each `update`/`delete` target's current field values **and its `modified` timestamp** out of the `get_expenses`/`get_income`/`get_analytics` `ToolMessage`s already in state — it does not re-read. A target not present in history → a `ToolMessage` nudge ("re-read EXP-17 first"), no interrupt. So `if_modified_since` is always the value the agent actually saw, and an edit between the agent's read and the member's confirm is caught by `_guard_not_stale`.
- **Payload / decision shapes.** Interrupt payload (and the `needs_confirmation` SSE data, and `ConfirmCard.vue` props): `{ actions: [{ id, tool, kind, entity, summary, changes | values }] }` — `id` is `a1`, `a2`… by proposal order; `kind` ∈ `create` / `update` / `delete`; `changes` is `[{field, from, to}]` for updates, `values` is the row for create/delete. `name` and `if_modified_since` stay server-side. Resume body: `{ decision: { selected: [id, …] } }`; an empty `selected` is cancel. The `propose` node **re-derives** the action list from the still-pending `tool_calls` + tool history on resume and filters by `selected` — no side table to keep in sync with the checkpoint.
- **Conflicts are per-action and recoverable.** A `TimestampMismatchError` on one action does not abort the batch — the non-conflicting actions apply, the conflicted one comes back as a `ToolMessage`, and the model re-reads and re-proposes (a **second** `needs_confirmation` showing the new current values). A conflict is never a turn-killing `error` event.
- **SSE.** An `interrupt` ends the `/chat` stream with `needs_confirmation` and **no** `done`. The payload is just `{actions}` — **no run id** (the "carrying the run id" phrasing in the "LangGraph framework" section above is superseded): the thread is 1:1 with the Member and derived server-side, so `/resume` resumes whatever interrupt is pending on that thread. `/resume` opens a fresh continuation stream (`step`/`token` → `done` or another `needs_confirmation`). A new `/chat` while an interrupt is pending **discards** it (a transient `step`, "Discarded the unconfirmed changes") and proceeds — the thread is linear; a new message means the member moved on. `/resume` with nothing pending is a clean no-op.
- **Accounting across the interrupt.** `/resume` opens its own `feature:chat` trace (same `session_id`); the chat cap is **not** re-checked on resume; `tool_call_count` persists in `AgentState` across the interrupt (the `propose` node increments it once per executed batch); the wall-clock cap resets per SSE leg (member think-time is free); `resume_turn` binds `entry_method="assistant"`. **Token lifetime open detail (above) resolved:** `resume_turn` re-mints via the same lazy path as `stream_turn`, so a card that sits for an hour still resumes.
- **`set_budget`** is `kind: "update"` when a budget row for that category/month is in the tool history, else `create`; `add_category` / `add_source` are always `create` (no `if_modified_since`).

**The daily *assistant* write cap is dropped; a per-turn batch cap replaces it.**

ADR 0008 listed per-Member daily caps as "chat / receipt / write". For the confirmed in-app path the write leg does not earn a daily total:

- LLM spend is already bounded by the **chat cap** — every propose-card costs a turn, and turns are capped per day.
- Every in-app write is **Member-confirmed** — a human saw the exact rows. A daily total would only ever bite a legitimate bulk recategorise.
- What the chat cap does **not** bound is the **blast radius of a single confirmation** — one turn could propose "recategorise all 500 expenses", one card, one tap.

So P6-S7 adds **`max_proposed_writes_per_turn`** (default 25): the `propose` node caps the card and tells the model to propose the rest in a follow-up (a second card). It is a **local check** — no Langfuse counting, nothing to keep fail-open. The `daily_write_cap` config key and the unwired `daily_receipt_cap` are removed from `config.py` (receipt caps, if wanted, are P7-S1's call). The connector's Frappe-side `CONNECTOR_DAILY_WRITE_CAP` is **unrelated and unchanged** — it backstops *unreviewed* external-connector writes, which never reach Langfuse.

Recorded in place: pre-code, refining "Capabilities and the confirm step" and reversing the write leg of the "Cost bounds" daily-cap list.

---

**Update (2026-09-11, P7-S1 grill): receipts — image transport, keeping the photo out of the checkpointer, and where the accuracy score lands.**

- **Transport.** `ChatIn` gains an optional `image` field: a `data:image/jpeg;base64,…` data URI, sent alongside `message` in the same JSON body `/chat` already takes. No multipart, no CORS change (`Authorization`/`Content-Type` already allowed). The frontend always re-encodes client-side via `<canvas>` before sending — decode whatever the file picker/camera hands it (HEIC included), downscale to a capped long edge, export as JPEG — so the service only ever accepts one mime type and needs only a payload-size backstop, not a format whitelist. One photo per turn in v1; attaching a new one replaces any not-yet-sent pick.
- **Never touches checkpointed state.** `stream_turn` cannot put the image inside the `HumanMessage` it hands to `graph.astream_events` — anything in `inputs["messages"]` is merged into `state["messages"]` by the `add_messages` reducer and lands in Postgres. Instead the image rides in `config["configurable"]["receipt_image"]` — the same per-run `config` dict that already carries `today`, never checkpointed. `agent_node` reads it and builds a **transient** message list for `model_with_tools.ainvoke(...)` — the last `HumanMessage` gets a multimodal copy (text + image block) for that call only; the node still returns `{"messages": [reply]}`, so only the model's reply (text) is ever persisted. Consequence accepted: since each `agent_node` call is a stateless model call, the image is re-spliced on **every** loop iteration within the turn (e.g. if the agent reads `list_categories` before proposing), not just the first — bounded by the existing `run_max_tool_calls` / wall-clock caps, not a new unbounded cost.
- **What the thread remembers instead.** The checkpointed `HumanMessage` content is `"[Attached a photo]"`, plus the Member's typed caption if they added one (`"[Attached a photo] lunch with the team"`). This is what `GET /history` replays — never the image.
- **Tagging is by input shape, not outcome.** Any turn whose body carries `image` binds `entry_method="receipt"` (`tools.py`'s docstring already anticipated this) and opens its Langfuse trace with `feature="receipt"`, decided before the graph runs — a non-receipt photo (the agent just asks what the Member wants) still traces as `feature="receipt"` with no proposal resulting. Receipt turns count against the existing `daily_chat_cap` (both `feature="chat"` and `feature="receipt"` traces) rather than a new `daily_receipt_cap` — P6-S7 had left this cap unwired and explicitly deferred the decision to this streak. Vision runs on the same `settings.openai_model` (`gpt-4o-mini`, already vision-capable and priced) — no per-feature model routing.
- **Feedback while the vision call thinks.** A tool call gets a `step` line from `on_tool_start`; the vision call is just the model itself taking longer, with no event to hang a line on. `session.py` emits a synthetic `sse("step", {"text": "Reading the receipt…"})` itself, directly, the moment it sees `body.image` — before driving the graph at all.
- **Confirm-card editing, generalized.** ADR 0003's "kept = the values the Member confirms in the chat confirm card, **after any inline edits**" already assumed editing existed; it didn't. `ConfirmCard.vue` gets always-editable inline inputs (amount/date/category/notes) for **any `kind: "create"` action**, not receipt-specific — the component has no reason to know an action's origin, and a manually-typed "add this expense" proposal benefits identically. Updates/deletes stay checkbox-only. The resume decision shape grows from `{selected}` to `{selected, edits: {actionId: {field: value}}}` — `edits` sparse and optional, so an old client that never sends it behaves exactly as before. `propose.py`'s `_apply` merges `edits[action["id"]]` into `call_args` before calling the write tool, for approved actions only.
- **Entry method is captured per-action, at proposal time, not at resume-bind time.** `resume_turn` unconditionally binds `entry_method="assistant"` (P6-S7) — wrong for a receipt-sourced write, and `propose.py` has no other way to tell a receipt `create_expense` apart from an ordinary one once it's resuming on a fresh request. `_build_action` now reads `tool_defs._entry_method.get()` at the moment the card is built (during the *original* `/chat` call, when it genuinely is `"receipt"`) and stores it on the action — a checkpointed string, not the image, so it survives the interrupt boundary same as `if_modified_since` does. `_apply` binds entry_method per-action from that captured value instead of trusting the caller's blanket bind.
- **The accuracy score lands on the resume trace, not the original.** Revisits this ADR's framing above ("posts `receipt_accuracy_*` scores on the receipt trace") — the comparison that *is* the accuracy signal only exists at the moment of confirm/edit, which happens during `/resume`'s own SSE leg and its own trace, not the `/chat` leg that ran the vision call. Threading the original trace's id through checkpointed state just to score it there would be plumbing in service of a distinction the metric doesn't need: an unedited confirm (`receipt_accuracy_* = 1` for every non-null proposed field) and an edited one (`0` for the changed field) are both *decided* at resume time, so `propose.py`'s `_apply` posts the scores directly on `resume_turn`'s own `TurnTrace`, gated on `action["entry_method"] == "receipt"` and `action["tool"] == "create_expense"`, and only for approved actions (a rejected proposal gets no scores — the trace still has cost/latency). ADR 0003's metric definition is otherwise unchanged: compare the originally-proposed value to the final `call_args` value (post-edit-merge, i.e. what the Member confirmed) per field; a `null` proposed value is excluded from scoring entirely; `notes` uses the same exact-string comparison as the structured fields.

Recorded in place: pre-code, extending "Capabilities and the confirm step" (payload/decision shapes, editing) and "Accounting across the interrupt" (`entry_method` binding), and correcting where this ADR said the accuracy score would live.

---

**Update (2026-09-11, P7-S2 grill): proactive runs never propose, budget-drift has no dedup, and the execution model.**

Building P7-S2 (proactive Insights), the "Proactive Insights" section's "pending proposal" and "last warned marker" framing didn't survive contact with the write-confirmation mechanics P6-S7 actually built, and got simplified rather than implemented as originally sketched.

- **Why "pending proposal from a proactive run" doesn't work as originally framed.** `route()` sends a message to `propose` only when the model *emits* a tool-call named in `WRITE_TOOL_NAMES` — and OpenAI-style function calling means the model can only emit a call for a tool it was actually bound. If a proactive run binds `READ_TOOLS` only (as `graph.py`'s docstring already specified, pre-dating this streak), the model is structurally incapable of producing a write tool-call, so it can never reach `propose` — there is no code path left for a proactive run to raise a confirm-card interrupt. The alternative (bind the real `WRITE_TOOLS` to a scheduled run too, relying on `interrupt()` alone to block execution) was considered and rejected: `interrupt()` stops *execution*, but a hallucinated write tool-call would still park a confirm card in the Member's thread with no request from them that turn to scope it — worse than a bad Insight message, since a stray card invites an inattentive tap-to-confirm on something nobody asked for. **v1 proactive runs bind `READ_TOOLS` only, full stop, for both jobs — no proposal mechanism at all.** If an Insight suggests an action ("raise your Dining budget?"), the Member has to ask for it in an ordinary chat turn, which already has the full propose/confirm flow.
- **Why there is no dedup marker.** The "last warned" marker was going to be either a new Postgres table (new schema, a new data-access module, and a marker whose lifecycle is disconnected from anything else) or a field piggybacked onto `AgentState` (no new schema, but "Clear chat" — which calls `checkpointer.adelete_thread()` — would then also silently reset the drift-warning history, so a Member clearing their chat to start fresh would unknowingly cause next week's job to re-warn about a Category it had already flagged once). Weighed against the actual cost of skipping dedup — a Category that stays over budget gets the same Insight every week until it isn't — re-warning won by simplicity: `run_budget_drift` re-evaluates `compute_budget_status` fresh every run and warns on whatever's currently `Warning`/`Exceeded`, with no memory of prior runs at all.
- **`run_budget_drift`'s pre-check is deterministic, not model-judged, and gates whether the model runs at all.** Before invoking the graph, the background task calls `get_analytics` for the current month (a plain Frappe REST read, not an LLM call) and checks the `budget_status` field it already returns (`expenso_budget.py::compute_budget_status` — reused, not reimplemented). If nothing is `Warning`/`Exceeded`, the run stops there: no graph invocation, no Insight, no Langfuse trace, no LLM cost. Only when something crosses the threshold does the read-only graph run, given an instruction naming which Categories triggered so it composes the actual wording. `run_monthly_summary` has no such gate — it always invokes the graph, since a monthly summary is worth sending even when the month was quiet.
- **`POST /run/proactive` is fire-and-forget.** The endpoint validates the member/job and returns `202` immediately; the graph run itself happens as a background task on the service. This decouples Frappe's HTTP call (which can use a short timeout) from `run_wall_clock_seconds` (90s), and means one Member's slow run in a scheduler tick's loop never stacks up delay for the next Member. A run's failure is visible only in the service's own logs/Langfuse trace, not back to the Frappe job — acceptable for a non-critical job that just tries again next week/month.
- **A pending unconfirmed proposal on the thread gets discarded by a proactive run, same as a new live message would.** `stream_turn` already has `_discard_pending` for "the thread is linear, a new message means the Member moved on" (P6-S7). A proactive run reuses the same rule rather than adding a new branch: if the Member has an uncomfirmed card sitting there when their job fires, it's dropped and the run proceeds normally. Considered and rejected: skipping that Member's run entirely rather than touching their pending card — rejected for consistency (the live-chat rule is already "the thread is linear," and since proactive runs never produce their own proposals, there's no risk of a proactive run's *own* output being what gets silently discarded next).
- **Insight messages are tagged, not indistinguishable from ordinary replies.** An Insight appears in the transcript with no preceding question from the Member, which would otherwise read as a non-sequitur. The AIMessage the proactive job appends carries `additional_kwargs={"kind": "insight", "posted_at": <iso timestamp>}`; `session.py::history()` passes `kind`/`posted_at` through when present (sparse and optional, same pattern as P7-S1's `edits`), and `Assistant.vue` renders a small "💡 Insight" label for a tagged message.
- **The unread badge is discovered on app-shell mount only, not polled.** `BottomNav.vue` (mounted for the whole app, all screens) calls `fetchHistory()` once when it mounts, refreshing `newestAssistantId` without calling `markAllSeen()` — so the badge can light up for a Member who wasn't on the Assistant tab when a job fired overnight, as long as they reload or re-enter the app afterward. No polling interval: matches the GLOSSARY Realtime rule (no push notifications, no background refresh) already governing the Feed's own update model, and avoids a recurring `GET /history` call per open tab for a nudge that is not time-critical.
- **`Langfuse` `metadata.feature` gains `"insights"`**, alongside the existing `"chat"`/`"receipt"` (ADR 0008's earlier text already anticipated this value). Proactive runs are **not** counted against `daily_chat_cap` — volume is inherently tiny (at most two LLM calls per Member per week: one monthly, one weekly, and `run_budget_drift`'s pre-check already skips the LLM call entirely most weeks), so a separate cap isn't worth the config surface.
- **The scheduler trigger stays in Frappe** (`hooks.py` `scheduler_events`, already wired in P6-S2) — reaffirmed, not reversed, but worth recording why it was reconsidered and kept: moving the cron into the assistant service would require the service to mint tokens for arbitrary Members without them being logged in, which needs a new privileged Frappe endpoint that lets an external caller impersonate any Member for token-minting, guarded by a static service credential — a new trust boundary that doesn't exist anywhere else in this architecture. Frappe already has a working scheduler and already owns the Family Member data the "one run per Member" loop needs; there's no locality win to moving the trigger that offsets adding an impersonation credential.

Recorded in place: pre-code, correcting the "Proactive Insights" section's original "pending proposal" / "last warned marker" framing to what actually shipped, and settling the `/run/proactive` execution model and badge-discovery mechanism that section left unspecified.

---

**Update (2026-09-11, chat-history grill): a token-count window bounds what's sent to the model, not what's persisted.**

Each Member's thread (**Chat**, GLOSSARY) is documented as "one continuous, ever-growing thread" with no automatic bound — the only reset is the Member's own "Clear chat". `agent_node` (`graph.py`) resends `state["messages"]` in full to the Chat Completions API on every turn (no OpenAI Responses/conversation-state API is used, so nothing is remembered API-side between calls), and nothing trims it. For a Member who never clears chat, the marginal cost of each new turn rises without limit for the life of the thread — the actual concern, not the model's context-window ceiling, which a cost-bounding fix resolves as a corollary rather than something to design for separately.

- **Windowed by token count, not message count.** Message sizes vary too much here — a `get_expenses`/`get_analytics` tool result carrying a month of rows dwarfs a one-word confirmation — so a message-count window bounds shape, not cost. A token-count window (`trim_messages(max_tokens=..., token_counter=...)`, counted via the model's own tokenizer) bounds the thing actually being managed.
- **Transient, applied per call — the checkpoint is never pruned.** The window is computed fresh in `agent_node` immediately before `model_with_tools.ainvoke(...)`, the same shape as the existing `_with_receipt_image` / `_with_proactive_instruction` transient transforms in that function: built from `state["messages"]`, never returned from the node, so it never reaches the checkpoint. This was the deciding trade-off against pruning the checkpoint itself (`RemoveMessage`): pruning would shrink what `GET /history` replays, silently taking history away from a Member who never asked to clear anything — a materially bigger behavior change than "the model just stops seeing that far back," and one that contradicts the GLOSSARY's "ever-growing thread" wording. A transient window changes nothing the Member can see; it is a backend cost control only.
- **Summarization was considered and rejected.** Compressing older turns into a running summary preserves more than a hard cutoff, but costs an extra LLM call to maintain (real added spend and complexity to solve a spend problem) and introduces a new failure mode — a summary that quietly drifts wrong misleads every later turn with nothing to catch it. A window is one deterministic cut, no extra model call. The lost context is also cheaper here than in agents with no other source of truth: Expenso's tools re-read the ledger fresh every turn (`get_expenses`/`get_analytics`/etc.), so the model isn't relying on old turns for ledger facts, only for conversational continuity.
- **Applies to both interactive chat and proactive runs for free.** `agent_node` is the one node both `build_graph` call sites share (interactive binds `tools=` the full set, proactive binds `tools=READ_TOOLS`) — a window added there needs no separate wiring for `proactive.py`'s runs.
- **Must not strand a tool call from its result.** OpenAI's Chat Completions API requires an `AIMessage` with `tool_calls` to be immediately followed by its matching `ToolMessage`(s); the cut point can't split that pair. `trim_messages` already trims pairing-aware, so this is a constraint to rely on, not a new problem to solve.
- **Budget: 20,000 tokens**, picked generously rather than tightly. At `gpt-4o-mini` pricing ($0.15/1M input, $0.075/1M cached) even an unbounded 50k-token prefix costs a fraction of a cent per call — the goal is a flat, knowable cost trend over a thread's life, not trimming today's already-negligible per-call spend. 20k tokens is weeks of typical usage before anything drops, with comfortable headroom under the 128k context window even with a tool-heavy turn stacked on top. Lives as a new `Settings` field in `config.py` alongside `daily_chat_cap` / `run_max_tool_calls`, not a hardcoded constant in `graph.py`.

Recorded in place: pre-code, a new bound alongside "Cost bounds" and the **Chat** GLOSSARY entry, neither of which currently mention it.

---

**Update (2026-09-11, cost-bounds grill continued): `daily_chat_cap` becomes a token total, not a turn count — `daily_token_cap`, backed by a local counter, not a Langfuse query.**

Following straight on from the window above: a turn-count cap treats every turn as equal cost, which it isn't. Two gaps this misses on its own: a Member can post an arbitrarily long message (uncapped input text, independent of the window, which only bounds resent *history*), and a receipt turn's actual vision cost varies with image resolution far more than with the byte-size backstop (`max_receipt_image_chars`, P7-S1) that gates it today. Patching each individually (a message-length cap, then a resolution check for images) is a growing pile of partial-coverage proxies for the one thing that actually matters: cumulative dollar cost per Member per day.

- **`daily_chat_cap` (turn count, `observability.py::within_daily_chat_cap`) is replaced by `daily_token_cap` (input+output tokens, per Member, per local day).** A precise total covers every cost driver at once — a long message, a tool-heavy turn, an expensive vision call — with no per-dimension proxy needed. This also makes the image byte-size-vs-resolution gap (this ADR's prior update, "leave it") moot: actual vision cost lands in the same tally regardless of what drove it, so no separate resolution check is needed after all.
- **The count comes from the call's own response, not a Langfuse read-back.** `CostCallback.on_llm_end` (`observability.py:142`) already computes `usage["input_tokens"]`/`usage["output_tokens"]` from every call's `usage_metadata` before it ever reaches Langfuse — that's the same number, already available, at the moment it's needed. The cap becomes: increment a running per-Member-per-day total right there in `on_llm_end`, and read it back locally at turn-start — no `fetch_traces`/`fetch_observations` call against Langfuse in the check at all, which is what made switching the unit rejected as too costly earlier in this same session before this was noticed.
- **Backed by a small counter table in the LangGraph checkpointer's Postgres** (`config.py:91`: "LangGraph checkpointer + Langfuse share this Postgres") — not a new datastore, a new table in the one already provisioned and already connected from this exact code path. Keyed by `user_id` + local date, reset by simply not existing for a new day (no cron cleanup needed if old rows are left to age out or a trivial periodic delete is added later).
- **Does not violate "Langfuse is the *only* record of every LLM call."** That principle (this ADR's "Persistence boundary" / the 2026-09-10 update rejecting `LLM Call Log`) is about not duplicating *call history* — per-call detail, audit trail, anything Desk could list and jump from. A same-day, increment-only numeric total with no per-call detail is a gating aggregate, not a record of a call; nothing about it is queryable per-call or persists past the day. Worth stating explicitly here so a future reader doesn't read the counter table as a reversal of that decision.
- **Fail-open gets simpler, not harder.** The old cap failed open if Langfuse was unreachable, with the per-run caps as the backstop. The new cap's storage (Postgres) is already a hard dependency for the turn to run at all — the checkpointer needs it first — so there is no new failure mode to design for: if Postgres is down, the turn never gets far enough for the cap check to matter.
- **The message-length cap stays, as a secondary bound, not the load-bearing one.** Even with a precise daily total, one very long message could still consume the whole day's budget in a single turn — worse UX than being throttled gradually across several. A generous max length (~4,000 characters) on `ChatIn.message`, enforced with a plain Pydantic `max_length` (no Langfuse or Postgres involved, a local check before the turn starts), keeps that from happening without being the thing that actually bounds cost.
- **Budget: 500,000 tokens/Member/day.** At `gpt-4o-mini` rates this is at most ~$0.08–0.30/Member/day depending on cache mix (this ADR's earlier "Cost bounds" section already treats the OpenAI-account monthly cap as the real money backstop) — generous headroom for real usage, a precise and enforceable ceiling instead of an approximate one.

Recorded in place: pre-code, revising "Cost bounds" — supersedes that section's "Per-Member daily caps (chat / receipt / write) are computed from Langfuse" for the chat/receipt case specifically; the write cap (`max_proposed_writes_per_turn`, P6-S7) is unaffected.
