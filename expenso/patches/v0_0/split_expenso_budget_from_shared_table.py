import frappe


def execute():
	"""Split expenso's rows back out of tabBudget (#83).

	expenso's Budget DocType used to collide with ERPNext core's own Budget DocType
	(same name, different module) whenever both apps were installed on one site —
	Frappe has no cross-app DocType name collision detection, so the two apps
	silently shared one tabBudget table, each only reading/writing its own columns.
	expenso's Budget DocType has since been renamed to Expenso Budget to stop
	colliding; this patch moves expenso's existing rows into the new table and
	removes them from tabBudget, leaving any ERPNext-owned rows untouched.

	Safe to re-run: rows already moved no longer match the row_filter, so a second
	run touches nothing. Safe on sites that never had the collision (or never had
	Budget at all) — the guards below make it a no-op there.
	"""
	if not frappe.db.table_exists("Budget"):
		return

	# Bust the cached column list: nothing re-syncs tabBudget's schema anymore (the
	# Budget DocType no longer exists to sync), so a stale cache entry from earlier
	# in this process would never self-correct otherwise.
	frappe.cache.hdel("table_columns", "tabBudget")
	columns = set(frappe.db.get_table_columns("Budget"))
	expenso_columns = {"category", "amount", "month", "year", "family"}
	if not expenso_columns.issubset(columns):
		return

	# These 5 columns don't exist in ERPNext's own Budget schema, so a genuine
	# ERPNext-created row can never have all of them populated — this positively
	# identifies expenso's rows regardless of which app's DocType meta happened to
	# be active when a given row was written.
	row_filter = (
		"category IS NOT NULL AND amount IS NOT NULL AND month IS NOT NULL "
		"AND year IS NOT NULL AND family IS NOT NULL"
	)

	frappe.db.sql(
		f"""
		INSERT IGNORE INTO `tabExpenso Budget`
			(name, creation, modified, modified_by, owner, docstatus, idx,
			 category, amount, month, year, family)
		SELECT name, creation, modified, modified_by, owner, docstatus, idx,
			   category, amount, month, year, family
		FROM `tabBudget`
		WHERE {row_filter}
		"""
	)  # nosemgrep

	frappe.db.sql(f"DELETE FROM `tabBudget` WHERE {row_filter}")  # nosemgrep
