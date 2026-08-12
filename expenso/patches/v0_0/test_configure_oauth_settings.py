import frappe
from frappe.tests.utils import FrappeTestCase

from expenso.patches.v0_0.configure_oauth_settings import execute


class TestConfigureOAuthSettings(FrappeTestCase):
	def tearDown(self):
		frappe.db.rollback()

	def test_enables_discovery_metadata_and_disables_dynamic_registration(self):
		frappe.db.set_single_value(
			"OAuth Settings",
			{
				"show_auth_server_metadata": 0,
				"show_protected_resource_metadata": 0,
				"enable_dynamic_client_registration": 1,
			},
		)

		execute()

		settings = frappe.db.get_singles_dict("OAuth Settings")
		self.assertEqual(settings.show_auth_server_metadata, "1")
		self.assertEqual(settings.show_protected_resource_metadata, "1")
		self.assertEqual(settings.enable_dynamic_client_registration, "0")

	def test_adds_expenso_read_to_scopes_supported_without_duplicating(self):
		frappe.db.set_single_value("OAuth Settings", "scopes_supported", "openid")

		execute()
		execute()

		scopes = frappe.db.get_single_value("OAuth Settings", "scopes_supported").splitlines()
		self.assertEqual(scopes.count("expenso:read"), 1)
		self.assertIn("openid", scopes)
