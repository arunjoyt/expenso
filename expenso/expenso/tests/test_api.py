import frappe
from frappe.tests.utils import FrappeTestCase

from expenso.expenso.api import create_expense, delete_expense, get_expenses, update_expense


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


class TestExpenseCrudApi(FrappeTestCase):
	def setUp(self):
		self.member_a = _ensure_test_user("crud.membera@expenso.test")
		self.member_b = _ensure_test_user("crud.memberb@expenso.test")
		self.outsider = _ensure_test_user("crud.outsider@expenso.test")

		for email in (self.member_a, self.member_b):
			user = frappe.get_doc("User", email)
			if "Family Member" not in {r.role for r in user.roles}:
				user.add_roles("Family Member")

		self.family_a = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "CRUD Test Family A",
				"currency": "USD",
				"members": [{"user": self.member_a}],
			}
		).insert(ignore_permissions=True)

		self.family_b = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "CRUD Test Family B",
				"currency": "USD",
				"members": [{"user": self.member_b}],
			}
		).insert(ignore_permissions=True)

		self.expense_b = frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 40.0,
				"family": self.family_b.name,
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.local._realtime_log = []

	# I31
	def test_create_expense_persists_and_publishes_realtime_event(self):
		frappe.local._realtime_log = []
		frappe.set_user(self.member_a)
		doc = create_expense(amount=25.0, date="2025-06-01")
		self.assertTrue(frappe.db.exists("Expense", doc.name))
		events = [entry[0] for entry in frappe.local._realtime_log]
		self.assertIn("expense_created", events)

	# I32
	def test_create_expense_without_amount_raises_validation_error(self):
		frappe.set_user(self.member_a)
		with self.assertRaises(frappe.ValidationError):
			create_expense(amount=0)

	# I33
	def test_update_expense_persists_changed_field(self):
		frappe.set_user(self.member_a)
		doc = create_expense(amount=25.0)
		updated = update_expense(name=doc.name, amount=99.0)
		self.assertEqual(updated.amount, 99.0)
		self.assertEqual(frappe.db.get_value("Expense", doc.name, "amount"), 99.0)

	# I34
	def test_delete_expense_removes_from_db(self):
		frappe.set_user(self.member_a)
		doc = create_expense(amount=25.0)
		delete_expense(name=doc.name)
		self.assertFalse(frappe.db.exists("Expense", doc.name))

	# I35
	def test_create_expense_by_user_without_family_raises_permission_error(self):
		frappe.set_user(self.outsider)
		with self.assertRaises(frappe.PermissionError):
			create_expense(amount=25.0)

	# I36
	def test_update_expense_from_different_family_raises_permission_error(self):
		frappe.set_user(self.member_a)
		with self.assertRaises(frappe.PermissionError):
			update_expense(name=self.expense_b.name, amount=99.0)

	# I37
	def test_delete_expense_from_different_family_raises_permission_error(self):
		frappe.set_user(self.member_a)
		with self.assertRaises(frappe.PermissionError):
			delete_expense(name=self.expense_b.name)

	# I38
	def test_realtime_event_payload_contains_name_and_family(self):
		frappe.local._realtime_log = []
		frappe.set_user(self.member_a)
		doc = create_expense(amount=25.0)
		payload = next(entry[1] for entry in frappe.local._realtime_log if entry[0] == "expense_created")
		self.assertEqual(payload["name"], doc.name)
		self.assertEqual(payload["family"], self.family_a.name)
