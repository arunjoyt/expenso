import frappe
from frappe import _
from frappe.model.document import Document


def _validate_amount(amount):
	if (amount or 0) <= 0:
		frappe.throw(_("Amount must be greater than zero"), frappe.ValidationError)


class Income(Document):
	def validate(self):
		if self.amount is not None:
			_validate_amount(self.amount)
