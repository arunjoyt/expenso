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

P4-S4 and P4-S5 span both features (Receipt + in-app Chat) via the shared `LLM Call Log`; both ship functionally once P4-S1 lands (Receipt-only data). Phase 5's MCP-connector Chat makes no OpenAI calls of its own (see ADR 0005/0006) and so contributes no `LLM Call Log` rows; P4-S4/P4-S5 pick up Chat's contribution only once Phase 6's in-app Chat (#69) ships — no rework needed either way.

| Streak | Issue | Title | Scope |
|--------|-------|-------|-------|
| P4-S1 | #66 | Receipt extraction: OpenAI vision endpoint + LLM Call Log (config, prompt, rate limit, cost/latency tracking) | Backend |
| P4-S2 | #67 | Receipt capture flow: Add Expense sheet + image attachment + accuracy linking | Full-stack |
| P4-S3 | #68 | Receipt extraction: admin cost/accuracy reporting (Workspace Number Cards + daily-trend report) | Backend |
| P4-S4 | #72 | LLM Call Log: Cost by Member by Month report (admin) | Backend |
| P4-S5 | #73 | Settings: your usage this month (Member-facing cost) | Full-stack |

---

## Phase 5 — Chat via MCP connector (read + write)

**Goal:** Members ask questions about their Family's Expenses, Income, and Budgets, and create Expense/Income entries (typed or photo-derived), through their own ChatGPT/Claude app via a remote MCP connector — no in-app UI in this phase. See `docs/adr/0005-chat-via-mcp-connector-alternative.md` (read) and `docs/adr/0006-chat-driven-manual-entry-mcp-connector.md` (write) for the settled design. Decided 2026-08-11 (issues #78, #79) to build this **before** Phase 6's in-app Chat, not instead of it.

**New DocType:** none. Schema additions: `Expense`/`Income` gain a verbatim-message field and an "unreviewed external write" marker (ADR 0006), populated only by the write tools below. A single admin-configured `OAuth Client` (standard Frappe DocType, no new schema) provides auth for both scopes (`expenso:read`, `expenso:write`).

Independent of Phase 4 — the MCP connector makes no OpenAI/Anthropic calls of its own, so it does not touch `LLM Call Log`.

| Streak | Issue | Title | Scope |
|--------|-------|-------|-------|
| P5-S1 | #80 | MCP server + OAuth2 (`expenso:read`) + read tools: `get_expenses`, `get_analytics`, `get_income`, `get_budgets` | Backend |
| P5-S2 | #81 | MCP write tools: `create_expense`, `create_income`, `list_categories`, `list_sources` + `expenso:write` scope + daily write cap + unreviewed-write marker/message fields | Full-stack |

---

## Phase 6 — Chat (in-app)

**Goal:** Members can ask read-only questions about their Family's Expenses, Income, and Budgets via an in-app chat assistant, alongside (not instead of) Phase 5's MCP connector. See `docs/GLOSSARY.md` (Chat, Chat Message) and `docs/adr/0004-chat-via-tool-calling.md` for the settled design — accepted but deferred until Phase 5 ships (#78).

**New DocType:** `Chat Message` — one row per message, private per Member (not Family-shared), retained indefinitely unless the Member clears their thread. **Extends** `LLM Call Log` (from Phase 4) with a nullable `content` field, populated only for `feature: "chat"` rows (full tool-calling trace, for admin debugging) — Receipt's rows don't use it. No new tools/actions beyond the existing whitelisted `get_expenses`/`get_analytics`/`get_income`/`get_budgets` methods, which Chat calls directly under their existing Family-scoped permissions.

Depends on Phase 4 (P4-S1 creates `LLM Call Log`; P4-S3's report pattern is extended, not duplicated) and follows Phase 5 by decision, not technical necessity.

| Streak | Issue | Title | Scope |
|--------|-------|-------|-------|
| P6-S1 | #69 | Chat: send-message endpoint with tool-calling + Chat Message + LLM Call Log content | Backend |
| P6-S2 | #70 | Chat UI: floating bubble, full-screen thread, Clear chat | Full-stack |
| P6-S3 | #71 | Chat: admin cost/latency reporting | Backend |
