import frappe


def execute():
	"""Backfill `entry_method` on pre-existing Expense/Income rows.

	The field was added in P6-S1 (ADR 0008). Rows written by the external MCP
	connector carry `is_external_write=1` — those become `connector`; every
	other existing row is a manual entry.

	Safe to re-run: it only ever reasserts values derived from `is_external_write`,
	which this patch never changes.
	"""
	for doctype in ("Expense", "Income"):
		frappe.db.set_value(
			doctype, {"is_external_write": 1}, "entry_method", "connector", update_modified=False
		)
		frappe.db.set_value(
			doctype, {"is_external_write": ("!=", 1)}, "entry_method", "manual", update_modified=False
		)
