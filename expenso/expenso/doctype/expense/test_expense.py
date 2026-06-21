import datetime
import unittest

import frappe
from frappe.tests.utils import FrappeTestCase

from expenso.expenso.doctype.expense.expense import _validate_amount


class TestExpenseUnit(unittest.TestCase):
	# U1
	def test_validate_amount_zero(self):
		self.assertRaises(frappe.ValidationError, _validate_amount, 0)

	# U2
	def test_validate_amount_negative(self):
		self.assertRaises(frappe.ValidationError, _validate_amount, -1)


class TestExpenseIntegration(FrappeTestCase):
	def setUp(self):
		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Expense Test Family",
				"currency": "USD",
			}
		).insert(ignore_permissions=True)

	# I10
	def test_create_expense_with_amount_and_family(self):
		doc = frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 100.0,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)
		self.assertTrue(frappe.db.exists("Expense", doc.name))

	# I11
	def test_create_expense_without_amount_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Expense",
					"family": self.family.name,
				}
			).insert(ignore_permissions=True)

	# I12
	def test_create_expense_without_family_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Expense",
					"amount": 100.0,
				}
			).insert(ignore_permissions=True)

	# I13
	def test_create_expense_without_date_defaults_to_today(self):
		doc = frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 50.0,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)
		self.assertEqual(str(doc.date), str(datetime.date.today()))

	# I14
	def test_create_expense_without_category_succeeds(self):
		doc = frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 75.0,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)
		self.assertIsNone(doc.category)

	# I15
	def test_create_expense_with_valid_category(self):
		cat = frappe.get_doc(
			{
				"doctype": "Category",
				"category_name": "Groceries",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)

		doc = frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": 25.0,
				"family": self.family.name,
				"category": cat.name,
			}
		).insert(ignore_permissions=True)
		self.assertEqual(doc.category, cat.name)
