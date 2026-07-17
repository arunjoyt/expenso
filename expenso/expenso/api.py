import frappe
from frappe import _
from frappe.utils import cint, get_first_day, get_last_day

from expenso.expenso.permissions import get_user_family


@frappe.whitelist()
def get_expenses(month, year):
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	month = cint(month)
	year = cint(year)
	period_start = get_first_day(f"{year}-{month:02d}-01")
	period_end = get_last_day(f"{year}-{month:02d}-01")

	return frappe.get_all(
		"Expense",
		filters={
			"family": family,
			"date": ["between", [period_start, period_end]],
		},
		fields=["name", "amount", "date", "category", "category.category_name as category_name"],
		order_by="date desc, `tabExpense`.creation desc",
	)
