# Receipt extraction via OpenAI vision LLM, synchronous, rate-limited

Creating an Expense from a Receipt photo (issue #65) needed a way to turn an image into `amount`/`date`/`category`/`notes`. We chose a vision-capable LLM call (OpenAI `gpt-4o-mini`, reusing an existing account) over a traditional OCR-plus-regex pipeline — real-world receipts (crumpled thermal paper, varied layouts) are far more reliably parsed by a vision LLM than by OCR text extraction with heuristics, and it needs no new infra beyond an API key in `site_config.json`.

The call is synchronous: the Member waits on a loading state in the Add Expense sheet rather than the photo submitting as a background job. Extraction takes a few seconds and the Member is actively waiting to review the result, so a job queue and realtime callback would add complexity without a matching benefit.

Because this spends real API credits and any Member can trigger it, we added a per-Member daily cap enforced server-side, rather than shipping with no limit. The Family's existing Category list is passed into the extraction prompt so the LLM can only select from it (or return none) instead of inventing new Category names server-side. The extracted amount is used as-is with no currency conversion — bills are assumed to be in the Family's currency.

Extraction failure (unreadable image, API error, missing fields) never blocks Expense creation: the Add Expense sheet opens with whatever was extracted pre-filled, and the Member completes the rest manually, same as today's manual-entry flow.

The OpenAI call is isolated inside `extract_receipt`'s implementation: callers (the frontend, and `create_expense` for accuracy-linking) only ever see the `amount`/`date`/`category`/`notes` return contract, never OpenAI's raw response shape. We deliberately did not build a provider-agnostic abstraction — there's no second provider in view, and guessing at that interface without a real second consumer would likely produce the wrong one. This isolation is the cheap version of that insurance: if a provider swap is ever needed, it's confined to this one function.
