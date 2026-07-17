import frappe
from frappe.tests.utils import FrappeTestCase

from expenso.expenso.api import get_expenses


def _ensure_test_user(email):
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Test",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
	return email


class TestGetExpenses(FrappeTestCase):
	def setUp(self):
		self.member = _ensure_test_user("api.member@expenso.test")
		user = frappe.get_doc("User", self.member)
		if "Family Member" not in {r.role for r in user.roles}:
			user.add_roles("Family Member")

		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "API Test Family",
				"currency": "USD",
				"members": [{"user": self.member}],
			}
		).insert(ignore_permissions=True)

		self.june_expense = frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 50.0,
				"date": "2025-06-15",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		self.july_expense = frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 30.0,
				"date": "2025-07-01",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.set_user("Administrator")

	# I27
	def test_get_expenses_returns_only_expenses_in_month(self):
		frappe.set_user(self.member)
		result = get_expenses(month=6, year=2025)
		names = [r.name for r in result]
		self.assertIn(self.june_expense.name, names)

	# I28
	def test_get_expenses_excludes_other_months(self):
		frappe.set_user(self.member)
		result = get_expenses(month=6, year=2025)
		names = [r.name for r in result]
		self.assertNotIn(self.july_expense.name, names)

	# I29
	def test_get_expenses_with_no_expenses_returns_empty_list(self):
		frappe.set_user(self.member)
		result = get_expenses(month=1, year=2020)
		self.assertEqual(result, [])

	# I30
	def test_get_expenses_ordered_newest_date_first(self):
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 15.0,
				"date": "2025-06-20",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		result = get_expenses(month=6, year=2025)
		dates = [str(r.date) for r in result]
		self.assertEqual(dates, sorted(dates, reverse=True))
