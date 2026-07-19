import frappe
from frappe.tests.utils import FrappeTestCase

from expenso.patches.v0_0.backfill_family_categories_and_sources import execute


class TestBackfillFamilyCategoriesAndSources(FrappeTestCase):
	def _make_bare_family(self, family_name):
		# db_insert() skips controller hooks (after_insert), simulating a Family
		# that existed before expenso's seeding hook ever ran on this site.
		family = frappe.get_doc({"doctype": "Family", "family_name": family_name, "currency": "USD"})
		family.db_insert()
		return family.name

	def test_backfills_categories_and_sources_for_family_missing_both(self):
		name = self._make_bare_family("Bare Family 1")
		self.assertEqual(frappe.db.count("Category", {"family": name}), 0)
		self.assertEqual(frappe.db.count("Source", {"family": name}), 0)

		execute()

		self.assertEqual(frappe.db.count("Category", {"family": name}), 8)
		self.assertEqual(frappe.db.count("Source", {"family": name}), 4)

	def test_does_not_touch_family_that_already_has_categories_and_sources(self):
		family = frappe.get_doc({"doctype": "Family", "family_name": "Seeded Family", "currency": "USD"}).insert(
			ignore_permissions=True
		)
		self.assertEqual(frappe.db.count("Category", {"family": family.name}), 8)
		self.assertEqual(frappe.db.count("Source", {"family": family.name}), 4)

		execute()

		self.assertEqual(frappe.db.count("Category", {"family": family.name}), 8)
		self.assertEqual(frappe.db.count("Source", {"family": family.name}), 4)

	def test_running_twice_does_not_duplicate(self):
		name = self._make_bare_family("Bare Family 2")

		execute()
		execute()

		self.assertEqual(frappe.db.count("Category", {"family": name}), 8)
		self.assertEqual(frappe.db.count("Source", {"family": name}), 4)
