import frappe
from frappe.tests.utils import FrappeTestCase


class TestExpensoWorkspace(FrappeTestCase):
	# I48
	def test_expenso_workspace_exists(self):
		self.assertTrue(frappe.db.exists("Workspace", "Expenso"))

	# I49
	def test_expenso_workspace_links_core_doctypes_only(self):
		links = frappe.get_all(
			"Workspace Link",
			filters={"parent": "Expenso", "type": "Link", "link_type": "DocType"},
			pluck="link_to",
		)
		self.assertCountEqual(links, ["Family", "Category", "Expense"])
		self.assertNotIn("Family Member", links)
