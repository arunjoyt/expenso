import frappe
from frappe import _
from frappe.model.document import Document


def _validate_amount(amount):
	if (amount or 0) <= 0:
		frappe.throw(_("Amount must be greater than zero"), frappe.ValidationError)


def compute_budget_status(spent, budget):
	if not budget:
		return None

	ratio = spent / budget
	if ratio >= 1:
		return "Exceeded"
	if ratio >= 0.8:
		return "Warning"
	return "Normal"


class Budget(Document):
	def validate(self):
		if self.amount is not None:
			_validate_amount(self.amount)

		duplicate = frappe.db.exists(
			"Budget",
			{
				"category": self.category,
				"family": self.family,
				"name": ["!=", self.name or ""],
			},
		)
		if duplicate:
			frappe.throw(
				_("A Budget already exists for this Category in this Family"), frappe.ValidationError
			)
