"""Proactive Assistant runs, fired by the Frappe scheduler.

Wired into `hooks.py` `scheduler_events` here in P6-S2; the bodies land in
P7-S2 (#97). Each run, per Family Member, mints a **read-scoped** Assistant
token (`expenso.assistant.auth.mint_assistant_token_for(user, write=False)`)
and POSTs the `expenso-assistant` service's `/run/proactive` endpoint, which
runs fire-and-forget (`202` immediately, the graph runs as a background task
on the service — see ADR 0008's 2026-09-11 P7-S2 update) and posts an Insight
into that Member's thread. A proactive run never proposes or writes anything
— it binds the service's read-only toolset only, a binding-level guarantee,
not a confirm-gate — and there is no dedup marker: the weekly budget-drift
check re-warns every week a Category is still over its threshold.

Scheduled off-hours (see the cron slots in `hooks.py`) so a tens-of-seconds
batch graph cannot stall a live chat SSE stream — one uvicorn process for now
(ADR 0008).
"""

import frappe
import requests

from expenso.assistant.auth import mint_assistant_token_for

JOB_MONTHLY_SUMMARY = "monthly_summary"
JOB_BUDGET_DRIFT = "budget_drift"

# The service returns 202 immediately and runs the graph as a background task
# (P7-S2) — this call only needs to survive the round trip, not the run.
_REQUEST_TIMEOUT_SECONDS = 10


def run_monthly_summary():
	"""Monthly spending summary, 1st of the month."""
	_trigger(JOB_MONTHLY_SUMMARY)


def run_budget_drift():
	"""Weekly budget-drift check."""
	_trigger(JOB_BUDGET_DRIFT)


def _trigger(job: str) -> None:
	url = _service_url()
	if not url:
		return  # not configured (dev, or not deployed yet) — nothing to do

	for user in _family_member_users():
		token = mint_assistant_token_for(user, write=False)
		try:
			requests.post(
				f"{url}/run/proactive",
				json={"job": job},
				headers={"Authorization": f"Bearer {token.access_token}"},
				timeout=_REQUEST_TIMEOUT_SECONDS,
			)
		except requests.RequestException:
			frappe.log_error(
				title=f"Proactive {job} failed to reach the assistant service",
				message=f"user={user}",
			)


def _service_url() -> str | None:
	url = frappe.conf.get("expenso_assistant_url")
	return url.rstrip("/") if url else None


def _family_member_users() -> list[str]:
	# `distinct=True`: a user could in principle be a Family Member row on more
	# than one Family — "one run per Member" (ADR 0008) means once per unique
	# user, not once per membership row.
	return [
		row.user
		for row in frappe.get_all(
			"Family Member",
			filters={"parenttype": "Family"},
			fields=["user"],
			distinct=True,
			ignore_permissions=True,
		)
	]
