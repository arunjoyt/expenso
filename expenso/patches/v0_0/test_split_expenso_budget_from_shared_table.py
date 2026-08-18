import frappe
from frappe.tests.utils import FrappeTestCase

from expenso.patches.v0_0.split_expenso_budget_from_shared_table import execute


class TestSplitExpensoBudgetFromSharedTable(FrappeTestCase):
	# Budget no longer exists as an app DocType (#83 renamed it to Expenso Budget), so
	# these tests build a standalone tabBudget by hand with raw SQL to simulate the
	# leftover/shared table a real affected site has, rather than going through
	# frappe.get_doc(doctype="Budget", ...) which can no longer be constructed.
	#
	# CREATE/DROP TABLE cause an implicit commit in MariaDB — frappe.db.sql_ddl()
	# commits first so that's explicit rather than accidental. No real Family/
	# Category records are created here (raw SQL never validates the Link values
	# anyway), and tearDown cleans up explicitly rather than relying on rollback,
	# since the implicit commit would defeat FrappeTestCase's usual rollback cleanup.
	FAKE_CATEGORY = "test-split-budget-category"
	FAKE_FAMILY = "test-split-budget-family"

	def tearDown(self):
		frappe.db.sql_ddl("DROP TABLE IF EXISTS `tabBudget`")  # nosemgrep
		frappe.db.sql("DELETE FROM `tabExpenso Budget` WHERE name LIKE 'split-test-%'")  # nosemgrep
		frappe.db.commit()  # nosemgrep

	def _create_shared_table(self, with_erpnext_columns):
		frappe.db.sql_ddl("DROP TABLE IF EXISTS `tabBudget`")  # nosemgrep
		erpnext_columns = ", `company` VARCHAR(140), `fiscal_year` VARCHAR(140)" if with_erpnext_columns else ""
		frappe.db.sql_ddl(
			f"""
			CREATE TABLE `tabBudget` (
				`name` VARCHAR(140) NOT NULL PRIMARY KEY,
				`creation` DATETIME(6), `modified` DATETIME(6),
				`modified_by` VARCHAR(140), `owner` VARCHAR(140),
				`docstatus` INT(1) NOT NULL DEFAULT 0, `idx` INT(8) NOT NULL DEFAULT 0,
				`category` VARCHAR(140), `amount` DECIMAL(21, 9),
				`month` INT(11), `year` INT(11), `family` VARCHAR(140)
				{erpnext_columns}
			) ENGINE=InnoDB
			"""
		)  # nosemgrep

	def _insert_expenso_row(self, name):
		frappe.db.sql(
			"""
			INSERT INTO `tabBudget`
				(name, creation, modified, owner, modified_by, category, amount, month, year, family)
			VALUES (%s, NOW(), NOW(), 'Administrator', 'Administrator', %s, 500, 6, 2025, %s)
			""",
			(name, self.FAKE_CATEGORY, self.FAKE_FAMILY),
		)  # nosemgrep

	def _insert_erpnext_row(self, name):
		frappe.db.sql(
			"""
			INSERT INTO `tabBudget` (name, creation, modified, owner, modified_by, company, fiscal_year)
			VALUES (%s, NOW(), NOW(), 'Administrator', 'Administrator', 'Test Company', '2025')
			""",
			(name,),
		)  # nosemgrep

	def _budget_row_count(self):
		return frappe.db.sql("SELECT COUNT(*) FROM `tabBudget`")[0][0]

	def test_no_table_is_a_no_op(self):
		frappe.db.sql_ddl("DROP TABLE IF EXISTS `tabBudget`")  # nosemgrep
		execute()  # must not raise

	def test_moves_expenso_rows_into_expenso_budget_and_removes_them_from_tabBudget(self):
		self._create_shared_table(with_erpnext_columns=False)
		self._insert_expenso_row("split-test-1")

		execute()

		self.assertEqual(self._budget_row_count(), 0)
		row = frappe.db.get_value(
			"Expenso Budget", "split-test-1", ["category", "amount", "month", "year", "family"], as_dict=True
		)
		self.assertEqual(row.category, self.FAKE_CATEGORY)
		self.assertEqual(row.amount, 500)
		self.assertEqual(row.month, 6)
		self.assertEqual(row.year, 2025)
		self.assertEqual(row.family, self.FAKE_FAMILY)

	def test_leaves_erpnext_shaped_rows_untouched(self):
		self._create_shared_table(with_erpnext_columns=True)
		self._insert_expenso_row("split-test-expenso")
		self._insert_erpnext_row("split-test-erpnext")

		execute()

		self.assertTrue(frappe.db.exists("Expenso Budget", "split-test-expenso"))
		self.assertEqual(self._budget_row_count(), 1)
		remaining = frappe.db.sql("SELECT name, company, fiscal_year FROM `tabBudget`", as_dict=True)[0]
		self.assertEqual(remaining.name, "split-test-erpnext")
		self.assertEqual(remaining.company, "Test Company")
		self.assertEqual(remaining.fiscal_year, "2025")

	def test_running_twice_is_safe(self):
		self._create_shared_table(with_erpnext_columns=False)
		self._insert_expenso_row("split-test-idempotent")

		execute()
		execute()

		self.assertEqual(self._budget_row_count(), 0)
		self.assertTrue(frappe.db.exists("Expenso Budget", "split-test-idempotent"))

	def test_table_with_unrelated_shape_is_a_no_op(self):
		frappe.db.sql_ddl("DROP TABLE IF EXISTS `tabBudget`")  # nosemgrep
		frappe.db.sql_ddl(
			"CREATE TABLE `tabBudget` (`name` VARCHAR(140) NOT NULL PRIMARY KEY) ENGINE=InnoDB"
		)  # nosemgrep

		execute()  # must not raise despite missing expenso columns
