# Considering a move from the hand-rolled graph to LangChain v1 `create_agent`

**Status: accepted (2026-09-26) — option 1 done; option 2 done with stock middleware, dropping the behaviour stock does not cover.** See [Decision](#decision-2026-09-26) at the end. Written 2026-09-25 after comparing `expenso-assistant` with the LangChain Academy course repo (`lca-lc-foundations`, "Introduction to LangChain – Python"). This is not a reversal of [ADR 0008](0008-in-app-assistant-architecture.md). It stays on LangGraph + LangChain, so it is a smaller question than [ADR 0009](0009-agents-sdk-migration-consideration.md) (a framework change).

## Context

The trigger was the concern that `expenso-assistant` uses old LangChain packages compared with the course. The course builds every agent with `langchain.agents.create_agent` plus middleware (`HumanInTheLoopMiddleware`, `SummarizationMiddleware`, `@dynamic_prompt`, `@wrap_model_call`, `@before_agent`), `context_schema` + `ToolRuntime`, and `@tool`. `expenso-assistant` uses a hand-rolled `StateGraph` (`agent/graph.py`) and a custom `propose` node with `interrupt()` (`agent/propose.py`).

## What we verified

**The package versions are not old.** `pyproject.toml` has stale floors (`langgraph>=0.2`, `langchain-core>=0.3`, `langchain-openai>=0.2`), so it looks old. But `uv.lock` resolves to newer versions than the course uses:

| Package | expenso-assistant (lock) | course (lock) |
|---|---|---|
| langgraph | 1.2.11 | 1.2.10 |
| langchain-core | 1.6.2 | 1.5.3 |
| langchain-openai | 1.6.2 | 1.4.1 |
| langchain (v1 meta-package) | not installed | 1.3.14 |

Two items are genuinely old:

- **`langfuse>=2.50,<3`** (v2 SDK). It is pinned on purpose to match the self-hosted `langfuse/langfuse:2` server (see the `agent/observability.py` docstring and expenso-assistant#4).
- **The floors in `pyproject.toml`.** They do not match what actually runs.

**The real difference is the pattern, not the versions.**

| Concern | expenso-assistant now | LangChain v1 equivalent |
|---|---|---|
| Agent loop | Hand-rolled `StateGraph` (`agent/graph.py`) | `create_agent` |
| Tool-call cap | `tool_call_count` in state + `ToolCapExceeded` | `ToolCallLimitMiddleware` |
| History window | `_windowed()` via `trim_messages`, transient, checkpoint untouched | `@before_model` / `wrap_model_call`. `SummarizationMiddleware` rewrites history, so it breaks the GLOSSARY promise of a full thread — not suitable. |
| System prompt | `render_system_prompt` inside `agent_node` | `@dynamic_prompt` |
| Receipt image, proactive instruction | `_with_receipt_image`, `_with_proactive_instruction` | `wrap_model_call` + `request.override(messages=...)` |
| Read-only proactive runs | `tools=READ_TOOLS` at build time | `request.override(tools=...)` or a separate agent |
| `today`, `entry_method` | `config["configurable"]` / state field | `context_schema` + `ToolRuntime.context` |
| Write confirmation | Custom `propose_node` + `interrupt()` | `HumanInTheLoopMiddleware` (approve / edit / reject per call) |
| Tools | Plain async functions → `StructuredTool.from_function` | `@tool` |
| Tracing | Self-hosted Langfuse v2, custom `CostCallback` | LangSmith (course default) |
| Serving | FastAPI + SSE (`agent/session.py`) | `langgraph dev` / `langgraph-api` |

**Most course packages do not apply to this service.** `jupyterlab`, `ipywidgets`, `tavily*`, `sounddevice`, `scipy`, `langchain-google-*`, `langchain-anthropic`, `langgraph-cli`/`langgraph-api`, `mcp_server_time` are course or demo dependencies. The service binds tools directly (ADR 0008) and uses FastMCP for its external adapter, so `langchain-mcp-adapters` is also not needed.

## Pros of moving to `create_agent` + middleware

- **Less custom loop code.** The cap, prompt, window and message injection each become one small, named middleware instead of logic inside `agent_node`.
- **Matches current LangChain docs and the course.** New patterns (dynamic tools, typed context, middleware) become easier to add.
- **Typed runtime context.** `context_schema` replaces the `config["configurable"]` dict lookups for `today`, `receipt_image`, `proactive_instruction` and `entry_method`.
- **Built-in middleware later** (model fallback, retries, PII) without graph changes.

## Cons / risks

- **The hard part does not get simpler — if the current card is kept exactly.** *(Corrected 2026-09-26 after reading the `langchain` 1.4.2 source.)* `HumanInTheLoopMiddleware` already batches every write call of one message into one interrupt, gives per-call approve / edit / reject decisions, and takes a `description` callback that sees state. What it does not do: structured `changes` / `values` on the card (the description is a string), the `max_proposed_writes_per_turn` overflow, the "re-read first" nudge, the mixed read/write bounce, injecting the stale-write guard, and receipt-accuracy scoring. Its payload (`action_requests`) and resume shape (`decisions`) also differ, so the frontend card changes.
- **Frontend contract risk.** The Assistant tab sends `Command(resume={"selected": [...], "edits": {...}})` and reads the interrupt payload. The stock HITL shape (`{"decisions": [...]}`) would need a change in both repos.
- **Adds the `langchain` meta-package.** `observability.py` deliberately avoids it. It brings more transitive dependencies into the Docker image.
- **Existing checkpoints.** `create_agent` uses its own state schema and node names (`model`, `tools`). Threads paused on an interrupt in the prod Postgres may not resume after the change. This needs a migration or a "discard pending" step at deploy.
- **Regression cost.** Phases 6–7 are shipped and verified with a real OpenAI + Langfuse e2e pass. Several subtle bugs were fixed in exactly this code (windowing loop on proactive runs, dropped tool history, proactive auth race). A rewrite re-opens that surface.
- **Speculative benefit.** No user-facing problem drives this. The gain is code shape and familiarity, not a bug fix or a blocked feature.
- **LangSmith vs Langfuse is a separate decision.** `create_agent` does not require LangSmith. Moving tracing means hosted data leaves the VPS (see ADR 0008).

## Options on the table

1. **Hygiene only (low risk).** Raise the `pyproject.toml` floors to match `uv.lock` (`langgraph>=1.2`, `langchain-core>=1.6`, `langchain-openai>=1.6`, `langgraph-checkpoint-postgres>=3.1`). No behaviour change.
2. **Move the loop to `create_agent` (medium risk).** Port the cap, prompt, window, image and proactive instruction to middleware. Move `today` / `entry_method` to `context_schema`. Port `propose_node` to a custom middleware that keeps the **same** interrupt payload and resume shape, so the Frappe frontend does not change. Files: `agent/graph.py`, `agent/propose.py`, `agent/session.py` (`pending_card`, `discard_pending`, `_drive` depend on node and task names), `agent/proactive.py`, `tools.py`, `pyproject.toml`, and the `tests/test_agent_*.py` suite plus `tests/fakes.py`.
3. **Langfuse v3 (separate).** Needs an upgrade of the self-hosted Langfuse server (v3 adds ClickHouse, Redis and S3). Evaluate on its own.

## Open questions before any decision

1. Can an `after_model` middleware with `interrupt()` reproduce the `propose` node's "re-runs from the top on resume, so read only from state" guarantee exactly?
2. Do the existing tests pass unchanged against option 2? They are the behaviour contract, so any test that must change is a behaviour change to review.
3. What happens to a thread paused on a confirm card across the deploy — resume, or discard cleanly?
4. Is there a planned feature (second model provider, new middleware need) that would make option 2 pay for itself?

## Spike results (2026-09-26)

Option 1 is done on the `chore/raise-langgraph-floors` branch of `expenso-assistant`. Only the `pyproject.toml` specifiers and the matching `uv.lock` metadata change. The resolved versions do not change. All 99 tests pass.

For option 2, a throwaway spike (`spike/create-agent`, not for merge) built the same agent with `create_agent` (`langchain` 1.4.2) and three custom middleware:

- `TurnGuards`: the tool-call cap (`before_model`) and the counter (`after_model`).
- `ModelCallShaping`: one `wrap_model_call` for the system prompt, token window, receipt image, proactive instruction and Insight tag.
- `ProposeWrites`: `propose_node` as an `after_model` hook.

A switch in `build_graph` ran the unchanged test suite against the spike.

**Answers to the open questions:**

1. **Yes.** An `after_model` hook is its own graph node, so `interrupt()` re-runs it from the top on resume, as before. When the hook appends a `ToolMessage` for every call, the `create_agent` router sends the run back to the model with no `jump_to`. This is the same path that the stock HITL middleware uses. The confirm card and the `{"selected", "edits"}` resume shape did not change, so the frontend does not need a change.
2. **98 of 99 tests pass.** The one failure checks that `build_graph` calls `bind_tools`. `create_agent` binds tools at model-call time, so this test checks the old mechanism, not behaviour. Two other failures were real spike bugs and are fixed:
   - `session.discard_pending` used `as_node="agent"`, a node that no longer exists. `as_node="model"` works. `scripts/dev_inject_insight.py` has the same coupling.
   - **Middleware order changes behaviour.** `after_model` hooks run in reverse list order. With the wrong order, `ProposeWrites` added its ToolMessages first, and `TurnGuards` did not count the write step. The cap then did not stop the run after a confirm. Nothing warns about this. Only `test_tool_call_count_persists_across_the_interrupt` found it.
3. **A card that is open at deploy is lost, and the thread can break.** The new graph has no `propose` node, so the old paused task disappears. `/resume` then returns `nothing_to_resume` (clean, and nothing is written). But `discard_pending` finds pending cards through interrupt tasks, so it does not see this one. The AI message with the unanswered write call stays in the thread. The next turn sends it to the model with no `ToolMessage`. OpenAI rejects this (HTTP 400), so every later turn fails until the member clears the thread. The fake model accepts it, so no test catches this. **Mitigation, required for option 2:** find a stale proposal from state (a last AI message with write calls and no ToolMessages), not from interrupt tasks. Alternatively, run the old `discard_pending` on all threads before the cutover.
4. Not answered by the spike. It is still a product question.

**Other findings:**

- **No less code.** The spike loop is about 130 non-blank lines, compared with about 60 in the old `build_graph`. The small helpers (`_windowed` and the others) stay the same. The logic moves into named classes but does not shrink.
- **The stock `ToolCallLimitMiddleware` does not fit.** It counts individual calls. `run_max_tool_calls` counts tool-call *steps*: one per tools or propose step, and a step can hold several calls. A custom middleware keeps the current behaviour.
- **Read tools now run through `Send`, one task per call.** The observable behaviour and the SSE `step` events did not change in the tests.
- **When a discarded card leaves `state.next` set** (`TurnGuards.after_model`), it is harmless. A new input drops unfinished tasks. But `next` is not empty the way it is after a discard in the old graph.
- Installing `langchain` 1.4.2 raised `langchain-core` from 1.6.2 to 1.6.5.

## Recommendation (non-binding)

Option 1 is ready to merge. Do not do a full rewrite: the spike shows option 2 is feasible with no frontend change, but it gives no less code, and it needs the stale-proposal fix from open question 3 before any deploy. Plan option 2 as a scoped streak only if upcoming Assistant work would benefit from middleware; the current code already runs on LangGraph 1.x and gains little from the move today. Treat option 3 as an infra decision, not part of this one.

## Decision (2026-09-26)

Align with stock LangChain, and drop the Expenso-specific behaviour it does not cover. The dropped behaviour is parked (below), not lost. This overrides the non-binding recommendation above. An earlier version of this decision kept every behaviour in custom middleware; it gave no less code, which is why the goal moved to alignment.

Both repos change and must deploy together (the confirm-card contract changed). Deploy in a downtime window, so no confirm card is open at the cutover.

**Built (`refactor/create-agent` in `expenso-assistant`):**

| Concern | Now |
|---|---|
| Agent loop | `create_agent` |
| Write confirmation | Stock `HumanInTheLoopMiddleware` on every write tool: approve / edit / reject per call. A `description` callback (`agent/describe.py`) writes one line per call, with `field: from → to` when the row was read. |
| Tool-call cap | Stock `ToolCallLimitMiddleware(run_limit=RUN_MAX_TOOL_CALLS, exit_behavior="error")` |
| History bound | Stock `ContextEditingMiddleware` with `ClearToolUsesEdit(trigger=CHAT_HISTORY_TOKEN_BUDGET)`: old tool outputs are cleared from what the model sees; the saved thread is not edited |
| Frappe errors in a tool | Stock `ToolErrorMiddleware`: a `FrappeError` (validation, stale-write conflict) goes back to the model as an error `ToolMessage`, so the rest of a batch still runs |
| Prompt, receipt image, proactive instruction, Insight tag | The one custom middleware, `ModelCallShaping` (`agent/middleware.py`). Stock has no hook for these. |
| Per-run values | Typed `RunContext` (`today`, `receipt_image`, `proactive_instruction`). `entry_method` stays in state; `/resume` binds it from state, so a receipt write keeps `entry_method=receipt`. |
| Receipt-accuracy scores | Computed in `session.resume_turn` from the card and the member's decisions (`observability.score_receipt_accuracy`), not after the write |
| Stale confirm card | `discard_pending` finds it from state (a trailing AI message with unanswered tool calls), not from the paused interrupt |

**Frontend (`expenso`):** `ConfirmCard.vue` renders `action_requests` (the description, and editable args other than the row id) and emits one decision per row: unchecked rejects, a changed field sends `edit` with the full args, otherwise `approve`. Cancel rejects every row.

**Behaviour changes that come free with stock HITL:** after an edit, the model is told the call that actually ran, so it narrates the saved values (before, it could narrate the proposed amount). Reads in a message that also has writes now run after the member decides, instead of the whole message being bounced.

**Parked (dropped behaviour, tracked for later in expenso-assistant#10; the known issue in #9):**

1. **Stale-write guard is model-dependent (known issue).** The service no longer injects the row's `modified` value as `if_modified_since`; the guard holds only when the model passes it. The prompt and the tool docstrings tell it to, and in the live test it did, but nothing enforces it.
2. **Structured card fields.** The card shows a text description, not structured `from → to` fields.
3. **Per-card overflow cap** (`MAX_PROPOSED_WRITES_PER_TURN`, removed). A card can now hold any number of writes.
4. **"Re-read first" nudge.** A write whose row was not read still opens a card; the description flags it as "not in what you've read".
5. **Row-specific outcome text** (expenso-assistant#5). A rejected call now gets the stock rejection message, which names the tool, not the row.
6. **Cap across the confirm pause.** The stock per-run count resets when `/resume` starts a new run, and it counts single calls, not steps.
7. **Hard token budget on chat text.** Context editing clears old tool outputs only. Plain chat text is bounded by the daily token cap and the max message length, not by a history window.

**Deploy notes:**

- `RUN_RECURSION_LIMIT` default is now 100 (a `create_agent` cycle is up to four graph steps). If the production `.env` sets `RUN_RECURSION_LIMIT=50`, change it to 100. `MAX_PROPOSED_WRITES_PER_TURN` is no longer read.
- Adds `langchain>=1.4` (the lock gains only `langchain` and a `langchain-core` bump from 1.6.2 to 1.6.5). `tiktoken` is no longer a direct dependency.
- `scripts/dev_inject_insight.py` (local, untracked) uses `as_node="agent"`; it must change to `as_node="model"`.

**Verified:** 99 service tests pass. The test chat model rejects an unanswered tool call the way OpenAI does. Live smoke test with `gpt-4o-mini` and the rebuilt Docker image: create, edit, batched update + create, receipt with an edit (`entry_method=receipt`), and discard. Browser test of the new card.

**Langfuse v3 (option 3) is not part of this decision.** It is still an infra decision.

## Follow-up: more of stock LangGraph / LangChain (2026-09-26)

Three more items from the "use what the framework gives" review, same branch:

1. **Streaming.** `session._drive` now uses `graph.astream(stream_mode=["tasks", "messages", "updates"], version="v2")` instead of `astream_events`. `tasks` gives a `step` line when a tool actually runs, `messages` gives answer tokens from the `model` node, and `updates` carries the confirm card (`__interrupt__`) and the final reply's id. That removes two state reads per leg (`pending_card`, `_latest_ai_id`). The SSE contract did not change.
2. **Retry and fallback.**
   - **Read tools:** stock `ToolRetryMiddleware`, 2 retries on a transient error (httpx transport error, or Frappe 429 / 502 / 503 / 504). It sits inside `ToolErrorMiddleware`, as that middleware requires.
   - **Write tools are never retried.** A write that timed out may have committed, so a retry could duplicate a row.
   - **Model retry: not added.** `ChatOpenAI` already retries twice through the OpenAI SDK, honouring `Retry-After`. `ModelRetryMiddleware` would stack on top of that, up to 9 attempts.
   - **Model fallback:** stock `ModelFallbackMiddleware`, off unless `OPENAI_FALLBACK_MODEL` is set. Fallback tokens count against the daily cap; the local cost figure still uses the primary model's price.
3. **Checkpoint durability: kept at LangGraph's default `"async"`, now stated explicitly.** Probes showed `"exit"` also saves after an exception or a cancelled leg, so graceful failures behave the same. But on a process crash mid-resume, `"exit"` would lose the record of a committed write and reopen the card, and a re-confirm would duplicate the row. The saving (a few Postgres writes per turn) is not worth that.

**Not adopted:** the `langgraph-api` server (tracked in expenso-assistant#11), the Store, time travel, subgraphs, and node caching — no current need. ADR 0009 (OpenAI Agents SDK) is rejected: it is an alternative framework, not an add-on.
