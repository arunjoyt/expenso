import frappe


def get_user_family(user):
	return frappe.db.get_value("Family Member", {"user": user, "parenttype": "Family"}, "parent")


def get_permission_query_conditions(user, doctype="Expense"):
	if not user:
		user = frappe.session.user

	family = get_user_family(user)
	if not family:
		return "1=0"

	return f"`tab{doctype}`.`family` = {frappe.db.escape(family)}"


def has_permission(doc, ptype=None, user=None, debug=False):
	if not user:
		user = frappe.session.user

	family = get_user_family(user)
	if not family:
		return False

	return doc.family == family
