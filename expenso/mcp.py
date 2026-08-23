import functools

import frappe
from frappe import _
from frappe_mcp import MCP

from expenso.expenso.api import _publish_family_event
from expenso.expenso.api import get_analytics as _get_analytics
from expenso.expenso.api import get_budgets as _get_budgets
from expenso.expenso.api import get_expenses as _get_expenses
from expenso.expenso.api import get_income as _get_income
from expenso.expenso.permissions import get_user_family

READ_SCOPE = "expenso:read"
WRITE_SCOPE = "expenso:write"

# One combined per-Member daily cap across create_expense + create_income,
# per ADR 0006 — bounds unreviewed-write volume regardless of which tool,
# or how calls are split between them.
DAILY_WRITE_CAP = 20

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


@mcp.tool()
@require_oauth_scope(READ_SCOPE)
def list_categories():
	"""List the calling Member's Family's Category names.

	Use this to validate a `category` value before calling `create_expense`.
	"""
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	return frappe.get_all("Category", filters={"family": family}, pluck="category_name")


@mcp.tool()
@require_oauth_scope(READ_SCOPE)
def list_sources():
	"""List the calling Member's Family's Source names.

	Use this to validate a `source` value before calling `create_income`.
	"""
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	return frappe.get_all("Source", filters={"family": family}, pluck="source_name")


def _todays_external_write_count(user: str) -> int:
	today_start = frappe.utils.get_datetime(frappe.utils.today())
	tomorrow_start = frappe.utils.add_to_date(today_start, days=1)

	return sum(
		frappe.db.count(
			doctype,
			filters={
				"owner": user,
				"is_external_write": 1,
				"creation": ["between", [today_start, tomorrow_start]],
			},
		)
		for doctype in ("Expense", "Income")
	)


def _check_daily_write_cap(user: str):
	if _todays_external_write_count(user) >= DAILY_WRITE_CAP:
		frappe.throw(
			_("Daily limit for chat-created entries reached. Try again tomorrow."), frappe.ValidationError
		)


def _resolve_family_link_name(doctype: str, name_field: str, value: str | None, family: str) -> str | None:
	"""Match `value` against `doctype`'s `name_field` within `family`, case-insensitively.

	Returns None (never auto-creates) if nothing matches, per ADR 0006 — an
	unreviewed write shouldn't also be allowed to silently expand the
	Family's Category/Source lists.
	"""
	if not value:
		return None

	records = frappe.get_all(doctype, filters={"family": family}, fields=["name", name_field])
	value_key = value.strip().lower()
	for record in records:
		if (record.get(name_field) or "").strip().lower() == value_key:
			return record["name"]
	return None


def _create_external_write(doctype: str, family: str, amount, date, message, link_fields: dict):
	_check_daily_write_cap(frappe.session.user)

	doc_dict = {
		"doctype": doctype,
		"amount": amount,
		"family": family,
		"is_external_write": 1,
		"external_write_message": message,
		**link_fields,
	}
	if date:
		doc_dict["date"] = date

	doc = frappe.get_doc(doc_dict).insert(ignore_permissions=True)
	_publish_family_event(f"{doctype.lower()}_created", family, doc.name)
	return doc


@mcp.tool()
@require_oauth_scope(WRITE_SCOPE)
def create_expense(
	amount: float | None = None,
	message: str | None = None,
	date: str | None = None,
	category: str | None = None,
):
	"""Create an Expense from a chat message, with no in-app review step.

	Args:
		amount: The Expense amount. Required.
		message: The Member's original message, stored verbatim for later review.
		date: Date of the Expense (YYYY-MM-DD). Defaults to today if unstated.
		category: Category name, matched via `list_categories`. Left unset if it doesn't match an existing Category.
	"""
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	resolved_category = _resolve_family_link_name("Category", "category_name", category, family)
	return _create_external_write("Expense", family, amount, date, message, {"category": resolved_category})


@mcp.tool()
@require_oauth_scope(WRITE_SCOPE)
def create_income(
	amount: float | None = None,
	message: str | None = None,
	date: str | None = None,
	source: str | None = None,
):
	"""Create an Income from a chat message, with no in-app review step.

	Args:
		amount: The Income amount. Required.
		message: The Member's original message, stored verbatim for later review.
		date: Date of the Income (YYYY-MM-DD). Defaults to today if unstated.
		source: Source name, matched via `list_sources`. Left unset if it doesn't match an existing Source.
	"""
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	resolved_source = _resolve_family_link_name("Source", "source_name", source, family)
	return _create_external_write("Income", family, amount, date, message, {"source": resolved_source})


def build_mcp_read_tool_schema() -> list[dict]:
	"""The `tools/list` schema this MCP server exposed as of P5-S1 (issue #80)."""
	from frappe_mcp.server.tools.handlers import handle_list_tools

	names = {"get_expenses", "get_analytics", "get_income", "get_budgets"}
	all_tools = handle_list_tools({}, mcp._tool_registry)["tools"]
	return [tool for tool in all_tools if tool["name"] in names]


def build_mcp_write_tool_schema() -> list[dict]:
	"""The `tools/list` schema for this streak's new tools (P5-S2)."""
	from frappe_mcp.server.tools.handlers import handle_list_tools

	names = {"create_expense", "create_income", "list_categories", "list_sources"}
	all_tools = handle_list_tools({}, mcp._tool_registry)["tools"]
	return [tool for tool in all_tools if tool["name"] in names]


@mcp.register()
def handle_mcp():
	"""MCP entry point for expenso, served at /api/method/expenso.mcp.handle_mcp."""
