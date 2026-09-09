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

The **FastMCP server** defines the tool set once. It is consumed both by the co-located LangGraph agent (via `langchain[mcp]`, currently beta) and by external Claude/ChatGPT connectors. This replaces the in-process `frappe-mcp` server (`expenso/mcp.py`), which is deleted along with its dependency — closing the `frappe-mcp` pin/spec-lag issues (#86/#88/#89).

The MCP tools call **back into Frappe's REST API as the Member** — the caller's bearer token is passed through, `validate_oauth()` → `frappe.set_user()` runs unchanged, and every existing `permission_query_conditions` / `has_permission` hook applies. **No new Frappe auth code.** Family-scoping is still free; the agent still has no path to construct its own query (ADR 0004's argument survives).

### Auth

Frappe stays the OAuth **authorization server**; the service is a **resource server**.

- **Interactive:** the logged-in frontend calls a light whitelisted mint endpoint (`expenso.assistant.auth.mint_assistant_token` — session-authenticated, creates a short-lived `OAuth Bearer Token` row for `frappe.session.user`, the shape `test_mcp.py::_make_bearer_token` already uses), scoped `expenso:read` always and `expenso:write` for the confirm-gated tools. The token is passed to the service and passed through to the MCP tools.
- **Proactive:** the Frappe scheduler mints a **read-scoped** per-Member token and POSTs the service.
- **External connector:** unchanged OAuth Authorization Code flow, new connector URL.

No shared secrets; no new `auth_hooks`.

### Capabilities and the confirm step

The agent's write tools: `create/update/delete_expense`, `create/update/delete_income`, `add_category`, `add_source`, `set_budget`. It may **recommend** but never execute `rename/delete_category` or `rename/delete_source` — those rewrite the meaning of historical rows or cascade-delete Budgets, and their safety comes from being done on Settings with the whole list in view.

**Every interactive write confirms.** MCP elicitation surfaces as a LangGraph `interrupt`, which the frontend renders as a confirm card — **batched per turn** (one card for the agent's whole proposed action set), showing the **literal row(s)** and a **before→after diff** for updates. The Member confirms the set, deselects rows, or cancels. More than one card per turn only when a later step needs an earlier write's result. This diverges from ADR 0006's "immediate write, no review" — justified because in-app a confirm is one tap, not an app switch.

Confirmed Assistant writes carry **no "unreviewed external write" marker** — the Member reviewed the exact values, so they are indistinguishable from manual entries. A new neutral **`entry_method`** field (`manual` / `assistant` / `connector` / `receipt`) on Expense/Income records provenance, orthogonal to the connector's `is_external_write` flag.

**Disambiguation** ("that coffee expense") is not the LLM's to solve. The agent narrows to candidates via reads; the confirm card shows the real rows and the Member picks the exact target. Ambiguous references → the agent asks in-thread rather than firing a speculative card. A **concurrency guard** on the row `modified` timestamp (a new `if_modified_since` parameter on the `update_*`/`delete_*` whitelisted methods) rejects a stale write and forces a re-read + re-propose.

### Proactive Insights

Scheduled runs get a **read-only toolset** — the write tools are not bound when the trigger is the scheduler. There is no confirm card when no human is present, so there must be no unattended mutation. Output is an **Insight** message in the Member's thread; a wanted action becomes a **pending proposal** — the same confirm card, queued for the Member's next visit.

One run per Member (threads are private per-Member). v1 jobs, the first `scheduler_events` in `hooks.py`: a **monthly summary** (1st of the month, covering the month just ended) and a **budget-drift check** (weekly, current month, deduped against a "last warned" marker). Insights land as thread messages; the chat bubble carries an **unread badge** as the nudge — no push notifications (the GLOSSARY Realtime rule holds).

### Persistence boundary

- **Conversation threads** live in the **LangGraph checkpointer's Postgres**, outright. There is **no `Chat Message` DocType** — this reverses ADR 0004's persistence model. The frontend reads history and streams from the service. "Clear chat" deletes the LangGraph thread.
- **Full step traces** live in **Langfuse only** (retention ~30–60 days). There is no `Chat Run` / `Assistant Run` DocType.
- **`LLM Call Log`** stays a Frappe DocType (System-Manager-only) — one row per LLM call, for ADR 0003's Desk reporting and the Member-facing "usage this month". The service writes rows via a new whitelisted `record_llm_call`. New `langfuse_trace_id` column for the Desk → Langfuse jump. The planned `content` full-trace field is dropped (the trace is in Langfuse).
- **Receipt images are never stored** — not on the Expense, not in the thread, no Frappe `File`. The image is transient in the browser/run state during the session and discarded after processing; the thread keeps a text marker.

### Observability

**Langfuse v2, self-hosted, Postgres-only** (as `contract-intelligence` runs it), loopback-bound and browsed via SSH tunnel. This reverses ADR 0003's "no third-party observability" **for the self-hosted case only** — the data stays on our infra and the UI is never publicly exposed. Hosted-SaaS observability (LangSmith, Helicone proxy) stays rejected for the data-residency reason ADR 0003 gave.

### Cost bounds

Per-run: LangGraph `recursion_limit` + a max-tool-calls cap + a wall-clock cap. Exceeding any → an error to the caller, no partial turn persisted, an `LLM Call Log` row with `status: "error"`. A **monthly spend cap** (sum of this month's `LLM Call Log.cost`, a hardcoded constant in the service) → interactive returns "paused until next month", proactive skips. Per-Member daily caps (chat / receipt / write) enforced in the service by counting today's `LLM Call Log` rows.

### Phase 5 cutover

`frappe-mcp` is replaced outright — `expenso/mcp.py` and the dependency are deleted. Members re-add the connector once with the new URL. The `OAuth Client`, `expenso:read`/`expenso:write` scopes, `Allowed Roles`, and OAuth-enabling patches all carry over unchanged.

## Consequences

- **Chat history leaves Frappe Desk.** Admin conversation debugging happens in Langfuse. The LangGraph Postgres is its own backup target, alongside the Langfuse Postgres.
- **Receipts and the Assistant now require the service to be up**, not just Frappe + an API key. ADR 0002's "extraction failure never blocks manual Expense creation" covers the degraded case.
- **Beta dependencies in the critical path:** `langchain[mcp]` and the MCP-elicitation → LangGraph-`interrupt` bridge. Fallback if the bridge isn't first-class: skip MCP elicitation for the in-app path (the agent raises `interrupt()` from a proposal node directly) and keep elicitation only for the external connector.
- **Langfuse v2 is on a deprecation path.** Pinned; migrate only if it breaks.
- **The production host runs a second container stack** alongside the Frappe bench.
- **"Clear chat" is not a full-deletion guarantee** — `LLM Call Log` rows persist (cost integrity, same reasoning as ADR 0004) and Langfuse traces persist to the retention window.
- **Token lifetime vs. long confirm waits** is an open detail: a minted token can expire while a turn sits on a confirm card or a proposal sits for days. Resolved during implementation (longer resume-leg TTL, refresh, or re-mint-on-resume).
