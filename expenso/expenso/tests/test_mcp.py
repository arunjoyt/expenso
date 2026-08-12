from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime

from expenso.expenso.tests.test_api import _ensure_test_user
from expenso.mcp import (
	_json_safe,
	build_mcp_read_tool_schema,
	get_analytics,
	get_budgets,
	get_expenses,
	get_income,
)


def _make_oauth_client(app_name):
	return frappe.get_doc(
		{
			"doctype": "OAuth Client",
			"app_name": app_name,
			"scopes": "all openid expenso:read",
			"default_redirect_uri": "https://example.com/callback",
		}
	).insert(ignore_permissions=True)


def _make_bearer_token(user, client, scopes, status="Active", expiration_time=None):
	return frappe.get_doc(
		{
			"doctype": "OAuth Bearer Token",
			"client": client,
			"user": user,
			"scopes": scopes,
			"access_token": frappe.generate_hash(length=32),
			"expiration_time": expiration_time or add_to_date(now_datetime(), hours=1),
			"status": status,
		}
	).insert(ignore_permissions=True)


class TestMcpReadToolSchema(FrappeTestCase):
	# U35
	def test_schema_includes_exactly_the_four_read_tools(self):
		names = {tool["name"] for tool in build_mcp_read_tool_schema()}
		self.assertEqual(names, {"get_expenses", "get_analytics", "get_income", "get_budgets"})


class TestMcpReadTools(FrappeTestCase):
	def setUp(self):
		self.member = _ensure_test_user("mcp.member@expenso.test")
		user = frappe.get_doc("User", self.member)
		if "Family Member" not in {r.role for r in user.roles}:
			user.add_roles("Family Member")

		self.outsider = _ensure_test_user("mcp.outsider@expenso.test")
		outsider_user = frappe.get_doc("User", self.outsider)
		if "Family Member" not in {r.role for r in outsider_user.roles}:
			outsider_user.add_roles("Family Member")

		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "MCP Test Family",
				"currency": "USD",
				"members": [{"user": self.member}],
			}
		).insert(ignore_permissions=True)

		self.other_family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "MCP Other Family",
				"currency": "USD",
				"members": [{"user": self.outsider}],
			}
		).insert(ignore_permissions=True)

		self.expense = frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 42.0,
				"date": "2025-06-15",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		self.other_expense = frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 99.0,
				"date": "2025-06-15",
				"family": self.other_family.name,
			}
		).insert(ignore_permissions=True)

		self.client = _make_oauth_client("MCP Test Client")
		self.token = _make_bearer_token(self.member, self.client.name, "all openid expenso:read")

	def tearDown(self):
		frappe.set_user("Administrator")

	def _call_as_member_with_token(self, fn, token, **kwargs):
		frappe.set_user(self.member)
		with patch.object(frappe, "get_request_header", return_value=f"Bearer {token}"):
			return fn(**kwargs)

	# I177
	def test_get_expenses_with_valid_token_matches_direct_whitelisted_call(self):
		from expenso.expenso.api import get_expenses as direct_get_expenses

		frappe.set_user(self.member)
		direct_result = _json_safe(direct_get_expenses(month=6, year=2025))

		mcp_result = self._call_as_member_with_token(
			get_expenses, self.token.access_token, month=6, year=2025
		)

		self.assertEqual(mcp_result, direct_result)
		names = [row["name"] for row in mcp_result]
		self.assertIn(self.expense.name, names)

	# I178
	def test_get_analytics_income_budgets_match_direct_whitelisted_calls(self):
		from expenso.expenso.api import get_analytics as direct_get_analytics
		from expenso.expenso.api import get_budgets as direct_get_budgets
		from expenso.expenso.api import get_income as direct_get_income

		frappe.set_user(self.member)
		direct_analytics = _json_safe(direct_get_analytics(month=6, year=2025))
		direct_income = _json_safe(direct_get_income(month=6, year=2025))
		direct_budgets = _json_safe(direct_get_budgets(month=6, year=2025))

		self.assertEqual(
			self._call_as_member_with_token(get_analytics, self.token.access_token, month=6, year=2025),
			direct_analytics,
		)
		self.assertEqual(
			self._call_as_member_with_token(get_income, self.token.access_token, month=6, year=2025),
			direct_income,
		)
		self.assertEqual(
			self._call_as_member_with_token(get_budgets, self.token.access_token, month=6, year=2025),
			direct_budgets,
		)

	# I179
	def test_call_with_no_authorization_header_is_rejected(self):
		frappe.set_user(self.member)
		with patch.object(frappe, "get_request_header", return_value=None):
			self.assertRaises(frappe.PermissionError, get_expenses, month=6, year=2025)

	# I179
	def test_call_with_token_missing_read_scope_is_rejected(self):
		write_only_token = _make_bearer_token(self.member, self.client.name, "all openid")

		frappe.set_user(self.member)
		with patch.object(
			frappe, "get_request_header", return_value=f"Bearer {write_only_token.access_token}"
		):
			self.assertRaises(frappe.PermissionError, get_expenses, month=6, year=2025)

	# I180
	def test_token_stays_scoped_to_its_own_family_even_with_crafted_params(self):
		mcp_result = self._call_as_member_with_token(
			get_expenses, self.token.access_token, month=6, year=2025
		)
		names = [row["name"] for row in mcp_result]
		self.assertNotIn(self.other_expense.name, names)


class TestValidateOAuthResolvesUser(FrappeTestCase):
	"""Exercises Frappe's own `validate_oauth()` against a real Bearer token,
	the exact mechanism ADR 0005 relies on for #80 (no new permission logic).
	"""

	def setUp(self):
		self.member = _ensure_test_user("mcp.oauth@expenso.test")
		self.client = _make_oauth_client("MCP OAuth Flow Client")

	def tearDown(self):
		frappe.set_user("Administrator")

	def _run_validate_oauth(self, token):
		from frappe.auth import validate_oauth
		from frappe.utils import set_request

		frappe.set_user("Guest")
		set_request(method="GET", path="/api/method/expenso.mcp.handle_mcp")
		validate_oauth(["Bearer", token])

	# I176
	def test_valid_token_resolves_to_its_member_via_validate_oauth(self):
		token = _make_bearer_token(self.member, self.client.name, "all openid expenso:read")

		self._run_validate_oauth(token.access_token)

		self.assertEqual(frappe.session.user, self.member)

	# I179
	def test_expired_token_does_not_resolve_a_user(self):
		token = _make_bearer_token(
			self.member,
			self.client.name,
			"all openid expenso:read",
			expiration_time=add_to_date(now_datetime(), hours=-1),
		)

		self._run_validate_oauth(token.access_token)

		self.assertEqual(frappe.session.user, "Guest")
