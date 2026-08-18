import unittest

import frappe
from frappe.tests.utils import FrappeTestCase

from expenso.expenso.doctype.expenso_budget.expenso_budget import compute_budget_status


class TestComputeBudgetStatus(unittest.TestCase):
	# U15
	def test_no_spend_is_normal(self):
		self.assertEqual(compute_budget_status(spent=0, budget=100), "Normal")

	# U16
	def test_below_eighty_percent_is_normal(self):
		self.assertEqual(compute_budget_status(spent=79, budget=100), "Normal")

	# U17
	def test_at_eighty_percent_is_warning(self):
		self.assertEqual(compute_budget_status(spent=80, budget=100), "Warning")

	# U18
	def test_below_hundred_percent_is_warning(self):
		self.assertEqual(compute_budget_status(spent=99, budget=100), "Warning")

	# U19
	def test_at_hundred_percent_is_exceeded(self):
		self.assertEqual(compute_budget_status(spent=100, budget=100), "Exceeded")

	# U20
	def test_above_hundred_percent_is_exceeded(self):
		self.assertEqual(compute_budget_status(spent=150, budget=100), "Exceeded")

	# U21
	def test_zero_budget_does_not_divide_by_zero(self):
		self.assertIsNone(compute_budget_status(spent=50, budget=0))


class TestBudgetIntegration(FrappeTestCase):
	def setUp(self):
		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Budget Test Family",
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

	# I72
	def test_create_budget_with_category_family_amount_month_year(self):
		doc = frappe.get_doc(
			{
				"doctype": "Expenso Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 500.0,
				"month": 6,
				"year": 2025,
			}
		).insert(ignore_permissions=True)
		self.assertTrue(frappe.db.exists("Expenso Budget", doc.name))

	# I73
	def test_second_budget_for_same_category_family_and_month_raises_validation_error(self):
		frappe.get_doc(
			{
				"doctype": "Expenso Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 500.0,
				"month": 6,
				"year": 2025,
			}
		).insert(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "Expenso Budget",
					"category": self.groceries.name,
					"family": self.family.name,
					"amount": 300.0,
					"month": 6,
					"year": 2025,
				}
			).insert(ignore_permissions=True)

	# I74
	def test_budget_for_different_category_in_same_family_is_allowed(self):
		dining = frappe.get_doc(
			{
				"doctype": "Category",
				"category_name": "Dining",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		frappe.get_doc(
			{
				"doctype": "Expenso Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 500.0,
				"month": 6,
				"year": 2025,
			}
		).insert(ignore_permissions=True)
		second = frappe.get_doc(
			{
				"doctype": "Expenso Budget",
				"category": dining.name,
				"family": self.family.name,
				"amount": 200.0,
				"month": 6,
				"year": 2025,
			}
		).insert(ignore_permissions=True)
		self.assertTrue(frappe.db.exists("Expenso Budget", second.name))

	# I75
	def test_create_budget_without_category_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Expenso Budget",
					"family": self.family.name,
					"amount": 500.0,
					"month": 6,
					"year": 2025,
				}
			).insert(ignore_permissions=True)

	# I76
	def test_create_budget_without_family_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Expenso Budget",
					"category": self.groceries.name,
					"amount": 500.0,
					"month": 6,
					"year": 2025,
				}
			).insert(ignore_permissions=True)

	# I77
	def test_create_budget_with_zero_amount_raises_validation_error(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "Expenso Budget",
					"category": self.groceries.name,
					"family": self.family.name,
					"amount": 0,
					"month": 6,
					"year": 2025,
				}
			).insert(ignore_permissions=True)

	# I78
	def test_create_budget_with_negative_amount_raises_validation_error(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "Expenso Budget",
					"category": self.groceries.name,
					"family": self.family.name,
					"amount": -50,
					"month": 6,
					"year": 2025,
				}
			).insert(ignore_permissions=True)

	# I91
	def test_create_budget_without_month_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Expenso Budget",
					"category": self.groceries.name,
					"family": self.family.name,
					"amount": 500.0,
					"year": 2025,
				}
			).insert(ignore_permissions=True)

	# I92
	def test_create_budget_without_year_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Expenso Budget",
					"category": self.groceries.name,
					"family": self.family.name,
					"amount": 500.0,
					"month": 6,
				}
			).insert(ignore_permissions=True)

	# I93
	def test_create_budget_with_month_zero_raises_validation_error(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "Expenso Budget",
					"category": self.groceries.name,
					"family": self.family.name,
					"amount": 500.0,
					"month": 0,
					"year": 2025,
				}
			).insert(ignore_permissions=True)

	# I94
	def test_create_budget_with_month_thirteen_raises_validation_error(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "Expenso Budget",
					"category": self.groceries.name,
					"family": self.family.name,
					"amount": 500.0,
					"month": 13,
					"year": 2025,
				}
			).insert(ignore_permissions=True)

	# I95
	def test_budget_for_same_category_in_different_month_is_allowed(self):
		frappe.get_doc(
			{
				"doctype": "Expenso Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 500.0,
				"month": 6,
				"year": 2025,
			}
		).insert(ignore_permissions=True)
		second = frappe.get_doc(
			{
				"doctype": "Expenso Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 600.0,
				"month": 7,
				"year": 2025,
			}
		).insert(ignore_permissions=True)
		self.assertTrue(frappe.db.exists("Expenso Budget", second.name))

	# I96
	def test_budget_for_same_category_and_month_in_different_year_is_allowed(self):
		frappe.get_doc(
			{
				"doctype": "Expenso Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 500.0,
				"month": 6,
				"year": 2025,
			}
		).insert(ignore_permissions=True)
		second = frappe.get_doc(
			{
				"doctype": "Expenso Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 550.0,
				"month": 6,
				"year": 2026,
			}
		).insert(ignore_permissions=True)
		self.assertTrue(frappe.db.exists("Expenso Budget", second.name))

	# I90
	def test_list_view_shows_category_amount_month_year_family(self):
		meta = frappe.get_meta("Expenso Budget")
		in_list = {f.fieldname for f in meta.fields if f.in_list_view}
		in_filter = {f.fieldname for f in meta.fields if f.in_standard_filter}
		self.assertEqual(in_list, {"category", "amount", "month", "year", "family"})
		self.assertEqual(in_filter, {"category", "family", "month", "year"})
