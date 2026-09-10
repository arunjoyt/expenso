import frappe
from frappe.tests.utils import FrappeTestCase

from expenso.patches.v0_0.add_entry_method import execute


class TestAddEntryMethod(FrappeTestCase):
	def setUp(self):
		self.family = frappe.get_doc(
			{"doctype": "Family", "family_name": "Entry Method Family", "currency": "USD"}
		).insert(ignore_permissions=True)

	def _make_row(self, doctype, *, is_external_write):
		doc = frappe.get_doc(
			{
				"doctype": doctype,
				"amount": 10.0,
				"date": "2025-06-01",
				"family": self.family.name,
				"is_external_write": is_external_write,
			}
		).insert(ignore_permissions=True)
		# Simulate a row that predates the entry_method field.
		frappe.db.set_value(doctype, doc.name, "entry_method", None, update_modified=False)
		return doc.name

	def test_backfills_connector_and_manual(self):
		connector_expense = self._make_row("Expense", is_external_write=1)
		manual_expense = self._make_row("Expense", is_external_write=0)
		connector_income = self._make_row("Income", is_external_write=1)
		manual_income = self._make_row("Income", is_external_write=0)

		execute()

		self.assertEqual(
			frappe.db.get_value("Expense", connector_expense, "entry_method"), "connector"
		)
		self.assertEqual(frappe.db.get_value("Expense", manual_expense, "entry_method"), "manual")
		self.assertEqual(frappe.db.get_value("Income", connector_income, "entry_method"), "connector")
		self.assertEqual(frappe.db.get_value("Income", manual_income, "entry_method"), "manual")

	def test_running_twice_is_stable(self):
		connector_expense = self._make_row("Expense", is_external_write=1)
		manual_expense = self._make_row("Expense", is_external_write=0)

		execute()
		execute()

		self.assertEqual(
			frappe.db.get_value("Expense", connector_expense, "entry_method"), "connector"
		)
		self.assertEqual(frappe.db.get_value("Expense", manual_expense, "entry_method"), "manual")
