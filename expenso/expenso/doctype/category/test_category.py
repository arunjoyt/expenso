import frappe
from frappe.tests.utils import FrappeTestCase


class TestCategoryIntegration(FrappeTestCase):
	def setUp(self):
		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Cat Test Family",
				"currency": "USD",
			}
		).insert(ignore_permissions=True)
		self.family2 = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Cat Test Family 2",
				"currency": "USD",
			}
		).insert(ignore_permissions=True)

	# I6
	def test_create_category(self):
		cat = frappe.get_doc(
			{
				"doctype": "Category",
				"category_name": "Groceries",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)
		self.assertRegex(cat.name, r"CAT-\d+")

	# I7
	def test_create_category_without_name_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Category",
					"family": self.family.name,
				}
			).insert(ignore_permissions=True)

	# I8
	def test_create_category_without_family_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Category",
					"category_name": "Orphan",
				}
			).insert(ignore_permissions=True)

	# I9
	def test_same_category_name_allowed_in_different_families(self):
		cat1 = frappe.get_doc(
			{
				"doctype": "Category",
				"category_name": "Groceries",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)
		cat2 = frappe.get_doc(
			{
				"doctype": "Category",
				"category_name": "Groceries",
				"family": self.family2.name,
			}
		).insert(ignore_permissions=True)
		self.assertNotEqual(cat1.name, cat2.name)
		self.assertTrue(frappe.db.exists("Category", cat1.name))
		self.assertTrue(frappe.db.exists("Category", cat2.name))
