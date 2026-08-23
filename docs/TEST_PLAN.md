# Expenso — Test Plan

Complete unit and integration test plan across all three phases. Backend tests use Frappe's `UnitTestCase` (no DB) and `IntegrationTestCase` (DB, auto-rollback). Frontend tests use Vitest.

---

## How tests are organised

| Layer | Tool | Location |
|---|---|---|
| Backend unit | `frappe.tests.UnitTestCase` | `expenso/expenso/expenso/doctype/<dt>/test_<dt>.py` |
| Backend integration | `frappe.tests.IntegrationTestCase` | same file, separate class |
| Backend API integration | `IntegrationTestCase` | `expenso/expenso/expenso/tests/test_<feature>.py` |
| Frontend unit / component | Vitest + Vue Test Utils | `frontend/src/**/__tests__/` |

---

## Phase 1 — Core Expense Ledger

### P1-S1 · DocTypes: Family, FamilyMember, Expense, Category

**Unit tests**

| # | Test | Assertion |
|---|------|-----------|
| U1 | `Expense.validate` with `amount = 0` | raises `ValidationError` |
| U2 | `Expense.validate` with `amount < 0` | raises `ValidationError` |

**Integration tests**

*Family*

| # | Test | Assertion |
|---|------|-----------|
| I1 | Create Family with `family_name` + `currency` | inserts; `name` is auto-set |
| I2 | Create Family without `family_name` | raises `MandatoryError` |
| I3 | Create Family without `currency` | raises `MandatoryError` |
| I4 | Create Family with two `FamilyMember` child rows | both rows present after fetch |
| I5 | Add `FamilyMember` child row without `user` | raises `MandatoryError` |
| I87 | Family form's Connections (`meta.links`) | links to Category, Source (group "Setup") and Expense, Income, Budget (group "Transactions"), each via the `family` field |

*Category*

| # | Test | Assertion |
|---|------|-----------|
| I6 | Create Category with `category_name` + `family` | inserts; `name` matches `CAT-\d+` |
| I7 | Create Category without `category_name` | raises `MandatoryError` |
| I8 | Create Category without `family` | raises `MandatoryError` |
| I9 | Two Categories with same `category_name` in different Families | both insert (no uniqueness constraint across Families) |

*Expense*

| # | Test | Assertion |
|---|------|-----------|
| I10 | Create Expense with `amount` + `family` | inserts successfully |
| I11 | Create Expense without `amount` | raises `MandatoryError` |
| I12 | Create Expense without `family` | raises `MandatoryError` |
| I13 | Create Expense without `date` | inserts; `date` equals today |
| I14 | Create Expense without `category` | inserts (category is optional) |
| I15 | Create Expense with valid `category` belonging to same Family | inserts successfully |
| I88 | Expense list view fields/filters | `in_list_view`: `amount`, `date`, `category`, `family`; `in_standard_filter`: `date`, `category`, `family` |

---

### P1-S2 · Permissions: Family Member role, query conditions, `has_permission`

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I16 | `Family Member` role exists in the database | `frappe.get_all("Role")` contains the role |
| I17 | `permission_query_conditions` for a Member | returns SQL clause filtering to their Family |
| I18 | `permission_query_conditions` for a user with no Family | returns clause that returns no rows |
| I19 | `has_permission` for a Member on their own Family's Expense | returns `True` |
| I20 | `has_permission` for a Member on a different Family's Expense | returns `False` |
| I21 | Member A reads Expense list — only their Family's Expenses appear | Expense from Family B not in results |
| I22 | Member A attempts to fetch Expense from Family B by name | raises `PermissionError` |

---

### P1-S3 · Family lifecycle: `after_insert` seeds default Categories

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I23 | Insert a new Family | exactly 8 Categories are created for it |
| I24 | Seeded Category names | `{"Groceries", "Dining", "Transport", "Utilities", "Health", "Entertainment", "Shopping", "Other"}` |
| I25 | All seeded Categories have `family` pointing to the new Family | no orphan Categories |
| I26 | Save the Family again (update) | Category count stays at 8 (no double-seeding) |

---

### P1-S4 · Frontend scaffold: Login screen, routing

**Frontend unit tests (Vitest)**

| # | Test | Assertion |
|---|------|-----------|
| F1 | Unauthenticated user visits `/` | redirected to `/login` |
| F2 | Authenticated user visits `/login` | redirected to `/feed` |
| F3 | Login page renders | username field, password field, and submit button present |
| F4 | Login form submitted with wrong credentials | error message visible |
| F5 | Login form submitted with valid credentials | redirected to `/feed` |

---

### P1-S5 · Feed screen: monthly list, date grouping, month navigation

**Unit tests**

| # | Test | Assertion |
|---|------|-----------|
| U3 | Date grouping — today's date | label = `"Today"` |
| U4 | Date grouping — yesterday's date | label = `"Yesterday"` |
| U5 | Date grouping — older date e.g. 2025-06-12 | label = `"Jun 12"` |
| U6 | Month store `prevMonth` from Jan 2025 | becomes Dec 2024 |
| U7 | Month store `nextMonth` from Dec 2024 | becomes Jan 2025 |

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I27 | `get_expenses(family, month, year)` with Expenses in that month | returns only those Expenses |
| I28 | `get_expenses` with Expenses in different months | Expenses from other months excluded |
| I29 | `get_expenses` with no Expenses | returns empty list |
| I30 | `get_expenses` response order | newest date first within each date group |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F6 | Feed renders Expense rows grouped under date headers | group headers visible |
| F7 | Month label in header matches store | header shows "June 2025" |
| F8 | Prev month button click | month store decrements |
| F9 | Next month button click | month store increments |
| F10 | Feed for a month with no Expenses | empty state visible |
| F11 | Monthly total shown at top | total equals sum of rendered Expenses |

---

### P1-S6 · Expense bottom sheet: Add / Edit / Delete + realtime

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| U35 | `parseAmount` / `sanitizeAmountInput` | comma and period decimals both parse to the same Number; non-numeric characters stripped; empty/null → `null` |

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I31 | `create_expense(amount, date, family)` | Expense exists in DB; realtime event published |
| I32 | `create_expense` without `amount` | raises `ValidationError` |
| I33 | `update_expense(name, amount=...)` | updated field persisted |
| I34 | `delete_expense(name)` | Expense no longer in DB |
| I35 | `create_expense` by Member of different Family | raises `PermissionError` |
| I36 | `update_expense` on Expense from different Family | raises `PermissionError` |
| I37 | `delete_expense` on Expense from different Family | raises `PermissionError` |
| I38 | Realtime event payload on create | contains Expense `name` and `family` |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F12 | FAB click | ExpenseSheet slides up directly, defaulting to the Expense tab |
| F13 | ExpenseSheet — `amount` field is required | submit disabled without amount |
| F137 | ExpenseSheet — `amount` accepts a comma as decimal separator | e.g. `12,50` submits as `12.5` |
| F14 | ExpenseSheet — `date` defaults to today | date field pre-filled |
| F15 | ExpenseSheet — `category` is optional | can submit without it |
| F16 | Successful add submit | sheet closes; Feed list updated |
| F17 | Tapping Expense row | ExpenseSheet opens in edit mode with fields pre-filled |
| F18 | Delete action in edit mode | confirmation prompt shown |
| F19 | Confirmed delete | Expense removed from Feed |
| F20 | Tap outside sheet / swipe down | sheet closes without saving |

---

### P1-S7 · Analytics screen: monthly total + Category breakdown

**Unit tests**

| # | Test | Assertion |
|---|------|-----------|
| U8 | Category breakdown aggregation on sample data | groups correctly, amounts sum correctly |
| U9 | Expenses with no Category | appear as a separate uncategorized group |

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I39 | `get_analytics(family, month, year)` | returns `{ total, categories: [{ name, amount, budget, budget_status }] }` |
| I40 | `total` value | equals sum of all Expenses for the month |
| I41 | Category list ordering | sorted by `amount` descending |
| I42 | No Expenses for month | returns `{ total: 0, categories: [] }` |
| I43 | Expenses without Category | counted in `total`; listed separately as uncategorized |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F21 | Analytics shows monthly total | correct amount displayed |
| F22 | Analytics shows Category rows | each row has name + amount |
| F23 | Uncategorized row | visible when Expenses have no Category |

---

### P1-S8 · Settings screen: Category list, app version

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I44 | `add_category(name)` | Category created for user's Family; returned |
| I45 | `rename_category(id, new_name)` | `category_name` updated; old name gone |
| I46 | ~~`get_app_version()`~~ — removed; version is now injected server-side into `context.boot.app_version` (see `expenso/www/expenso.py`) and read from `window.app_version` in `App.vue`, matching kido/flashcard | n/a |
| I47 | `add_category` called by Member — Category linked to their Family, not another | `family` field is correct |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F24 | Settings lists all Categories for the Family | all names visible |
| F25 | Add Category form | new Category appears in list after submit |
| F26 | Rename via `RenameSheet` | tapping name opens sheet; submitting updates displayed name |
| F27 | ~~App version in footer~~ — moved to `App.vue` global footer pill, sourced from `window.app_version` (server-injected boot value, no API call); no longer Settings-specific | n/a |

---

### P1-S9 · Workspace: Expenso admin Workspace with links to core DocTypes

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I48 | `Expenso` Workspace exists in the database | `frappe.db.exists("Workspace", "Expenso")` |
| I49 | Workspace has no plain Workspace Link entries | `Workspace Link` rows for `Expenso` is empty — navigation is via the Number Cards (I50), not a redundant link list |
| I50 | Workspace number cards | one `Count` Number Card per top-level DocType (`Families`, `Categories`, `Expenses`, `Income`, `Sources`, `Budgets`), each pointed at its matching `document_type`, clicking through to that DocType's list view |
| I51 | `Family Members` Script Report resolves a User to their Family | System Manager-only; joining `tabFamily Member`/`tabFamily` returns the correct `family` and `family_name` for a known user with no filters applied at all (the exact call the report page makes on first load) — `Family Member` is a child table with no list view of its own, so this is the lookup path. Built as a Script Report rather than a plain SQL Query Report because the latter can't survive a missing filter key without crashing |
| I52 | `Family Members` report filters by User and by Family | filtering by either narrows the result to just that user's row, and the two filters are linked to a workspace shortcut (Report type) for discoverability |

---

## Phase 2 — Income & Savings

### P2-S1 · DocTypes: Income + Source; permissions; default Sources

**Unit tests**

| # | Test | Assertion |
|---|------|-----------|
| U10 | `Income.validate` with `amount = 0` | raises `ValidationError` |
| U11 | `Income.validate` with `amount < 0` | raises `ValidationError` |

**Integration tests**

*Source*

| # | Test | Assertion |
|---|------|-----------|
| I48 | Create Source with `source_name` + `family` | inserts; `name` matches `SRC-\d+` |
| I49 | Create Source without `source_name` | raises `MandatoryError` |
| I50 | Create Source without `family` | raises `MandatoryError` |
| I91 | Source shows its name wherever linked | `title_field` = `source_name`, `show_title_field_in_link` = 1 — otherwise Income's list view (and any Link field) shows the raw `SRC-\d+` name |

*Income*

| # | Test | Assertion |
|---|------|-----------|
| I51 | Create Income with `amount` + `family` | inserts successfully |
| I52 | Create Income without `amount` | raises `MandatoryError` |
| I53 | Create Income without `family` | raises `MandatoryError` |
| I54 | Create Income without `date` | inserts; `date` equals today |
| I55 | Create Income without `source` | inserts (source is optional) |
| I89 | Income list view fields/filters | `in_list_view`: `amount`, `date`, `source`, `family`; `in_standard_filter`: `date`, `source`, `family` |

*Lifecycle*

| # | Test | Assertion |
|---|------|-----------|
| I56 | Insert new Family | exactly 4 Sources seeded: `{"Salary", "Freelance", "Rental", "Other"}` |
| I57 | All seeded Sources have `family` pointing to the new Family | no orphan Sources |
| I58 | Save Family again | Source count stays at 4 (no double-seeding) |

*Permissions*

| # | Test | Assertion |
|---|------|-----------|
| I59 | Member reads Income list | only their Family's Income records returned |
| I60 | Member fetches Income from different Family by name | raises `PermissionError` |

---

### P2-S2 · Analytics: Income total, Balance line

Renamed to "Balance" in issue #75 — see the retrofit section near the end of this document.

**Unit tests**

| # | Test | Assertion |
|---|------|-----------|
| U12 | Balance = income_total − expense_total (positive) | correct |
| U13 | Balance with no Income | equals `−expense_total` (negative) |
| U14 | Balance with no Expenses | equals `income_total` |

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I61 | `get_analytics` response | includes `income_total` and `balance` fields |
| I62 | `balance` value | equals `income_total − expense_total` |
| I63 | No Income records for month | `income_total = 0`, `balance = −expense_total` |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F28 | Analytics shows income_total row | correct amount |
| F29 | Analytics shows Balance row | correct (can be negative) |
| F30 | Feed FAB click, then Income tab click | IncomeSheet slides up in place of ExpenseSheet |

---

### P2-S3 · Income bottom sheet: Add / Edit / Delete

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I64 | `create_income(amount, date, family)` | Income exists in DB |
| I65 | `update_income(name, amount=...)` | updated field persisted |
| I66 | `delete_income(name)` | Income no longer in DB |
| I67 | `create_income` by Member of different Family | raises `PermissionError` |
| I68 | `update_income` on Income from different Family | raises `PermissionError` |
| I69 | `delete_income` on Income from different Family | raises `PermissionError` |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F32 | IncomeSheet `amount` is required | submit disabled without amount |
| F138 | IncomeSheet — `amount` accepts a comma as decimal separator | e.g. `12,50` submits as `12.5` |
| F33 | IncomeSheet `date` defaults to today | pre-filled |
| F34 | IncomeSheet `source` is optional | can submit without it |
| F35 | Successful add submit | sheet closes; `createIncome` called |
| F36 | Delete action | confirmation prompt shown |
| F37 | Confirmed delete | `deleteIncome` called; sheet closes |

---

### P2-S4 · Settings: Source list management

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I70 | `add_source(name)` | Source created for user's Family; returned |
| I71 | `rename_source(id, new_name)` | `source_name` updated |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F38 | Settings shows Sources section | all Source names visible |
| F39 | Add Source form | new Source appears in list after submit |
| F40 | Rename Source via `RenameSheet` | tapping name opens sheet; submitting updates displayed name |

---

## Phase 3 — Budgeting

### P3-S1 · DocType: Budget; one Budget per Category per Family

**Unit tests**

| # | Test | Assertion |
|---|------|-----------|
| U15 | `compute_budget_status(spent=0, budget=100)` | `"Normal"` |
| U16 | `compute_budget_status(spent=79, budget=100)` | `"Normal"` |
| U17 | `compute_budget_status(spent=80, budget=100)` | `"Warning"` |
| U18 | `compute_budget_status(spent=99, budget=100)` | `"Warning"` |
| U19 | `compute_budget_status(spent=100, budget=100)` | `"Exceeded"` |
| U20 | `compute_budget_status(spent=150, budget=100)` | `"Exceeded"` |
| U21 | `compute_budget_status` with `budget=0` | no division-by-zero; returns `None` or `"Normal"` |

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I72 | Create Budget with `category` + `family` + `amount` | inserts successfully |
| I73 | Create second Budget for same Category + Family | raises `ValidationError` |
| I74 | Create Budget for different Category in same Family | inserts successfully (allowed) |
| I75 | Create Budget without `category` | raises `MandatoryError` |
| I76 | Create Budget without `family` | raises `MandatoryError` |
| I77 | Create Budget with `amount = 0` | raises `ValidationError` |
| I78 | Create Budget with `amount < 0` | raises `ValidationError` |
| I90 | Budget list view fields/filters | `in_list_view`: `category`, `amount`, `month`, `year`, `family`; `in_standard_filter`: `category`, `family`, `month`, `year` |
| I91 | Create Budget without `month` | raises `MandatoryError` |
| I92 | Create Budget without `year` | raises `MandatoryError` |
| I93 | Create Budget with `month = 0` | raises `ValidationError` |
| I94 | Create Budget with `month = 13` | raises `ValidationError` |
| I95 | Create Budget for same Category + Family, different `month` | inserts successfully (allowed) |
| I96 | Create Budget for same Category + Family + `month`, different `year` | inserts successfully (allowed) |

---

### P3-S2 · Budget tab: monthly Budget per Category (issue #51)

Budget moved off Settings into its own bottom-nav tab and became month-scoped: one Budget
row per Category per Family per (month, year), with carry-forward materialization on first
read of a new month (see `docs/adr/0001-monthly-budget-carry-forward.md`).

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I79 | `set_budget(category_id, month, year, amount=500)` — no prior Budget for that period | Budget created; amount = 500 |
| I80 | `set_budget(...)` — Budget exists for that exact period | Budget updated; amount = 800 |
| I81 | `set_budget(..., amount=None)` — Budget exists for that exact period | Budget deleted |
| I82 | `get_budgets(month, year)` | returns list with `budget_amount` for the requested period (null if none, ever) |
| I98 | `set_budget` for one period, then another period | each period's Budget is independent; unrelated periods untouched |
| I99 | `get_budgets` called twice for a period with an exact-match row | no duplicate Budget row created |
| I100 | Delete a month's Budget, then request a later month | carry-forward resumes from the last real row before the deleted one, not from the deleted month |
| I101 | `get_budgets` for a period with no exact row but an earlier period has one | materializes a new row copying the earlier amount |
| I102 | `get_budgets` with a gap of several unset months between two set ones | carries forward from the nearest prior period, not the earliest; gap months stay unmaterialized |
| I103 | `get_budgets` with only a *future* period set | returns `budget_amount: null` (no forward-looking carry) |
| I104 | `get_budgets` for a Category that has never had any Budget | returns `budget_amount: null`; creates no row |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F43 | `BudgetSheet` submit with an amount | Budget persisted via `setBudget(category, month, year, amount)`; sheet closes |
| F44 | `BudgetSheet` for a Category with an existing Budget | amount input pre-filled with current amount |
| F139 | `BudgetSheet` — `amount` accepts a comma as decimal separator | e.g. `12,50` saved as `12.5` |
| F55 | `BudgetSheet` opened for a Category | sheet title includes the Category name |
| F56 | `BudgetSheet` for a Category with no existing Budget | amount input starts empty |
| F57 | `BudgetSheet` for a Category with no existing Budget | no "Remove Budget" button shown |
| F58 | `BudgetSheet` "Remove Budget" clicked | Budget removed via `setBudget(category, month, year, null)`; sheet closes |
| F59 | `BudgetSheet` backdrop clicked | sheet closes without calling `setBudget` |
| F60 | `RenameSheet` mounted with a `title` prop | title shown in the sheet |
| F61 | `RenameSheet` mounted with an `initialValue` | amount input pre-filled with that value |
| F62 | `RenameSheet` submit with a changed value | `renameFn` called with the new value; sheet closes |
| F63 | `RenameSheet` submit with an unchanged value | `renameFn` not called; sheet still closes |
| F64 | `RenameSheet` input cleared | Save button disabled |
| F65 | `RenameSheet` backdrop clicked | sheet closes without calling `renameFn` |
| F66 | Settings Category row | no budget button rendered (moved to Budget tab) |
| F70 | Budget page lists every Category with a budget button | buttons present |
| F71 | Category with no Budget for the month | budget button reads "Set Budget" |
| F72 | Category with a Budget for the month | budget button reads the formatted amount |
| F73 | Tapping a Category's budget button | opens `BudgetSheet` for that Category |
| F74 | `BudgetSheet` closes (save or backdrop) | Budget page reloads Categories |
| F75 | Budget page header | shows the month label from the store |
| F76 | Budget page prev month click | decrements the month store |
| F77 | Budget page next month click | increments the month store |
| F78 | Budget page with no Categories | shows an empty state |

---

### P3-S3 · Analytics: Budget Status per Category

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I83 | `get_analytics` with Budget set and spent < 80% | category row has `budget_status: "Normal"` |
| I84 | `get_analytics` with Budget set and spent ≥ 80% | `budget_status: "Warning"` |
| I85 | `get_analytics` with Budget set and spent ≥ 100% | `budget_status: "Exceeded"` |
| I86 | `get_analytics` for Category with no Budget | `budget_status: null` |
| I87 | `get_analytics` with Budget set | category row includes `budget: <amount>` |
| I97 | `get_analytics` for a month with no exact Budget but an earlier month has one | resolves `budget`/`budget_status` via carry-forward; creates no Budget row (read-only) |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F45 | Category row with `budget_status: null` | no threshold indicator in DOM |
| F46 | Category row with `budget_status: "Warning"` | yellow indicator present |
| F47 | Category row with `budget_status: "Exceeded"` | red indicator present |
| F48 | Category row with `budget_status: "Normal"` | no threshold indicator |
| F49 | Category row with `budget: 240, amount: 24.48` | progress bar width ≈ 10% (percent-of-budget, not relative-to-max) |
| F50 | Category row with `budget: 240, amount: 24.48` | shows `Budget 240 · Balance 215.52` and `10%` |
| F51 | Category row with `budget: null` | shows "No budget set"; bar width falls back to relative-to-max-spend |
| F67 | Analytics page header | shows the month label from the store |
| F68 | Analytics page prev month click | decrements the month store |
| F69 | Analytics page next month click | increments the month store |

---

### Feed FAB: Add Expense / Add Income tab switcher (issue #53)

"Add Income" moved off Analytics (which is read-only) onto the Feed screen. The FAB opens
the ExpenseSheet directly in add mode, defaulting to the Expense tab — no extra tap for the
common case. An Expense/Income tab switcher inside the sheet (add mode only, hidden while
editing) swaps `ExpenseSheet` for `IncomeSheet` in place via a `switch-mode` event, and back
again. `IncomeSheet` closing does not reload the Expense list — Income doesn't affect what
Feed displays.

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F12 | FAB click | ExpenseSheet slides up directly, Expense tab active, no IncomeSheet shown |
| F30 | Income tab click while ExpenseSheet is open (add mode) | ExpenseSheet is replaced with IncomeSheet |
| F79 | Expense tab click while IncomeSheet is open | IncomeSheet is replaced with ExpenseSheet |
| F80 | Row tap to edit an existing Expense | tab switcher not shown |
| F81 | IncomeSheet closes | Expense list is not reloaded |
| — | `ExpenseSheet`/`IncomeSheet` in add mode | tab switcher rendered; clicking the other tab emits `switch-mode` with `'income'`/`'expense'` |
| — | `ExpenseSheet`/`IncomeSheet` in edit mode | tab switcher not rendered |

---

### Settings: delete Category / Source (issue #52)

Category and Source were previously add/rename-only by design. Both now support delete from
Settings, behind a confirmation prompt. `delete_category`/`delete_source` rely on Frappe's
built-in link-existence check (`frappe.delete_doc` without `force`) to block deletion while
any Expense/Income still references the record — no manual "is it in use" query needed.
Deleting a Category also deletes its Budget rows for every month first (Budget links to
Category too, so it would otherwise block the delete on its own link).

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I105 | `delete_category(name)` with no linked Expense | Category no longer in DB |
| I106 | `delete_category(name)` with a linked Expense | raises `LinkExistsError`; Category still in DB |
| I107 | `delete_category(name)` for a Category with Budgets set | its Budget rows are deleted along with it |
| I108 | `delete_category` by Member of a different Family | raises `PermissionError` |
| I109 | `delete_source(name)` with no linked Income | Source no longer in DB |
| I110 | `delete_source(name)` with a linked Income | raises `LinkExistsError`; Source still in DB |
| I111 | `delete_source` by Member of a different Family | raises `PermissionError` |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F82 | Category row | shows a delete button |
| F83 | Category delete button click | confirmation prompt shown; `deleteCategory` not yet called |
| F84 | Category delete confirmation Cancel | prompt dismissed; `deleteCategory` not called |
| F85 | Category delete confirmed | `deleteCategory` called; list reloads; Category gone |
| F86 | Category delete rejected (in use) | error message shown; Category still in the list |
| F87 | Source row | shows a delete button |
| F88 | Source delete button click | confirmation prompt shown; `deleteSource` not yet called |
| F89 | Source delete confirmation Cancel | prompt dismissed; `deleteSource` not called |
| F90 | Source delete confirmed | `deleteSource` called; list reloads; Source gone |
| F91 | Source delete rejected (in use) | error message shown; Source still in the list |

---

### Analytics: total Budget stat + budgeted zero-spend categories (issue #62)

The total Budget stat tile this section originally added to Analytics (with `budget_total` on
`get_analytics`, tests I115/I116/F92) was later moved to the Budget screen in issue #75 — see
the retrofit section near the end of this document. The zero-spend Category behavior described
below is unaffected and still lives on Analytics.

The Category breakdown was built only from Expense rows this month, so a Category with a
Budget set but no spend was invisible to Analytics entirely. `_add_budgeted_categories` now
appends a Category to the list (at `amount: 0`) whenever it has an effective Budget for the
month and isn't already present from spend, resolving via the same `_resolve_budget_amount`
carry-forward logic and attaching `budget`/`budget_status` directly (bypassing the
expense-derived label lookup in `_attach_budget_status`, which cannot disambiguate categories
that share a name within a Family). Sort stays by amount spent descending, so zero-spend rows
sort last.

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I112 | `get_analytics` for a Category with a Budget but no Expense this month | category row appears with `amount: 0`, `budget: <amount>`, `budget_status` computed against 0 spend |
| I113 | `get_analytics` for a Category with neither Budget nor Expense this month | Category does not appear in `categories` |
| I114 | `get_analytics` sort order with a mix of spent and zero-spend budgeted Categories | zero-spend budgeted Category sorts after Categories with spend |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F93 | Category row with `amount: 0` and a Budget set | row renders with budget summary (not "No budget set"), 0% |

---

### Add Expense/Income sheet: inline create for new Category/Source (issue #63)

Creating a new Category/Source previously required leaving the Add Expense/Income sheet for
Settings, breaking flow mid-entry. The Category/Source `<select>` now has a trailing
"+ New category"/"+ New source" option; picking it reveals an inline name input in the sheet.
Submitting calls the existing `add_category`/`add_source` API, reloads the list, and
auto-selects the new record — no navigation away. Rename/delete are unchanged and still
Settings-only.

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F94 | Selecting "+ New category" in ExpenseSheet | inline name input appears |
| F95 | Submitting the inline Category name | `addCategory` called; list reloads; new Category auto-selected; inline input closes |
| F96 | Cancelling inline Category creation | inline input closes; Category select resets to empty; `addCategory` not called |
| F97 | Inline Category creation open | submit button disabled even with a valid amount |
| F98 | Selecting "+ New source" in IncomeSheet | inline name input appears |
| F99 | Submitting the inline Source name | `addSource` called; list reloads; new Source auto-selected; inline input closes |
| F100 | Cancelling inline Source creation | inline input closes; Source select resets to empty; `addSource` not called |

---

### Feed: unify Expense + Income ledger, promote Notes over Category/Source (issue #64)

Income never appeared on Feed — it was recorded via the FAB but only reviewed from Analytics.
Feed now merges Expense and Income into one reverse-chronological, date-grouped list, sorted
and interleaved together (not clustered by type). A new `get_income` method (mirroring
`get_expenses`) and `income_created`/`income_updated`/`income_deleted` realtime events (mirroring
the existing `expense_*` ones) back this. Each row's typographic hierarchy is swapped: Notes
(when present) is now the bold primary line, with Category/Source demoted to a smaller gray
caption below it — falling back to Category/Source alone (or "No source" for Income) when
there's no Notes. Income rows show their amount in green with a leading "+". The Feed banner
gains a second stat, Income, alongside Spent. The Add Expense/Income sheets reorder their
fields to Amount → Date → Notes → Category/Source, matching the new row hierarchy.

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I117 | `get_income` returns only Income in the requested month | included/excluded correctly |
| I118 | `get_income` excludes other months | out-of-month Income not present |
| I119 | `get_income` ordering | newest date first |
| I120 | `get_income` includes notes | `notes` field present on each row |
| I121 | `create_income` | publishes `income_created` realtime event |
| I122 | `update_income` | publishes `income_updated` realtime event |
| I123 | `delete_income` | publishes `income_deleted` realtime event |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F101 | Feed with Income but no Expenses | empty state not shown |
| F102 | Feed Income total | equals the sum of rendered Income |
| F103 | Expense row with Notes | Notes is the bold primary line; Category shows as the caption below it |
| F104 | Expense row with no Notes | Category is the primary line; no caption line rendered |
| F105 | Income row | amount shown in green with a leading "+" |
| F106 | Income row with no Source and no Notes | primary line reads "No source" |
| F107 | Income row with Notes | Notes is the primary line; Source shows as the caption below it |
| F108 | Feed with Expense and Income on different dates | rows interleave newest-first across both types, grouped by date |
| F109 | Tapping an Income row | opens IncomeSheet in edit mode with fields pre-filled |
| — | Closing ExpenseSheet or IncomeSheet after a save | both Expense and Income lists reload (supersedes the old "Income doesn't reload Feed" assumption, now that Income appears there) |

---

## Phase 4 — Receipt-to-Expense

See `docs/GLOSSARY.md` (Receipt), `docs/adr/0002-receipt-extraction-via-vision-llm.md`, and `docs/adr/0003-receipt-extraction-tracking.md` for the settled design this phase implements.

### P4-S1 · Receipt extraction: OpenAI vision endpoint + LLM Call Log (issue #66)

**Unit tests**

| # | Test | Assertion |
|---|------|-----------|
| U22 | `build_extraction_prompt(category_names=["Groceries", "Dining"])` | prompt/payload includes both Category names |
| U23 | `parse_extraction_response(json_with_all_fields)` | returns dict with `amount`, `date`, `category`, `notes` all populated |
| U24 | `parse_extraction_response(json_missing_amount)` | returns dict with `amount: None`; other fields still populated |
| U25 | `parse_extraction_response(...)` with `category` not in the allowed list | returns `category: None` (suggestion discarded, never invented) |
| U26 | `check_rate_limit(count=20, cap=20)` | not allowed |
| U27 | `check_rate_limit(count=19, cap=20)` | allowed |
| U28 | `compute_cost(input_tokens=1000, output_tokens=200, model="gpt-4o-mini")` | matches the hardcoded pricing constant's computed value |
| U29 | `compute_field_accuracy(extracted={"amount": 12.5}, saved={"amount": 12.5})` | `{"amount": True}` |
| U30 | `compute_field_accuracy(extracted={"category": None}, saved={"category": "Groceries"})` | `category` key absent from result (excluded, not counted as inaccurate) |
| U31 | `compute_field_accuracy(extracted={"notes": "Trader Joe's"}, saved={"notes": "Trader Joe's, groceries"})` | `{"notes": False}` (exact match required) |

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I124 | `extract_receipt(image)` by a Member, OpenAI mock returns full valid data | returns dict with `amount`, `date`, `category` (matched to an existing Family Category), `notes` |
| I125 | `extract_receipt(image)`, OpenAI mock returns a category name not in the Family's list | response `category` is `None` |
| I126 | `extract_receipt(image)`, OpenAI mock raises an error | request does not raise; returns a response with all fields `None` (graceful fallback, per ADR 0002) |
| I127 | `extract_receipt(image)` without an `image` param | raises `MandatoryError` |
| I128 | `extract_receipt(image)` by a Member with no Family | raises `PermissionError` |
| I129 | `extract_receipt(image)` call | increments that Member's daily extraction count |
| I130 | `extract_receipt(image)` when Member has reached the daily cap | raises `ValidationError`; OpenAI mock not called |
| I131 | `extract_receipt(image)` by two different Members on the same day | each Member's count tracked independently |
| I132 | `extract_receipt(image)` — Member's count from a previous day | doesn't count toward today's cap |
| I133 | `extract_receipt(image)` success | creates a `LLM Call Log` row with `latency_ms`, `input_tokens`, `output_tokens`, `cost`, `model` populated; accuracy fields unset |
| I134 | `extract_receipt(image)` response | includes the created log row's `name` |
| I135 | `extract_receipt(image)` when the daily cap is already reached | no `LLM Call Log` row created (rate-limited attempts aren't logged) |
| I136 | `extract_receipt(image)`, OpenAI mock raises an error | log row still created, with `status: "error"` and latency recorded |
| I137 | `extract_receipt(image)` success | created `LLM Call Log` row has `feature: "receipt_extraction"` |
| I138 | Non-System-Manager user lists `LLM Call Log` | returns no rows / raises `PermissionError` |

---

### P4-S2 · Receipt capture flow: Add Expense sheet + image attachment + accuracy linking (issue #67)

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I139 | `create_expense(..., receipt_image=<file>)` | Expense created; File attachment linked to the new Expense via `attached_to_doctype`/`attached_to_name` |
| I140 | `create_expense(...)` without `receipt_image` | Expense created as before; no File attachment created |
| I141 | `create_expense(..., receipt_extraction_log=<name>)` where saved values match the extraction | log row updated with final values, all gradeable fields marked accurate, linked to the created Expense |
| I142 | `create_expense(..., receipt_extraction_log=<name>)` where saved `amount` differs from the extracted `amount` | log row's `amount` accuracy is `False` |
| I143 | `create_expense(..., receipt_extraction_log=<name>)` where extracted `category` was `None` | log row's `category` accuracy field stays unset (excluded, not graded) |
| I144 | `create_expense(...)` without a `receipt_extraction_log` param (plain manual entry) | no `LLM Call Log` row is touched |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F110 | ExpenseSheet in add mode | "Scan receipt" (camera/upload) entry point visible |
| F111 | Selecting an image via camera or gallery input | client-side compression runs before the extraction call fires |
| F112 | Extraction call in flight | loading state shown in the sheet |
| F113 | Extraction succeeds with all fields | amount, date, category, and notes pre-filled in the form |
| F114 | Extraction returns partial data (e.g. no category) | only the successfully extracted fields are pre-filled; the rest left blank |
| F115 | Extraction fails entirely (API error) | sheet still opens, all fields blank, non-blocking warning message shown |
| F116 | Fields pre-filled after extraction | remain editable; Member can change any field before saving |
| F117 | Saving after a successful extraction | `create_expense` called with the edited/confirmed fields, with the receipt image attached |
| F118 | Daily scan cap reached (backend error) | warning message shown; sheet still usable for manual entry |
| F119 | Selecting an image, then dismissing the sheet before saving | no Expense created; no image uploaded |
| F120 | Saving after a successful extraction | `create_expense` is called with the `receipt_extraction_log` id returned by the earlier `extract_receipt` call |

---

### P4-S3 · Receipt extraction: admin cost/accuracy reporting (issue #68)

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I145 | "Total Cost This Month" Number Card | targets `LLM Call Log`, `Sum` of `cost`, filtered to the current month |
| I146 | "Avg Latency" Number Card | targets `LLM Call Log`, `Average` of `latency_ms` |
| I147 | "Accuracy Rate" Number Card | computes percentage of graded fields (non-null extraction) that matched, across the current month |
| I148 | Daily-trend Script Report | exists, System Manager-only, mirroring the "Family Members" Script Report pattern |
| I149 | Daily-trend Script Report with log rows spanning two different days | returns one aggregated row per day (`cost`, `count`, avg `latency_ms`, accuracy) |

---

### P4-S4 · LLM Call Log: Cost by Member by Month report (issue #72)

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I168 | "Cost by Member by Month" Script Report | exists, System Manager-only |
| I169 | Report with one Member's `LLM Call Log` rows spanning two different months | returns one row per (Member, Month), each with the correct summed cost |
| I170 | Report with rows from both features (`receipt_extraction` and `chat`) for the same Member/Month — `chat` rows only exist once Phase 6's in-app Chat ships, but the report's per-feature breakdown is exercised now with synthetic rows | separate Receipt-cost and Chat-cost columns present, summing to the row's total cost |
| I171 | Report with rows for two different Members in the same month | returns separate rows per Member, not merged |

---

### P4-S5 · Settings: your usage this month (issue #73)

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I172 | `get_my_llm_cost()` (defaults to current month) by a Member with both Receipt and Chat `LLM Call Log` rows this month — `chat` rows only exist once Phase 6 ships, exercised now with synthetic rows | returns `{total, receipt_extraction, chat}` matching the sum of that Member's own rows |
| I173 | `get_my_llm_cost()` by a Member with no `LLM Call Log` rows this month | returns `{total: 0, receipt_extraction: 0, chat: 0}` |
| I174 | `get_my_llm_cost()` — Member and another Member of the same Family both have rows this month | response never includes the other Member's rows |
| I175 | `get_my_llm_cost()` response | contains only the aggregated dollar figures — no raw `LLM Call Log` fields, no `content`, nothing identifying another Member |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F134 | Settings screen | shows a "Your usage this month" section with a total cost figure |
| F135 | "Your usage this month" section | shows a Receipt cost breakdown beneath the total now; gains a Chat row once Phase 6's in-app Chat ships (component built to break down by feature generically, not hardcoded to Receipt-only) |
| F136 | Member with no usage this month | section shows $0 (or equivalent), not hidden or broken |

---

## Phase 5 — Chat via MCP connector (read + write)

See `docs/GLOSSARY.md` (Chat) and `docs/adr/0005-chat-via-mcp-connector-alternative.md` / `docs/adr/0006-chat-driven-manual-entry-mcp-connector.md` for the settled design this phase implements. Ships before Phase 6's in-app Chat (decided #78, #79).

### P5-S1 · MCP server + OAuth2 (`expenso:read`) + read tools (issue #80)

**Unit tests**

| # | Test | Assertion |
|---|------|-----------|
| U35 | `build_mcp_read_tool_schema()` | includes exactly `get_expenses`, `get_analytics`, `get_income`, `get_budgets`; no write-capable tool |

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I176 | OAuth2 authorization-code flow completed by a Member for the connector's `OAuth Client` | resulting access token resolves to that Member's Frappe user via `validate_oauth()`/`frappe.set_user()` |
| I177 | MCP `get_expenses` call with a valid `expenso:read` token | returns the calling Member's Family's Expenses only — identical result to calling the existing whitelisted method directly |
| I178 | MCP `get_analytics`/`get_income`/`get_budgets` calls with a valid `expenso:read` token | each returns Family-scoped data identical to the existing whitelisted method |
| I179 | MCP call with no token, an expired token, or a token for a different scope | request rejected; no data returned |
| I180 | MCP call requesting data belonging to a different Family (via crafted params) | stays scoped to the calling Member's own Family — existing `has_permission`/`permission_query_conditions` enforcement, no new access path |

---

### P5-S2 · MCP write tools: `create_expense`, `create_income`, `list_categories`, `list_sources` (issue #81)

**Unit tests**

| # | Test | Assertion |
|---|------|-----------|
| U36 | `build_mcp_write_tool_schema()` | includes exactly `create_expense`, `create_income`, `list_categories`, `list_sources`, gated separately from the read tools |

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I181 | `create_expense(amount, message)` with a valid `expenso:write` token | creates an Expense with the "unreviewed external write" marker set and `message` stored verbatim in `external_write_message` (audit-only — never rendered in the app) |
| I182 | `create_income(amount, message)` with a valid `expenso:write` token | creates an Income with the same marker and verbatim-message treatment as `create_expense` |
| I183 | `create_expense(...)` without `amount` | raises `MandatoryError`; no record created |
| I184 | `create_expense(...)` without `date` | Expense created with `date` defaulting to today |
| I185 | `create_expense(..., category="Nonexistent")` | `category` left unset on the created Expense; category not auto-created |
| I186 | `create_income(..., source="Nonexistent")` | `source` left unset on the created Income; source not auto-created |
| I187 | `create_expense`/`create_income` call | increments one combined per-Member daily write-cap counter shared across both tools |
| I188 | Member at the daily write cap calls either `create_expense` or `create_income` | raises `ValidationError`; no record created |
| I189 | `create_expense`/`create_income` call with a token that has `expenso:read` but not `expenso:write` | rejected; no record created |
| I190 | `list_categories()`/`list_sources()` via MCP | returns the calling Member's Family's Category/Source names, for the calling LLM to validate against before calling `create_expense`/`create_income` |
| I191 | `create_expense`/`create_income` call | creates no `LLM Call Log` row (Expenso makes no OpenAI call for this path) |
| I192 | `create_expense(amount, notes, message)` with distinct `notes` and `message` values | `notes` stored on the Expense's own `notes` field (same field a manual entry uses); `message` stored separately in `external_write_message` |
| I193 | `create_income(amount, notes, message)` with distinct `notes` and `message` values | same `notes`/`external_write_message` separation as `create_expense` |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F142 | Expense/Income detail view for a record created via `create_expense`/`create_income` | shows the "unreviewed external write" marker as a static label; `notes` (if given) shows in the Notes field like any manual entry; the raw `external_write_message` is never rendered anywhere |
| F143 | Expense/Income detail view for a normally-created record | no marker shown |
| F144 | Feed list row for a record created via `create_expense`/`create_income` | no marker or raw message shown at the row level — `notes`, if present, shows normally like any other entry |

---

## Phase 6 — Chat (in-app)

See `docs/GLOSSARY.md` (Chat, Chat Message) and `docs/adr/0004-chat-via-tool-calling.md` for the settled design this phase implements — accepted but deferred until Phase 5 ships (#78).

### P6-S1 · Chat: send-message endpoint with tool-calling + Chat Message + LLM Call Log content (issue #69)

**Unit tests**

| # | Test | Assertion |
|---|------|-----------|
| U32 | `build_chat_context(messages=<25 rows>, limit=20)` | returns only the most recent 20 |
| U33 | `build_chat_context(messages=<5 rows>, limit=20)` | returns all 5 |
| U34 | `build_tool_schema()` | includes exactly `get_expenses`, `get_analytics`, `get_income`, `get_budgets`; no write-capable tool |

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I150 | `send_message(text)` by a Member, OpenAI mock calls `get_expenses` then returns a final answer | tool executed under the Member's normal permissions; final answer returned; both the Member's message and Chat's answer persisted as `Chat Message` rows |
| I151 | `send_message(text)` — OpenAI mock requests data belonging to a different Family | tool execution stays scoped to the calling Member's own Family regardless of what the LLM requests (existing `has_permission`/`permission_query_conditions` enforcement, no new access path) |
| I152 | `send_message(text)` without a `text` param | raises `MandatoryError` |
| I153 | `send_message(text)` by a Member with no Family | raises `PermissionError` |
| I154 | `send_message(text)` call | increments that Member's daily chat count, independent of the Receipt extraction daily count |
| I155 | `send_message(text)` when Member has reached the daily chat cap | raises `ValidationError`; OpenAI mock not called |
| I156 | `send_message(text)`, OpenAI mock raises an error | request does not raise; returns a transient error response; no `Chat Message` row created for the attempt |
| I157 | `send_message(text)` success | creates an `LLM Call Log` row with `feature: "chat"`, `latency_ms`, `input_tokens`, `output_tokens`, `cost`, `model` populated, and `content` containing the full tool-calling trace (message, tool calls, results, final answer) |
| I158 | `get_chat_history()` | returns only the calling Member's `Chat Message` rows, ordered chronologically |
| I159 | `get_chat_history()` for a Member with no messages | returns empty list |
| I160 | Two different Members each with `Chat Message` rows | each Member's `get_chat_history()` excludes the other's messages (private, not Family-shared) |
| I161 | `clear_chat()` | deletes all of the calling Member's `Chat Message` rows |
| I162 | `clear_chat()` | does not delete or modify any `LLM Call Log` rows |
| I163 | `send_message(text)` immediately after `clear_chat()` | context assembled for the LLM call contains no prior messages (fresh context) |

---

### P6-S2 · Chat UI: floating bubble, full-screen thread, Clear chat (issue #70)

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F121 | Chat bubble | visible on Feed, Analytics, Budget, and Settings screens |
| F122 | FAB | now visible on Analytics, Budget, and Settings too (previously Feed-only); same Add Expense sheet behavior on every screen |
| F123 | Chat bubble and FAB together, any screen | both bottom-right; Chat bubble stacked directly above the FAB, with a clear gap (no overlapping tap targets) |
| F124 | Tapping the chat bubble | opens the full-screen chat overlay |
| F125 | Chat overlay on open | renders message history from `get_chat_history()` |
| F126 | Sending a message | input cleared; loading state shown while `send_message` is in flight |
| F127 | Successful `send_message` response | Member's message and Chat's answer both appended to the visible thread |
| F128 | Failed `send_message` call | transient error notice shown; message list unchanged (nothing appended) |
| F129 | Daily chat cap reached (backend error) | warning message shown; input remains usable |
| F130 | "Clear chat" action | confirmation prompt shown before clearing |
| F131 | Confirmed "Clear chat" | `clear_chat` called; message list becomes empty |
| F132 | Cancelled "Clear chat" confirmation | `clear_chat` not called; message list unchanged |
| F133 | Chat overlay closed (back/close action) | returns to the underlying screen; thread still present on reopen |

---

### P6-S3 · Chat: admin cost/latency reporting (issue #71)

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I164 | "Total Cost This Month (Chat)" Number Card | targets `LLM Call Log`, `Sum` of `cost`, filtered to `feature: "chat"` and the current month |
| I165 | "Avg Latency (Chat)" Number Card | targets `LLM Call Log`, `Average` of `latency_ms`, filtered to `feature: "chat"` |
| I166 | Daily-trend Script Report | breaks out rows by `feature` (or accepts a feature filter), so Receipt and Chat trends are distinguishable rather than conflated |
| I167 | Daily-trend Script Report with both Receipt and Chat log rows on the same day | each feature's aggregates (cost, count, avg latency) are computed independently |

---

### Feed/Analytics: rename Spent→Expense and Savings→Balance; move Budget total to Budget screen (issue #75)

"Spent" is renamed to "Expense" (Feed banner, Analytics tile) and "Savings" is renamed to
"Balance" (`get_analytics`'s `savings` key becomes `balance` — see P2-S2 above, edited in
place). Feed's summary banner gains a Balance figure it never showed before (Income − Expense),
so it now shows Income, Expense, and Balance in one line, matching Analytics. Analytics' top
summary collapses from a 2×2 grid of four tiles to a single line of three (Income, Expense,
Balance), dropping its Budget tile entirely. The total-Budget figure moves to the Budget screen,
computed client-side in `useBudgets()` as the sum of each Category's `budget_amount` already
returned by `get_budgets` — no backend API change, so the I115/I116 tests that lived on
`get_analytics` (issue #62) are removed rather than moved. Analytics' per-category "Balance"
label (Budget minus spend) is renamed to "Remaining" to avoid colliding with the new top-level
Balance figure.

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F140 | Budget page shows a "Budget" summary tile | total equals the sum of each Category's `budget_amount` for the month, formatted |
| F141 | Feed banner shows a Balance figure | equals Income total minus Expense total; appears third, after Income and Expense |

---

## Totals

| Layer | Count |
|---|---|
| Backend unit tests | 37 |
| Backend integration tests | 191 |
| Frontend unit tests | 160 |
| **Total** | **388** |
