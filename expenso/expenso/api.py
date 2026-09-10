import frappe
from frappe import _
from frappe.utils import cint, get_datetime, get_first_day, get_last_day

from expenso.expenso.doctype.expenso_budget.expenso_budget import compute_budget_status
from expenso.expenso.permissions import get_user_family

# Provenance of a ledger row, orthogonal to `is_external_write`. The frontend
# and the in-app Assistant only ever set `manual` / `assistant` / `receipt`;
# `connector` is set on the external-connector write path (see expenso/mcp.py).
ENTRY_METHODS = ("manual", "assistant", "connector", "receipt")


def _resolve_entry_method(value: str | None) -> str:
	return value if value in ENTRY_METHODS else "manual"


def _guard_not_stale(doc, if_modified_since: str | None):
	"""Reject a write when the row changed after the caller last read it.

	The Assistant reads a row, shows it in a confirm card, and only later
	sends the edit/delete. `if_modified_since` is the `modified` timestamp it
	saw; if the row has moved on since, the write would silently clobber that
	change, so we reject it and let the agent re-read and re-propose (ADR 0008).
	"""
	if not if_modified_since:
		return
	if get_datetime(doc.modified) > get_datetime(if_modified_since):
		frappe.throw(
			_("This entry changed since it was last read. Re-read it and try again."),
			frappe.TimestampMismatchError,
		)


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
		fields=[
			"name",
			"amount",
			"date",
			"category",
			"category.category_name as category_name",
			"notes",
			"is_external_write",
			"external_write_message",
		],
		order_by="date desc, `tabExpense`.creation desc",
	)


def _publish_family_event(event: str, family: str, doc_name: str):
	members = frappe.get_all(
		"Family Member", filters={"parenttype": "Family", "parent": family}, pluck="user"
	)
	for member in members:
		frappe.publish_realtime(event, {"name": doc_name, "family": family}, user=member, after_commit=True)


@frappe.whitelist()
def create_expense(
	amount: float,
	date: str | None = None,
	category: str | None = None,
	notes: str | None = None,
	entry_method: str | None = None,
):
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	doc = frappe.get_doc(
		{
			"doctype": "Expense",
			"amount": amount,
			"date": date,
			"category": category,
			"notes": notes,
			"family": family,
			"entry_method": _resolve_entry_method(entry_method),
		}
	).insert(ignore_permissions=True)

	_publish_family_event("expense_created", family, doc.name)
	return doc


@frappe.whitelist()
def update_expense(
	name: str,
	amount: float | None = None,
	date: str | None = None,
	category: str | None = None,
	notes: str | None = None,
	if_modified_since: str | None = None,
):
	doc = frappe.get_doc("Expense", name)
	doc.check_permission("write")
	_guard_not_stale(doc, if_modified_since)

	if amount is not None:
		doc.amount = amount
	if date is not None:
		doc.date = date
	doc.category = category
	doc.notes = notes

	doc.save(ignore_permissions=True)

	_publish_family_event("expense_updated", doc.family, doc.name)
	return doc


@frappe.whitelist()
def delete_expense(name: str, if_modified_since: str | None = None):
	doc = frappe.get_doc("Expense", name)
	doc.check_permission("delete")
	_guard_not_stale(doc, if_modified_since)

	family = doc.family
	frappe.delete_doc("Expense", name, ignore_permissions=True)

	_publish_family_event("expense_deleted", family, name)


def _aggregate_categories(expenses):
	totals = {}
	for expense in expenses:
		label = expense.get("category_name") or _("Uncategorized")
		totals[label] = totals.get(label, 0) + expense.get("amount", 0)

	categories = [{"name": name, "amount": amount} for name, amount in totals.items()]
	categories.sort(key=lambda category: category["amount"], reverse=True)
	return categories


def _add_budgeted_categories(categories, family, month, year):
	existing_names = {category["name"] for category in categories}
	for category in frappe.get_all("Category", filters={"family": family}, fields=["name", "category_name"]):
		if category.category_name in existing_names:
			continue
		budget_amount = _resolve_budget_amount(category.name, family, month, year)
		if budget_amount is None:
			continue
		categories.append(
			{
				"name": category.category_name,
				"amount": 0,
				"budget": budget_amount,
				"budget_status": compute_budget_status(0, budget_amount),
			}
		)
		existing_names.add(category.category_name)
	return categories


def _period_key(month, year):
	return cint(year) * 12 + cint(month)


def _find_prior_budget(category, family, month, year):
	rows = frappe.get_all(
		"Expenso Budget",
		filters={"category": category, "family": family},
		fields=["name", "amount", "month", "year"],
	)
	requested_key = _period_key(month, year)
	prior = [row for row in rows if _period_key(row.month, row.year) < requested_key]
	if not prior:
		return None
	return max(prior, key=lambda row: _period_key(row.month, row.year))


def _resolve_budget_amount(category, family, month, year):
	exact = frappe.db.get_value(
		"Expenso Budget",
		{"category": category, "family": family, "month": month, "year": year},
		"amount",
	)
	if exact is not None:
		return exact

	prior = _find_prior_budget(category, family, month, year)
	return prior.amount if prior else None


def _attach_budget_status(categories, expenses, family, month, year):
	spent_by_category_id = {}
	category_id_by_label = {}
	for expense in expenses:
		category_id = expense.get("category")
		if not category_id:
			continue
		label = expense.get("category_name") or _("Uncategorized")
		category_id_by_label[label] = category_id
		spent_by_category_id[category_id] = spent_by_category_id.get(category_id, 0) + expense.get(
			"amount", 0
		)

	for category in categories:
		if "budget" in category:
			continue

		category_id = category_id_by_label.get(category["name"])
		budget_amount = _resolve_budget_amount(category_id, family, month, year) if category_id else None
		category["budget"] = budget_amount
		category["budget_status"] = (
			compute_budget_status(spent_by_category_id.get(category_id, 0), budget_amount)
			if category_id
			else None
		)

	return categories


def _compute_balance(income_total, expense_total):
	return income_total - expense_total


def compute_analytics(family: str, month: int, year: int):
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

	categories = _aggregate_categories(expenses)
	categories = _add_budgeted_categories(categories, family, month, year)
	categories = _attach_budget_status(categories, expenses, family, month, year)
	categories.sort(key=lambda category: category["amount"], reverse=True)

	return {
		"total": expense_total,
		"categories": categories,
		"income_total": income_total,
		"balance": _compute_balance(income_total, expense_total),
	}


@frappe.whitelist()
def get_analytics(month: int, year: int):
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	return compute_analytics(family, month, year)


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
def delete_category(name: str):
	doc = frappe.get_doc("Category", name)
	doc.check_permission("delete")

	for budget_name in frappe.get_all(
		"Expenso Budget", filters={"category": name, "family": doc.family}, pluck="name"
	):
		frappe.delete_doc("Expenso Budget", budget_name, ignore_permissions=True)

	frappe.delete_doc("Category", name, ignore_permissions=True)


@frappe.whitelist()
def get_family_name():
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	return frappe.db.get_value("Family", family, "family_name")


@frappe.whitelist()
def list_categories():
	"""The calling Member's Family's Category names.

	Used by the Assistant to validate a `category` value before a write.
	"""
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	return frappe.get_all(
		"Category", filters={"family": family}, pluck="category_name", order_by="category_name asc"
	)


@frappe.whitelist()
def list_sources():
	"""The calling Member's Family's Source names.

	Used by the Assistant to validate a `source` value before a write.
	"""
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	return frappe.get_all(
		"Source", filters={"family": family}, pluck="source_name", order_by="source_name asc"
	)


@frappe.whitelist()
def get_income(month: int, year: int):
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	month = cint(month)
	year = cint(year)
	period_start = get_first_day(f"{year}-{month:02d}-01")
	period_end = get_last_day(f"{year}-{month:02d}-01")

	return frappe.get_all(
		"Income",
		filters={
			"family": family,
			"date": ["between", [period_start, period_end]],
		},
		fields=[
			"name",
			"amount",
			"date",
			"source",
			"source.source_name as source_name",
			"notes",
			"is_external_write",
			"external_write_message",
		],
		order_by="date desc, `tabIncome`.creation desc",
	)


@frappe.whitelist()
def create_income(
	amount: float,
	date: str | None = None,
	source: str | None = None,
	notes: str | None = None,
	entry_method: str | None = None,
):
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	doc = frappe.get_doc(
		{
			"doctype": "Income",
			"amount": amount,
			"date": date,
			"source": source,
			"notes": notes,
			"family": family,
			"entry_method": _resolve_entry_method(entry_method),
		}
	).insert(ignore_permissions=True)

	_publish_family_event("income_created", family, doc.name)
	return doc


@frappe.whitelist()
def update_income(
	name: str,
	amount: float | None = None,
	date: str | None = None,
	source: str | None = None,
	notes: str | None = None,
	if_modified_since: str | None = None,
):
	doc = frappe.get_doc("Income", name)
	doc.check_permission("write")
	_guard_not_stale(doc, if_modified_since)

	if amount is not None:
		doc.amount = amount
	if date is not None:
		doc.date = date
	doc.source = source
	doc.notes = notes

	doc.save(ignore_permissions=True)

	_publish_family_event("income_updated", doc.family, doc.name)
	return doc


@frappe.whitelist()
def delete_income(name: str, if_modified_since: str | None = None):
	doc = frappe.get_doc("Income", name)
	doc.check_permission("delete")
	_guard_not_stale(doc, if_modified_since)

	family = doc.family
	frappe.delete_doc("Income", name, ignore_permissions=True)

	_publish_family_event("income_deleted", family, name)


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
def delete_source(name: str):
	doc = frappe.get_doc("Source", name)
	doc.check_permission("delete")

	frappe.delete_doc("Source", name, ignore_permissions=True)


@frappe.whitelist()
def get_budgets(month: int, year: int):
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	month = cint(month)
	year = cint(year)

	categories = frappe.get_all(
		"Category",
		filters={"family": family},
		fields=["name", "category_name"],
		order_by="category_name asc",
	)

	for category in categories:
		exact_name = frappe.db.exists(
			"Expenso Budget",
			{"category": category.name, "family": family, "month": month, "year": year},
		)
		if exact_name:
			category["budget_amount"] = frappe.db.get_value("Expenso Budget", exact_name, "amount")
			continue

		prior = _find_prior_budget(category.name, family, month, year)
		if not prior:
			category["budget_amount"] = None
			continue

		materialized = frappe.get_doc(
			{
				"doctype": "Expenso Budget",
				"category": category.name,
				"family": family,
				"month": month,
				"year": year,
				"amount": prior.amount,
			}
		).insert(ignore_permissions=True)
		category["budget_amount"] = materialized.amount

	return categories


@frappe.whitelist()
def set_budget(category: str, month: int, year: int, amount: float | None = None):
	family = get_user_family(frappe.session.user)
	if not family:
		frappe.throw(_("You are not part of a Family"), frappe.PermissionError)

	month = cint(month)
	year = cint(year)

	existing_name = frappe.db.exists(
		"Expenso Budget", {"category": category, "family": family, "month": month, "year": year}
	)

	if amount is None:
		if existing_name:
			frappe.delete_doc("Expenso Budget", existing_name, ignore_permissions=True)
		return None

	if existing_name:
		doc = frappe.get_doc("Expenso Budget", existing_name)
		doc.amount = amount
		doc.save(ignore_permissions=True)
		return doc

	return frappe.get_doc(
		{
			"doctype": "Expenso Budget",
			"category": category,
			"family": family,
			"month": month,
			"year": year,
			"amount": amount,
		}
	).insert(ignore_permissions=True)
