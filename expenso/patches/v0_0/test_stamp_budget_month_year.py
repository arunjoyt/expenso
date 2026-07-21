import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import getdate

from expenso.patches.v0_0.stamp_budget_month_year import execute


class TestStampBudgetMonthYear(FrappeTestCase):
	def setUp(self):
		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Stamp Budget Test Family",
				"currency": "USD",
			}
		).insert(ignore_permissions=True)

		self.groceries = frappe.get_doc(
			{
				"doctype": "Category",
				"category_name": "Groceries",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

	def _make_bare_budget(self, amount):
		# db_insert() skips controller validation, simulating a pre-existing Budget
		# row from before month/year existed on the DocType.
		budget = frappe.get_doc(
			{
				"doctype": "Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": amount,
			}
		)
		budget.db_insert()
		return budget.name

	def test_stamps_rows_missing_month_and_year(self):
		name = self._make_bare_budget(500)

		execute()

		today = getdate()
		self.assertEqual(frappe.db.get_value("Budget", name, "month"), today.month)
		self.assertEqual(frappe.db.get_value("Budget", name, "year"), today.year)

	def test_does_not_touch_rows_that_already_have_month_and_year(self):
		budget = frappe.get_doc(
			{
				"doctype": "Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 500,
				"month": 3,
				"year": 2024,
			}
		).insert(ignore_permissions=True)

		execute()

		self.assertEqual(frappe.db.get_value("Budget", budget.name, "month"), 3)
		self.assertEqual(frappe.db.get_value("Budget", budget.name, "year"), 2024)

	def test_running_twice_is_safe(self):
		name = self._make_bare_budget(500)

		execute()
		execute()

		today = getdate()
		self.assertEqual(frappe.db.get_value("Budget", name, "month"), today.month)
		self.assertEqual(frappe.db.get_value("Budget", name, "year"), today.year)
