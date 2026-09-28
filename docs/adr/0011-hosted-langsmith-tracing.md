# Assistant tracing moves from self-hosted Langfuse to hosted LangSmith

**Status: accepted (2026-09-27).** Supersedes the observability parts of [ADR 0008](0008-in-app-assistant-architecture.md) ("Observability", the Langfuse parts of "Persistence boundary" and of the 2026-09-10 update) and the "no hosted observability" rule of [ADR 0003](0003-receipt-extraction-tracking.md). Resolves expenso-assistant#12. Continues [ADR 0010](0010-langchain-v1-create-agent-consideration.md): use stock LangChain where it covers the need.

## Context

ADR 0008 put every Assistant trace in a self-hosted Langfuse v2 container, loopback only. It rejected hosted tools by name (LangSmith, Helicone) so that family financial data stays on our own servers.

Running it cost more than planned:

- **The server is stuck on v2.** `langfuse/langfuse:2` is on a deprecation path. v3 needs ClickHouse, Redis and S3 — three more services on a VPS that already runs Frappe.
- **Custom code.** The stock Langfuse callback pulls in extra packages, so the service had its own `TurnTrace` and `CostCallback`. The v2 server silently dropped `usage_details`/`cost_details` (expenso-assistant#4), so our own cost figures never reached the UI anyway.
- **Shallow traces.** One trace per turn, with one flat generation per model call. Tool calls, middleware steps and the confirm-card pause were not shown.

After ADR 0010 the agent is a stock `create_agent` graph. LangChain's `LangChainTracer` traces it to LangSmith with no custom code: every model call, tool call, middleware step and interrupt, nested.

## Decision

**Traces go to hosted LangSmith, in the US region** (`https://aws.api.smith.langchain.com`), project `expenso-assistant`.

- **Data residency is accepted, with receipt images masked.** Traces carry amounts, categories, notes and member emails, and LangSmith now stores them. Receipt photos are never uploaded: the LangSmith client's `hide_inputs` hook (`observability.mask_images`) replaces every `data:image/...` URI in a run's inputs with a placeholder. This covers the model-call runs, which record messages as dicts, and the middleware runs, which record the live message objects. Notes and emails are not masked, because the traces are for debugging and those fields carry the meaning.
- **The stock tracer.** Each turn puts `run_id`, `run_name` (`chat-turn` / `receipt-turn` / `insights-turn`; the confirm-card decision is its own trace, `chat-resume` / `receipt-resume`, with the turn's feature), the tag `feature:<x>` and the metadata `user_id` / `session_id` / `feature` on the run config, next to a `LangChainTracer`. The tracer records inputs, outputs and errors. `TurnTrace.finish`/`fail` and the per-turn flush are removed. The app flushes once at shutdown. `session_id` groups a Member's turns into one LangSmith thread.
- **Receipt accuracy is LangSmith feedback.** The `receipt_accuracy_{amount,date,category,notes}` metric from ADR 0003 is unchanged. The scores are posted with `create_feedback(trace_id=<resume-leg run id>)`, which the client batches with the runs.
- **Cost is LangSmith's figure.** LangSmith prices each call from its own model table, using the token counts in `usage_metadata`. `config.MODEL_PRICING` and `cost_for` are deleted. A model swap is now only `agent/model.py`.
- **The daily token cap is not affected.** It is a Postgres counter (ADR 0008's 2026-09-11 update). The callback that feeds it stays, as `TokenCounter`.
- **Tracing is off when `LANGSMITH_API_KEY` is empty.** The key alone turns it on. Leave `LANGSMITH_TRACING` unset: it is not needed, and with it set, any LangChain call made outside a turn would be traced by LangChain's default client, which does not mask images. (A turn is not traced twice: LangChain adds its own tracer only when the run has none.)
- **Langfuse is removed completely.** The `langfuse` dependency, the compose service and its env vars are gone. Existing Langfuse traces are not migrated. On the VPS, the `langfuse` Postgres database and the container are removed by hand (see DEPLOYMENT.md).

## Consequences

- Family financial data (amounts, categories, notes, emails) is stored by a third party in the US, for the plan's retention period. This reverses the data-residency position of ADR 0003 and ADR 0008 on purpose.
- "Clear chat" deletes the LangGraph thread. The LangSmith traces of those turns stay until retention expires, as the Langfuse traces did.
- One container and one database fewer on the VPS. There is no SSH tunnel: the LangSmith UI is at `https://aws.smith.langchain.com`.
- LangSmith datasets and evaluations are now available for agent-level evals (expenso-assistant#8).
- The Langfuse dashboard views planned for P7-S2 are replaced by LangSmith's built-in monitoring, filtered by the `feature:<x>` tags.
