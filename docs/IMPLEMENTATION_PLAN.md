# Implementation Plan

Ordered phases and streaks. Each streak depends on the ones before it within its phase. Each streak maps to one GitHub Issue.

See `docs/ARCHITECTURE.md` for the full data model, screen specs, and file layout. See `docs/DEPLOYMENT.md` for production setup and the end-to-end verification checklist. See `docs/TEST_PLAN.md` for the complete numbered test tables — each streak section there lists every unit and integration test to implement alongside the feature.

---

## Phase 1 — Core Expense Ledger

**Goal:** A working shared expense tracker. Both Members can add, view, edit, and delete Expenses. Feed, Analytics, and Settings screens are functional.

| Streak | Issue | Title | Scope |
|--------|-------|-------|-------|
| P1-S1 | #1 | DocTypes: Family, FamilyMember, Expense, Category | Backend |
| P1-S2 | #2 | Permissions: Family Member role, query conditions, has_permission | Backend |
| P1-S3 | #3 | Family lifecycle: after_insert seeds default Categories | Backend |
| P1-S4 | #4 | Frontend scaffold: Vue 3 SPA, frappe-ui, Vite, PWA, Login screen | Frontend |
| P1-S5 | #5 | Feed screen: monthly list, date grouping, prev/next month, Pinia store | Frontend |
| P1-S6 | #6 | Expense bottom sheet: Add / Edit / Delete + realtime WebSocket refresh | Full-stack |
| P1-S7 | #7 | Analytics screen: monthly total + category breakdown | Frontend |
| P1-S8 | #8 | Settings screen: Category list (add, rename) + app version in footer | Full-stack |
| P1-S9 | #19 | Workspace: Expenso admin Workspace with links to Family, Category, Expense | Backend |

---

## Phase 2 — Income & Savings

**Goal:** Add a shared Family income ledger. Analytics gains a net Savings view (Income − Expenses).

**New DocTypes:** `Income`, `Source` — see `docs/ARCHITECTURE.md` for field details.

**Analytics changes:** Income total, Savings line, Add Income button.

**Settings changes:** Source list management (add, rename).

| Streak | Issue | Title | Scope |
|--------|-------|-------|-------|
| P2-S1 | #9  | DocTypes: Income + Source; permissions; default Sources on Family creation | Backend |
| P2-S2 | #10 | Analytics: Income total, Savings line, Add Income entry point | Frontend |
| P2-S3 | #11 | Income bottom sheet: Add / Edit / Delete Income | Full-stack |
| P2-S4 | #12 | Settings: Source list management (add, rename) | Frontend |

---

## Phase 3 — Budgeting

**Goal:** Allow Members to set optional fixed monthly spending caps per Category. Analytics shows budget progress with two visual threshold states.

**New DocType:** `Budget` — see `docs/ARCHITECTURE.md` for field details and Budget Status rules.

**Analytics changes:** Budget Status indicator per Category row (Warning ≥80%, Exceeded ≥100%).

**Settings changes:** Budget amount field on each Category row (inline edit).

| Streak | Issue | Title | Scope |
|--------|-------|-------|-------|
| P3-S1 | #13 | DocType: Budget; one Budget per Category per Family validation | Backend |
| P3-S2 | #14 | Settings: Budget amount field on each Category row | Frontend |
| P3-S3 | #15 | Analytics: Budget Status per Category (Warning ≥80%, Exceeded ≥100%) | Frontend |

---

## Phase 4 — Receipt-to-Expense

**Goal:** Members can create an Expense from a photo of a Receipt instead of typing it manually. See `docs/GLOSSARY.md` (Receipt), `docs/adr/0002-receipt-extraction-via-vision-llm.md`, and `docs/adr/0003-receipt-extraction-tracking.md` for the settled design.

**New DocType:** `LLM Call Log` — one row per OpenAI call (`feature` discriminator, latency, tokens, cost, model, per-field accuracy), System Manager-only. Named feature-agnostic rather than Receipt-specific since the planned chat feature (issue #44) will also need this tracking. The extracted image itself is stored as a standard Frappe File attached to the created Expense; no schema changes to Expense are needed.

| Streak | Issue | Title | Scope |
|--------|-------|-------|-------|
| P4-S1 | #66 | Receipt extraction: OpenAI vision endpoint + LLM Call Log (config, prompt, rate limit, cost/latency tracking) | Backend |
| P4-S2 | #67 | Receipt capture flow: Add Expense sheet + image attachment + accuracy linking | Full-stack |
| P4-S3 | #68 | Receipt extraction: admin cost/accuracy reporting (Workspace Number Cards + daily-trend report) | Backend |
