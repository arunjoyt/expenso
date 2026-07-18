import frappe


def run():
	frappe.set_user("Administrator")

	if frappe.db.exists("Family", {"family_name": "Smith Family"}):
		family = frappe.get_doc("Family", {"family_name": "Smith Family"})
	else:
		family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "Smith Family",
				"currency": "USD",
				"members": [{"user": "Administrator"}],
			}
		).insert(ignore_permissions=True)

	user = frappe.get_doc("User", "Administrator")
	if "Family Member" not in {r.role for r in user.roles}:
		user.add_roles("Family Member")

	categories = {
		c.category_name: c.name
		for c in frappe.get_all(
			"Category", filters={"family": family.name}, fields=["name", "category_name"]
		)
	}

	today = frappe.utils.today()
	yesterday = frappe.utils.add_days(today, -1)
	last_week = frappe.utils.add_days(today, -6)

	expenses = [
		(85.50, today, "Groceries"),
		(35.00, today, "Dining"),
		(45.00, today, "Transport"),
		(42.30, yesterday, "Groceries"),
		(62.50, yesterday, "Dining"),
		(28.99, yesterday, "Entertainment"),
		(120.00, last_week, "Groceries"),
		(18.75, last_week, "Transport"),
	]
	for amount, date, category_name in expenses:
		frappe.get_doc(
			{
				"doctype": "Expense",
				"amount": amount,
				"date": date,
				"category": categories[category_name],
				"family": family.name,
			}
		).insert(ignore_permissions=True)

	sources = {
		s.source_name: s.name
		for s in frappe.get_all("Source", filters={"family": family.name}, fields=["name", "source_name"])
	}
	frappe.get_doc(
		{
			"doctype": "Income",
			"amount": 3500,
			"date": today,
			"source": sources.get("Salary"),
			"family": family.name,
		}
	).insert(ignore_permissions=True)

	budgets = [
		("Groceries", 200),
		("Dining", 150),
		("Transport", 70),
	]
	for category_name, amount in budgets:
		frappe.get_doc(
			{
				"doctype": "Budget",
				"category": categories[category_name],
				"family": family.name,
				"amount": amount,
			}
		).insert(ignore_permissions=True)

	frappe.db.commit()
	print("ready")
