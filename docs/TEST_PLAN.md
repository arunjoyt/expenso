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

### P6-S2 · `[F]` Assistant token mint endpoint + proactive scheduler stubs (reuses #91)

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I160 | `mint_assistant_token()` by a Member | returns `access_token` + `token_type="Bearer"` + `expires_in`; the token resolves to that Member via `validate_oauth` and carries `expenso:read` but **not** `expenso:write` |
| I161 | `mint_assistant_token(write=True)` (incl. the string `"true"` from an HTTP call) | the minted token carries both `expenso:read` and `expenso:write` |
| I162 | Minted token's `expiration_time` | short-lived — within `ASSISTANT_TOKEN_TTL_MINUTES` of now, and `expires_in` matches |
| I163 | `mint_assistant_token()` by a signed-in user with no Family | raises `frappe.PermissionError`; no token row created |
| I164 | `mint_assistant_token()` as `Guest` | raises `frappe.PermissionError` |
| I165 | First mint on a site with no `Expenso Assistant` OAuth Client | creates one internal `OAuth Client` (scopes cover `expenso:read`+`expenso:write`); a second mint reuses it, not a duplicate |
| I166 | `run_monthly_summary` / `run_budget_drift` | importable, registered in `hooks.scheduler_events["cron"]`, and a no-op call raises nothing (bodies are P7-S2) |

---

### P6-S3 · `[A]` `tools.py` + FastMCP external adapter (Frappe-REST-backed)

**Service tests** (`expenso-assistant` repo)

| Test | Assertion |
|------|-----------|
| `tools.py` read fn (`get_expenses`) called with a Member's bearer token | calls Frappe REST as that Member; returns only that Family's rows |
| `tools.py` read fn called with a token for a different Family, crafted params | still scoped to the token's Family (Frappe `permission_query_conditions` enforce it, not the fn) |
| FastMCP `create_expense` tool, first call | returns an SEP-2322 `InputRequiredResult` (confirm request), no Frappe write yet |
| confirmation accepted (re-invoked with `confirm=true`) | Frappe REST `create_expense` fires with `entry_method="connector"` |
| confirmation declined, or `confirm=false` | no Frappe write; tool returns `status="cancelled"` |
| Token missing the `expenso:write` scope calls a FastMCP write tool | rejected before the confirm round-trip starts |
| read tool via FastMCP | no confirm round-trip — returns straight away |
| `MCP_ENABLED=false` | `/mcp` is not mounted; the agent's own endpoints and tool binding are unaffected |
| the read fn set / write fn set exposed to the agent | read set has no write-capable fn; write set is exactly the D2 list (no `rename/delete_category`, no `rename/delete_source`) |
| `FrappeTokenVerifier` against Frappe's RFC 7662 introspection | active token → `AccessToken` with its scopes; inactive/unreachable → `None` |
| model/pricing constant (`cost_for`) | applies the `config.py` rate table per token class — cached input discounted, reasoning billed as output; unknown model → `None` |

---

### P6-S4 · `[F]` Cutover: delete `expenso/mcp.py`, drop `frappe-mcp`

The Phase-5 connector semantics `expenso/mcp.py` owned move onto `api.py`:
`create_expense`/`create_income` take `entry_method` + `external_message` and,
for `entry_method="connector"`, set `is_external_write=1` + the audit message
and enforce the daily cap; `require_oauth_scope` moves to `permissions.py` and
guards every whitelisted read (`expenso:read`) and write (`expenso:write`).

**Integration tests** (`test_connector.py`)

| # | Test | Assertion |
|---|------|-----------|
| I167 | `import expenso.mcp` | `ModuleNotFoundError`; no `.py` file imports `frappe_mcp`; `pyproject.toml` has no `frappe-mcp` dependency |
| I168 | `test_mcp.py` | removed; connector coverage lives in `test_connector.py` |
| I169 | `OAuth Settings.show_auth_server_metadata` | still enabled — discovery metadata unaffected by the cutover |
| I170 | `create_expense(entry_method="connector", external_message=…)` | Expense has `is_external_write=1`, `external_write_message` verbatim, `notes` separate; same for `create_income` |
| I171 | `create_expense(entry_method="assistant", external_message=…)` | **not** marked; `external_write_message` stays null |
| I172 | `create_expense(category="groceries", entry_method="connector")` | resolves to the Family's "Groceries" Category (case-insensitive); unknown label → `category` unset, never created |
| I173 | connector `create_expense` + `create_income` share one daily counter; cap reached → `ValidationError`, row not written; manual writes don't count |
| I174 | Bearer token with `expenso:read` only calls a write method | `PermissionError`; a token missing `expenso:read` calls a read method → `PermissionError`; session-authed calls are not scope-gated |
| I175 | `validate_oauth(["Bearer", <valid>])` | resolves `frappe.session.user` to the token's Member; expired token does not |

---

### P6-S5 · `[A]` LangGraph agent (read-only) + SSE/resume FastAPI

Decisions taken while implementing (grill 2026-09-10): `metadata.family` dropped
(above); Member id resolved via `frappe.auth.get_logged_user` after introspection;
`thread_id = "member:" + sha256(email)` **derived server-side** — no client-supplied
thread id anywhere; hand-rolled `StateGraph` (`agent` ⇄ `tools`, `tool_call_count`
in state); `build_model()` is the one place OpenAI is named; custom LangChain
callback owns the explicit cost (not the stock Langfuse handler); `feature:chat`
added as a trace **tag** so the daily-cap query is a tag filter, checked *before*
this run's trace opens; on any cap error the turn is rolled back to the
pre-run checkpoint (no orphaned user message); `/resume` ships as an
endpoint+SSE shell (interrupt semantics are P6-S7); endpoints require
`expenso:read`; saved Langfuse dashboards deferred to P7-S2.

**Service tests** (`expenso-assistant` repo)

| Test | Assertion |
|------|-----------|
| Agent binds tools | `build_graph()` binds the `tools.py` `READ_TOOLS` directly (`model.bind_tools(READ_TOOLS)`); no `langchain[mcp]` / `langchain_mcp` import anywhere in `agent/`; no MCP client in the agent path |
| Read-only graph never binds a write tool | `WRITE_TOOLS` names are absent from the compiled graph's tool set |
| Agent given "what did I spend on groceries in March", fake tool-calling model | calls a read tool with `month=3` and the current year (date from the per-run system prompt); returns a final answer |
| One Langfuse trace per turn, tagged | exactly one trace; `user_id`=<member email>, `metadata.feature="chat"`, tag `feature:chat`, `session_id`=<derived thread id>; no `metadata.family` |
| Generation cost is the service's number | fake model reports known `prompt_tokens`/`completion_tokens` (+ `cached_tokens`, `reasoning_tokens`); the generation's recorded cost == `config.cost_for(...)` per token class (cached input discounted, reasoning as output) — Langfuse's own model-price estimate is not used |
| `recursion_limit` exceeded | `GraphRecursionError` caught; SSE ends with `error` `{code:"recursion"}`; no `token` event was emitted; thread history unchanged (rolled back) |
| max-tool-calls cap exceeded | routes to the terminal cap node, not `tools`; SSE `error` `{code:"tool_cap"}`; history unchanged |
| wall-clock cap exceeded | `asyncio.wait_for` times out; SSE `error` `{code:"wall_clock"}`; history unchanged |
| Per-Member daily chat cap reached (mock Langfuse count ≥ cap) | run refused with `error` `{code:"daily_cap"}` before the trace opens; the model is never called |
| Langfuse unreachable during the daily-cap check | check fails open — run proceeds; a `warning` is logged |
| Daily-cap query shape | counts today's traces (service tz) for `user_id` + tag `feature:chat`; this run's own trace is not counted (checked first) |
| SSE happy path | `step` events (humanized from tool name/args) then `token` deltas then `done` `{message_id}` |
| History endpoint | returns human + assistant messages in checkpoint order as `{id, role, content}`; tool messages and tool-call-only assistant messages omitted |
| "Clear chat" | deletes the derived thread from the checkpointer; history then empty |
| Client-supplied thread id is ignored | run / `/resume` / history / clear all operate on the id derived from the token's Member — a body/query `thread_id` for another Member has no effect |
| Inactive or unintrospectable bearer | every endpoint returns 401; the graph is not invoked |
| Token missing `expenso:read` | 401 (endpoints require the read scope) |
| `/resume` with no pending interrupt | clean response (no 500); read-only graph has nothing to resume — full interrupt/resume path is P6-S7 |

---

### P6-S6 · `[FE]` Assistant tab (Chat surface) + global FAB (reuses #70)

Chat is the 5th bottom-nav tab, "Assistant" — a routed screen, not a floating bubble/overlay
(ADR 0008's 2026-09-10 P6-S6 update). FAB extracted from `Feed.vue` into a global `Fab.vue`
via a shared `useEntrySheet.js`. `useAssistant.js` mints a read-only token, consumes `POST /chat`
as SSE via `fetch()` + `ReadableStream`, and tracks a dormant unread badge.

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F121 | `BottomNav` | 5 tabs — Feed, Analytics, Budget, Settings, Assistant (icon 💬); the Assistant tab routes to `pages/Assistant.vue` |
| F122 | FAB | rendered by a global `Fab.vue` on Feed, Analytics, Budget, and Settings — **not** on the Assistant screen; opens the Add Expense sheet with the Expense/Income switcher, same behaviour on every screen |
| F123 | `useEntrySheet` | `openAdd` / `openEditExpense` / `openEditIncome` / `close` drive one shared sheet; the sheets are mounted once (in `App.vue`), not per-page; a Feed row tap opens the edit sheet through the composable |
| F124 | Assistant screen on mount | calls `mint_assistant_token` (read scope), then `GET /history`; renders the returned user + assistant messages in order |
| F125 | `window.assistant_url` unset | the screen shows an "Assistant isn't configured" notice; no token mint, no fetch |
| F126 | Sending a message | POSTs `/chat` with the bearer header; `step` events render as a transient humanized log, `token` events stream into the answer bubble, `done` commits the final assistant message; the step log clears after `done` |
| F127 | Failed stream (`error` event / network failure) | a transient error notice shows; nothing is appended to the visible thread; input stays usable |
| F128 | `error` `{code:"daily_cap"}` from the service | the cap warning shows; the input remains usable |
| F129 | Expired token → 401 on a request | `useAssistant` re-mints once and retries; a second 401 surfaces the error notice |
| F130 | "Clear chat" | inline Confirm/Cancel (no `window.confirm`); confirmed → `DELETE /history`, the visible list empties, `lastSeenMessageId` resets; cancelled → no call |
| F133 | Unread badge (dormant mechanism) | history whose newest message is an unseen `assistant` message → a dot on the Assistant nav tab; opening the tab sets `lastSeenMessageId` to the newest id → the dot clears; a message received in a live turn never self-badges |
| F134 | `useAssistant` SSE parser | frames split on `\n\n`, partial frames buffered across chunks, `event:`/`data:` parsed, `token` text accumulated, `done` returns the committed text, `error` returns without committing |

_(F129/F133/F134 added beyond the original F121–F130; F131/F132 stay reserved for P6-S7. The ~10-test estimate in Totals becomes ~13.)_

**Service test (companion `[A]` change, `expenso-assistant` repo)**

| Test | Assertion |
|------|-----------|
| CORS preflight | an `OPTIONS` to `/chat` from an allowed origin returns the `Access-Control-Allow-Origin` / `-Headers: authorization` / `-Methods` headers; a disallowed origin gets none |

---

### P6-S7 · `[A]`+`[FE]` Agent writes + confirm-card flow + concurrency guard

Decisions taken while implementing (grill 2026-09-10, recorded in ADR 0008's P6-S7 update):
`route()` sends a message with any **write** tool-call to a `propose` node (reads still go
to `tools`); `propose` raises `interrupt({actions:[…]})` — the real `tools.py` write fns
never run inline; `/resume` body is `{decision:{selected:[id,…]}}` (empty = cancel) and
`propose` **re-derives** the action list from the still-pending `tool_calls` + tool history;
the diff's "before" and `if_modified_since` come from the `ToolMessage`s already in state
(no re-read); a per-action `TimestampMismatchError` doesn't abort the batch; the daily
*write* cap is dropped for `max_proposed_writes_per_turn` (25, local check); `/resume`
opens its own `feature:chat` trace and the chat cap is not re-checked; `resume_turn` binds
`entry_method="assistant"` and re-mints the token; wall-clock resets per SSE leg.

**Integration / service tests** (`expenso-assistant` repo)

| Test | Assertion |
|------|-----------|
| Write prompt, scripted model emits one `update_expense` call | `route()` goes to `propose`, not `tools`; the graph interrupts; `astream` ends the leg with `needs_confirmation`, no `done`; no `tools.py` write fn ran |
| Read-only call still routes to `tools` | a message with only `get_expenses` calls never reaches `propose` (regression) |
| `needs_confirmation` payload shape | `actions[]` — each `{id:"a1"…, tool, kind, entity, summary}`; `update` carries `changes:[{field,from,to}]` from the tool history; `create`/`delete` carry `values`; `name`/`if_modified_since` are **not** in the payload |
| Target row not in the tool history | `propose` returns a `ToolMessage` nudge ("re-read … first"), does **not** interrupt |
| Card confirmed → `POST /resume` `{selected:["a1","a2"]}` | the `tools.py` write fns run for a1+a2; each Frappe call carries `entry_method="assistant"`, no `is_external_write`, and `if_modified_since` = the value the agent read; the continuation streams `token` then `done` |
| One action deselected | `{selected:["a1"]}` → only a1 is written; a2's original `tool_call` gets a "skipped by the member" `ToolMessage` |
| Cancelled | `{selected:[]}` (and `{}`) → nothing is written; the model is told the member cancelled |
| Per-action conflict | 3 actions, a2's target changed underneath (`TimestampMismatchError`) → a1+a3 applied, a2 → `ToolMessage` → model re-reads and re-proposes → a **second** `needs_confirmation` with the new current values |
| `max_proposed_writes_per_turn` exceeded | model proposes 30 writes in one message → card carries the first 25; after resume a `ToolMessage` says 5 remain → model proposes them → second card |
| Multi-step: step 2 needs step 1's row | model creates a Category (card 1), resumes, then proposes an Expense using it (card 2) — two cards in the one turn |
| New `POST /chat` while an interrupt is pending | the pending interrupt is discarded (a transient `step` "Discarded the unconfirmed changes"), the new message proceeds; `/history` shows no orphaned proposal |
| `POST /resume` with nothing pending | clean response (no 500, no write), same as the P6-S5 shell |
| `tool_call_count` persists across the interrupt | a turn that used N-1 tool cycles before proposing hits `run_max_tool_calls` on the post-resume cycle → `error` `{code:"tool_cap"}` |
| Resume accounting | `/resume` opens its own trace tagged `feature:chat`; `within_daily_chat_cap` is **not** called on the resume path |
| `set_budget` kind | `update` when a budget row for that category/month is in the tool history, else `create`; `add_category`/`add_source` always `create`, no `if_modified_since` |
| Read-only (proactive) graph | built without `WRITE_TOOLS`, `route()` never reaches `propose`; `interrupt` is unreachable |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F131 | `ConfirmCard` | renders each action's concrete `values` (create/delete) or `changes` before→after rows (update); a checkbox per action, checked by default; Confirm + Cancel present; goes read-only once `resume` starts |
| F132 | Confirm / deselect / cancel | Confirm → `resume({selected:[checked ids]})`; unchecking a row drops its id; Cancel → `resume({selected:[]})` |
| F135 | `useAssistant` parser | a `needs_confirmation` frame resolves `sendMessage`/`resume` with `{kind:"confirm", actions}` (vs `{kind:"message"}` on `done`) |
| F136 | `useAssistant.resume` | `POST /resume` with the bearer and `{decision}` body; parses the continuation stream; a `done` commits the follow-up assistant message |
| F137 | `Assistant.vue` confirm flow | a `needs_confirmation` turn renders `ConfirmCard` inline; Confirm drives `resume` and the streamed follow-up answer is appended; a second `needs_confirmation` replaces the card |
| F138 | Token scope | the Assistant screen mints with `write=true` (P6-S7 raised it from read-only) |

**Frappe-side:** the `if_modified_since` guard and `entry_method` plumbing shipped in P6-S1. P6-S7 adds `modified` to the `get_expenses` / `get_income` field lists so the agent can capture it at read and pass it back — one test: `get_expenses` rows carry `modified`.

---

## Phase 7 — Proactive & Reporting

### P7-S1 · `[A]`+`[FE]` Receipts conversational in the Assistant

Decisions taken while implementing (grill 2026-09-11, recorded in ADR 0008's P7-S1 update):
`ChatIn` gains an optional `image` (base64 JPEG data URI) sent alongside `message` — the
frontend always re-encodes client-side via `<canvas>` first, so the service accepts one
mime type plus a size backstop, never a whitelist. The image never enters checkpointed
state — it rides in `config["configurable"]["receipt_image"]`, and `agent_node` splices it
into a transient message list built just for `model_with_tools.ainvoke(...)`, re-spliced on
every loop iteration in the turn since each model call is stateless. The checkpointed
`HumanMessage` is `"[Attached a photo]"` plus the Member's caption if given. Tagging
(`entry_method="receipt"`, trace `feature="receipt"`) is decided by input shape (an `image`
present) before the graph runs, not by whether a proposal results; receipt turns count
against the existing `daily_chat_cap`, no new cap. `session.py` emits a synthetic
`step` ("Reading the receipt…") itself the moment it sees `image`, before driving the graph.
`ConfirmCard.vue` gets always-editable inline inputs for any `kind: "create"` action (not
receipt-specific); the resume decision shape grows to `{selected, edits: {actionId:
{field: value}}}`, sparse and optional. `_build_action` captures `entry_method` at
proposal-build time onto the action (so `_apply` knows a receipt-sourced action even on
resume, when the caller's own binding is back to `"assistant"`); `receipt_accuracy_*`
scores post on the **resume leg's own trace** (not the original `/chat` trace that ran the
vision call) — the comparison only exists once the Member confirms/edits, which happens at
resume — gated on `entry_method == "receipt"` and `tool == "create_expense"`, approved
actions only.

**Integration / service tests** (`expenso-assistant` repo)

| Test | Assertion |
|------|-----------|
| `POST /chat` with `image` set | `entry_method` binds `"receipt"` for the turn; the trace opens with `feature="receipt"`; a synthetic `step` ("Reading the receipt…") is the first SSE event, before any tool/token event |
| `agent_node` invocation with `config["configurable"]["receipt_image"]` set | the model call receives a multimodal message (text + image block); the graph's checkpointed `state["messages"]` after the turn contains only the text marker, never the image bytes or data URI |
| A receipt image attached to a chat turn, vision mock returns full fields | agent proposes `create_expense` in a confirm card with those values; the action's captured `entry_method` is `"receipt"` |
| Confirm the proposal (unedited) — `POST /resume {selected:["a1"]}`, no `edits` | Expense created with `entry_method="receipt"`; the **resume leg's** trace gets `receipt_accuracy_{amount,date,category,notes}` scores = 1 (proposed matched confirmed) |
| Edit the amount in the card — `POST /resume {selected:["a1"], edits:{a1:{amount:...}}}` | Expense saved with the edited amount (edits merged into `call_args` before the write); `receipt_accuracy_amount` score = 0 on the resume trace, the other three = 1 |
| Reject the proposal — `{selected:[]}` | no Expense; no `receipt_accuracy_*` scores posted anywhere (the `/chat` trace still has cost/latency; the resume trace has neither) |
| A non-receipt, non-image write proposal (e.g. "add this $20 coffee") gets edited at resume | `entry_method` stays `"assistant"` (not `"receipt"`) on the action; **no** `receipt_accuracy_*` scores posted — the gate is `entry_method=="receipt"`, not "was anything edited" |
| Non-receipt photo | agent asks what the Member wants; no proposal; turn still traces `feature="receipt"` |
| After processing | no Frappe `File` created, no image on the Expense, no image in the thread, no image anywhere in the Postgres checkpoint row — only the text marker |
| Vision mock returns a category not in the Family list | proposed `category` is `None`; excluded from `receipt_accuracy_category` scoring (null-proposed-field exclusion, ADR 0003) |
| Vision mock returns `notes` that differs from confirmed by only appended text | `receipt_accuracy_notes` = 0 (exact-string rule, ADR 0003 — not fuzzy/substring) |

**Frontend unit tests**

| # | Test | Assertion |
|---|------|-----------|
| F139 | Attach-photo control | an icon in the compose bar opens a file picker (`accept="image/*" capture="environment"`); a picked file renders as a removable thumbnail chip above the input before sending |
| F140 | Client-side re-encode | a picked file is drawn to a `<canvas>`, downscaled to a capped long edge, and sent as a `image/jpeg` base64 data URI in the `/chat` body — regardless of the source file's original format |
| F141 | Caption with photo | sending a photo with typed text includes both in one turn; the rendered user-message bubble (from history / the live send) reads `"[Attached a photo] <caption>"`; photo alone reads `"[Attached a photo]"` |
| F142 | `ConfirmCard` inline edit inputs | a `kind:"create"` action renders amount/date/category/notes as editable inputs (not plain text); an `update`/`delete` action still renders read-only with a checkbox only |
| F143 | Edited value flows to resume | changing a `create` action's field before confirming sends `resume({selected:[...], edits:{actionId:{field:newValue}}})`; an unedited action sends no `edits` entry for it |

---

### P7-S2 · `[F]`+`[A]` Proactive Insights

**Integration tests**

| # | Test | Assertion |
|---|------|-----------|
| I176 | `run_monthly_summary` scheduled job | mints a per-Member **read-scoped** bearer token and POSTs `/run/proactive` once per Member |
| I177 | Proactive run | the graph binds the **read-only** toolset (no write tool available) |
| I178 | Proactive run output | an Insight message is posted into that Member's thread; the Assistant nav-tab unread badge reflects it |
| I179 | `run_budget_drift` run twice with unchanged data | the second run posts no message (dedup marker) |
| I180 | `run_budget_drift` when a Category crosses its threshold | exactly one new Insight |
| I181 | Proactive run wants an action taken | it emits a pending proposal (queued confirm card), never a direct write |

---

### P7-S3 — removed

Consolidated LLM reporting (old #68, absorbing #71/#72/#73) is dropped by ADR 0008's 2026-09-10 update. There is no `LLM Call Log` DocType and no Frappe reporting surface — cost / latency / token visibility is the Langfuse dashboards (P6-S5 ships the trace tagging + explicit cost; the saved views are built in P7-S2), and receipt-extraction accuracy is a Langfuse score on the receipt trace. No Frappe integration or frontend tests here. The Member-facing "your usage this month" (#73) is deferred out of v1.

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
count is retired — the section was folded into Phases 6–7. Phases 6–7 add roughly **62** more:
`[F]`/`[FE]` tests in this repo (P6-S1 ~8 I + P6-S2 ~7 I + P6-S4 ~3 I + P6-S6 ~13 F + P6-S7 ~2 F +
P7-S2 ~6 I; P7-S3 removed), plus `[A]` service tests in the `expenso-assistant` repo (P6-S3 /
P6-S5 / P6-S7 / P7-S1). Exact numbered rows are finalised when each streak is implemented.
