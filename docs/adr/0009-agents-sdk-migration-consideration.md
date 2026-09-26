# Considering a move from LangGraph to the OpenAI Agents SDK

**Status: rejected (2026-09-26) — superseded by [ADR 0010](0010-langchain-v1-create-agent-consideration.md).** The Assistant stays on LangGraph and moved to stock LangChain v1 `create_agent` middleware instead. The OpenAI Agents SDK is an alternative agent framework, not an add-on, so adopting it would mean a second framework for the same job. The `openai` API client stays, used by `langchain-openai`. Written from a grill-style debate session, 2026-09-12. This is not a reversal of [ADR 0008](0008-in-app-assistant-architecture.md); it records the pros/cons surfaced while debating whether Phase 6/7's shipped LangGraph implementation should move to the OpenAI Agents SDK, and whether that move would also justify folding the Assistant into Frappe (dropping the standalone `expenso-assistant` service).

## Context

ADR 0008 chose LangGraph specifically because "write actions, multi-step workflows, and durable human-in-the-loop pause/resume are real complexity the checkpointer + `interrupt` model handles directly." Two of LangGraph's properties were treated as fixed costs of that choice:

1. Its maintained checkpointers require **Postgres** (or SQLite for non-production use) — no MariaDB backend exists.
2. It runs as an **async** state graph, which doesn't fit inside Frappe's request/response cycle — one of the standing reasons the Assistant lives in its own service.

This session re-examined both assumptions against the OpenAI **Agents SDK** (`openai-agents`, open-source, distinct from the OpenAI-hosted **Agents API** covered below) and against Frappe's own long-running-job mechanism.

## What we verified

**The Agents SDK does not require Postgres.** Its default session backend is `SQLiteSession` (file-based or in-memory, no external database). Its production option, `SQLAlchemySession`, works against "any SQLAlchemy-supported database" — including MySQL/MariaDB dialects, i.e. it could point at Frappe's own database (new tables, no new database server) instead of a dedicated Postgres instance.

**The Agents SDK has a native confirm-gate primitive.** `needs_approval` on a tool pauses the run; pending calls surface in `result.interruptions`; the caller batches them and resumes via `state.approve(...)` / `state.reject(...)` per call. This is a close structural match for the `propose` node / `interrupt()` / `Command(resume=...)` flow P6-S7 built — selective per-action approve/reject, not all-or-nothing — without hand-rolling that plumbing.

**Frappe is permanently WSGI, not ASGI** — confirmed against current docs/community sources, not just prior assumption. Frappe's ORM and DB layer are synchronous throughout; running Frappe behind an ASGI server wouldn't change that. But Frappe already has an idiomatic answer for long-running, streamed-progress work: `frappe.enqueue` onto an RQ background worker (its own OS process, free to run `asyncio.run(...)` internally), streaming progress back via `frappe.publish_realtime` → Redis pub/sub → Frappe's existing Node.js Socket.IO process → the browser's `frappe.realtime.on(...)` listener. This is the same mechanism Frappe uses for imports, reports, and progress bars — not a new pattern for this codebase to invent.

**The OpenAI-hosted "Agents API" (a separate product from the Agents SDK) is not a fit and should be ruled out.** It's built for autonomous coding/task-execution agents ("execute code, edit files, connect to MCP servers, produce artifacts" — bug repro, SQL analysis, GitHub issue triage), not a confirm-gated conversational assistant over a REST ledger. No approval/pause-before-execution mechanism is documented. Most decisively: "the Agents API currently supports data residency only in the United States and **does not support Zero Data Retention (ZDR)**" — session/conversation state itself would live on OpenAI's servers with no opt-out, a harder residency posture than even hosted LangSmith. Pricing is pass-through model rates plus standard tool/sandbox rates — not itself the blocker, but moot given the fit and residency issues. **This product is out of scope for Expenso; only the open-source Agents SDK is being considered.**

## Two separable questions

These got conflated in conversation and are worth keeping apart:

- **(A) Framework:** LangGraph vs. OpenAI Agents SDK — orthogonal to where the code runs.
- **(B) Deployment:** standalone `expenso-assistant` service vs. folded into the `expenso` Frappe app.

Moving to the Agents SDK removes two of the three objections ADR 0008 (and this session) raised against folding in (B): the Postgres requirement, and the confirm-gate mechanism. It does not remove the third: Frappe's dependency-pin exposure to a fast-moving package (the exact class of problem that produced the `frappe-mcp` pin/spec-lag issues #86/#88/#89 that ADR 0008 closed by moving the agent out of Frappe in the first place).

## Pros of moving to the Agents SDK

- **Drops the hard Postgres dependency for conversation state.** `SQLAlchemySession` against MariaDB (whether that's Frappe's own DB or a separate one) removes the need for a Postgres server dedicated to checkpointing — real infra simplification regardless of (A)/(B).
- **Confirm-gate is a supported primitive, not hand-rolled.** `needs_approval` / `result.interruptions` / `state.approve()`/`reject()` covers the same batched, selective-approval shape the `propose` node currently implements manually against LangGraph's lower-level `interrupt()`.
- **Matches what's already shipped.** ADR 0008 ships OpenAI-only in v1 and explicitly treats LangChain's model-swap abstraction as "cheap insurance," not something exercised at runtime — so leaving the LangChain layer costs nothing you're actually using today.
- **Official, maintained, purpose-built** for this exact "single-provider tool-calling agent with human approval" shape, versus LangGraph's more general graph model, which this codebase uses in a fairly linear way (`agent` → `route` → `tools`/`propose` → back to `agent`).
- **Enables (B) if you want it.** If folding into Frappe is a goal independent of this framework question, the Agents SDK is the piece that makes it viable at all (see Frappe-async findings above) — LangGraph's Postgres requirement made (B) a non-starter on its own.
- **A fourth observability option.** The Agents SDK has built-in tracing to the OpenAI dashboard, alongside the already-considered self-hosted Langfuse and hosted LangSmith — not evaluated in depth this session, but worth a line item before any migration.

## Cons / risks of moving to the Agents SDK

- **Locks in OpenAI as the model provider, fully.** ADR 0008 kept LangChain specifically as "cheap provider-swap insurance." Moving to the Agents SDK removes that option outright rather than leaving it merely unused — a real (if currently uncosted) loss of optionality.
- **Unverified durability for your actual usage pattern.** ADR 0008's "Token lifetime vs. long confirm waits" note and P6-S7's shipped behavior mean a confirm card or resumed thread must survive **days**, backed by Postgres-durable LangGraph checkpoints today. Whether `SQLAlchemySession`'s interruption/session state gives the same durability guarantee across process restarts over that timeframe has not been verified — this needs to be checked before committing, not assumed from "it uses a real database."
- **This is a rewrite of shipped, tested functionality, not a greenfield choice.** Per project history, P6-S5 through P7-S2 (agent core, Assistant tab, agent writes, receipts, proactive Insights) are implemented, tested, and pushed. Migrating frameworks means re-implementing and re-testing: the `propose`/`route` graph shape, `tools.py`'s binding into two consumers, the token-window trim (20k budget, pairing-aware, per the chat-history grill update), the per-Member daily token cap counter, receipt image transient-injection (`config["configurable"]["receipt_image"]`, never checkpointed), and the proactive `READ_TOOLS`-only binding guarantee. None of this is exotic, but it is a full streak (or several) of migration work against a system that already works.
- **Speculative benefit vs. concrete cost.** No user-facing problem is driving this — the motivation is architectural (Postgres footprint, dependency isolation options), not a bug or a blocked feature. That's a legitimate reason to consider it, but it should be weighed as "infra cleanup" against real regression risk, not treated as free.
- **If paired with folding into Frappe (B):** still requires the SSE→Socket.IO frontend rewrite (`useAssistant.js`) and RQ `long`-queue capacity planning described above — bounded, known-shape work, but real work, and separate from the framework migration itself.
- **Dependency-pin risk shrinks but doesn't vanish if folded in.** `openai-agents` is still a non-Frappe package added to the bench's Python environment; smaller surface than the full LangGraph+LangChain+langchain-openai stack, but not zero, and still a package whose release cadence Frappe upgrades would need to tolerate.

## Options on the table

| | Framework: LangGraph (current) | Framework: Agents SDK |
|---|---|---|
| **Deployment: standalone service (current)** | Status quo. Shipped, tested, working. | Removes Postgres-for-checkpointer if desired; keeps dependency isolation from Frappe; still a rewrite of shipped code for infra-only gain. |
| **Deployment: folded into Frappe** | Not viable — no MariaDB checkpointer exists; would require building and maintaining a custom `BaseCheckpointSaver`. | Viable: `SQLAlchemySession` against Frappe's DB or a lighter dedicated one, RQ+Socket.IO for the async/streaming path, native confirm-gate. Requires both the framework migration *and* the frontend/streaming rewrite. |

## Open questions before any decision

1. Does `SQLAlchemySession`'s durability actually match what a multi-day-pending confirm card / long-idle thread needs — verify against the Agents SDK docs/source, not assumed.
2. What does the Agents SDK offer for the specific caps this system already enforces (`recursion_limit`, max-tool-calls, wall-clock, per-Member daily token total) — are these built in, or hand-rolled again on the new framework?
3. Is there a clean equivalent to LangGraph's `add_messages`/`trim_messages` pairing-aware token-window trim, given the OpenAI tool-call/tool-result pairing constraint still applies?
4. If (B) is pursued, does `frappe.publish_realtime`'s Redis pub/sub path add latency/complexity that changes the "feels like a live chat" UX bar the SSE implementation currently meets?
5. Is the OpenAI-only lock-in acceptable now that it would be irreversible-by-default rather than merely unexercised?

## Recommendation (non-binding)

Given Phase 6/7 is fully shipped on LangGraph, this reads as a deliberate, scoped migration streak to plan for later — not something to start opportunistically. If the real goal is dropping the second container stack (folding into Frappe), the Agents SDK is the enabling piece that makes that concretely viable for the first time; if the goal is purely "simpler framework," the cost (full re-test of a working system) likely outweighs the benefit today. Revisit if a new streak's requirements (e.g., a second LLM provider, or genuine pressure to consolidate infra) tips the balance.
