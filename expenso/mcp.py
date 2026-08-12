import functools

import frappe
from frappe import _
from frappe_mcp import MCP

from expenso.expenso.api import get_analytics as _get_analytics
from expenso.expenso.api import get_budgets as _get_budgets
from expenso.expenso.api import get_expenses as _get_expenses
from expenso.expenso.api import get_income as _get_income

READ_SCOPE = "expenso:read"

mcp = MCP(name="expenso-mcp")


def get_current_oauth_scopes() -> set[str] | None:
	"""Granted scopes for the current request's OAuth2 Bearer token.

	Returns None for any request not authenticated via an OAuth2 Bearer token
	(session cookie, API key, guest) — Frappe attaches no scope concept to
	those, so callers must treat None as "no scope", not "any scope".
	"""
	auth_header = frappe.get_request_header("Authorization") or ""
	scheme, _sep, token = auth_header.partition(" ")
	if scheme.lower() != "bearer" or not token:
		return None

	scopes = frappe.db.get_value("OAuth Bearer Token", token, "scopes")
	return set(scopes.split()) if scopes else None


def require_oauth_scope(scope: str):
	def decorator(fn):
		@functools.wraps(fn)
		def wrapper(*args, **kwargs):
			granted = get_current_oauth_scopes()
			if not granted or scope not in granted:
				frappe.throw(_("Missing required OAuth scope: {0}").format(scope), frappe.PermissionError)
			return fn(*args, **kwargs)

		return wrapper

	return decorator


def _json_safe(value):
	"""Round-trip through Frappe's own JSON encoder so `date`/`datetime`
	values survive `frappe_mcp`'s plain `json.dumps` of the tool result —
	it has no handling for those types and silently falls back to `str()`,
	which is not valid JSON, instead of raising.
	"""
	return frappe.parse_json(frappe.as_json(value))


@mcp.tool()
@require_oauth_scope(READ_SCOPE)
def get_expenses(month: int, year: int):
	"""Get the calling Member's Family's Expenses for a given month.

	Args:
		month: Month number (1-12).
		year: Four-digit year.
	"""
	return _json_safe(_get_expenses(month=month, year=year))


@mcp.tool()
@require_oauth_scope(READ_SCOPE)
def get_analytics(month: int, year: int):
	"""Get the calling Member's Family's monthly total, per-Category breakdown,
	and Budget status for a given month.

	Args:
		month: Month number (1-12).
		year: Four-digit year.
	"""
	return _json_safe(_get_analytics(month=month, year=year))


@mcp.tool()
@require_oauth_scope(READ_SCOPE)
def get_income(month: int, year: int):
	"""Get the calling Member's Family's Income entries for a given month.

	Args:
		month: Month number (1-12).
		year: Four-digit year.
	"""
	return _json_safe(_get_income(month=month, year=year))


@mcp.tool()
@require_oauth_scope(READ_SCOPE)
def get_budgets(month: int, year: int):
	"""Get the calling Member's Family's Budget amount per Category for a given month.

	Args:
		month: Month number (1-12).
		year: Four-digit year.
	"""
	return _json_safe(_get_budgets(month=month, year=year))


def build_mcp_read_tool_schema() -> list[dict]:
	"""The `tools/list` schema this MCP server currently exposes."""
	from frappe_mcp.server.tools.handlers import handle_list_tools

	return handle_list_tools({}, mcp._tool_registry)["tools"]


@mcp.register()
def handle_mcp():
	"""MCP entry point for expenso, served at /api/method/expenso.mcp.handle_mcp."""
