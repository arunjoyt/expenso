# Expenso — Test Plan

Complete unit and integration test plan. Backend tests use Frappe's `UnitTestCase` (no DB) and `IntegrationTestCase` (DB, auto-rollback). Frontend tests use Vitest. Phases 6–7 also have `[A]` tests that live in the `expenso-assistant` repo's own pytest suite (sketched here for completeness).

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

## Phase 4 — Receipt-to-Expense — superseded

**Folded into Phase 6/7 on 2026-09-09 ([ADR 0008](adr/0008-in-app-assistant-architecture.md)).** Receipt extraction is now a capability of the in-app Assistant (attach a photo in the Assistant chat), the vision call runs in the `expenso-assistant` service, and the image is never stored. The old streaks map as follows:

- **P4-S1** (`extract_receipt` endpoint) → the vision call moves to the service and is tested in the `expenso-assistant` repo (`build_extraction_prompt` / `parse_extraction_response` / `compute_cost` / `compute_field_accuracy` become service unit tests). There is no `LLM Call Log` DocType (ADR 0008's 2026-09-10 update). #67's ExpenseSheet-scan tests (F110–F120) are dropped — there is no camera on the sheet.
- **P4-S3 / P4-S4 / P4-S5** (admin + Member reporting) → dropped. Cost / latency / token visibility is the Langfuse dashboards; receipt accuracy is a Langfuse score. No Frappe reporting tests.

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
| I191 | `create_expense`/`create_income` via the connector | the write path invokes no LLM call and meters nothing — Expenso bills nothing for connector writes (holds by construction: the connector path has no model binding) |
| I192 | `create_expense(amount, notes, message)` with distinct `notes` and `message` values | `notes` stored on the Expense's own `notes` field (same field a manual entry uses); `message` stored separately in `external_write_message` |
| I193 | `create_income(amount, notes, message)` with distinct `notes` and `message` values | same `notes`/`external_write_message` separation as `create_expense` |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F142 | Expense/Income detail view for a record created via `create_expense`/`create_income` | shows the "unreviewed external write" marker as a static label; `notes` (if given) shows in the Notes field like any manual entry; the raw `external_write_message` is never rendered anywhere |
| F143 | Expense/Income detail view for a normally-created record | no marker shown |
| F144 | Feed list row for a record created via `create_expense`/`create_income` | no marker or raw message shown at the row level — `notes`, if present, shows normally like any other entry |

---

## Phase 6 — Assistant core

See `docs/adr/0008-in-app-assistant-architecture.md` for the settled design. ADR 0004 is largely superseded. `[F]`/`[FE]` tests live in this repo; `[A]` tests live in the `expenso-assistant` repo's own suite and are sketched here for completeness.

### P6-S1 · `[F]` `entry_method` + `api.py` plumbing + concurrency guard (reuses #66)

No `LLM Call Log` / `record_llm_call` / `get_my_llm_cost` — dropped by ADR 0008's 2026-09-10 update. LLM call tracking is Langfuse traces only, tested in the `expenso-assistant` repo (P6-S5).

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I155 | `update_expense(name, …, if_modified_since=<stale timestamp>)` | raises a distinct conflict error; the row is not changed |
| I156 | `update_expense(name, …, if_modified_since=<current timestamp>)` | write succeeds |
| I157 | `create_expense(…, entry_method="assistant")` | Expense created with `entry_method="assistant"` and **no** `is_external_write` |
| I158 | `list_categories()` / `list_sources()` in `api.py` by a Member | returns that Family's Category / Source names only |
| I159 | Migration patch `add_entry_method` | existing `is_external_write=1` rows backfill to `entry_method="connector"`, the rest to `"manual"` |

---

### P6-S3 · `[A]` `tools.py` + FastMCP external adapter (Frappe-REST-backed)

**Service tests** (`expenso-assistant` repo)

| Test | Assertion |
|------|-----------|
| `tools.py` read fn (`get_expenses`) called with a Member's bearer token | calls Frappe REST as that Member; returns only that Family's rows |
| `tools.py` read fn called with a token for a different Family, crafted params | still scoped to the token's Family (Frappe `permission_query_conditions` enforce it, not the fn) |
| FastMCP `create_expense` tool | issues an MCP elicitation request before any Frappe write |
| Elicitation accepted | Frappe REST `create_expense` fires with `entry_method="connector"` |
| Elicitation declined | no Frappe write |
| Token missing the `expenso:write` scope calls a FastMCP write tool | rejected before elicitation |
| `MCP_ENABLED=false` | `/mcp` is not mounted; the agent's own endpoints and tool binding are unaffected |
| the read fn set / write fn set exposed to the agent | read set has no write-capable fn; write set is exactly the D2 list |

---

### P6-S4 · `[F]` Cutover: delete `expenso/mcp.py`, drop `frappe-mcp`

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I160 | `expenso/mcp.py` removed | no import of `frappe_mcp` anywhere in the app; `pyproject.toml` has no `frappe-mcp` dependency |
| I161 | `test_mcp.py` | replaced or removed — the in-process MCP handler no longer exists |
| I162 | OAuth discovery metadata (`/.well-known/oauth-authorization-server`) | still served (Frappe stays the authorization server) |

---

### P6-S5 · `[A]` LangGraph agent (read-only) + SSE/resume FastAPI

**Service tests** (`expenso-assistant` repo)

| Test | Assertion |
|------|-----------|
| Agent binds tools | the graph's tool list is the `tools.py` read fns bound directly — no `langchain[mcp]` import, no MCP client in the agent path |
| Agent given "what did I spend on groceries in March", OpenAI mock | calls the right read tool(s) with month/year params; returns a final answer; one Langfuse trace emitted, tagged `user_id`=<member> / `metadata.family` / `metadata.feature="chat"` / `session_id`=<thread>, generation cost set from the `config.py` pricing constant |
| Cost is computed from returned token usage | mock OpenAI returns known `prompt_tokens` / `completion_tokens` (+ `cached_tokens`); the trace's cost = the `config.py` rate table applied per token class (cached input discounted, reasoning as output) — not Langfuse's own estimate |
| Per-run `recursion_limit` / max-tool-calls / wall-clock cap exceeded | run ends in error; caller sees an error; no partial answer emitted |
| Per-Member daily chat cap reached (mock Langfuse trace count) | refused; OpenAI not called |
| Langfuse unreachable during the daily-cap check | the check fails open — the run proceeds; a warning is logged |
| SSE stream | emits humanized step events then the streamed answer; ends with `done` |
| Bearer token for Member A used to open Member B's thread | rejected by the custom auth |

---

### P6-S6 · `[FE]` Chat surface: bubble + overlay on every screen, global FAB (reuses #70)

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F121 | Chat bubble | visible on Feed, Analytics, Budget, and Settings |
| F122 | FAB | now visible on Analytics, Budget, and Settings too (was Feed-only); extracted from `Feed.vue` into a global `Fab.vue`; same Add Expense sheet behaviour everywhere |
| F123 | Chat bubble + FAB together, any screen | both bottom-right; bubble stacked directly above the FAB with a clear gap (no overlapping tap targets) |
| F124 | Tapping the bubble | opens the full-screen chat overlay |
| F125 | Overlay on open | fetches an Assistant token, renders thread history from the service |
| F126 | Sending a message | opens the SSE stream; humanized step log renders, then the answer streams in |
| F127 | Failed stream | transient error notice; nothing appended to the thread |
| F128 | Daily cap error from the service | warning shown; input remains usable |
| F129 | "Clear chat" | confirmation prompt; confirmed → service call deletes the thread and the visible list empties; cancelled → no call |
| F130 | Overlay closed | returns to the underlying screen; thread present on reopen; unread badge cleared once seen |

---

### P6-S7 · `[A]`+`[FE]` Agent writes + confirm-card flow + concurrency guard

**Integration / service tests**

| Test | Assertion |
|------|-----------|
| Write prompt → the proposal node raises `interrupt()` (no MCP elicitation on this path) → one batched confirm card | payload lists every proposed action with concrete values; updates show a before→after diff; no `tools.py` write fn has run yet |
| Card confirmed → `/resume` | the graph calls the `tools.py` write fns for the approved set; each Frappe write fires with `entry_method="assistant"`, no `is_external_write` |
| Card with one row deselected | only the selected rows are written |
| Card cancelled | nothing is written |
| Target row edited from a second session between the agent's read and the resume | write rejected via `if_modified_since`; the agent re-reads and re-proposes with the new values |
| Multi-step: step 2 needs step 1's created row | two confirm cards in the turn, each batched for its step |
| Per-Member daily write cap reached | write path refused with a clear message |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F131 | Confirm card | renders concrete rows and a before→after diff for edits; confirm / per-row deselect / cancel controls present |
| F132 | Confirm / deselect / cancel | send the matching resume payload to the service |

---

## Phase 7 — Proactive & Reporting

### P7-S1 · `[A]`+`[FE]` Receipts conversational in the Assistant

**Service / integration tests**

| Test | Assertion |
|------|-----------|
| A receipt image attached to a chat turn, vision mock returns full fields | agent proposes `create_expense` in a confirm card with those values |
| Confirm the proposal (unedited) | Expense created with `entry_method="receipt"`; the receipt trace gets `receipt_accuracy_{amount,date,category,notes}` scores = 1 (proposed matched confirmed) |
| Edit the amount in the card, then confirm | Expense saved with the edited amount; `receipt_accuracy_amount` score = 0 on the trace, the other three = 1 |
| Reject the proposal | no Expense; the trace still carries cost/latency but no accuracy scores |
| Non-receipt photo | agent asks what the Member wants; no proposal |
| After processing | no Frappe `File` created, no image on the Expense, no image in the thread — only a text marker |
| Vision mock returns a category not in the Family list | proposed `category` is `None` |

---

### P7-S2 · `[F]`+`[A]` Proactive Insights

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I176 | `run_monthly_summary` scheduled job | mints a per-Member **read-scoped** bearer token and POSTs `/run/proactive` once per Member |
| I177 | Proactive run | the graph binds the **read-only** toolset (no write tool available) |
| I178 | Proactive run output | an Insight message is posted into that Member's thread; the bubble unread badge reflects it |
| I179 | `run_budget_drift` run twice with unchanged data | the second run posts no message (dedup marker) |
| I180 | `run_budget_drift` when a Category crosses its threshold | exactly one new Insight |
| I181 | Proactive run wants an action taken | it emits a pending proposal (queued confirm card), never a direct write |

---

### P7-S3 — removed

Consolidated LLM reporting (old #68, absorbing #71/#72/#73) is dropped by ADR 0008's 2026-09-10 update. There is no `LLM Call Log` DocType and no Frappe reporting surface — cost / latency / token visibility is the Langfuse dashboards (saved views set up in P6-S5), and receipt-extraction accuracy is a Langfuse score on the receipt trace. No Frappe integration or frontend tests here. The Member-facing "your usage this month" (#73) is deferred out of v1.

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

Phases 1–3 and 5 (shipped): **~340** tests (backend unit + integration + frontend). Phase 4's
count is retired — the section was folded into Phases 6–7. Phases 6–7 add roughly **55** more:
`[F]`/`[FE]` tests in this repo (P6-S1 ~4 I + P6-S4 ~3 I + P6-S6 ~10 F + P6-S7 ~2 F + P7-S2 ~6 I;
P7-S3 removed), plus `[A]` service tests in the `expenso-assistant` repo (P6-S3 / P6-S5 /
P6-S7 / P7-S1). Exact numbered rows are finalised when each streak is implemented.
