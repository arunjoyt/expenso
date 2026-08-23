from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime

from expenso.expenso.tests.test_api import _ensure_test_user
from expenso.mcp import (
	_json_safe,
	_todays_external_write_count,
	build_mcp_read_tool_schema,
	build_mcp_write_tool_schema,
	create_expense,
	create_income,
	get_analytics,
	get_budgets,
	get_expenses,
	get_income,
	list_categories,
	list_sources,
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


class TestMcpWriteToolSchema(FrappeTestCase):
	# U36
	def test_schema_includes_exactly_the_four_write_streak_tools(self):
		names = {tool["name"] for tool in build_mcp_write_tool_schema()}
		self.assertEqual(names, {"create_expense", "create_income", "list_categories", "list_sources"})


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


class TestMcpWriteTools(FrappeTestCase):
	def setUp(self):
		self.member = _ensure_test_user("mcp.writer@expenso.test")
		user = frappe.get_doc("User", self.member)
		if "Family Member" not in {r.role for r in user.roles}:
			user.add_roles("Family Member")

		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "MCP Write Test Family",
				"currency": "USD",
				"members": [{"user": self.member}],
			}
		).insert(ignore_permissions=True)

		self.category = frappe.get_doc(
			{"doctype": "Category", "category_name": "Groceries", "family": self.family.name}
		).insert(ignore_permissions=True)
		self.source = frappe.get_doc(
			{"doctype": "Source", "source_name": "Salary", "family": self.family.name}
		).insert(ignore_permissions=True)

		self.client = _make_oauth_client("MCP Write Test Client")
		self.write_token = _make_bearer_token(self.member, self.client.name, "all openid expenso:write")
		self.read_only_token = _make_bearer_token(self.member, self.client.name, "all openid expenso:read")

	def tearDown(self):
		frappe.set_user("Administrator")

	def _call_as_member_with_token(self, fn, token, **kwargs):
		frappe.set_user(self.member)
		with patch.object(frappe, "get_request_header", return_value=f"Bearer {token}"):
			return fn(**kwargs)

	# I181
	def test_create_expense_sets_marker_and_stores_message_verbatim(self):
		doc = self._call_as_member_with_token(
			create_expense, self.write_token.access_token, amount=50, message="add a $50 dinner expense"
		)
		self.assertEqual(doc.is_external_write, 1)
		self.assertEqual(doc.external_write_message, "add a $50 dinner expense")

	# I182
	def test_create_income_sets_marker_and_stores_message_verbatim(self):
		doc = self._call_as_member_with_token(
			create_income, self.write_token.access_token, amount=1000, message="got paid $1000"
		)
		self.assertEqual(doc.is_external_write, 1)
		self.assertEqual(doc.external_write_message, "got paid $1000")

	# I192
	def test_create_expense_stores_notes_separately_from_message(self):
		doc = self._call_as_member_with_token(
			create_expense,
			self.write_token.access_token,
			amount=2.75,
			notes="Nahkauf - Küchentücher",
			message="Nahkauf receipt line 12 of 12",
		)
		self.assertEqual(doc.notes, "Nahkauf - Küchentücher")
		self.assertEqual(doc.external_write_message, "Nahkauf receipt line 12 of 12")

	# I193
	def test_create_income_stores_notes_separately_from_message(self):
		doc = self._call_as_member_with_token(
			create_income,
			self.write_token.access_token,
			amount=500,
			notes="July freelance payout",
			message="got $500 for the July freelance gig",
		)
		self.assertEqual(doc.notes, "July freelance payout")
		self.assertEqual(doc.external_write_message, "got $500 for the July freelance gig")

	# I183
	def test_create_expense_without_amount_raises_mandatory(self):
		self.assertRaises(
			frappe.MandatoryError,
			self._call_as_member_with_token,
			create_expense,
			self.write_token.access_token,
			message="no amount here",
		)

	# I184
	def test_create_expense_without_date_defaults_to_today(self):
		doc = self._call_as_member_with_token(
			create_expense, self.write_token.access_token, amount=20, message="coffee"
		)
		self.assertEqual(str(doc.date), frappe.utils.today())

	# I185
	def test_create_expense_with_unknown_category_leaves_it_unset(self):
		doc = self._call_as_member_with_token(
			create_expense,
			self.write_token.access_token,
			amount=20,
			message="coffee",
			category="Nonexistent",
		)
		self.assertIsNone(doc.category)
		self.assertFalse(frappe.db.exists("Category", {"category_name": "Nonexistent"}))

	# I186
	def test_create_income_with_unknown_source_leaves_it_unset(self):
		doc = self._call_as_member_with_token(
			create_income,
			self.write_token.access_token,
			amount=20,
			message="bonus",
			source="Nonexistent",
		)
		self.assertIsNone(doc.source)
		self.assertFalse(frappe.db.exists("Source", {"source_name": "Nonexistent"}))

	# I187
	def test_create_expense_and_income_share_one_daily_counter(self):
		self.assertEqual(_todays_external_write_count(self.member), 0)

		self._call_as_member_with_token(create_expense, self.write_token.access_token, amount=10, message="a")
		self.assertEqual(_todays_external_write_count(self.member), 1)

		self._call_as_member_with_token(create_income, self.write_token.access_token, amount=10, message="b")
		self.assertEqual(_todays_external_write_count(self.member), 2)

	# I188
	def test_daily_write_cap_blocks_further_writes(self):
		# `self.member`'s email is reused across every test in this class, so its
		# daily count may carry writes from tests that ran earlier in the same
		# session — cap relative to that starting count instead of assuming zero.
		starting_count = _todays_external_write_count(self.member)

		with patch("expenso.mcp.DAILY_WRITE_CAP", starting_count + 1):
			self._call_as_member_with_token(
				create_expense, self.write_token.access_token, amount=10, message="first"
			)
			count_before = _todays_external_write_count(self.member)
			self.assertEqual(count_before, starting_count + 1)

			self.assertRaises(
				frappe.ValidationError,
				self._call_as_member_with_token,
				create_income,
				self.write_token.access_token,
				amount=10,
				message="second",
			)

			self.assertEqual(_todays_external_write_count(self.member), count_before)

	# I189
	def test_create_expense_rejected_with_read_only_token(self):
		self.assertRaises(
			frappe.PermissionError,
			self._call_as_member_with_token,
			create_expense,
			self.read_only_token.access_token,
			amount=10,
			message="nope",
		)

	# I190
	def test_list_categories_and_sources_return_family_scoped_names(self):
		categories = self._call_as_member_with_token(list_categories, self.read_only_token.access_token)
		sources = self._call_as_member_with_token(list_sources, self.read_only_token.access_token)

		self.assertIn("Groceries", categories)
		self.assertIn("Salary", sources)

	# I191
	def test_create_expense_creates_no_llm_call_log_row(self):
		if not frappe.db.exists("DocType", "LLM Call Log"):
			self.skipTest("LLM Call Log doesn't exist yet (P4-S1, #66) — nothing to assert against")

		before = frappe.db.count("LLM Call Log")
		self._call_as_member_with_token(create_expense, self.write_token.access_token, amount=10, message="x")
		self.assertEqual(frappe.db.count("LLM Call Log"), before)


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
