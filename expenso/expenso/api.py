import frappe
from frappe import _
from frappe.utils import cint, get_first_day, get_last_day

from expenso.expenso.permissions import get_user_family


@frappe.whitelist()
def get_expenses(month: int, year: int):
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


def _publish_expense_event(event: str, family: str, expense_name: str):
	members = frappe.get_all(
		"Family Member", filters={"parenttype": "Family", "parent": family}, pluck="user"
	)
	for member in members:
		frappe.publish_realtime(
			event, {"name": expense_name, "family": family}, user=member, after_commit=True
		)


@frappe.whitelist()
def create_expense(amount: float, date: str | None = None, category: str | None = None):
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	doc = frappe.get_doc(
		{
			"doctype": "Expense",
			"amount": amount,
			"date": date,
			"category": category,
			"family": family,
		}
	).insert(ignore_permissions=True)

	_publish_expense_event("expense_created", family, doc.name)
	return doc


@frappe.whitelist()
def update_expense(
	name: str, amount: float | None = None, date: str | None = None, category: str | None = None
):
	doc = frappe.get_doc("Expense", name)
	doc.check_permission("write")

	if amount is not None:
		doc.amount = amount
	if date is not None:
		doc.date = date
	doc.category = category

	doc.save(ignore_permissions=True)

	_publish_expense_event("expense_updated", doc.family, doc.name)
	return doc


@frappe.whitelist()
def delete_expense(name: str):
	doc = frappe.get_doc("Expense", name)
	doc.check_permission("delete")

	family = doc.family
	frappe.delete_doc("Expense", name, ignore_permissions=True)

	_publish_expense_event("expense_deleted", family, name)


def _aggregate_categories(expenses):
	totals = {}
	for expense in expenses:
		label = expense.get("category_name") or _("Uncategorized")
		totals[label] = totals.get(label, 0) + expense.get("amount", 0)

	categories = [{"name": name, "amount": amount} for name, amount in totals.items()]
	categories.sort(key=lambda category: category["amount"], reverse=True)
	return categories


@frappe.whitelist()
def get_analytics(month: int, year: int):
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	month = cint(month)
	year = cint(year)
	period_start = get_first_day(f"{year}-{month:02d}-01")
	period_end = get_last_day(f"{year}-{month:02d}-01")

	expenses = frappe.get_all(
		"Expense",
		filters={
			"family": family,
			"date": ["between", [period_start, period_end]],
		},
		fields=["amount", "category", "category.category_name as category_name"],
	)

	return {
		"total": sum(expense.amount for expense in expenses),
		"categories": _aggregate_categories(expenses),
	}
