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

**Expense**: A single spending record entered by a Member. `amount` and `date` are required (`date` defaults to today). `category` and `notes` are optional. The app is a shared ledger: both Members can see all Expenses in their Family. From Phase 5, an Expense may instead be created by the `create_expense` MCP tool (see **Chat**) — such a record carries a visible "unreviewed external write" marker and the verbatim message it was created from, shown in its detail view.
_Avoid_: Transaction, entry, payment, Spent

**Notes**: An optional free-text field on an Expense or Income capturing what it was specifically for, beyond its Category/Source (e.g. "Dinner with the Smiths"). On the Feed, Notes is the primary (bold) line of a row when present, with Category/Source demoted to a smaller caption below it; a row with no Notes falls back to showing Category/Source alone as the primary line. In the Add/Edit Expense and Income sheets, Notes is field-ordered ahead of Category/Source (after Amount and Date).
_Avoid_: Description, memo, comment

**Receipt**: A photo of proof-of-purchase (camera capture or gallery upload) that a Member submits to have Expense fields (Amount, Date, Category, Notes) pre-filled automatically, via a vision LLM, into the same Add Expense sheet used for manual entry — the Member still reviews and confirms before saving. One Receipt produces at most one Expense per pass (no batch import). The original image is kept as an attachment on the created Expense for later reference.
_Avoid_: Bill, invoice, scan

---

## Navigation

**Feed**: The home screen — a unified, reverse-chronological list of Expenses and Income in the Member's Family for the selected month, grouped by date. Within a date group, Expense and Income rows interleave by recency rather than clustering by type. A summary banner at the top shows Income, Expense, and Balance in one line, in that order. Prev/next month navigation is available.
_Avoid_: Dashboard, timeline, activity

**Analytics**: A separate, read-only screen showing the selected month's financial summary — plain numbers, no charts. Phase 1: total Expenses and a breakdown by Category. Phase 2 adds: Income total and Balance (net). The top summary is a single line of three figures — Income, Expense, and Balance, in that order — matching the Feed banner. The month's total Budget is not shown here; see Budget (screen). There is no per-Member breakdown. The Category breakdown lists every Category that has spend this month, an effective Budget this month, or both — a Category with a Budget but no spend yet still appears, at $0. Each row shows spend alongside its Budget for the month, its Remaining (Budget minus spend, which may go negative), and its Budget Status; rows are ordered by amount spent, descending (zero-spend budgeted Categories sort last). Prev/next month navigation is available. Adding an Expense or Income happens via the Feed FAB, not here.
_Avoid_: Dashboard, reports, insights; Balance (this term is reserved for the Family-wide net figure — see **Balance**)

**Budget** (screen): A bottom-nav screen, alongside Feed and Analytics, for setting each Category's Budget amount for the selected month. A summary tile at the top, labeled "Budget", shows the total Budget for the month (sum of each Category's effective Budget) — spend and Budget Status are not shown here, see Analytics. Prev/next month navigation is available, sharing the same selected month as Feed and Analytics. The Category list itself (renaming, deleting) is managed on Settings, not here — this screen only uses it to render one row per Category.
_Avoid_: Budgets, Spending, Caps

**FAB (Floating Action Button)**: The persistent primary action button — visible on Feed only until Phase 6 widens it to every screen — that opens the Add Expense sheet by default; an Expense/Income tab switcher inside the sheet reaches Add Income without a second tap on the FAB. Sits bottom-right; from Phase 6 onward, the in-app Chat bubble stacks directly above it in the same corner, both within single-hand thumb reach. Phase 5's MCP-connector Chat has no in-app surface and does not affect the FAB.
_Avoid_: Add button, create button

**Settings**: A bottom-nav screen, alongside Feed, Analytics, and Budget. It is the primary surface for renaming or deleting Categories (Phase 1) and Sources (Phase 2); adding a new Category/Source can also be done here, or inline from the Add Expense/Income sheet without leaving it. Budget amounts are managed on the Budget screen, not here. Phase 4 adds a "Your usage this month" section showing the logged-in Member's own Receipt API cost for the current month; Phase 6 extends it with an in-app Chat cost breakdown once that phase's OpenAI calls start producing `LLM Call Log` rows (Phase 5's MCP-connector Chat makes no such calls, so it never appears here) — their own usage only, never another Member's or the Family's total.
_Avoid_: Profile, preferences, configuration

---

## Income

**Income**: A single earning record entered by a Member on behalf of the Family. `amount` and `date` are required (`date` defaults to today). `source` and `notes` are optional. Income belongs to the Family's shared pool — it is not attributed to an individual Member. Income is recorded via the Feed FAB (Income tab), appears alongside Expenses in the Feed list (shown in green with a leading "+"), and its monthly total/Balance are reviewed from the Feed banner and the Analytics screen. From Phase 5, an Income may instead be created by the `create_income` MCP tool (see **Chat**) — same "unreviewed external write" marker and verbatim-message treatment as Expense.
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

**Phase**: A major milestone tracked as a GitHub Milestone. Three phases planned (see `docs/PLAN.md`).

**Streak**: A small, shippable slice of work within a Phase — completable in one sitting, tracked as a single GitHub Issue assigned to its Phase milestone. Each Streak ends with a commit and a Frappe app version bump.
_Avoid_: Sprint, task, ticket

---

## Realtime

The Feed silently refreshes via Frappe's WebSocket when any Member adds, edits, or deletes an Expense or Income — no manual refresh needed, no push notifications.

---

## Chat

**Chat**: Ships in two phases, decided 2026-08-11 (issues #78, #79) to build both rather than choose one:

- **Phase 5 — MCP connector** (current plan of record, ships first): a remote MCP server, added as a connector inside a Member's own ChatGPT/Claude app — not reachable from inside Expenso itself. Exposes read tools (`get_expenses`, `get_analytics`, `get_income`, `get_budgets`, `list_categories`, `list_sources`) answering questions about the Family's data, and write tools (`create_expense`, `create_income`) that create records directly with no in-app review step. Auth is Frappe's built-in OAuth2 (`expenso:read` / `expenso:write` scopes); Expenso never sees or stores the conversation — ChatGPT/Claude hold it client-side. Every write carries a visible "unreviewed external write" marker and the verbatim source message (see **Expense**, **Income**), and is bounded by a combined per-Member daily write cap. See `docs/adr/0005-chat-via-mcp-connector-alternative.md` and `docs/adr/0006-chat-driven-manual-entry-mcp-connector.md`.
- **Phase 6 — in-app Chat** (deferred, not dropped): a read-only Q&A assistant reachable via a floating bubble on every screen — stacked directly above the FAB in the bottom-right corner, both reachable with one thumb — answering the same kinds of questions via the same whitelisted read APIs, but cannot create, edit, or delete records. Each Member has exactly one continuous, ever-growing Chat thread, private to them, stored in Expenso as **Chat Message** rows. A Member may clear their own thread at any time ("Clear chat"). See `docs/adr/0004-chat-via-tool-calling.md`.

_Avoid_: Assistant, chatbot, AI

**Chat Message**: A single message within a Member's Phase 6 in-app Chat thread — either from the Member or from Chat. Ordered chronologically; only the most recent messages are sent to the LLM as context on each turn (older ones remain stored and viewable but drop out of context). Does not exist for Phase 5's MCP connector, where ChatGPT/Claude hold history client-side instead.
_Avoid_: Prompt, turn, reply

---

## Onboarding

Member accounts are created by the admin via the Frappe Desk. Self-service email invites are a future phase.

---

## Permissions

Any Member of a Family may create, edit, or delete any Expense belonging to that Family.
