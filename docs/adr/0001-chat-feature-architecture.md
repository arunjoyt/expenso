# Chat feature: OpenAI backend, tool-use grounding, read-only, no persisted history

Expenso's new Chat tab lets a Member ask questions about their Family's stored data. We chose the OpenAI API over Claude for the backend, since we already hold an OpenAI account/key; the LLM answers by calling existing family-scoped whitelisted functions in `api.py` as tools (in-process, not a second HTTP round trip), rather than stuffing the full month's data into every prompt. Chat is read-only — it cannot create, edit, or delete records, and it declines questions it can't ground in the Family's own data. Each message caps the tool-call loop at 5 calls before forcing a final answer, guarding against a runaway agentic loop against our own OpenAI key; there is no per-day message limit for this first version. Conversation history is not persisted: it lives only in the frontend's Pinia store for the duration of the visit and resets on refresh, matching the app's existing ephemeral UI-state pattern (`month.js`).

## Considered Options

- Claude API instead of OpenAI — rejected only for lack of an existing account; either would satisfy the tool-use requirement.
- Persisting conversation history in a new `Chat Message` DocType — rejected to keep the first streak's scope small and avoid a new permission surface; can be revisited if Members want history across sessions.
