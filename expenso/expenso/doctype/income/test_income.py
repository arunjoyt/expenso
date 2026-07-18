import datetime
import unittest

import frappe
from frappe.tests.utils import FrappeTestCase

from expenso.expenso.doctype.income.income import _validate_amount


class TestIncomeUnit(unittest.TestCase):
	# U10
	def test_validate_amount_zero(self):
		self.assertRaises(frappe.ValidationError, _validate_amount, 0)

	# U11
	def test_validate_amount_negative(self):
		self.assertRaises(frappe.ValidationError, _validate_amount, -1)


class TestIncomeIntegration(FrappeTestCase):
	def setUp(self):
		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Income Test Family",
				"currency": "USD",
			}
		).insert(ignore_permissions=True)

	# I51
	def test_create_income_with_amount_and_family(self):
		doc = frappe.get_doc(
			{
				"doctype": "Income",
				"amount": 100.0,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)
		self.assertTrue(frappe.db.exists("Income", doc.name))

	# I52
	def test_create_income_without_amount_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Income",
					"family": self.family.name,
				}
			).insert(ignore_permissions=True)

	# I53
	def test_create_income_without_family_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Income",
					"amount": 100.0,
				}
			).insert(ignore_permissions=True)

	# I54
	def test_create_income_without_date_defaults_to_today(self):
		doc = frappe.get_doc(
			{
				"doctype": "Income",
				"amount": 50.0,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)
		self.assertEqual(str(doc.date), str(datetime.date.today()))

	# I55
	def test_create_income_without_source_succeeds(self):
		doc = frappe.get_doc(
			{
				"doctype": "Income",
				"amount": 75.0,
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)
		self.assertIsNone(doc.source)
