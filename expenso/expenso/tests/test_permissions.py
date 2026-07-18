import frappe
from frappe.tests.utils import FrappeTestCase

from expenso.expenso.permissions import get_permission_query_conditions, has_permission


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


class TestPermissions(FrappeTestCase):
	def setUp(self):
		self.member_a = _ensure_test_user("permtest.membera@expenso.test")
		self.member_b = _ensure_test_user("permtest.memberb@expenso.test")
		self.outsider = _ensure_test_user("permtest.outsider@expenso.test")

		for email in (self.member_a, self.member_b):
			user = frappe.get_doc("User", email)
			if "Family Member" not in {r.role for r in user.roles}:
				user.add_roles("Family Member")

		self.family_a = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Perm Test Family A",
				"currency": "USD",
				"members": [{"user": self.member_a}],
			}
		).insert(ignore_permissions=True)

		self.family_b = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Perm Test Family B",
				"currency": "USD",
				"members": [{"user": self.member_b}],
			}
		).insert(ignore_permissions=True)

		self.expense_a = frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 10.0,
				"family": self.family_a.name,
			}
		).insert(ignore_permissions=True)

		self.expense_b = frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 20.0,
				"family": self.family_b.name,
			}
		).insert(ignore_permissions=True)

		self.income_a = frappe.get_doc(
			{
				"doctype": "Income",
				"amount": 500.0,
				"family": self.family_a.name,
			}
		).insert(ignore_permissions=True)

		self.income_b = frappe.get_doc(
			{
				"doctype": "Income",
				"amount": 800.0,
				"family": self.family_b.name,
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.set_user("Administrator")

	# I16
	def test_family_member_role_exists(self):
		roles = frappe.get_all("Role", pluck="name")
		self.assertIn("Family Member", roles)

	# I17
	def test_permission_query_conditions_for_member(self):
		condition = get_permission_query_conditions(self.member_a)
		self.assertIn(self.family_a.name, condition)
		self.assertIn("tabExpense", condition)

	# I18
	def test_permission_query_conditions_for_user_without_family(self):
		condition = get_permission_query_conditions(self.outsider)
		self.assertEqual(condition, "1=0")

	# I19
	def test_has_permission_for_member_on_own_family_expense(self):
		self.assertTrue(has_permission(self.expense_a, user=self.member_a))

	# I20
	def test_has_permission_for_member_on_other_family_expense(self):
		self.assertFalse(has_permission(self.expense_b, user=self.member_a))

	# I21
	def test_member_reads_only_own_family_expenses(self):
		frappe.set_user(self.member_a)
		try:
			names = frappe.get_list("Expense", pluck="name")
		finally:
			frappe.set_user("Administrator")
		self.assertIn(self.expense_a.name, names)
		self.assertNotIn(self.expense_b.name, names)

	# I22
	def test_member_fetching_other_family_expense_raises_permission_error(self):
		frappe.set_user(self.member_a)
		try:
			with self.assertRaises(frappe.PermissionError):
				frappe.get_doc("Expense", self.expense_b.name).check_permission("read")
		finally:
			frappe.set_user("Administrator")

	def test_permission_query_conditions_scopes_category_by_family(self):
		condition = get_permission_query_conditions(self.member_a, doctype="Category")
		self.assertIn(self.family_a.name, condition)
		self.assertIn("tabCategory", condition)

	def test_member_reads_only_own_family_categories(self):
		frappe.set_user(self.member_a)
		try:
			names = frappe.get_list("Category", pluck="name")
		finally:
			frappe.set_user("Administrator")
		own_categories = frappe.get_all("Category", filters={"family": self.family_a.name}, pluck="name")
		other_categories = frappe.get_all("Category", filters={"family": self.family_b.name}, pluck="name")
		for name in own_categories:
			self.assertIn(name, names)
		for name in other_categories:
			self.assertNotIn(name, names)

	# I59
	def test_member_reads_only_own_family_income(self):
		frappe.set_user(self.member_a)
		try:
			names = frappe.get_list("Income", pluck="name")
		finally:
			frappe.set_user("Administrator")
		self.assertIn(self.income_a.name, names)
		self.assertNotIn(self.income_b.name, names)

	# I60
	def test_member_fetching_other_family_income_raises_permission_error(self):
		frappe.set_user(self.member_a)
		try:
			with self.assertRaises(frappe.PermissionError):
				frappe.get_doc("Income", self.income_b.name).check_permission("read")
		finally:
			frappe.set_user("Administrator")

	def test_permission_query_conditions_scopes_source_by_family(self):
		condition = get_permission_query_conditions(self.member_a, doctype="Source")
		self.assertIn(self.family_a.name, condition)
		self.assertIn("tabSource", condition)

	def test_member_reads_only_own_family_sources(self):
		frappe.set_user(self.member_a)
		try:
			names = frappe.get_list("Source", pluck="name")
		finally:
			frappe.set_user("Administrator")
		own_sources = frappe.get_all("Source", filters={"family": self.family_a.name}, pluck="name")
		other_sources = frappe.get_all("Source", filters={"family": self.family_b.name}, pluck="name")
		for name in own_sources:
			self.assertIn(name, names)
		for name in other_sources:
			self.assertNotIn(name, names)
