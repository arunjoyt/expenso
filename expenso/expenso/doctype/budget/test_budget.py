import unittest

import frappe
from frappe.tests.utils import FrappeTestCase

from expenso.expenso.doctype.budget.budget import compute_budget_status


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
	def test_create_budget_with_category_family_and_amount(self):
		doc = frappe.get_doc(
			{
				"doctype": "Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 500.0,
			}
		).insert(ignore_permissions=True)
		self.assertTrue(frappe.db.exists("Budget", doc.name))

	# I73
	def test_second_budget_for_same_category_and_family_raises_validation_error(self):
		frappe.get_doc(
			{
				"doctype": "Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 500.0,
			}
		).insert(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "Budget",
					"category": self.groceries.name,
					"family": self.family.name,
					"amount": 300.0,
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
				"doctype": "Budget",
				"category": self.groceries.name,
				"family": self.family.name,
				"amount": 500.0,
			}
		).insert(ignore_permissions=True)
		second = frappe.get_doc(
			{
				"doctype": "Budget",
				"category": dining.name,
				"family": self.family.name,
				"amount": 200.0,
			}
		).insert(ignore_permissions=True)
		self.assertTrue(frappe.db.exists("Budget", second.name))

	# I75
	def test_create_budget_without_category_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Budget",
					"family": self.family.name,
					"amount": 500.0,
				}
			).insert(ignore_permissions=True)

	# I76
	def test_create_budget_without_family_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Budget",
					"category": self.groceries.name,
					"amount": 500.0,
				}
			).insert(ignore_permissions=True)

	# I77
	def test_create_budget_with_zero_amount_raises_validation_error(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "Budget",
					"category": self.groceries.name,
					"family": self.family.name,
					"amount": 0,
				}
			).insert(ignore_permissions=True)

	# I78
	def test_create_budget_with_negative_amount_raises_validation_error(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "Budget",
					"category": self.groceries.name,
					"family": self.family.name,
					"amount": -50,
				}
			).insert(ignore_permissions=True)

	# I90
	def test_list_view_shows_category_amount_family(self):
		meta = frappe.get_meta("Budget")
		in_list = {f.fieldname for f in meta.fields if f.in_list_view}
		in_filter = {f.fieldname for f in meta.fields if f.in_standard_filter}
		self.assertEqual(in_list, {"category", "amount", "family"})
		self.assertEqual(in_filter, {"category", "family"})
