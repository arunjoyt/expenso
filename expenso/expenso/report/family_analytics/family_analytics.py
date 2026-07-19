import frappe
from frappe import _

from expenso.expenso.api import compute_analytics


def execute(filters=None):
	filters = filters or {}

	columns = [
		{"label": _("Category"), "fieldname": "name", "fieldtype": "Data", "width": 200},
		{"label": _("Amount"), "fieldname": "amount", "fieldtype": "Currency", "width": 120},
		{"label": _("Budget Status"), "fieldname": "budget_status", "fieldtype": "Data", "width": 120},
	]

	if not filters.get("family") or not filters.get("month") or not filters.get("year"):
		return columns, [], None, None, []

	result = compute_analytics(filters["family"], filters["month"], filters["year"])

	report_summary = [
		{"label": _("Expense Total"), "value": result["total"], "datatype": "Currency"},
		{"label": _("Income Total"), "value": result["income_total"], "datatype": "Currency"},
		{
			"label": _("Savings"),
			"value": result["savings"],
			"datatype": "Currency",
			"indicator": "Red" if result["savings"] < 0 else "Green",
		},
	]

	data = [
		{
			"name": category["name"],
			"amount": category["amount"],
			"budget_status": category["budget_status"] or "",
		}
		for category in result["categories"]
	]

	return columns, data, None, None, report_summary
