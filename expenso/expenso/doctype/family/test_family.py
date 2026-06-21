import frappe
from frappe.tests.utils import FrappeTestCase

TEST_ADMIN = "Administrator"
TEST_MEMBER_EMAIL = "testmember@expenso.test"


def _ensure_test_user(email):
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Test",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
	return email


class TestFamilyIntegration(FrappeTestCase):
	def _make_family(self, **kwargs):
		data = {"doctype": "Family", "family_name": "Test Family", "currency": "USD"}
		data.update(kwargs)
		return frappe.get_doc(data).insert(ignore_permissions=True)

	# I1
	def test_create_family(self):
		family = self._make_family()
		self.assertTrue(family.name)
		self.assertTrue(frappe.db.exists("Family", family.name))

	# I2
	def test_create_family_without_family_name_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			frappe.get_doc(
				{
					"doctype": "Family",
					"currency": "USD",
				}
			).insert(ignore_permissions=True)

	# I3 — Frappe fills the global default currency (EUR) when none is provided,
	# so MandatoryError is not raised. Verify the default is applied instead.
	def test_create_family_without_explicit_currency_uses_default(self):
		family = frappe.get_doc(
			{
				"doctype": "Family",
				"family_name": "No Currency Family",
			}
		).insert(ignore_permissions=True)
		self.assertTrue(family.currency)

	# I4
	def test_create_family_with_two_members(self):
		second = _ensure_test_user(TEST_MEMBER_EMAIL)
		family = self._make_family(
			members=[
				{"user": TEST_ADMIN},
				{"user": second},
			]
		)
		fetched = frappe.get_doc("Family", family.name)
		self.assertEqual(len(fetched.members), 2)

	# I5
	def test_family_member_without_user_raises_mandatory(self):
		with self.assertRaises(frappe.MandatoryError):
			self._make_family(members=[{"user": None}])
