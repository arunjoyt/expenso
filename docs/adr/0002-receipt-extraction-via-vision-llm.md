# Receipt extraction via OpenAI vision LLM, synchronous, rate-limited

Creating an Expense from a Receipt photo (issue #65) needed a way to turn an image into `amount`/`date`/`category`/`notes`. We chose a vision-capable LLM call (OpenAI `gpt-4o-mini`, reusing an existing account) over a traditional OCR-plus-regex pipeline — real-world receipts (crumpled thermal paper, varied layouts) are far more reliably parsed by a vision LLM than by OCR text extraction with heuristics, and it needs no new infra beyond an API key in `site_config.json`.

The call is synchronous: the Member waits on a loading state in the Add Expense sheet rather than the photo submitting as a background job. Extraction takes a few seconds and the Member is actively waiting to review the result, so a job queue and realtime callback would add complexity without a matching benefit.

Because this spends real API credits and any Member can trigger it, we added a per-Member daily cap enforced server-side, rather than shipping with no limit. The Family's existing Category list is passed into the extraction prompt so the LLM can only select from it (or return none) instead of inventing new Category names server-side. The extracted amount is used as-is with no currency conversion — bills are assumed to be in the Family's currency.

Extraction failure (unreadable image, API error, missing fields) never blocks Expense creation: the Add Expense sheet opens with whatever was extracted pre-filled, and the Member completes the rest manually, same as today's manual-entry flow.

The OpenAI call is isolated inside `extract_receipt`'s implementation: callers (the frontend, and `create_expense` for accuracy-linking) only ever see the `amount`/`date`/`category`/`notes` return contract, never OpenAI's raw response shape. We deliberately did not build a provider-agnostic abstraction — there's no second provider in view, and guessing at that interface without a real second consumer would likely produce the wrong one. This isolation is the cheap version of that insurance: if a provider swap is ever needed, it's confined to this one function.

---

**Update (2026-09-09, [ADR 0008](0008-in-app-assistant-architecture.md)): receipt extraction moves out of Frappe into the `expenso-assistant` service, and the image is no longer stored.**

The core of this ADR is unchanged: a vision LLM over OCR+regex; the Member waits on a loading state rather than a background job; the Family's Category list goes into the prompt; extracted amount used as-is, no currency conversion; extraction failure never blocks manual Expense creation. What changes:

- **There is no `extract_receipt` whitelisted method and no OpenAI key in `site_config.json`.** Receipt vision is a capability of the multimodal agent in the `expenso-assistant` service — the Member attaches a photo in the Assistant chat and the agent extracts the fields into a confirm card. Frappe ends up with zero LLM dependencies and zero LLM keys.
- **The isolation principle relocates, intact.** "The OpenAI call isolated in one function, no provider abstraction" now means: isolated in the service's model module, with the model id and its pricing a coupled constant in the service's `config.py`. LangChain's model layer is present but is not used as a runtime provider switch — it is the "cheap swap insurance" this ADR already described.
- **No camera affordance on the Add Expense sheet.** `ExpenseSheet.vue` stays manual-only; the Assistant chat is the only receipt path. The confirm card replaces the pre-filled sheet as the review surface (the Member still reviews and confirms before anything is saved).
- **The image is never retained** — drop "the original image is kept as an attachment on the created Expense." It lives only in the browser/run state during the chat session and is discarded after processing; the thread keeps a text marker. Accepted trade: a mis-extraction noticed later has no image to re-check — the Member edits the Expense manually (consistent with ADR 0003's "the Member is the ground truth").
- **New runtime coupling:** creating an Expense from a receipt now requires the `expenso-assistant` service to be up, not just Frappe plus an API key.
