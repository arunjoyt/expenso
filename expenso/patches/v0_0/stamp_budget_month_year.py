import frappe
from frappe.utils import getdate


def execute():
	"""Stamp pre-existing Budget rows (created before Budget became month-scoped) with the
	current month/year, so they keep applying unchanged starting this month. Safe to re-run:
	only rows still missing month/year are touched.

	Guarded on table_exists and column presence: a site created after the Budget ->
	Expenso Budget rename (#83) never gets a tabBudget table at all, since expenso no
	longer ships that DocType (and a site stuck on a schema from before month/year
	existed never gets those columns added either, for the same reason) — but this
	patch still runs once on every fresh site.
	"""
	if not frappe.db.table_exists("Budget"):
		return

	# Bust the cached column list: nothing re-syncs tabBudget's schema anymore (the
	# Budget DocType no longer exists to sync), so a stale cache entry from earlier
	# in this process would never self-correct otherwise.
	frappe.cache.hdel("table_columns", "tabBudget")
	if not {"month", "year"}.issubset(frappe.db.get_table_columns("Budget")):
		return

	today = getdate()
	frappe.db.sql(
		"""
		UPDATE `tabBudget`
		SET month = %s, year = %s
		WHERE IFNULL(month, 0) <= 0 OR IFNULL(year, 0) <= 0
		""",
		(today.month, today.year),
	)
