import frappe
from frappe.auth import validate_oauth
from frappe.tests.utils import FrappeTestCase
from frappe.utils import now_datetime, set_request

from expenso import hooks
from expenso.assistant.auth import (
	ASSISTANT_OAUTH_APP_NAME,
	ASSISTANT_TOKEN_TTL_MINUTES,
	_assistant_oauth_client,
	mint_assistant_token,
)
from expenso.expenso.tests.test_api import _ensure_test_user


def _resolve_via_oauth(access_token):
	frappe.set_user("Guest")
	set_request(method="GET", path="/api/method/expenso.assistant.auth.mint_assistant_token")
	validate_oauth(["Bearer", access_token])
	return frappe.session.user


class TestMintAssistantToken(FrappeTestCase):
	def setUp(self):
		self.member = _ensure_test_user("assistant.member@expenso.test")
		user = frappe.get_doc("User", self.member)
		if "Family Member" not in {r.role for r in user.roles}:
			user.add_roles("Family Member")
		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Assistant Auth Family",
				"currency": "USD",
				"members": [{"user": self.member}],
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.set_user("Administrator")

	# I160
	def test_mint_returns_read_scoped_token_that_resolves_to_the_member(self):
		frappe.set_user(self.member)
		result = mint_assistant_token()

		self.assertTrue(result["access_token"])
		self.assertEqual(result["token_type"], "Bearer")
		self.assertEqual(result["expires_in"], ASSISTANT_TOKEN_TTL_MINUTES * 60)

		scopes = frappe.db.get_value("OAuth Bearer Token", result["access_token"], "scopes")
		self.assertIn("expenso:read", scopes)
		self.assertNotIn("expenso:write", scopes)

		self.assertEqual(_resolve_via_oauth(result["access_token"]), self.member)

	# I161
	def test_mint_with_write_adds_the_write_scope(self):
		frappe.set_user(self.member)
		for requested in (True, "true"):
			result = mint_assistant_token(write=requested)
			scopes = frappe.db.get_value("OAuth Bearer Token", result["access_token"], "scopes")
			self.assertIn("expenso:read", scopes)
			self.assertIn("expenso:write", scopes)
			self.assertEqual(_resolve_via_oauth(result["access_token"]), self.member)

	# I162
	def test_minted_token_is_short_lived(self):
		frappe.set_user(self.member)
		before = now_datetime()
		result = mint_assistant_token()

		expiry = frappe.db.get_value("OAuth Bearer Token", result["access_token"], "expiration_time")
		ttl_seconds = (expiry - before).total_seconds()
		self.assertGreater(ttl_seconds, 0)
		self.assertLessEqual(ttl_seconds, ASSISTANT_TOKEN_TTL_MINUTES * 60 + 5)
		self.assertEqual(result["expires_in"], ASSISTANT_TOKEN_TTL_MINUTES * 60)

	# I163
	def test_mint_without_a_family_raises_permission_error(self):
		familyless = _ensure_test_user("assistant.nofamily@expenso.test")
		frappe.set_user(familyless)
		before = frappe.db.count("OAuth Bearer Token")

		with self.assertRaises(frappe.PermissionError):
			mint_assistant_token()

		self.assertEqual(frappe.db.count("OAuth Bearer Token"), before)

	# I164
	def test_mint_as_guest_raises_permission_error(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			mint_assistant_token()

	# I165
	def test_internal_oauth_client_is_created_once_and_reused(self):
		first = _assistant_oauth_client()
		second = _assistant_oauth_client()
		self.assertEqual(first, second)

		clients = frappe.get_all("OAuth Client", filters={"app_name": ASSISTANT_OAUTH_APP_NAME})
		self.assertEqual(len(clients), 1)

		scopes = frappe.db.get_value("OAuth Client", first, "scopes")
		self.assertIn("expenso:read", scopes)
		self.assertIn("expenso:write", scopes)


class TestProactiveSchedulerStubs(FrappeTestCase):
	# I166 — job bodies themselves are P7-S2, see test_proactive.py
	def test_proactive_jobs_are_registered_as_cron_events(self):
		cron_jobs = [job for jobs in hooks.scheduler_events["cron"].values() for job in jobs]
		self.assertIn("expenso.assistant.proactive.run_monthly_summary", cron_jobs)
		self.assertIn("expenso.assistant.proactive.run_budget_drift", cron_jobs)
