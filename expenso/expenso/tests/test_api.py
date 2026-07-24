import frappe
from frappe.tests.utils import FrappeTestCase

from expenso.expenso.api import (
	_aggregate_categories,
	_compute_savings,
	add_category,
	add_source,
	create_expense,
	create_income,
	delete_category,
	delete_expense,
	delete_income,
	delete_source,
	get_analytics,
	get_budgets,
	get_expenses,
	get_family_name,
	rename_category,
	rename_source,
	set_budget,
	update_expense,
	update_income,
)


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

		self.expense_with_notes = frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 20.0,
				"date": "2025-06-05",
				"family": self.family.name,
				"notes": "Dinner with the Smiths",
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

	def test_get_expenses_includes_notes(self):
		frappe.set_user(self.member)
		result = get_expenses(month=6, year=2025)
		row = next(r for r in result if r.name == self.expense_with_notes.name)
		self.assertEqual(row.notes, "Dinner with the Smiths")


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

	def test_create_expense_persists_notes(self):
		frappe.set_user(self.member_a)
		doc = create_expense(amount=25.0, notes="Dinner with the Smiths")
		self.assertEqual(frappe.db.get_value("Expense", doc.name, "notes"), "Dinner with the Smiths")

	def test_update_expense_persists_changed_notes(self):
		frappe.set_user(self.member_a)
		doc = create_expense(amount=25.0, notes="Original note")
		updated = update_expense(name=doc.name, notes="Updated note")
		self.assertEqual(updated.notes, "Updated note")
		self.assertEqual(frappe.db.get_value("Expense", doc.name, "notes"), "Updated note")

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


class TestAggregateCategories(FrappeTestCase):
	# U8
	def test_groups_and_sums_by_category(self):
		expenses = [
			{"amount": 10.0, "category_name": "Groceries"},
			{"amount": 5.0, "category_name": "Groceries"},
			{"amount": 20.0, "category_name": "Dining"},
		]
		categories = _aggregate_categories(expenses)
		self.assertEqual(
			categories,
			[
				{"name": "Dining", "amount": 20.0},
				{"name": "Groceries", "amount": 15.0},
			],
		)

	# U9
	def test_expenses_without_category_form_uncategorized_group(self):
		expenses = [
			{"amount": 10.0, "category_name": None},
			{"amount": 5.0, "category_name": None},
		]
		categories = _aggregate_categories(expenses)
		self.assertEqual(categories, [{"name": "Uncategorized", "amount": 15.0}])


class TestGetAnalyticsApi(FrappeTestCase):
	def setUp(self):
		self.member = _ensure_test_user("analytics.member@expenso.test")
		user = frappe.get_doc("User", self.member)
		if "Family Member" not in {r.role for r in user.roles}:
			user.add_roles("Family Member")

		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Analytics Test Family",
				"currency": "USD",
				"members": [{"user": self.member}],
			}
		).insert(ignore_permissions=True)

		self.groceries = frappe.get_doc(
			{
				"doctype": "Category",
				"category_name": "Groceries",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.set_user("Administrator")

	# I39 / I40
	def test_get_analytics_returns_total_and_categories(self):
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 30.0,
				"date": "2025-06-15",
				"category": self.groceries.name,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 20.0,
				"date": "2025-06-20",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		result = get_analytics(month=6, year=2025)

		self.assertEqual(result["total"], 50.0)
		self.assertEqual(
			result["categories"],
			[
				{"name": "Groceries", "amount": 30.0, "budget": None, "budget_status": None},
				{"name": "Uncategorized", "amount": 20.0, "budget": None, "budget_status": None},
			],
		)

	# I41
	def test_get_analytics_category_list_sorted_by_amount_descending(self):
		dining = frappe.get_doc(
			{
				"doctype": "Category",
				"category_name": "Dining",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 10.0,
				"date": "2025-06-01",
				"category": dining.name,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 40.0,
				"date": "2025-06-02",
				"category": self.groceries.name,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		result = get_analytics(month=6, year=2025)
		amounts = [c["amount"] for c in result["categories"]]
		self.assertEqual(amounts, sorted(amounts, reverse=True))

	# I42
	def test_get_analytics_with_no_expenses_returns_zero_total_empty_categories(self):
		frappe.set_user(self.member)
		result = get_analytics(month=1, year=2020)
		self.assertEqual(result["total"], 0)
		self.assertEqual(result["categories"], [])

	# I43
	def test_get_analytics_expenses_without_category_counted_and_listed_separately(self):
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 15.0,
				"date": "2025-06-05",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		result = get_analytics(month=6, year=2025)

		self.assertEqual(result["total"], 15.0)
		self.assertEqual(
			result["categories"],
			[{"name": "Uncategorized", "amount": 15.0, "budget": None, "budget_status": None}],
		)

	# I61 / I62
	def test_get_analytics_includes_income_total_and_savings(self):
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 30.0,
				"date": "2025-06-15",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)
		frappe.get_doc(
			{
				"doctype": "Income",
				"amount": 100.0,
				"date": "2025-06-10",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		result = get_analytics(month=6, year=2025)

		self.assertEqual(result["income_total"], 100.0)
		self.assertEqual(result["savings"], 70.0)

	# I63
	def test_get_analytics_with_no_income_savings_is_negative_expense_total(self):
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 40.0,
				"date": "2025-06-15",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		result = get_analytics(month=6, year=2025)

		self.assertEqual(result["income_total"], 0)
		self.assertEqual(result["savings"], -40.0)

	def _category_row(self, result, name):
		return next(c for c in result["categories"] if c["name"] == name)

	# I83
	def test_budget_status_normal_when_spent_below_eighty_percent(self):
		frappe.get_doc(
			{
				"doctype": "Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 100.0,
				"month": 6,
				"year": 2025,
			}
		).insert(ignore_permissions=True)
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 50.0,
				"date": "2025-06-15",
				"category": self.groceries.name,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		result = get_analytics(month=6, year=2025)
		row = self._category_row(result, "Groceries")
		self.assertEqual(row["budget_status"], "Normal")
		self.assertEqual(row["budget"], 100.0)

	# I84
	def test_budget_status_warning_when_spent_at_least_eighty_percent(self):
		frappe.get_doc(
			{
				"doctype": "Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 100.0,
				"month": 6,
				"year": 2025,
			}
		).insert(ignore_permissions=True)
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 80.0,
				"date": "2025-06-15",
				"category": self.groceries.name,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		result = get_analytics(month=6, year=2025)
		self.assertEqual(self._category_row(result, "Groceries")["budget_status"], "Warning")

	# I85
	def test_budget_status_exceeded_when_spent_at_least_hundred_percent(self):
		frappe.get_doc(
			{
				"doctype": "Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 100.0,
				"month": 6,
				"year": 2025,
			}
		).insert(ignore_permissions=True)
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 120.0,
				"date": "2025-06-15",
				"category": self.groceries.name,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		result = get_analytics(month=6, year=2025)
		self.assertEqual(self._category_row(result, "Groceries")["budget_status"], "Exceeded")

	# I86
	def test_budget_status_none_for_category_without_budget(self):
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 30.0,
				"date": "2025-06-15",
				"category": self.groceries.name,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		result = get_analytics(month=6, year=2025)
		self.assertIsNone(self._category_row(result, "Groceries")["budget_status"])


class TestComputeSavings(FrappeTestCase):
	# U12
	def test_savings_positive_when_income_exceeds_expenses(self):
		self.assertEqual(_compute_savings(income_total=100, expense_total=60), 40)

	# U13
	def test_savings_negative_with_no_income(self):
		self.assertEqual(_compute_savings(income_total=0, expense_total=60), -60)

	# U14
	def test_savings_equals_income_with_no_expenses(self):
		self.assertEqual(_compute_savings(income_total=100, expense_total=0), 100)


class TestCategorySettingsApi(FrappeTestCase):
	def setUp(self):
		self.member = _ensure_test_user("settings.member@expenso.test")
		user = frappe.get_doc("User", self.member)
		if "Family Member" not in {r.role for r in user.roles}:
			user.add_roles("Family Member")

		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Settings Test Family",
				"currency": "USD",
				"members": [{"user": self.member}],
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.set_user("Administrator")

	# I44
	def test_add_category_creates_category_for_users_family(self):
		frappe.set_user(self.member)
		doc = add_category(name="Groceries")

		self.assertTrue(frappe.db.exists("Category", doc.name))
		self.assertEqual(doc.category_name, "Groceries")

	# I45
	def test_rename_category_updates_category_name(self):
		frappe.set_user(self.member)
		doc = add_category(name="Groceries")

		rename_category(name=doc.name, new_name="Groceries & Household")

		self.assertEqual(
			frappe.db.get_value("Category", doc.name, "category_name"),
			"Groceries & Household",
		)

	# I47
	def test_add_category_is_linked_to_callers_family_not_another(self):
		other_member = _ensure_test_user("settings.other@expenso.test")
		other_user = frappe.get_doc("User", other_member)
		if "Family Member" not in {r.role for r in other_user.roles}:
			other_user.add_roles("Family Member")
		other_family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Settings Other Family",
				"currency": "USD",
				"members": [{"user": other_member}],
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		doc = add_category(name="Dining")

		self.assertEqual(doc.family, self.family.name)
		self.assertNotEqual(doc.family, other_family.name)

	# I105
	def test_delete_category_removes_from_db(self):
		frappe.set_user(self.member)
		doc = add_category(name="Groceries")

		delete_category(name=doc.name)

		self.assertFalse(frappe.db.exists("Category", doc.name))

	# I106
	def test_delete_category_with_linked_expense_raises_link_exists_error(self):
		frappe.set_user(self.member)
		doc = add_category(name="Groceries")
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 25.0,
				"category": doc.name,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		with self.assertRaises(frappe.LinkExistsError):
			delete_category(name=doc.name)
		self.assertTrue(frappe.db.exists("Category", doc.name))

	# I107
	def test_delete_category_removes_its_budgets(self):
		frappe.set_user(self.member)
		doc = add_category(name="Groceries")
		set_budget(category=doc.name, month=6, year=2025, amount=500)

		delete_category(name=doc.name)

		self.assertEqual(frappe.db.count("Budget", {"category": doc.name}), 0)

	# I108
	def test_delete_category_from_different_family_raises_permission_error(self):
		other_member = _ensure_test_user("settings.deleteother@expenso.test")
		other_user = frappe.get_doc("User", other_member)
		if "Family Member" not in {r.role for r in other_user.roles}:
			other_user.add_roles("Family Member")
		other_family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Settings Delete Other Family",
				"currency": "USD",
				"members": [{"user": other_member}],
			}
		).insert(ignore_permissions=True)
		other_category = frappe.get_doc(
			{
				"doctype": "Category",
				"category_name": "Other Family Category",
				"family": other_family.name,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		with self.assertRaises(frappe.PermissionError):
			delete_category(name=other_category.name)


class TestGetFamilyNameApi(FrappeTestCase):
	def setUp(self):
		self.member = _ensure_test_user("familyname.member@expenso.test")
		user = frappe.get_doc("User", self.member)
		if "Family Member" not in {r.role for r in user.roles}:
			user.add_roles("Family Member")

		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "The Testers",
				"currency": "USD",
				"members": [{"user": self.member}],
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_get_family_name_returns_callers_family_name(self):
		frappe.set_user(self.member)
		self.assertEqual(get_family_name(), "The Testers")

	def test_get_family_name_raises_permission_error_without_a_family(self):
		outsider = _ensure_test_user("familyname.outsider@expenso.test")
		frappe.set_user(outsider)
		with self.assertRaises(frappe.PermissionError):
			get_family_name()


class TestIncomeCrudApi(FrappeTestCase):
	def setUp(self):
		self.member_a = _ensure_test_user("income.membera@expenso.test")
		self.member_b = _ensure_test_user("income.memberb@expenso.test")
		self.outsider = _ensure_test_user("income.outsider@expenso.test")

		for email in (self.member_a, self.member_b):
			user = frappe.get_doc("User", email)
			if "Family Member" not in {r.role for r in user.roles}:
				user.add_roles("Family Member")

		self.family_a = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Income CRUD Test Family A",
				"currency": "USD",
				"members": [{"user": self.member_a}],
			}
		).insert(ignore_permissions=True)

		self.family_b = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Income CRUD Test Family B",
				"currency": "USD",
				"members": [{"user": self.member_b}],
			}
		).insert(ignore_permissions=True)

		self.income_b = frappe.get_doc(
			{
				"doctype": "Income",
				"amount": 400.0,
				"family": self.family_b.name,
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.set_user("Administrator")

	# I64
	def test_create_income_persists(self):
		frappe.set_user(self.member_a)
		doc = create_income(amount=250.0, date="2025-06-01")
		self.assertTrue(frappe.db.exists("Income", doc.name))

	# I65
	def test_update_income_persists_changed_field(self):
		frappe.set_user(self.member_a)
		doc = create_income(amount=250.0)
		updated = update_income(name=doc.name, amount=300.0)
		self.assertEqual(updated.amount, 300.0)
		self.assertEqual(frappe.db.get_value("Income", doc.name, "amount"), 300.0)

	def test_create_income_persists_notes(self):
		frappe.set_user(self.member_a)
		doc = create_income(amount=250.0, notes="Year-end bonus")
		self.assertEqual(frappe.db.get_value("Income", doc.name, "notes"), "Year-end bonus")

	def test_update_income_persists_changed_notes(self):
		frappe.set_user(self.member_a)
		doc = create_income(amount=250.0, notes="Original note")
		updated = update_income(name=doc.name, notes="Updated note")
		self.assertEqual(updated.notes, "Updated note")
		self.assertEqual(frappe.db.get_value("Income", doc.name, "notes"), "Updated note")

	# I66
	def test_delete_income_removes_from_db(self):
		frappe.set_user(self.member_a)
		doc = create_income(amount=250.0)
		delete_income(name=doc.name)
		self.assertFalse(frappe.db.exists("Income", doc.name))

	# I67
	def test_create_income_by_user_without_family_raises_permission_error(self):
		frappe.set_user(self.outsider)
		with self.assertRaises(frappe.PermissionError):
			create_income(amount=250.0)

	# I68
	def test_update_income_from_different_family_raises_permission_error(self):
		frappe.set_user(self.member_a)
		with self.assertRaises(frappe.PermissionError):
			update_income(name=self.income_b.name, amount=999.0)

	# I69
	def test_delete_income_from_different_family_raises_permission_error(self):
		frappe.set_user(self.member_a)
		with self.assertRaises(frappe.PermissionError):
			delete_income(name=self.income_b.name)


class TestSourceSettingsApi(FrappeTestCase):
	def setUp(self):
		self.member = _ensure_test_user("sourcesettings.member@expenso.test")
		user = frappe.get_doc("User", self.member)
		if "Family Member" not in {r.role for r in user.roles}:
			user.add_roles("Family Member")

		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Source Settings Test Family",
				"currency": "USD",
				"members": [{"user": self.member}],
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.set_user("Administrator")

	# I70
	def test_add_source_creates_source_for_users_family(self):
		frappe.set_user(self.member)
		doc = add_source(name="Bonus")

		self.assertTrue(frappe.db.exists("Source", doc.name))
		self.assertEqual(doc.source_name, "Bonus")
		self.assertEqual(doc.family, self.family.name)

	# I71
	def test_rename_source_updates_source_name(self):
		frappe.set_user(self.member)
		doc = add_source(name="Bonus")

		rename_source(name=doc.name, new_name="Annual Bonus")

		self.assertEqual(
			frappe.db.get_value("Source", doc.name, "source_name"),
			"Annual Bonus",
		)

	# I109
	def test_delete_source_removes_from_db(self):
		frappe.set_user(self.member)
		doc = add_source(name="Bonus")

		delete_source(name=doc.name)

		self.assertFalse(frappe.db.exists("Source", doc.name))

	# I110
	def test_delete_source_with_linked_income_raises_link_exists_error(self):
		frappe.set_user(self.member)
		doc = add_source(name="Bonus")
		frappe.get_doc(
			{
				"doctype": "Income",
				"amount": 250.0,
				"source": doc.name,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		with self.assertRaises(frappe.LinkExistsError):
			delete_source(name=doc.name)
		self.assertTrue(frappe.db.exists("Source", doc.name))

	# I111
	def test_delete_source_from_different_family_raises_permission_error(self):
		other_member = _ensure_test_user("sourcesettings.deleteother@expenso.test")
		other_user = frappe.get_doc("User", other_member)
		if "Family Member" not in {r.role for r in other_user.roles}:
			other_user.add_roles("Family Member")
		other_family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Source Settings Delete Other Family",
				"currency": "USD",
				"members": [{"user": other_member}],
			}
		).insert(ignore_permissions=True)
		other_source = frappe.get_doc(
			{
				"doctype": "Source",
				"source_name": "Other Family Source",
				"family": other_family.name,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		with self.assertRaises(frappe.PermissionError):
			delete_source(name=other_source.name)


class TestBudgetSettingsApi(FrappeTestCase):
	def setUp(self):
		self.member = _ensure_test_user("budgetsettings.member@expenso.test")
		user = frappe.get_doc("User", self.member)
		if "Family Member" not in {r.role for r in user.roles}:
			user.add_roles("Family Member")

		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Budget Settings Test Family",
				"currency": "USD",
				"members": [{"user": self.member}],
			}
		).insert(ignore_permissions=True)

		self.groceries = frappe.get_doc(
			{
				"doctype": "Category",
				"category_name": "Groceries",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.set_user("Administrator")

	# I79
	def test_set_budget_creates_budget_when_none_exists(self):
		frappe.set_user(self.member)
		set_budget(category=self.groceries.name, month=6, year=2025, amount=500)

		amount = frappe.db.get_value(
			"Budget", {"category": self.groceries.name, "month": 6, "year": 2025}, "amount"
		)
		self.assertEqual(amount, 500)

	# I80
	def test_set_budget_updates_existing_budget(self):
		frappe.set_user(self.member)
		set_budget(category=self.groceries.name, month=6, year=2025, amount=500)
		set_budget(category=self.groceries.name, month=6, year=2025, amount=800)

		amount = frappe.db.get_value(
			"Budget", {"category": self.groceries.name, "month": 6, "year": 2025}, "amount"
		)
		self.assertEqual(amount, 800)
		self.assertEqual(frappe.db.count("Budget", {"category": self.groceries.name}), 1)

	# I81
	def test_set_budget_with_none_amount_deletes_existing_budget(self):
		frappe.set_user(self.member)
		set_budget(category=self.groceries.name, month=6, year=2025, amount=500)
		set_budget(category=self.groceries.name, month=6, year=2025, amount=None)

		self.assertFalse(
			frappe.db.exists("Budget", {"category": self.groceries.name, "month": 6, "year": 2025})
		)

	# I82
	def test_get_budgets_includes_budget_amount_for_requested_month(self):
		frappe.set_user(self.member)
		set_budget(category=self.groceries.name, month=6, year=2025, amount=500)
		dining = frappe.get_doc(
			{
				"doctype": "Category",
				"category_name": "Dining",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		result = get_budgets(month=6, year=2025)
		by_name = {c["name"]: c["budget_amount"] for c in result}

		self.assertEqual(by_name[self.groceries.name], 500)
		self.assertIsNone(by_name[dining.name])

	# I98
	def test_set_budget_only_affects_the_exact_period(self):
		frappe.set_user(self.member)
		set_budget(category=self.groceries.name, month=6, year=2025, amount=500)
		set_budget(category=self.groceries.name, month=7, year=2025, amount=650)

		june = frappe.db.get_value(
			"Budget", {"category": self.groceries.name, "month": 6, "year": 2025}, "amount"
		)
		july = frappe.db.get_value(
			"Budget", {"category": self.groceries.name, "month": 7, "year": 2025}, "amount"
		)
		self.assertEqual(june, 500)
		self.assertEqual(july, 650)

	# I100
	def test_deleting_one_periods_budget_does_not_break_carry_forward_from_before_it(self):
		frappe.set_user(self.member)
		set_budget(category=self.groceries.name, month=5, year=2025, amount=400)
		set_budget(category=self.groceries.name, month=6, year=2025, amount=500)
		set_budget(category=self.groceries.name, month=6, year=2025, amount=None)

		result = get_budgets(month=7, year=2025)
		by_name = {c["name"]: c["budget_amount"] for c in result}
		self.assertEqual(by_name[self.groceries.name], 400)


class TestBudgetCarryForward(FrappeTestCase):
	def setUp(self):
		self.member = _ensure_test_user("budgetcarryforward.member@expenso.test")
		user = frappe.get_doc("User", self.member)
		if "Family Member" not in {r.role for r in user.roles}:
			user.add_roles("Family Member")

		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Budget Carry Forward Test Family",
				"currency": "USD",
				"members": [{"user": self.member}],
			}
		).insert(ignore_permissions=True)

		self.groceries = frappe.get_doc(
			{
				"doctype": "Category",
				"category_name": "Groceries",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.set_user("Administrator")

	# I104
	def test_get_budgets_with_no_prior_budget_ever_returns_none_and_creates_no_row(self):
		frappe.set_user(self.member)
		result = get_budgets(month=6, year=2025)
		by_name = {c["name"]: c["budget_amount"] for c in result}

		self.assertIsNone(by_name[self.groceries.name])
		self.assertEqual(frappe.db.count("Budget", {"category": self.groceries.name}), 0)

	# I101
	def test_get_budgets_materializes_a_row_carrying_forward_the_prior_periods_amount(self):
		frappe.set_user(self.member)
		set_budget(category=self.groceries.name, month=6, year=2025, amount=500)

		result = get_budgets(month=7, year=2025)
		by_name = {c["name"]: c["budget_amount"] for c in result}

		self.assertEqual(by_name[self.groceries.name], 500)
		self.assertTrue(
			frappe.db.exists("Budget", {"category": self.groceries.name, "month": 7, "year": 2025})
		)

	# I99
	def test_get_budgets_with_an_exact_period_match_creates_no_duplicate_row(self):
		frappe.set_user(self.member)
		set_budget(category=self.groceries.name, month=6, year=2025, amount=500)

		get_budgets(month=6, year=2025)

		self.assertEqual(frappe.db.count("Budget", {"category": self.groceries.name}), 1)

	# I102
	def test_get_budgets_carries_forward_from_the_nearest_prior_period_across_a_gap(self):
		frappe.set_user(self.member)
		set_budget(category=self.groceries.name, month=3, year=2025, amount=300)
		set_budget(category=self.groceries.name, month=6, year=2025, amount=600)

		# September has no row; nothing was ever set for July or August either.
		result = get_budgets(month=9, year=2025)
		by_name = {c["name"]: c["budget_amount"] for c in result}

		self.assertEqual(by_name[self.groceries.name], 600)
		self.assertFalse(
			frappe.db.exists("Budget", {"category": self.groceries.name, "month": 7, "year": 2025})
		)
		self.assertFalse(
			frappe.db.exists("Budget", {"category": self.groceries.name, "month": 8, "year": 2025})
		)

	# I103
	def test_get_budgets_does_not_carry_forward_from_a_future_period(self):
		frappe.set_user(self.member)
		set_budget(category=self.groceries.name, month=12, year=2025, amount=900)

		result = get_budgets(month=6, year=2025)
		by_name = {c["name"]: c["budget_amount"] for c in result}

		self.assertIsNone(by_name[self.groceries.name])

	# I97
	def test_get_analytics_resolves_budget_via_carry_forward_without_writing_a_row(self):
		frappe.get_doc(
			{
				"doctype": "Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 200.0,
				"month": 6,
				"year": 2025,
			}
		).insert(ignore_permissions=True)
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 180.0,
				"date": "2025-07-15",
				"category": self.groceries.name,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.member)
		result = get_analytics(month=7, year=2025)
		row = next(c for c in result["categories"] if c["name"] == "Groceries")

		self.assertEqual(row["budget"], 200.0)
		self.assertEqual(row["budget_status"], "Warning")
		self.assertFalse(
			frappe.db.exists("Budget", {"category": self.groceries.name, "month": 7, "year": 2025})
		)
