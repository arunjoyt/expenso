import frappe
from frappe import _
from frappe.utils import cint, get_first_day, get_last_day

from expenso import __version__
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


def _compute_savings(income_total, expense_total):
	return income_total - expense_total


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
	incomes = frappe.get_all(
		"Income",
		filters={
			"family": family,
			"date": ["between", [period_start, period_end]],
		},
		fields=["amount"],
	)

	expense_total = sum(expense.amount for expense in expenses)
	income_total = sum(income.amount for income in incomes)

	return {
		"total": expense_total,
		"categories": _aggregate_categories(expenses),
		"income_total": income_total,
		"savings": _compute_savings(income_total, expense_total),
	}


@frappe.whitelist()
def add_category(name: str):
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	return frappe.get_doc(
		{
			"doctype": "Category",
			"category_name": name,
			"family": family,
		}
	).insert(ignore_permissions=True)


@frappe.whitelist()
def rename_category(name: str, new_name: str):
	doc = frappe.get_doc("Category", name)
	doc.check_permission("write")

	doc.category_name = new_name
	doc.save(ignore_permissions=True)
	return doc


@frappe.whitelist()
def get_app_version():
	return __version__


@frappe.whitelist()
def create_income(amount: float, date: str | None = None, source: str | None = None):
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	return frappe.get_doc(
		{
			"doctype": "Income",
			"amount": amount,
			"date": date,
			"source": source,
			"family": family,
		}
	).insert(ignore_permissions=True)


@frappe.whitelist()
def update_income(name: str, amount: float | None = None, date: str | None = None, source: str | None = None):
	doc = frappe.get_doc("Income", name)
	doc.check_permission("write")

	if amount is not None:
		doc.amount = amount
	if date is not None:
		doc.date = date
	doc.source = source

	doc.save(ignore_permissions=True)
	return doc


@frappe.whitelist()
def delete_income(name: str):
	doc = frappe.get_doc("Income", name)
	doc.check_permission("delete")
	frappe.delete_doc("Income", name, ignore_permissions=True)


@frappe.whitelist()
def add_source(name: str):
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	return frappe.get_doc(
		{
			"doctype": "Source",
			"source_name": name,
			"family": family,
		}
	).insert(ignore_permissions=True)


@frappe.whitelist()
def rename_source(name: str, new_name: str):
	doc = frappe.get_doc("Source", name)
	doc.check_permission("write")

	doc.source_name = new_name
	doc.save(ignore_permissions=True)
	return doc


@frappe.whitelist()
def get_categories_with_budgets():
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	categories = frappe.get_all(
		"Category",
		filters={"family": family},
		fields=["name", "category_name"],
		order_by="category_name asc",
	)
	budgets = frappe.get_all(
		"Budget",
		filters={"family": family},
		fields=["category", "amount"],
	)
	budget_by_category = {budget.category: budget.amount for budget in budgets}

	for category in categories:
		category["budget_amount"] = budget_by_category.get(category.name)

	return categories


@frappe.whitelist()
def set_budget(category: str, amount: float | None = None):
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	existing_name = frappe.db.exists("Budget", {"category": category, "family": family})

	if amount is None:
		if existing_name:
			frappe.delete_doc("Budget", existing_name, ignore_permissions=True)
		return None

	if existing_name:
		doc = frappe.get_doc("Budget", existing_name)
		doc.amount = amount
		doc.save(ignore_permissions=True)
		return doc

	return frappe.get_doc(
		{
			"doctype": "Budget",
			"category": category,
			"family": family,
			"amount": amount,
		}
	).insert(ignore_permissions=True)
