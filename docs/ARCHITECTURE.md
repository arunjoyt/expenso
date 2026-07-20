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
| `amount` | Float | required; fixed monthly cap |
| `family` | Link → Family | required |

One Budget per Category per Family — enforced in `validate`.
Budget is a standing rule: persists across months until explicitly changed. Independent of Income.

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

`Category` and `Source` follow the same family-scoping pattern but are managed only through Settings (add, rename — no delete).

---

## Navigation (mobile)

Bottom navigation bar with 2 tabs + FAB:
- **Feed tab** — home screen, monthly expense list
- **Analytics tab** — monthly financial summary
- **FAB** — always visible on Feed and Analytics; opens Add Expense bottom sheet

No Family Switcher — a Member belongs to exactly one Family.

---

## Screens

### Feed
- Reverse-chronological Expense list for the selected month
- Grouped by date (headers: "Today", "Yesterday", "Jun 12"); within each group, sorted newest-first
- Each row: amount + category; date is the group header
- Compact monthly total at the top
- Prev / next month navigation; month state shared with Analytics
- Silently refreshes via Frappe WebSocket on any add / edit / delete in the Family

### Analytics
- **Phase 1:** total spent + Category breakdown (name + amount, no charts)
- **Phase 2 additions:** Income total, Savings line (Income − Expenses), Add Income button
- **Phase 3 additions:** Budget Status indicator per Category row
- Scoped to the Member's Family and the selected month (shared with Feed)

### Add / Edit Expense (bottom sheet)
- Slides up from FAB (add) or tapping an Expense row (edit)
- Fields: `amount` (required), `date` (defaults to today), `category` (optional)
- Delete action behind a confirmation prompt
- Dismissable by tapping outside or swiping down

### Add / Edit Income (bottom sheet) — Phase 2
- Same UX as Expense sheet
- Fields: `amount` (required), `date` (defaults to today), `source` (optional)
- Triggered from Analytics screen "Add Income" button

### Settings
- Reachable via gear icon in app header (not a tab)
- **Phase 1:** Category list — add, rename (no delete)
- **Phase 2:** Source list — add, rename (no delete)
- **Phase 3:** Budget amount field on each Category row (inline edit; blank removes Budget)
- App version displayed in footer (read from a whitelisted API method at runtime)

---

## Frontend State

- Selected month lives in a Pinia store; resets to current month on page refresh
- Feed and Analytics both read from the same `month` store key
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
    │   │   └── Settings.vue
    │   ├── components/
    │   │   ├── ExpenseSheet.vue    ← bottom sheet add/edit Expense
    │   │   └── IncomeSheet.vue     ← Phase 2
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
