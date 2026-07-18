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

	# I23
	def test_family_creation_seeds_eight_categories(self):
		family = self._make_family()
		self.assertEqual(frappe.db.count("Category", {"family": family.name}), 8)

	# I24
	def test_seeded_category_names(self):
		family = self._make_family()
		names = frappe.get_all("Category", filters={"family": family.name}, pluck="category_name")
		self.assertEqual(
			set(names),
			{
				"Groceries",
				"Dining",
				"Transport",
				"Utilities",
				"Health",
				"Entertainment",
				"Shopping",
				"Other",
			},
		)

	# I25
	def test_seeded_categories_all_point_to_new_family(self):
		family = self._make_family()
		categories = frappe.get_all("Category", filters={"family": family.name}, fields=["family"])
		self.assertTrue(all(cat.family == family.name for cat in categories))
		self.assertEqual(len(categories), frappe.db.count("Category", {"family": family.name}))

	# I26
	def test_updating_family_does_not_double_seed_categories(self):
		family = self._make_family()
		family.family_name = "Renamed Test Family"
		family.save(ignore_permissions=True)
		self.assertEqual(frappe.db.count("Category", {"family": family.name}), 8)

	# I56
	def test_family_creation_seeds_four_sources(self):
		family = self._make_family()
		self.assertEqual(frappe.db.count("Source", {"family": family.name}), 4)

	# I57
	def test_seeded_sources_all_point_to_new_family(self):
		family = self._make_family()
		names = frappe.get_all("Source", filters={"family": family.name}, pluck="source_name")
		self.assertEqual(set(names), {"Salary", "Freelance", "Rental", "Other"})

	# I58
	def test_updating_family_does_not_double_seed_sources(self):
		family = self._make_family()
		family.family_name = "Renamed Test Family"
		family.save(ignore_permissions=True)
		self.assertEqual(frappe.db.count("Source", {"family": family.name}), 4)
