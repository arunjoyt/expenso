import frappe
from frappe.tests.utils import FrappeTestCase

from expenso.patches.v0_0.stamp_budget_month_year import execute


class TestStampBudgetMonthYear(FrappeTestCase):
	# This patch already ran (and is recorded in Patch Log) on every site where the
	# Budget DocType ever existed with month/year columns. After the Budget ->
	# Expenso Budget rename (#83), a fresh site never gets a tabBudget table at all,
	# and a site stuck on a pre-month/year schema never gets those columns added
	# either — expenso no longer ships a Budget DocType to sync either onto. The only
	# behavior left to cover here is that execute() doesn't blow up in either case.
	#
	# CREATE/DROP TABLE cause an implicit commit in MariaDB — frappe.db.sql_ddl()
	# commits first so that's explicit rather than accidental; tearDown cleans up
	# explicitly since that implicit commit would defeat the usual rollback cleanup.
	def tearDown(self):
		frappe.db.sql_ddl("DROP TABLE IF EXISTS `tabBudget`")  # nosemgrep
		frappe.db.commit()  # nosemgrep

	def test_does_nothing_when_table_missing(self):
		self.assertFalse(frappe.db.table_exists("Budget"))
		execute()

	def test_does_nothing_when_month_year_columns_missing(self):
		frappe.db.sql_ddl(
			"CREATE TABLE `tabBudget` (`name` VARCHAR(140) NOT NULL PRIMARY KEY) ENGINE=InnoDB"
		)  # nosemgrep

		execute()  # must not raise despite no month/year columns
