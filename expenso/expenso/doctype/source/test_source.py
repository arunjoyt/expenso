import frappe
from frappe.tests.utils import FrappeTestCase


class TestSourceIntegration(FrappeTestCase):
	def setUp(self):
		self.family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Source Test Family",
				"currency": "USD",
			}
		).insert(ignore_permissions=True)

	# I48
	def test_create_source(self):
		source = frappe.get_doc(
			{
				"doctype": "Source",
				"source_name": "Salary",
				"family": self.family.name,
			}
		).insert(ignore_permissions=True)
		self.assertRegex(source.name, r"SRC-\d+")

	# I49
	def test_create_source_without_name_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Source",
					"family": self.family.name,
				}
			).insert(ignore_permissions=True)

	# I50
	def test_create_source_without_family_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Source",
					"source_name": "Orphan",
				}
			).insert(ignore_permissions=True)

	# I91
	def test_source_shows_title_wherever_linked(self):
		# Without this, any list/link column showing a Source (e.g. Income's
		# list view) displays the raw "SRC-0001" name instead of "Salary".
		meta = frappe.get_meta("Source")
		self.assertEqual(meta.title_field, "source_name")
		self.assertTrue(meta.show_title_field_in_link)
