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

**Expense**: A single spending record entered by a Member. `amount` and `date` are required (`date` defaults to today). `category` and `notes` are optional. The app is a shared ledger: both Members can see all Expenses in their Family. An Expense also carries an `entry_method` — `manual`, `assistant` (created via the in-app Assistant, always Member-confirmed), `connector` (created via the external MCP connector), or `receipt` (extracted from a photo in the Assistant chat). Only `connector` records carry the visible "unreviewed external write" marker and the audit-only stored request text — in-app Assistant writes are confirmed by the Member and look exactly like manual entries.
_Avoid_: Transaction, entry, payment, Spent

**Notes**: An optional free-text field on an Expense or Income capturing what it was specifically for, beyond its Category/Source (e.g. "Dinner with the Smiths"). On the Feed, Notes is the primary (bold) line of a row when present, with Category/Source demoted to a smaller caption below it; a row with no Notes falls back to showing Category/Source alone as the primary line. In the Add/Edit Expense and Income sheets, Notes is field-ordered ahead of Category/Source (after Amount and Date).
_Avoid_: Description, memo, comment

**Receipt**: A photo of proof-of-purchase a Member attaches in the **Assistant** chat. The multimodal agent reads it and proposes an Expense (Amount, Date, Category, Notes) in a confirm card the Member edits and approves before anything is saved. The Assistant chat is the only receipt path — there is no camera affordance on the Add Expense sheet. One Receipt produces at most one Expense (a line-item split only if the Member asks). The image is **not stored anywhere** — it is discarded after processing; the thread keeps a short text marker.
_Avoid_: Bill, invoice, scan

---

## Navigation

**Feed**: The home screen — a unified, reverse-chronological list of Expenses and Income in the Member's Family for the selected month, grouped by date. Within a date group, Expense and Income rows interleave by recency rather than clustering by type. A summary banner at the top shows Income, Expense, and Balance in one line, in that order. Prev/next month navigation is available.
_Avoid_: Dashboard, timeline, activity

**Analytics**: A separate, read-only screen showing the selected month's financial summary — plain numbers, no charts. Phase 1: total Expenses and a breakdown by Category. Phase 2 adds: Income total and Balance (net). The top summary is a single line of three figures — Income, Expense, and Balance, in that order — matching the Feed banner. The month's total Budget is not shown here; see Budget (screen). There is no per-Member breakdown. The Category breakdown lists every Category that has spend this month, an effective Budget this month, or both — a Category with a Budget but no spend yet still appears, at $0. Each row shows spend alongside its Budget for the month, its Remaining (Budget minus spend, which may go negative), and its Budget Status; rows are ordered by amount spent, descending (zero-spend budgeted Categories sort last). Prev/next month navigation is available. Adding an Expense or Income happens via the Feed FAB, not here.
_Avoid_: Dashboard, reports, insights; Balance (this term is reserved for the Family-wide net figure — see **Balance**)

**Budget** (screen): A bottom-nav screen, alongside Feed and Analytics, for setting each Category's Budget amount for the selected month. A summary tile at the top, labeled "Budget", shows the total Budget for the month (sum of each Category's effective Budget) — spend and Budget Status are not shown here, see Analytics. Prev/next month navigation is available, sharing the same selected month as Feed and Analytics. The Category list itself (renaming, deleting) is managed on Settings, not here — this screen only uses it to render one row per Category.
_Avoid_: Budgets, Spending, Caps

**FAB (Floating Action Button)**: The persistent primary action button that opens the Add Expense sheet by default; an Expense/Income tab switcher inside the sheet reaches Add Income without a second tap on the FAB. Sits bottom-right. Visible on Feed only until the Assistant ships, which widens it to every screen **except the Assistant tab** (which has its own pinned input). (The 2026-09-09 design also stacked a floating **Chat** bubble above it; that bubble was replaced by the Assistant nav tab — see `docs/adr/0008-in-app-assistant-architecture.md`'s 2026-09-10 P6-S6 update.)
_Avoid_: Add button, create button

**Settings**: A bottom-nav screen, alongside Feed, Analytics, and Budget. It is the primary surface for renaming or deleting Categories (Phase 1) and Sources (Phase 2); adding a new Category/Source can also be done here, or inline from the Add Expense/Income sheet without leaving it. Budget amounts are managed on the Budget screen, not here. (A "Your usage this month" LLM-cost readout was planned here and dropped for v1 — see `docs/adr/0008-in-app-assistant-architecture.md`.)
_Avoid_: Profile, preferences, configuration

---

## Income

**Income**: A single earning record entered by a Member on behalf of the Family. `amount` and `date` are required (`date` defaults to today). `source` and `notes` are optional. Income belongs to the Family's shared pool — it is not attributed to an individual Member. Income is recorded via the Feed FAB (Income tab), appears alongside Expenses in the Feed list (shown in green with a leading "+"), and its monthly total/Balance are reviewed from the Feed banner and the Analytics screen. Income also carries an `entry_method` and the same marker rules as **Expense** — only `connector` records are marked "unreviewed external write".
_Avoid_: Revenue, credit, earning

**Source**: A Member-defined label that classifies an Income record (e.g. Salary, Freelance, Rental). Sources belong to a Family — each Family manages its own list. Any Member may add, rename, or delete a Source — adding can happen on Settings or inline from the Add Income sheet, rename/delete only on Settings; deleting is blocked while any Income record still references it.
_Avoid_: Income type, income category

**Balance**: The net result of a month's Income minus Expenses for the Family. Displayed on the Feed banner and the Analytics screen, alongside Income total and Expense total. Not a stored value — always computed on read.
_Avoid_: Savings, profit, surplus

---

## Categories

**Category**: A Member-defined label that classifies an Expense (e.g. Groceries, Dining, Transport). Categories belong to a Family — each Family manages its own list, seeded with defaults on creation. Any Member may add, rename, or delete a Category — adding can happen on Settings or inline from the Add Expense sheet, rename/delete only on Settings; deleting is blocked while any Expense still references it, and removes that Category's Budgets for every month.
_Avoid_: Tag, type, label

---

## Budgeting

**Budget** (record): A fixed spending cap set on an individual Category for one specific month, belonging to a Family. Optional — not every Category requires a Budget in every month. Independent of Income. The first time a Member views a month on the Budget screen, any Category without a Budget for that month is auto-filled by carrying forward the amount from that Category's most recent earlier month that had one; editing or deleting a month's Budget affects only that month, and does not change the amount carried forward into other months.
_Avoid_: Limit, target, goal

**Budget Status**: The visual state of a Category row on the Analytics screen based on spending relative to its Budget for the selected month. Two states: **Warning** (≥80% of Budget spent — yellow) and **Exceeded** (≥100% spent — red). Categories without a Budget for that month show no threshold indicator.
_Avoid_: Alert, notification, flag

---

## Delivery

**Phase**: A major milestone tracked as a GitHub Milestone (see `docs/IMPLEMENTATION_PLAN.md`). Phases 1–3 (ledger, income, budgeting) and 5 (MCP connector) shipped; Phase 4 (standalone receipt extraction) was folded into the Assistant; Phase 6 (Assistant core) and Phase 7 (Proactive & Reporting) are the remaining roadmap.

**Streak**: A small, shippable slice of work within a Phase — completable in one sitting, tracked as a single GitHub Issue assigned to its Phase milestone. Each Streak ends with a commit and a Frappe app version bump.
_Avoid_: Sprint, task, ticket

---

## Realtime

The Feed silently refreshes via Frappe's WebSocket when any Member adds, edits, or deletes an Expense or Income — no manual refresh needed, no push notifications. The only proactive nudge is the **Assistant** tab's unread badge, shown when the Assistant has posted an Insight or a pending proposal the Member hasn't seen — still no push notifications.

---

## Assistant

**Assistant**: The AI capability of the app — an agent that answers questions about the Family's Expenses, Income, and Budgets, manages the ledger on request (create/edit/delete entries, add Categories/Sources, set Budgets), extracts Expenses from receipt photos, and runs on a schedule to surface **Insights**. It runs in a standalone service (`expenso-assistant`), not in Frappe. Reached in-app through the **Assistant** tab in the bottom nav (which opens the **Chat** surface); also reachable from a Member's own ChatGPT/Claude app via the MCP connector, which exposes the same tools. Every write the in-app Assistant makes is confirmed by the Member before it happens; the external connector's writes are immediate and carry an "unreviewed external write" marker (see **Expense**, **Income**). See `docs/adr/0008-in-app-assistant-architecture.md`.
_Avoid_: bot, AI, copilot

**Chat**: The interactive thread surface of the **Assistant**, opened from the **Assistant** tab in the bottom nav (a full-screen conversation, not an overlay). Each Member has exactly one continuous, ever-growing thread, private to them; a Member may clear their own thread at any time ("Clear chat"). Thread history is stored by the Assistant service, not in Frappe. As the Assistant works, its steps stream in as a humanized activity log; a proposed write appears as a confirm card the Member edits and approves. ("Chat" is the thread/conversation mechanic; the nav surface is the **Assistant** tab — the 2026-09-09 floating-bubble presentation was replaced, see `docs/adr/0008-in-app-assistant-architecture.md`'s 2026-09-10 P6-S6 update.)
_Avoid_: chatbot, AI, ChatGPT

**Insights**: What the Assistant's proactive scheduled runs produce — a monthly spending summary (1st of the month) and a weekly budget-drift check. Each lands as an Assistant message in the Member's Chat thread; the Assistant nav tab shows an unread badge until the Member opens it (no push notifications). A proactive run has read-only access to the ledger — if it wants an action taken, it queues a **pending proposal** (the same confirm card, waiting for the Member's next visit) rather than acting.
_Avoid_: alert, notification, digest

---

## Onboarding

Member accounts are created by the admin via the Frappe Desk. Self-service email invites are a future phase.

---

## Permissions

Any Member of a Family may create, edit, or delete any Expense belonging to that Family.
