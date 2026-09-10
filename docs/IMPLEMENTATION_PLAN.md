# Implementation Plan

Ordered phases and streaks. Each streak depends on the ones before it within its phase. Each streak maps to one GitHub Issue (all tracked in the `expenso` repo).

See `docs/ARCHITECTURE.md` for the full data model, screen specs, and file layout. See `docs/DEPLOYMENT.md` for production setup and the end-to-end verification checklist. See `docs/TEST_PLAN.md` for the complete numbered test tables — each streak section there lists every unit and integration test to implement alongside the feature.

## Repositories

From Phase 6 onward, work spans two repos. Streaks are tagged with the repo they land in:

- **`expenso`** — the Frappe app + Vue frontend (this repo). Tag `[F]` (backend) / `[FE]` (frontend).
- **`expenso-assistant`** — a standalone service (FastMCP server + LangGraph agent + Postgres + Langfuse), structured like the sibling `contract-intelligence` project. Tag `[A]`. See `docs/adr/0008-in-app-assistant-architecture.md`.

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

## Phase 4 — Receipt-to-Expense — ~~standalone~~ **folded into Phase 6/7**

**Superseded 2026-09-09 ([ADR 0008](adr/0008-in-app-assistant-architecture.md)).** Receipt extraction is no longer a standalone feature — it is a capability of the in-app Assistant (attach a photo in the Assistant chat, the agent proposes an Expense in a confirm card). What remains of the old plan:

- LLM call tracking → **not built in Frappe** (ADR 0008's 2026-09-10 update). Every call is a Langfuse trace tagged with the Member / Family / feature, cost attached explicitly. No `LLM Call Log` DocType, no `record_llm_call`.
- Receipt extraction itself → **P7-S1** (in `expenso-assistant`). No image storage anywhere; no camera on the Add Expense sheet. #67 dropped. Extraction accuracy is a Langfuse score, not a Frappe row.
- Admin cost/accuracy reporting → the **Langfuse dashboards** (folds into P6-S5). #68/#72 dropped. The Member-facing "your usage this month" (#73) is deferred out of v1.

---

## Phase 5 — Chat via MCP connector (read + write) — **shipped**

**Goal:** Members ask questions about their Family's Expenses, Income, and Budgets, and create Expense/Income entries, through their own ChatGPT/Claude app via a remote MCP connector. See `docs/adr/0005-chat-via-mcp-connector-alternative.md` and `docs/adr/0006-chat-driven-manual-entry-mcp-connector.md`.

Shipped: `Expense`/`Income` carry `is_external_write` + `external_write_message`; a single admin-configured `OAuth Client` provides auth for `expenso:read` / `expenso:write`.

| Streak | Issue | Title | Scope |
|--------|-------|-------|-------|
| P5-S1 | #80 | MCP server + OAuth2 (`expenso:read`) + read tools | Backend — done |
| P5-S2 | #81 | MCP write tools + `expenso:write` scope + daily write cap + marker/message fields | Full-stack — done |

**Cutover note:** the `frappe-mcp` in-process server this built (`expenso/mcp.py`) is replaced in Phase 6 (P6-S3/P6-S4) by the FastMCP server in `expenso-assistant`. The `OAuth Client`, scopes, `Allowed Roles`, and the `configure_oauth_settings` patch carry forward unchanged; Members re-add the connector once with the new URL.

---

## Phase 6 — Assistant core

**Goal:** A full-agentic in-app Assistant — answers questions, manages the ledger (every write confirmed by the Member), on every screen. Runs in the new `expenso-assistant` service. The external MCP connector is re-pointed at the same service. See `docs/adr/0008-in-app-assistant-architecture.md` for the settled design; ADR 0004 is largely superseded.

**New:** `entry_method` field on Expense/Income; `expenso-assistant` repo (FastMCP server + LangGraph agent + Postgres + Langfuse v2). No `Chat Message` DocType — threads live in the LangGraph checkpointer's Postgres. **No `LLM Call Log` DocType** — call tracking is Langfuse traces only (ADR 0008's 2026-09-10 update). `expenso/mcp.py` + the `frappe-mcp` dependency are deleted.

| Streak | Repo | Issue | Title |
|--------|------|-------|-------|
| P6-S1 | `[F]` | #66 (reused) | `entry_method` field on Expense/Income & backfill patch (`is_external_write=1` → `connector`, else `manual`) + `list_categories`/`list_sources` promoted into `api.py` + `if_modified_since` concurrency guard on `update_*`/`delete_*`. No `LLM Call Log` / `record_llm_call` / `get_my_llm_cost` — dropped by ADR 0008's 2026-09-10 update. |
| P6-S2 | `[F]` | #91 | Assistant token mint endpoint (`mint_assistant_token`) + proactive scheduler stubs in `hooks.py` |
| P6-S3 | `[A]` | #92 | `expenso-assistant` repo scaffold (compose: app + Postgres + `langfuse:2` + nginx) + `tools.py` (the one tool definition, ported from `mcp.py`, Frappe-REST-backed) + FastMCP server registering those fns for external connectors (SEP-2322 input-required confirm on writes — the `2026-07-28` MCP era's replacement for server-initiated elicitation; `/mcp`, `MCP_ENABLED`-gated — a pure adapter) + PKCE auth |
| P6-S4 | `[F]` | #93 | Cutover: delete `expenso/mcp.py`, drop `frappe-mcp` from `pyproject.toml`, update DEPLOYMENT, re-point `OAuth Client` redirect URI, close #86/#88/#89 |
| P6-S5 | `[A]` | #94 | LangGraph agent (read-only): graph binding the `tools.py` read fns **directly** (no `langchain[mcp]`); Postgres checkpointer; hand-rolled `astream_events`→SSE + `/resume` FastAPI; Langfuse callback tagging every trace with `user_id`/`family`/`feature`/`session_id` + explicit cost (computed from a per-model `{input,cached_input,output}` rate table in `config.py` — the API returns tokens, not cost); per-run caps + per-Member daily caps queried from Langfuse (fail-open); saved Langfuse dashboards for cost/latency/feature |
| P6-S6 | `[FE]` | #70 (reused) | Chat surface: bubble + full-screen overlay on every screen; FAB extracted from `Feed.vue` into a global `Fab.vue`; SSE step log + streamed prose; history from the thread; "Clear chat" |
| P6-S7 | `[A]`+`[FE]` | #95 | Agent writes + confirm-card flow (proposal node raises `interrupt()` directly — no elicitation bridge; batched per turn, before→after diff, deselect/cancel; `/resume` executes the approved subset) + concurrency guard wired + `entry_method=assistant` + daily write cap. FastMCP adapter keeps its own SEP-2322 confirm for external connectors. |

**Incremental value:** P6-S1→S4 restore the connector on the new stack and clear the `frappe-mcp` debt (no regression). P6-S5→S6 is the first milestone with new user value (read-only in-app Assistant). P6-S7 adds agentic ledger management.

---

## Phase 7 — Proactive & Reporting

**Goal:** Receipts in the Assistant and proactive Insights. (Consolidated LLM reporting is gone — cost/latency/accuracy live in the Langfuse dashboards, set up in P6-S5. ADR 0008's 2026-09-10 update; #68/#72/#73 dropped or deferred.)

| Streak | Repo | Issue | Title |
|--------|------|-------|-------|
| P7-S1 | `[A]`+`[FE]` | #96 | Receipts conversational: image attached in chat → multimodal agent → `create_expense` proposal in the confirm card; no image storage; `entry_method=receipt`; extraction accuracy posted as `receipt_accuracy_*` Langfuse scores (proposed-vs-confirmed diff at `/resume`) |
| P7-S2 | `[F]`+`[A]` | #97 | Proactive Insights: `hooks.py` `scheduler_events` (monthly 1st, weekly — **off-hours slot** so a batch graph can't stall live chat streams) → per-Member read-token → `/run/proactive` → read-only graph → Insight messages / pending proposals in the thread; drift dedup marker; frontend unread badge |
