import frappe
from frappe.model.document import Document

DEFAULT_CATEGORIES = [
	"Groceries",
	"Dining",
	"Transport",
	"Utilities",
	"Health",
	"Entertainment",
	"Shopping",
	"Other",
]


class Family(Document):
	def after_insert(self):
		for category_name in DEFAULT_CATEGORIES:
			frappe.get_doc(
				{
					"doctype": "Category",
					"category_name": category_name,
					"family": self.name,
				}
			).insert(ignore_permissions=True)
