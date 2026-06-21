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

**Expense**: A single spending record entered by a Member. `amount` and `date` are required (`date` defaults to today). `category` is optional. The app is a shared ledger: both Members can see all Expenses in their Family.
_Avoid_: Transaction, entry, payment

---

## Navigation

**Feed**: The home screen — Expenses in the Member's Family for the selected month, grouped by date with a compact monthly total at the top. Prev/next month navigation is available.
_Avoid_: Dashboard, timeline, activity

**Analytics**: A separate screen showing the month's financial summary — plain numbers, no charts. Phase 1: total Expenses and a breakdown by Category. Phase 2 adds: Income total, Savings (net), and an Add Income entry point. There is no per-Member breakdown.
_Avoid_: Dashboard, reports, insights

**FAB (Floating Action Button)**: The persistent primary action button — always visible on the Feed and Analytics screens — that opens the Add Expense form.
_Avoid_: Add button, create button

**Settings**: A screen reachable via a gear icon in the app header. It is the single surface for all Family configuration: Phase 1 — Category list management; Phase 2 — Source list management; Phase 3 — per-Category Budget amounts.
_Avoid_: Profile, preferences, configuration

---

## Income

**Income**: A single earning record entered by a Member on behalf of the Family. `amount` and `date` are required (`date` defaults to today). `source` is optional. Income belongs to the Family's shared pool — it is not attributed to an individual Member. Income does not appear on the Feed; it is recorded and reviewed from the Analytics screen.
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

**Budget**: A standing fixed-amount monthly spending cap set on an individual Category by any Member. Belongs to a Family. Optional — not every Category requires a Budget. Once set, a Budget persists until explicitly changed; it applies to every subsequent month without re-entry. Budgets are fixed amounts independent of Income.
_Avoid_: Limit, target, goal

**Budget Status**: The visual state of a Category row on the Analytics screen based on spending relative to its Budget. Two states: **Warning** (≥80% of Budget spent — yellow) and **Exceeded** (≥100% spent — red). Categories without a Budget show no threshold indicator.
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
