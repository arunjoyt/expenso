import frappe
from frappe import _
from frappe.model.document import Document


def _validate_amount(amount):
	if (amount or 0) <= 0:
		frappe.throw(_("Amount must be greater than zero"), frappe.ValidationError)


def _validate_month(month):
	if month is None or month < 1 or month > 12:
		frappe.throw(_("Month must be between 1 and 12"), frappe.ValidationError)


def compute_budget_status(spent, budget):
	if not budget:
		return None

	ratio = spent / budget
	if ratio >= 1:
		return "Exceeded"
	if ratio >= 0.8:
		return "Warning"
	return "Normal"


class ExpensoBudget(Document):
	def validate(self):
		if self.amount is not None:
			_validate_amount(self.amount)

		if self.month is not None:
			_validate_month(self.month)

		duplicate = frappe.db.exists(
			"Expenso Budget",
			{
				"category": self.category,
				"family": self.family,
				"month": self.month,
				"year": self.year,
				"name": ["!=", self.name or ""],
			},
		)
		if duplicate:
			frappe.throw(
				_("A Budget already exists for this Category in this Family for this month"),
				frappe.ValidationError,
			)
