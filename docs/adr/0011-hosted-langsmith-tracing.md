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
- **The stock tracer.** Each turn puts `run_id`, `run_name` (`chat-turn` / `receipt-turn` / `insights-turn`; the confirm-card decision is its own trace, `chat-resume` / `receipt-resume`, with the turn's feature), the tag `feature:<x>` and the metadata `user_id` / `session_id` / `feature` on the run config. LangChain adds its own `LangChainTracer` because `LANGSMITH_TRACING` is on (see the 2026-09-28 update). The tracer records inputs, outputs and errors. `TurnTrace.finish`/`fail` and the per-turn flush are removed. The app flushes once at shutdown. `session_id` groups a Member's turns into one LangSmith thread.
- **Receipt accuracy is LangSmith feedback.** The `receipt_accuracy_{amount,date,category,notes}` metric from ADR 0003 is unchanged. The scores are posted with `create_feedback(trace_id=<resume-leg run id>)`, which the client batches with the runs.
- **Cost is LangSmith's figure.** LangSmith prices each call from its own model table, using the token counts in `usage_metadata`. `config.MODEL_PRICING` and `cost_for` are deleted. A model swap is now only `agent/model.py`.
- **The daily token cap is not affected.** It is a Postgres counter (ADR 0008's 2026-09-11 update). The callback that feeds it stays, as `TokenCounter`.
- **Tracing is set up from the environment, as LangSmith recommends.** `LANGSMITH_TRACING=true` turns it on. The SDK reads `LANGSMITH_API_KEY`, `LANGSMITH_ENDPOINT` and `LANGSMITH_PROJECT` itself. At startup, the app makes a masking client LangSmith's default client, so every traced call masks images, also a call made outside a turn. This reverses the earlier rule "the key alone turns it on; leave `LANGSMITH_TRACING` unset" — see the 2026-09-28 update.
- **Langfuse is removed completely.** The `langfuse` dependency, the compose service and its env vars are gone. Existing Langfuse traces are not migrated. On the VPS, the `langfuse` Postgres database and the container are removed by hand (see DEPLOYMENT.md).

## Consequences

- Family financial data (amounts, categories, notes, emails) is stored by a third party in the US, for the plan's retention period. This reverses the data-residency position of ADR 0003 and ADR 0008 on purpose.
- "Clear chat" deletes the LangGraph thread. The LangSmith traces of those turns stay until retention expires, as the Langfuse traces did.
- One container and one database fewer on the VPS. There is no SSH tunnel: the LangSmith UI is at `https://aws.smith.langchain.com`.
- LangSmith datasets and evaluations are now available for agent-level evals (expenso-assistant#8).
- The Langfuse dashboard views planned for P7-S2 are replaced by LangSmith's built-in monitoring, filtered by the `feature:<x>` tags.

## Update (2026-09-28): tracing set up from the environment

The first version of this ADR turned tracing on with `LANGSMITH_API_KEY` alone. The service built its own `LangChainTracer` for each turn, and `LANGSMITH_TRACING` had to stay unset. That is not how LangSmith is normally set up, and a developer who set the flag by habit would send unmasked receipt images for any LangChain call made outside a turn.

The service now follows the LangSmith setup:

- **Environment only.** `LANGSMITH_TRACING`, `LANGSMITH_API_KEY`, `LANGSMITH_ENDPOINT` and `LANGSMITH_PROJECT` are read by the LangSmith SDK from the process environment. They are no longer fields in `config.Settings`. `LANGSMITH_TRACING=false` turns tracing off without removing the key.
- **LangChain adds the tracer.** `TurnTrace.apply` no longer adds a `LangChainTracer`. It still sets `run_id`, `run_name`, the `feature:<x>` tag and the metadata on the run config, so each turn is still one tagged trace.
- **Masking on the default client.** At startup, `observability.configure_tracing()` calls `langsmith.configure(client=Client(hide_inputs=mask_images))`. LangChain's tracer, feedback (`create_feedback`) and the shutdown flush all use this client.

Consequences:

- A deployment must set `LANGSMITH_TRACING=true`. With only the key set, nothing is traced.
- The variables must be in the process environment. Docker Compose loads `.env` through `env_file`. A local run uses `uv run --env-file .env uvicorn ...`, because pydantic reads `.env` but does not export it.
- The US endpoint is no longer a default in code. It comes from `LANGSMITH_ENDPOINT` (set in `.env.example`).
