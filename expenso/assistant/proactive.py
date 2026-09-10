"""Proactive Assistant runs, fired by the Frappe scheduler.

Wired into `hooks.py` `scheduler_events` here in P6-S2; the bodies land in
P7-S2 (#97). Each run will, per Family Member, mint a **read-scoped** Assistant
token (`expenso.assistant.auth.mint_assistant_token_for(user, write=False)`)
and POST the `expenso-assistant` service's `/run/proactive` endpoint, which
drives a read-only graph that posts an Insight (or queues a pending proposal)
into that Member's thread.

Scheduled off-hours (see the cron slots in `hooks.py`) so a tens-of-seconds
batch graph cannot stall a live chat SSE stream — one uvicorn process for now
(ADR 0008).
"""


def run_monthly_summary():
	"""Monthly spending summary, 1st of the month. Body in P7-S2 (#97)."""


def run_budget_drift():
	"""Weekly budget-drift check. Body in P7-S2 (#97)."""
