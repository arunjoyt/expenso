import frappe
from frappe.desk.query_report import run as run_report
from frappe.tests.utils import FrappeTestCase


def _ensure_test_user(email):
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Report Test",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
	return email


class TestExpensoWorkspace(FrappeTestCase):
	# I48
	def test_expenso_workspace_exists(self):
		self.assertTrue(frappe.db.exists("Workspace", "Expenso"))

	# I49
	def test_expenso_workspace_no_redundant_links(self):
		# Navigation to each DocType's list is handled by the Number Cards
		# (I50) — a plain Workspace Link section would just duplicate that.
		links = frappe.get_all("Workspace Link", filters={"parent": "Expenso"})
		self.assertEqual(len(links), 0)

	# I50
	def test_expenso_workspace_number_cards_all_doctypes(self):
		cards = frappe.get_all(
			"Workspace Number Card",
			filters={"parent": "Expenso"},
			pluck="number_card_name",
		)
		self.assertCountEqual(cards, ["Families", "Categories", "Expenses", "Income", "Sources", "Budgets"])
		for card_name, document_type in {
			"Families": "Family",
			"Categories": "Category",
			"Expenses": "Expense",
			"Income": "Income",
			"Sources": "Source",
			"Budgets": "Expenso Budget",
		}.items():
			self.assertEqual(frappe.db.get_value("Number Card", card_name, "document_type"), document_type)

	# I51
	def test_family_members_report_resolves_user_to_family(self):
		report = frappe.get_doc("Report", "Family Members")
		self.assertEqual(report.report_type, "Script Report")
		self.assertCountEqual([r.role for r in report.roles], ["System Manager"])

		user = _ensure_test_user("reporttest.member@expenso.test")
		family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Report Test Family",
				"currency": "USD",
				"members": [{"user": user}],
			}
		).insert(ignore_permissions=True)

		# No filters at all — the exact call the report page makes on first
		# load, before any client-side filter defaults are applied. A plain
		# SQL Query Report can't survive this (missing %(param)s raises a
		# KeyError); this is why the report is a Script Report instead.
		result = run_report("Family Members")
		match = next(r for r in result["result"] if r["user"] == user)
		self.assertEqual(match["family"], family.name)
		self.assertEqual(match["family_name"], "Report Test Family")

	# I52
	def test_family_members_report_filters_by_user_and_family(self):
		user_a = _ensure_test_user("reporttest.filtera@expenso.test")
		user_b = _ensure_test_user("reporttest.filterb@expenso.test")
		family_a = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Report Filter Family A",
				"currency": "USD",
				"members": [{"user": user_a}],
			}
		).insert(ignore_permissions=True)
		frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Report Filter Family B",
				"currency": "USD",
				"members": [{"user": user_b}],
			}
		).insert(ignore_permissions=True)

		by_user = run_report("Family Members", filters={"user": user_a})["result"]
		self.assertCountEqual([r["user"] for r in by_user], [user_a])

		by_family = run_report("Family Members", filters={"family": family_a.name})["result"]
		self.assertCountEqual([r["user"] for r in by_family], [user_a])
