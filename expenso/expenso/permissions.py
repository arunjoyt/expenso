import functools

import frappe
from frappe import _

READ_SCOPE = "expenso:read"
WRITE_SCOPE = "expenso:write"


def get_user_family(user):
	return frappe.db.get_value("Family Member", {"user": user, "parenttype": "Family"}, "parent")


def get_permission_query_conditions(user, doctype="Expense"):
	if not user:
		user = frappe.session.user

	family = get_user_family(user)
	if not family:
		return "1=0"

	return f"`tab{doctype}`.`family` = {frappe.db.escape(family)}"


def has_permission(doc, ptype=None, user=None, debug=False):
	if not user:
		user = frappe.session.user

	family = get_user_family(user)
	if not family:
		return False

	return doc.family == family


def get_current_oauth_scopes() -> set[str] | None:
	"""Granted scopes for the current request's OAuth2 Bearer token.

	Returns None for any request not authenticated via an OAuth2 Bearer token
	(session cookie, API key, guest) — Frappe attaches no scope concept to
	those, so callers must treat None as "not scope-gated", not "any scope".
	"""
	try:
		auth_header = frappe.get_request_header("Authorization") or ""
	except (RuntimeError, AttributeError):
		# No HTTP request bound (background job, scheduler, test): not a Bearer call.
		return None
	scheme, _sep, token = auth_header.partition(" ")
	if scheme.lower() != "bearer" or not token:
		return None

	scopes = frappe.db.get_value("OAuth Bearer Token", token, "scopes")
	return set(scopes.split()) if scopes else set()


def require_oauth_scope(scope: str):
	"""Guard a whitelisted method so a Bearer-token caller must hold `scope`.

	Session- and API-key-authenticated callers (the first-party frontend) are
	unaffected — they have no OAuth scope concept. A Bearer token that is
	missing `scope` is rejected. Replaces `expenso/mcp.py`'s decorator of the
	same name after the Phase 6 cutover; the `expenso-assistant` FastMCP
	adapter enforces the same scopes at its own boundary, this is defense in
	depth for a direct REST call.
	"""

	def decorator(fn):
		@functools.wraps(fn)
		def wrapper(*args, **kwargs):
			granted = get_current_oauth_scopes()
			if granted is not None and scope not in granted:
				frappe.throw(
					_("This token is not permitted to perform this action ({0}).").format(scope),
					frappe.PermissionError,
				)
			return fn(*args, **kwargs)

		return wrapper

	return decorator
