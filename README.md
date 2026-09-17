# Expenso — Family Expense Tracker

A mobile-first family expense tracker where multiple household members share and record shared spending and income, built on the [Frappe Framework](https://github.com/frappe/frappe).

Expenso is a Vue 3 PWA on a Frappe ledger. The in-app **Assistant** answers questions, proposes Expense and Income writes for Member confirmation, accepts receipt photos, and surfaces proactive Insights. Members can also connect Claude or ChatGPT through a remote **MCP** connector on the separate [`expenso-assistant`](https://github.com/arunjoyt/expenso-assistant) service. Usage caps apply on both paths (Assistant and MCP), each with its own rules. The MCP connector also uses separate `expenso:read` and `expenso:write` OAuth2 scopes and create-only access — no edit or delete through an AI client.

## Screenshots

| Login | Feed | Analytics |
|---|---|---|
| ![Login](docs/images/login.png) | ![Feed](docs/images/feed.png) | ![Analytics](docs/images/analytics.png) |

| Add Expense | Add Income | Edit Expense |
|---|---|---|
| ![Add Expense](docs/images/add-expense.png) | ![Add Income](docs/images/add-income.png) | ![Edit Expense](docs/images/edit-expense.png) |

The Feed's + button opens the Add Expense sheet directly; the Expense/Income tab switcher inside it reaches Add Income without a second tap.

| Budget | Settings | Assistant |
|---|---|---|
| ![Budget](docs/images/budget.png) | ![Settings](docs/images/settings.png) | ![Assistant](docs/images/assistant.png) |

| Assistant Chat | Confirm Card |
|---|---|
| ![Assistant Chat](docs/images/assistant-chat.png) | ![Confirm Card](docs/images/assistant-confirm.png) |

| Receipt Attach | Proactive Insight |
|---|---|
| ![Receipt Attach](docs/images/assistant-receipt.png) | ![Proactive Insight](docs/images/assistant-insight.png) |

The Assistant answers questions directly, proposes Expense/Income writes in a confirm card for Member approval, accepts a receipt photo in place of typing, and posts unprompted Insight messages (budget drift, monthly summaries) into the same thread.

## Features

- **Feed** — home screen showing the Family's Expenses for the selected month, grouped by date with a compact monthly total; prev/next month navigation
- **Analytics** — read-only monthly summary: total Expenses, Income, and Savings (net), with a per-Category breakdown against that Category's Budget and its Budget Status (Warning at ≥80% spent, Exceeded at ≥100%)
- **Budget** — a dedicated screen for setting each Category's spending cap for the selected month; unset months auto-fill by carrying forward the most recent earlier amount
- **Settings** — the single surface for managing a Family's Category and Source lists (add, rename, delete)
- **Shared Feed** — any Member can create, edit, or delete any Expense or Income belonging to their Family; the Feed refreshes live over Frappe's WebSocket when another Member makes a change, no manual refresh needed
- **Assistant** — bottom-nav tab for chat with the Family ledger; proposed writes land in a confirm card before they apply
- **Receipts** — attach a photo in Assistant chat; the agent proposes an Expense in the confirm card (no image storage)
- **Proactive Insights** — scheduled read-only runs post Insight messages into the Assistant thread, with an unread badge on the nav tab

## User Roles

| Role | Access |
|---|---|
| **Family Member** | Create, edit, and delete Expenses/Income for their own Family; manage their Family's Categories, Sources, and Budgets |

Admin sets up all accounts through Frappe Desk — there's no self-service signup.

## Admin Setup (one-time per family)

1. **Create a User** for each household member: `Desk → User → New`. Uncheck "Send Welcome Email" if the address is a placeholder.
2. On each User's **Roles & Permissions** tab, check the **Family Member** role — without it, the Member can't log in to the app or access their Family's data.
3. **Create a Family**: `Desk → Expenso → Family → New`. Set a Family Name and Currency, then add each User under Members.
4. **Save.** Default Categories (Groceries, Dining, Transport, Utilities, Health, Entertainment, Shopping, Other) and Sources (Salary, Freelance, Rental, Other) are seeded automatically — visible under Connections on the Family.
5. Members can now log in at the site URL and land on their shared Feed.

| New User | Assign "Family Member" role |
|---|---|
| ![New User](docs/images/admin-new-user.png) | ![Assign Role](docs/images/admin-assign-role.png) |

| New Family | Family created — defaults seeded |
|---|---|
| ![New Family](docs/images/admin-new-family.png) | ![Family Created](docs/images/admin-family-created.png) |

## Chat via Claude

Ask questions about your Family's Expenses, Income, and Budgets directly in Claude, through Claude's own remote MCP connector. Claude supports this on every plan, including Free (Free allows one custom connector).

Before you start, get the connector's **Client ID** from your admin. Expenso uses one pre-registered client per connecting app, not self-service registration.

1. Open Claude and go to **Settings → Connectors → Add custom connector**.
2. Enter the server URL your admin gives you (the `expenso-assistant` service, e.g. `https://assistant.<your-site>/mcp`).
3. Open **Advanced settings** and enter the Client ID from your admin.
4. Click **Connect**.
5. Log in with your own Expenso account, then approve access.
6. Ask Claude a question, for example: "What were my expenses last month?"

Claude only sees your own Family's data — access follows the same Family-scoped permissions as the app itself. Claude asks for approval before it calls a tool for the first time; change this under the connector's **Tool permissions**.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#mcp-connector-setup-admin-one-time) for the admin-side setup that creates the Client ID.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data model, screen specs, file layout
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — ordered phases and streaks
- [`docs/GLOSSARY.md`](docs/GLOSSARY.md) — domain terminology
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production setup and verification checklist
- [`docs/adr/`](docs/adr/) — architecture decision records

## Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app expenso
```

The in-app Assistant and the MCP connector need the separate [`expenso-assistant`](https://github.com/arunjoyt/expenso-assistant) service and `expenso_assistant_url` in site config. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Testing

### Backend (Python)

Tests run against a Frappe site. Enable tests on the site once, then run any time:

```bash
bench --site <your-site> set-config allow_tests true   # one-time
bench --site <your-site> run-tests --app expenso
```

Covers Expense/Income/Category/Source/Budget validation and lifecycle, the API layer, permissions, and the Frappe Desk Workspace (existence, and that its Number Cards and reports resolve to real doctypes).

### Frontend Unit Tests (Vitest)

Runs in jsdom and covers component logic, but never actually renders CSS — it won't catch a color or layout regression.

```bash
cd frontend
yarn test
```

### UI (Playwright) — visual regression

Fills the CSS gap by screenshotting the Login, Feed, Analytics, and Settings screens and diffing them against committed baselines. Runs against a real, already-running bench site (the app needs live Frappe auth/API responses), so build the frontend and clear the cache first:

```bash
# from apps/expenso/frontend
yarn build

# from the bench root, with $SITE already running
bench --site $SITE clear-cache

# back in apps/expenso/frontend
yarn test:visual        # compare against the committed baselines
yarn test:visual:update # regenerate baselines after an intentional UI change
```

By default it targets `http://127.0.0.1:8005/expenso/`; point it elsewhere with `EXPENSO_TEST_URL=http://host:port/expenso/ yarn test:visual`.

These are a **local dev tool only** — not run in CI. Baseline filenames are OS-specific (e.g. `-darwin`), and the screenshots bake in this site's current seed data, so they'd need a per-platform baseline set and consistent fixture data to run safely in CI.

## Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/expenso
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier

## CI

Workflow files for GitHub Actions are in the repo, but **CI** and **Linters** are currently disabled ([#55](https://github.com/arunjoyt/expenso/issues/55)). When enabled:

- CI: Installs this app, runs backend and frontend unit tests, and builds the frontend on every push to `develop`.
- Linters: Runs [Frappe Semgrep Rules](https://github.com/frappe/semgrep-rules) and [pip-audit](https://pypi.org/project/pip-audit/) on every pull request.

## License

MIT
