"""Connector-write semantics + OAuth scope guards on `api.py`.

After the Phase 6 cutover (P6-S4) `expenso/mcp.py` is gone; the external MCP
connector reaches Frappe through the `expenso-assistant` FastMCP adapter, which
calls the `expenso.expenso.api.*` whitelisted methods over REST with
`entry_method="connector"`. These tests cover what `mcp.py` used to own:
the "unreviewed external write" marker, the audit message, Category/Source
resolution, the daily write cap, and Bearer-token scope enforcement.
"""

import importlib
import pathlib
from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime

from expenso.expenso import api
from expenso.expenso.api import (
	create_expense,
	create_income,
	get_expenses,
)
from expenso.expenso.tests.test_api import _ensure_test_user


def _make_oauth_client(app_name):
	return frappe.get_doc(
		{
			"doctype": "OAuth Client",
			"app_name": app_name,
			"scopes": "all openid expenso:read expenso:write",
			"default_redirect_uri": "https://example.com/callback",
		}
	).insert(ignore_permissions=True)


def _make_bearer_token(user, client, scopes, expiration_time=None):
	return frappe.get_doc(
		{
			"doctype": "OAuth Bearer Token",
			"client": client,
			"user": user,
			"scopes": scopes,
			"access_token": frappe.generate_hash(length=32),
			"expiration_time": expiration_time or add_to_date(now_datetime(), hours=1),
			"status": "Active",
		}
	).insert(ignore_permissions=True)


class TestConnectorWrites(FrappeTestCase):
	def setUp(self):
		self.member = _ensure_test_user("connector.member@expenso.test")
		user = frappe.get_doc("User", self.member)
		if "Family Member" not in {r.role for r in user.roles}:
			user.add_roles("Family Member")

		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Connector Family",
				"currency": "USD",
				"members": [{"user": self.member}],
			}
		).insert(ignore_permissions=True)
		self.category = frappe.get_doc(
			{"doctype": "Category", "category_name": "Groceries", "family": self.family.name}
		).insert(ignore_permissions=True)
		frappe.set_user(self.member)

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_connector_expense_carries_marker_and_audit_message(self):
		doc = create_expense(
			amount=50,
			notes="Rewe run",
			entry_method="connector",
			external_message="add a 50 euro grocery expense",
		)
		self.assertEqual(doc.entry_method, "connector")
		self.assertEqual(doc.is_external_write, 1)
		self.assertEqual(doc.external_write_message, "add a 50 euro grocery expense")
		self.assertEqual(doc.notes, "Rewe run")

	def test_connector_income_carries_marker_and_audit_message(self):
		doc = create_income(amount=1000, entry_method="connector", external_message="got paid 1000")
		self.assertEqual(doc.is_external_write, 1)
		self.assertEqual(doc.external_write_message, "got paid 1000")

	def test_assistant_write_is_not_marked_even_with_a_message(self):
		doc = create_expense(amount=5, entry_method="assistant", external_message="ignored")
		self.assertFalse(doc.is_external_write)
		self.assertIsNone(doc.external_write_message)

	def test_category_resolved_by_label_case_insensitively(self):
		doc = create_expense(amount=5, category="groceries", entry_method="connector")
		self.assertEqual(doc.category, self.category.name)

	def test_unknown_category_left_unset_never_created(self):
		doc = create_expense(amount=5, category="Nonexistent", entry_method="connector")
		self.assertIsNone(doc.category)
		self.assertFalse(frappe.db.exists("Category", {"category_name": "Nonexistent"}))

	def test_daily_cap_is_shared_across_expense_and_income(self):
		start = api._todays_connector_write_count(self.member)
		with patch.object(api, "CONNECTOR_DAILY_WRITE_CAP", start + 1):
			create_expense(amount=1, entry_method="connector", external_message="one")
			self.assertEqual(api._todays_connector_write_count(self.member), start + 1)
			with self.assertRaises(frappe.ValidationError):
				create_income(amount=1, entry_method="connector", external_message="two")

	def test_manual_writes_do_not_count_toward_the_connector_cap(self):
		start = api._todays_connector_write_count(self.member)
		create_expense(amount=1)  # entry_method defaults to manual
		self.assertEqual(api._todays_connector_write_count(self.member), start)


class TestOAuthScopeGuards(FrappeTestCase):
	def setUp(self):
		self.member = _ensure_test_user("connector.scoped@expenso.test")
		user = frappe.get_doc("User", self.member)
		if "Family Member" not in {r.role for r in user.roles}:
			user.add_roles("Family Member")
		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Scoped Family",
				"currency": "USD",
				"members": [{"user": self.member}],
			}
		).insert(ignore_permissions=True)
		self.client = _make_oauth_client("Connector Scope Client")
		self.read_token = _make_bearer_token(self.member, self.client.name, "all openid expenso:read")
		self.write_token = _make_bearer_token(
			self.member, self.client.name, "all openid expenso:read expenso:write"
		)
		self.unscoped_token = _make_bearer_token(self.member, self.client.name, "all openid")
		frappe.set_user(self.member)

	def tearDown(self):
		frappe.set_user("Administrator")

	def _with_token(self, fn, token, **kwargs):
		with patch.object(frappe, "get_request_header", return_value=f"Bearer {token}"):
			return fn(**kwargs)

	def test_read_only_token_cannot_write(self):
		with self.assertRaises(frappe.PermissionError):
			self._with_token(create_expense, self.read_token.access_token, amount=10)

	def test_write_token_can_write(self):
		doc = self._with_token(create_expense, self.write_token.access_token, amount=10)
		self.assertTrue(frappe.db.exists("Expense", doc.name))

	def test_read_token_can_read(self):
		result = self._with_token(get_expenses, self.read_token.access_token, month=6, year=2025)
		self.assertIsInstance(result, list)

	def test_token_missing_read_scope_cannot_read(self):
		with self.assertRaises(frappe.PermissionError):
			self._with_token(get_expenses, self.unscoped_token.access_token, month=6, year=2025)

	def test_session_authed_call_is_not_scope_gated(self):
		# No Authorization header — the first-party frontend path.
		doc = create_expense(amount=10)
		self.assertTrue(frappe.db.exists("Expense", doc.name))


class TestValidateOAuthResolvesUser(FrappeTestCase):
	"""Frappe's own `validate_oauth()` still resolves a Member — the mechanism
	the connector relies on, unchanged by the cutover."""

	def setUp(self):
		self.member = _ensure_test_user("connector.oauth@expenso.test")
		self.client = _make_oauth_client("Connector OAuth Client")

	def tearDown(self):
		frappe.set_user("Administrator")

	def _run(self, token):
		from frappe.auth import validate_oauth
		from frappe.utils import set_request

		frappe.set_user("Guest")
		set_request(method="GET", path="/api/method/expenso.expenso.api.get_expenses")
		validate_oauth(["Bearer", token])

	def test_valid_token_resolves_to_its_member(self):
		token = _make_bearer_token(self.member, self.client.name, "all openid expenso:read")
		self._run(token.access_token)
		self.assertEqual(frappe.session.user, self.member)

	def test_expired_token_does_not_resolve(self):
		token = _make_bearer_token(
			self.member,
			self.client.name,
			"all openid expenso:read",
			expiration_time=add_to_date(now_datetime(), hours=-1),
		)
		self._run(token.access_token)
		self.assertNotEqual(frappe.session.user, self.member)


class TestOAuthDiscoveryMetadata(FrappeTestCase):
	def test_auth_server_metadata_stays_enabled(self):
		# configure_oauth_settings patch turns this on; the connector's spec
		# compliance depends on it and the cutover must not disturb it.
		self.assertTrue(frappe.db.get_single_value("OAuth Settings", "show_auth_server_metadata"))


class TestCutover(FrappeTestCase):
	# I167
	def test_in_process_mcp_module_is_gone(self):
		with self.assertRaises(ModuleNotFoundError):
			importlib.import_module("expenso.mcp")

	# I167
	def test_no_frappe_mcp_import_or_dependency(self):
		app_root = pathlib.Path(frappe.get_app_path("expenso")).parent
		this_file = pathlib.Path(__file__).resolve()
		offenders = [
			str(path.relative_to(app_root))
			for path in app_root.rglob("*.py")
			if path.resolve() != this_file
			and any(
				line.startswith(("import frappe_mcp", "from frappe_mcp"))
				for line in path.read_text().splitlines()
			)
		]
		self.assertEqual(offenders, [])

		pyproject = (app_root / "pyproject.toml").read_text()
		self.assertNotIn("frappe-mcp @", pyproject)
