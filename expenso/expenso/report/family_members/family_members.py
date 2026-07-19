import frappe


def execute(filters=None):
	filters = filters or {}

	columns = [
		{"label": "User", "fieldname": "user", "fieldtype": "Link", "options": "User", "width": 200},
		{"label": "Family", "fieldname": "family", "fieldtype": "Link", "options": "Family", "width": 150},
		{"label": "Family Name", "fieldname": "family_name", "fieldtype": "Data", "width": 200},
	]

	conditions = []
	values = {}
	if filters.get("user"):
		conditions.append("`tabFamily Member`.user = %(user)s")
		values["user"] = filters["user"]
	if filters.get("family"):
		conditions.append("`tabFamily Member`.parent = %(family)s")
		values["family"] = filters["family"]

	where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

	data = frappe.db.sql(
		f"""
		SELECT
			`tabFamily Member`.user as user,
			`tabFamily Member`.parent as family,
			`tabFamily`.family_name as family_name
		FROM `tabFamily Member`
		INNER JOIN `tabFamily` ON `tabFamily`.name = `tabFamily Member`.parent
		{where_clause}
		ORDER BY `tabFamily Member`.user
		""",
		values,
		as_dict=True,
	)

	return columns, data
