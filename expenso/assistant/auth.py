"""Token minting for the `expenso-assistant` service.

Frappe stays the OAuth authorization server; the assistant service is a
resource server. The logged-in frontend (and the proactive scheduler) mint a
short-lived `OAuth Bearer Token` here — the same row shape the external MCP
connector's tokens use — and hand it to the service, which passes it straight
through to Frappe's REST API on every tool call. `validate_oauth()` →
`frappe.set_user()` then runs unchanged and every `permission_query_conditions`
/ `has_permission` hook applies. No new auth hooks, no shared secrets.

See `docs/adr/0008-in-app-assistant-architecture.md` §Auth.
"""

import frappe
from frappe import _
from frappe.utils import add_to_date, now_datetime, sbool

from expenso.expenso.permissions import get_user_family

READ_SCOPE = "expenso:read"
WRITE_SCOPE = "expenso:write"
BASE_SCOPES = "all openid"

# Interactive tokens are deliberately short-lived — the assistant service
# re-mints as a turn or a pending proposal outlives the token (ADR 0008 flags
# the long-confirm-wait case; re-mint-on-resume is the service's job).
ASSISTANT_TOKEN_TTL_MINUTES = 60

# A dedicated internal OAuth Client, distinct from the admin-configured one the
# external connector uses. Never runs the authorize/consent flow — the mint
# endpoint is session-authenticated and writes the bearer-token row directly —
# so its redirect URI is a placeholder. Created on first use.
ASSISTANT_OAUTH_APP_NAME = "Expenso Assistant"
_INTERNAL_REDIRECT_URI = "http://localhost/expenso-assistant/unused"


def _assistant_oauth_client() -> str:
	name = frappe.db.get_value("OAuth Client", {"app_name": ASSISTANT_OAUTH_APP_NAME}, "name")
	if name:
		return name

	client = frappe.get_doc(
		{
			"doctype": "OAuth Client",
			"app_name": ASSISTANT_OAUTH_APP_NAME,
			"scopes": f"{BASE_SCOPES} {READ_SCOPE} {WRITE_SCOPE}",
			"redirect_uris": _INTERNAL_REDIRECT_URI,
			"default_redirect_uri": _INTERNAL_REDIRECT_URI,
			"skip_authorization": 1,
		}
	).insert(ignore_permissions=True)
	return client.name


def mint_assistant_token_for(user: str, *, write: bool):
	"""Create a short-lived bearer-token doc for `user`, read-scoped, plus write if asked."""
	scopes = f"{BASE_SCOPES} {READ_SCOPE}"
	if write:
		scopes = f"{scopes} {WRITE_SCOPE}"

	return frappe.get_doc(
		{
			"doctype": "OAuth Bearer Token",
			"client": _assistant_oauth_client(),
			"user": user,
			"scopes": scopes,
			"access_token": frappe.generate_hash(length=32),
			"expiration_time": add_to_date(now_datetime(), minutes=ASSISTANT_TOKEN_TTL_MINUTES),
			"status": "Active",
		}
	).insert(ignore_permissions=True)


@frappe.whitelist()
def mint_assistant_token(write: bool = False) -> dict:
	"""Mint an Assistant bearer token for the calling Member.

	`write=True` adds the `expenso:write` scope for the confirm-gated tools;
	the frontend requests it only for the chat surface, never for read-only use.
	"""
	user = frappe.session.user
	if user == "Guest":
		frappe.throw(_("You must be signed in to use the Assistant"), frappe.PermissionError)
	if not get_user_family(user):
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	token = mint_assistant_token_for(user, write=sbool(write))
	return {
		"access_token": token.access_token,
		"token_type": "Bearer",
		"expires_in": ASSISTANT_TOKEN_TTL_MINUTES * 60,
		"scope": token.scopes,
	}
