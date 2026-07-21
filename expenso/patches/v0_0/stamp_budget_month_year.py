import frappe
from frappe.utils import getdate


def execute():
	"""Stamp pre-existing Budget rows (created before Budget became month-scoped) with the
	current month/year, so they keep applying unchanged starting this month. Safe to re-run:
	only rows still missing month/year are touched.
	"""
	today = getdate()
	frappe.db.sql(
		"""
		UPDATE `tabBudget`
		SET month = %s, year = %s
		WHERE IFNULL(month, 0) <= 0 OR IFNULL(year, 0) <= 0
		""",
		(today.month, today.year),
	)
