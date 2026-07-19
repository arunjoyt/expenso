import frappe

from expenso.expenso.doctype.family.family import DEFAULT_CATEGORIES, DEFAULT_SOURCES


def execute():
	"""Seed default Categories/Sources for any Family missing them.

	Family.after_insert only seeds on genuine inserts, so Family records that
	existed before expenso was installed on a site (e.g. a DocType shared with
	another app already on the bench) never got seeded. Safe to re-run: a
	Family is skipped once it has at least one Category/Source.
	"""
	for family in frappe.get_all("Family", pluck="name"):
		if not frappe.db.exists("Category", {"family": family}):
			for category_name in DEFAULT_CATEGORIES:
				frappe.get_doc(
					{
						"doctype": "Category",
						"category_name": category_name,
						"family": family,
					}
				).insert(ignore_permissions=True)

		if not frappe.db.exists("Source", {"family": family}):
			for source_name in DEFAULT_SOURCES:
				frappe.get_doc(
					{
						"doctype": "Source",
						"source_name": source_name,
						"family": family,
					}
				).insert(ignore_permissions=True)
