# Architecture

## System Overview

```
Browser (PWA)
  └── Vue 3 SPA (frappe-ui + Tailwind)
        ├── /api/method/*        → Frappe whitelisted methods
        ├── /api/resource/*      → Frappe REST API
        └── WebSocket (Redis)    → realtime Feed refresh
              └── Frappe (Gunicorn)
                    └── MariaDB
```

---

## Tech Stack

### Backend — Frappe Framework (Python)
- Custom Frappe app (`expenso`): all DocTypes, APIs, and business logic
- MariaDB (Frappe default)
- Redis for caching + Frappe realtime (WebSocket) for live Feed updates
- Frappe's built-in session auth — no separate auth service

### Frontend — Vue 3 SPA (frappe-ui)
- Custom Vue 3 SPA in `frontend/` — **not** the Frappe Desk UI
- **frappe-ui** component library + Tailwind CSS (mobile-first, responsive)
- Vite for build/HMR
- Deployed as a static bundle served by Frappe's Nginx
- PWA (Vite PWA plugin) — installable on Android/iOS home screens

---

## Data Model (DocTypes)

### Phase 1 DocTypes

#### `Family`
| Field | Type | Notes |
|---|---|---|
| `family_name` | Data | display name |
| `currency` | Link → Currency | single currency per family, set at creation |
| `members` | Table (Child) | links to User; two Members expected |

#### `FamilyMember` (Child DocType)
| Field | Type | Notes |
|---|---|---|
| `user` | Link → User | the Member |

#### `Expense`
| Field | Type | Notes |
|---|---|---|
| `amount` | Float | required |
| `date` | Date | defaults to today |
| `category` | Link → Category | optional; `get_query` scopes to Family |
| `notes` | Small Text | optional; free text on what the Expense was for |
| `family` | Link → Family | required |

No `split_among` — there is no split or debt tracking.

#### `Category`
| Field | Type | Notes |
|---|---|---|
| `category_name` | Data | display label, e.g. "Groceries" |
| `family` | Link → Family | required |
| `name` | — | auto (naming series `CAT-.####`) |

`category_name` is not the name key — two Families can each have "Groceries".
Defaults seeded via `Family.after_insert`: `Groceries, Dining, Transport, Utilities, Health, Entertainment, Shopping, Other`.

Amounts displayed via `Intl.NumberFormat` with the Family's currency code.

---

### Phase 2 DocTypes

#### `Income`
| Field | Type | Notes |
|---|---|---|
| `amount` | Float | required |
| `date` | Date | defaults to today |
| `source` | Link → Source | optional; `get_query` scopes to Family |
| `notes` | Small Text | optional; free text on what the Income was for |
| `family` | Link → Family | required |

#### `Source`
| Field | Type | Notes |
|---|---|---|
| `source_name` | Data | display label, e.g. "Salary" |
| `family` | Link → Family | required |
| `name` | — | auto (naming series `SRC-.####`) |

Defaults seeded via `Family.after_insert`: `Salary, Freelance, Rental, Other`.

**Savings** is never stored — always computed as `Income − Expenses` for the selected month.

---

### Phase 3 DocTypes

#### `Budget`
| Field | Type | Notes |
|---|---|---|
| `category` | Link → Category | required; `get_query` scopes to Family |
| `amount` | Float | required; spending cap for this Category, for this month only |
| `month` | Int | required; 1–12 |
| `year` | Int | required |
| `family` | Link → Family | required |

One Budget per Category per Family per (month, year) — enforced in `validate`.
Budget is scoped to a single month. When a month has no Budget row for a Category, the
backend resolves the effective amount by carrying forward the most recent earlier month
that has one (`_resolve_budget_amount` in `api.py`) — no forward-looking carry, and gaps
are not backfilled. `get_analytics` uses this resolution read-only. The Budget screen's
`get_budgets` additionally materializes a real row for the requested month the first time
it's viewed (copying the carried-forward amount), so it becomes editable independently of
other months. Deleting a month's Budget only removes that month's row — carry-forward for
later months resumes from whatever row precedes it. Independent of Income.

**Budget Status** (computed on read, never stored):

| Spent / Budget | State | Display |
|---|---|---|
| < 80% | Normal | no indicator |
| ≥ 80% | Warning | yellow |
| ≥ 100% | Exceeded | red |

---

## Permissions

Pattern is identical for `Expense`, `Income`, and `Budget`:
- Custom role: **Family Member**
- `permission_query_conditions`: filters to `family = user's single family`
- `has_permission()`: validates requesting user belongs to that Family
- No `if_owner: 1` — any Member may create, edit, or delete any record in their Family

`Category` and `Source` follow the same family-scoping pattern. Rename and delete happen only through Settings; adding a new one can happen either through Settings or inline from the Add Expense/Income sheet (same `add_category` / `add_source` API either way). Deleting is blocked while any Expense (for Category) or Income (for Source) still references the record — Frappe's built-in link-existence check raises `LinkExistsError` on `frappe.delete_doc` for any doctype with existing Link references, so no manual "is it in use" query is needed. Deleting a Category also deletes its Budget rows for every month, since a Budget has no meaning without its Category.

---

## Navigation (mobile)

Bottom navigation bar with 4 tabs + FAB:
- **Feed tab** — home screen, monthly expense list
- **Analytics tab** — monthly financial summary (read-only), including Budget Status per Category
- **Budget tab** — set each Category's Budget amount for the selected month (editing only)
- **Settings tab** — Category/Source list management, logout, version
- **FAB** — visible on Feed only; tapping it opens the Add Expense bottom sheet directly (default tab); an Expense/Income tab switcher inside the sheet swaps it for the Add Income sheet without an extra tap on the FAB

No Family Switcher — a Member belongs to exactly one Family.

---

## Screens

### Feed
- Reverse-chronological Expense list for the selected month
- Grouped by date (headers: "Today", "Yesterday", "Jun 12"); within each group, sorted newest-first
- Each row: amount + category; date is the group header
- Compact monthly total at the top
- Prev / next month navigation; month state shared with Analytics and Budget
- Silently refreshes via Frappe WebSocket on any add / edit / delete in the Family

### Analytics
- **Phase 1:** total spent + Category breakdown (name + amount, no charts)
- **Phase 2 additions:** Income total, Savings line (Income − Expenses)
- **Phase 3 additions:** Budget Status indicator per Category row, budget amount shown alongside spend; a total Budget stat (sum of each Category's effective Budget for the month)
- Stat tiles laid out as a 2×2 grid: Spent / Income on top, Savings / Budget below
- Category breakdown includes any Category with spend this month, an effective Budget this month, or both — a Budget with $0 spent still shows a row; sorted by amount spent descending (zero-spend rows sort last)
- Prev / next month navigation; month state shared with Feed and Budget
- Read-only — no add/edit entry points live here; editing a Budget happens on the Budget screen, adding Income/Expense happens via the Feed FAB

### Add / Edit Expense (bottom sheet)
- Slides up from the Feed FAB (add, defaults to the Expense tab) or tapping an Expense row (edit)
- In add mode, an Expense/Income tab switcher sits at the top of the sheet; tapping "Income" swaps in the Add Income sheet in place. Not shown in edit mode.
- Fields: `amount` (required), `date` (defaults to today), `category` (optional)
- Category select includes a trailing "+ New category" option; picking it reveals an inline text input in the sheet to name and create the Category without leaving Add/Edit Expense, then auto-selects it. Rename/delete are not available here — those stay on Settings.
- Delete action behind a confirmation prompt
- Dismissable by tapping outside or swiping down

### Add / Edit Income (bottom sheet) — Phase 2
- Same UX as Expense sheet, including the Expense/Income tab switcher in add mode
- Fields: `amount` (required), `date` (defaults to today), `source` (optional)
- Source select includes the same trailing "+ New source" inline-create option as the Category select on the Expense sheet
- Reached from the Feed FAB by switching to the Income tab (no dedicated entry point of its own)

### Budget
- Bottom nav tab, alongside Feed and Analytics
- Lists every Category in the Family with a button showing its Budget amount for the
  selected month (or "Set Budget" if none) — tapping opens the same `BudgetSheet` used
  previously from Settings, now scoped to the selected month
- Prev / next month navigation; month state shared with Feed and Analytics
- Spend and Budget Status are not shown here — see Analytics
- Category list itself (rename, delete) is managed on Settings; adding a new Category can also be done inline from the Add Expense sheet (see above); this screen only reads the list

### Settings
- Reachable via the Settings tab in the bottom nav (alongside Feed, Analytics, Budget)
- **Phase 1:** Category list — rename, delete (delete blocked while an Expense references the Category; also removes its Budgets). Adding a new Category can be done here too, or inline from the Add Expense sheet.
- **Phase 2:** Source list — rename, delete (delete blocked while an Income references the Source). Adding a new Source can be done here too, or inline from the Add Income sheet.
- Budget amounts are managed on the Budget tab, not here
- App version displayed in footer (read from a whitelisted API method at runtime)

---

## Frontend State

- Selected month lives in a Pinia store; resets to current month on page refresh
- Feed, Analytics, and Budget all read from the same `month` store key
- `useExpenses`, `useCategories`, `useIncome`, `useBudgets` composables own their respective API calls

---

## Login

The Vue SPA uses frappe-ui's `LoginPage` component, which calls Frappe's auth API (`/api/method/login`). Frappe sets the session cookie; the user never leaves the SPA. No separate auth service.

---

## File Layout

```
expenso/                            ← Frappe app root (git repo)
├── docs/
│   ├── ARCHITECTURE.md             ← this file
│   ├── IMPLEMENTATION_PLAN.md
│   └── DEPLOYMENT.md
├── expenso/                        ← Python package
│   ├── __init__.py                 ← __version__ bumped on every commit
│   ├── hooks.py                    ← permission_query_conditions, doc_events
│   └── doctype/
│       ├── family/
│       ├── family_member/          ← Child DocType
│       ├── expense/
│       ├── category/               ← CAT-.####
│       ├── income/                 ← Phase 2
│       ├── source/                 ← Phase 2, SRC-.####
│       └── budget/                 ← Phase 3
└── frontend/                       ← Vue 3 SPA
    ├── src/
    │   ├── pages/
    │   │   ├── Login.vue
    │   │   ├── Feed.vue
    │   │   ├── Analytics.vue
    │   │   ├── Budget.vue
    │   │   └── Settings.vue
    │   ├── components/
    │   │   ├── ExpenseSheet.vue    ← bottom sheet add/edit Expense
    │   │   ├── IncomeSheet.vue     ← Phase 2
    │   │   ├── BudgetSheet.vue     ← bottom sheet set/remove monthly Budget
    │   │   └── MonthNav.vue        ← shared month nav header (Feed, Analytics, Budget)
    │   ├── stores/
    │   │   └── month.js            ← Pinia store for selected month
    │   ├── composables/
    │   │   ├── useExpenses.js
    │   │   ├── useCategories.js
    │   │   ├── useIncome.js        ← Phase 2
    │   │   └── useBudgets.js       ← Phase 3
    │   └── main.js
    ├── vite.config.js
    └── package.json
```
