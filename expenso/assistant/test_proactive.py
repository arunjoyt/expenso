from unittest.mock import patch

import frappe
import requests
from frappe.tests.utils import FrappeTestCase

from expenso.assistant.proactive import (
	JOB_BUDGET_DRIFT,
	JOB_MONTHLY_SUMMARY,
	run_budget_drift,
	run_monthly_summary,
)
from expenso.expenso.tests.test_api import _ensure_test_user

SERVICE_URL = "http://assistant.test"


class TestProactiveTriggers(FrappeTestCase):
	"""The dev site carries real Family Member data outside these fixtures, so
	assertions scope to this test's own two Members rather than the total call
	count — `_calls_for` picks out only the calls whose token resolves to one
	of them."""

	def setUp(self):
		self.member_a = _ensure_test_user("proactive.a@expenso.test")
		self.member_b = _ensure_test_user("proactive.b@expenso.test")
		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Proactive Trigger Family",
				"currency": "USD",
				"members": [{"user": self.member_a}, {"user": self.member_b}],
			}
		).insert(ignore_permissions=True)
		frappe.conf.expenso_assistant_url = SERVICE_URL

	def tearDown(self):
		frappe.conf.pop("expenso_assistant_url", None)
		frappe.set_user("Administrator")

	def _calls_for(self, mock_post, user: str) -> list:
		calls = []
		for call in mock_post.call_args_list:
			token = call.kwargs["headers"]["Authorization"].removeprefix("Bearer ")
			if frappe.db.get_value("OAuth Bearer Token", token, "user") == user:
				calls.append(call)
		return calls

	# I176
	@patch("expenso.assistant.proactive.requests.post")
	def test_run_monthly_summary_mints_a_read_token_and_posts_for_each_member(self, mock_post):
		run_monthly_summary()

		for user in (self.member_a, self.member_b):
			(call,) = self._calls_for(mock_post, user)
			self.assertEqual(call.args[0], f"{SERVICE_URL}/run/proactive")
			self.assertEqual(call.kwargs["json"], {"job": JOB_MONTHLY_SUMMARY})
			token = call.kwargs["headers"]["Authorization"].removeprefix("Bearer ")
			scopes = frappe.db.get_value("OAuth Bearer Token", token, "scopes")
			self.assertIn("expenso:read", scopes)
			self.assertNotIn("expenso:write", scopes)

	def test_run_budget_drift_posts_the_budget_drift_job(self):
		with patch("expenso.assistant.proactive.requests.post") as mock_post:
			run_budget_drift()

		for user in (self.member_a, self.member_b):
			(call,) = self._calls_for(mock_post, user)
			self.assertEqual(call.kwargs["json"], {"job": JOB_BUDGET_DRIFT})

	def test_no_op_when_the_service_url_is_not_configured(self):
		frappe.conf.pop("expenso_assistant_url", None)
		before = frappe.db.count("OAuth Bearer Token")

		with patch("expenso.assistant.proactive.requests.post") as mock_post:
			run_monthly_summary()

		mock_post.assert_not_called()
		self.assertEqual(frappe.db.count("OAuth Bearer Token"), before)

	def test_one_members_failed_request_does_not_stop_the_loop(self):
		with (
			patch(
				"expenso.assistant.proactive.requests.post",
				side_effect=requests.ConnectionError("refused"),
			),
			patch("frappe.log_error") as mock_log_error,
		):
			run_monthly_summary()

		# Both of this test's Members got a token minted and a (failed) post
		# attempt — the first Member's failure didn't stop the loop before
		# reaching the second.
		for user in (self.member_a, self.member_b):
			self.assertTrue(frappe.db.exists("OAuth Bearer Token", {"user": user}))
		self.assertGreaterEqual(mock_log_error.call_count, 2)
