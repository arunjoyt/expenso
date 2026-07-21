# Expenso — Domain Language

A mobile-first family finance tracker where multiple household members share and record shared spending and income.

---

## People

**Member**: A User who belongs to a Family. The primary use case is two Members per Family (e.g. husband and wife).
_Avoid_: User, person, participant

---

## Grouping

**Family**: A named group of Members who share a pool of Expenses, denominated in a single currency set at creation time. A Member belongs to exactly one Family.
_Avoid_: Group, household, account

---

## Expenses

**Expense**: A single spending record entered by a Member. `amount` and `date` are required (`date` defaults to today). `category` and `notes` are optional. The app is a shared ledger: both Members can see all Expenses in their Family.
_Avoid_: Transaction, entry, payment

**Notes**: An optional free-text field on an Expense or Income capturing what it was specifically for, beyond its Category/Source (e.g. "Dinner with the Smiths"). Shown as a preview line under the Category on the Feed.
_Avoid_: Description, memo, comment

---

## Navigation

**Feed**: The home screen — Expenses in the Member's Family for the selected month, grouped by date with a compact monthly total at the top. Prev/next month navigation is available.
_Avoid_: Dashboard, timeline, activity

**Analytics**: A separate screen showing the selected month's financial summary — plain numbers, no charts. Phase 1: total Expenses and a breakdown by Category. Phase 2 adds: Income total, Savings (net), and an Add Income entry point. There is no per-Member breakdown. The Category breakdown shows each Category's spend alongside its Budget for the month and its Budget Status. Prev/next month navigation is available.
_Avoid_: Dashboard, reports, insights

**Budget** (screen): A bottom-nav screen, alongside Feed and Analytics, purely for setting each Category's Budget amount for the selected month — spend and Budget Status are not shown here, see Analytics. Prev/next month navigation is available, sharing the same selected month as Feed and Analytics. The Category list itself (adding/renaming) is managed on Settings, not here — this screen only uses it to render one row per Category.
_Avoid_: Budgets, Spending, Caps

**FAB (Floating Action Button)**: The persistent primary action button — always visible on the Feed and Analytics screens — that opens the Add Expense form.
_Avoid_: Add button, create button

**Settings**: A screen reachable via a gear icon in the app header. It is the single surface for all Family configuration: Phase 1 — Category list management; Phase 2 — Source list management. Budget amounts are managed on the Budget screen, not here.
_Avoid_: Profile, preferences, configuration

---

## Income

**Income**: A single earning record entered by a Member on behalf of the Family. `amount` and `date` are required (`date` defaults to today). `source` and `notes` are optional. Income belongs to the Family's shared pool — it is not attributed to an individual Member. Income does not appear on the Feed; it is recorded and reviewed from the Analytics screen.
_Avoid_: Revenue, credit, earning

**Source**: A Member-defined label that classifies an Income record (e.g. Salary, Freelance, Rental). Sources belong to a Family — each Family manages its own list. Any Member may add or rename Sources; Sources cannot be deleted.
_Avoid_: Income type, income category

**Savings**: The net result of a month's Income minus Expenses for the Family. Displayed on the Analytics screen alongside Income total and Expense total. Not a stored value — always computed on read.
_Avoid_: Balance, profit, surplus

---

## Categories

**Category**: A Member-defined label that classifies an Expense (e.g. Groceries, Dining, Transport). Categories belong to a Family — each Family manages its own list, seeded with defaults on creation. Any Member may add or rename Categories; Categories cannot be deleted.
_Avoid_: Tag, type, label

---

## Budgeting

**Budget** (record): A fixed spending cap set on an individual Category for one specific month, belonging to a Family. Optional — not every Category requires a Budget in every month. Independent of Income. The first time a Member views a month on the Budget screen, any Category without a Budget for that month is auto-filled by carrying forward the amount from that Category's most recent earlier month that had one; editing or deleting a month's Budget affects only that month, and does not change the amount carried forward into other months.
_Avoid_: Limit, target, goal

**Budget Status**: The visual state of a Category row on the Analytics screen based on spending relative to its Budget for the selected month. Two states: **Warning** (≥80% of Budget spent — yellow) and **Exceeded** (≥100% spent — red). Categories without a Budget for that month show no threshold indicator.
_Avoid_: Alert, notification, flag

---

## Delivery

**Phase**: A major milestone tracked as a GitHub Milestone. Three phases planned (see `docs/PLAN.md`).

**Streak**: A small, shippable slice of work within a Phase — completable in one sitting, tracked as a single GitHub Issue assigned to its Phase milestone. Each Streak ends with a commit and a Frappe app version bump.
_Avoid_: Sprint, task, ticket

---

## Realtime

The Feed silently refreshes via Frappe's WebSocket when any Member adds, edits, or deletes an Expense — no manual refresh needed, no push notifications.

---

## Onboarding

Member accounts are created by the admin via the Frappe Desk. Self-service email invites are a future phase.

---

## Permissions

Any Member of a Family may create, edit, or delete any Expense belonging to that Family.
