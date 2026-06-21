import frappe
from frappe.model.document import Document


def _validate_amount(amount):
    if (amount or 0) <= 0:
        frappe.throw("Amount must be greater than zero", frappe.ValidationError)


class Expense(Document):
    def validate(self):
        _validate_amount(self.amount)
