### Expenso

A family expense tracker where multiple household members share and record expenses

### Screenshots

| Login | Feed | Analytics |
|---|---|---|
| ![Login](docs/images/login.png) | ![Feed](docs/images/feed.png) | ![Analytics](docs/images/analytics.png) |

| Add Expense | Edit Expense | Add Income |
|---|---|---|
| ![Add Expense](docs/images/add-expense.png) | ![Edit Expense](docs/images/edit-expense.png) | ![Add Income](docs/images/add-income.png) |

| Settings |
|---|
| ![Settings](docs/images/settings.png) |

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app expenso
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/expenso
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### Testing

Frontend unit tests ([Vitest](https://vitest.dev)) run in jsdom and cover component logic, but never actually render CSS — they won't catch a color or layout regression.

```bash
cd frontend
yarn test
```

Visual regression tests ([Playwright](https://playwright.dev)) fill that gap by screenshotting the Login, Feed, Analytics, and Settings screens and diffing them against committed baselines. They run against a real, already-running bench site (the app needs live Frappe auth/API responses), so build the frontend and clear the cache first:

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

### CI

This app can use GitHub Actions for CI. The following workflows are configured:

- CI: Installs this app and runs unit tests on every push to `develop` branch.
- Linters: Runs [Frappe Semgrep Rules](https://github.com/frappe/semgrep-rules) and [pip-audit](https://pypi.org/project/pip-audit/) on every pull request.


### License

mit
