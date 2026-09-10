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

Scheduled runs get a **read-only toolset** — the write tools are not bound when the trigger is the scheduler. There is no confirm card when no human is present, so there must be no unattended mutation. Output is an **Insight** message in the Member's thread; a wanted action becomes a **pending proposal** — the same confirm card, queued for the Member's next visit.

One run per Member (threads are private per-Member). v1 jobs, the first `scheduler_events` in `hooks.py`: a **monthly summary** (1st of the month, covering the month just ended) and a **budget-drift check** (weekly, current month, deduped against a "last warned" marker). Insights land as thread messages; the chat bubble carries an **unread badge** as the nudge — no push notifications (the GLOSSARY Realtime rule holds).

Both jobs are scheduled **off-hours** (e.g. early-morning cron), deliberately: a proactive run is a multi-step graph that can occupy the event loop for tens of seconds, and the single `app` process (one FastMCP server + agent, per the stack above) also serves the live chat SSE streams. Off-hours scheduling is the mitigation — at two Members the odds of a proactive run overlapping a live chat turn are already low, and the schedule removes them. If proactive volume ever grows, move these to a separate worker rather than relaxing the timing.

### Persistence boundary

- **Conversation threads** live in the **LangGraph checkpointer's Postgres**, outright. There is **no `Chat Message` DocType** — this reverses ADR 0004's persistence model. The frontend reads history and streams from the service. "Clear chat" deletes the LangGraph thread.
- **Full step traces** live in **Langfuse only** (retention ~30–60 days). There is no `Chat Run` / `Assistant Run` DocType.
- **Every LLM call is recorded only as a Langfuse trace** — tagged with the Member (`user_id`), Family, `feature`, and thread, with cost attached explicitly. **There is no `LLM Call Log` DocType and Frappe stores nothing about the Assistant** (this reverses an earlier version of this bullet — see the 2026-09-10 update). Admin cost/latency visibility is the Langfuse dashboards; receipt-accuracy is a Langfuse score.
- **Receipt images are never stored** — not on the Expense, not in the thread, no Frappe `File`. The image is transient in the browser/run state during the session and discarded after processing; the thread keeps a text marker.

### Observability

**Langfuse v2, self-hosted, Postgres-only** (as `contract-intelligence` runs it), loopback-bound and browsed via SSH tunnel. This reverses ADR 0003's "no third-party observability" **for the self-hosted case only** — the data stays on our infra and the UI is never publicly exposed. Hosted-SaaS observability (LangSmith, Helicone proxy) stays rejected for the data-residency reason ADR 0003 gave.

Langfuse is not just the trace viewer — it is the **only** record of every LLM call (there is no `LLM Call Log`; see the 2026-09-10 update). Every trace is tagged `user_id` = Member / `metadata.family` / `metadata.feature` / `session_id` = thread, with the generation cost set explicitly from the `config.py` pricing constant. Admin cost/latency/token dashboards, per-Member daily-cap counts, and receipt-accuracy scores all read from this.

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
- **Langfuse is the sole record of every call.** Each trace the service emits carries `user_id` = the Member, `metadata.family`, `metadata.feature` (`chat` / `receipt` / `insights`), `session_id` = the thread id, and **cost attached explicitly on the generation** from the `config.py` pricing constant — not Langfuse's built-in model-price table. This tagging is a P6-S5 requirement.
  - The OpenAI API returns **token counts, not a cost** — `prompt_tokens` / `completion_tokens` plus `prompt_tokens_details.cached_tokens` and `completion_tokens_details.reasoning_tokens`. The service computes cost itself, so the `config.py` "pricing constant" is a small per-model rate table — `{input, cached_input, output}` per 1M tokens — with cached input billed at its discounted rate and reasoning tokens billed as output. A model swap is one reviewed commit to that table (the ADR 0003 audit-trail-via-code-diff reasoning).
- **Admin cost/latency/token visibility is the Langfuse dashboards.** No Frappe Number Cards, no Script Reports. `#68` / `#72` are dropped; standing up the saved Langfuse views folds into P6-S5.
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
