/**
 * One-shot README screenshot capture.
 * Requires a running bench site with a built frontend.
 *
 *   EXPENSO_TEST_URL=http://127.0.0.1:8008/expenso/ yarn playwright test e2e/capture-readme.spec.js
 */
import { test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../docs/images");

async function login(page) {
	await page.goto("login");
	await page.fill('input[name="email"]', "administrator");
	await page.fill('input[name="password"]', "admin");
	await page.click('button[type="submit"]');
	await page.waitForURL(/\/feed/);
}

async function shot(page, name) {
	await page.waitForTimeout(400);
	await page.screenshot({ path: path.join(OUT, name), animations: "disabled" });
}

test.describe("README screenshots", () => {
	test("capture app screens", async ({ page }) => {
		test.setTimeout(90_000);

		await page.goto("login");
		await page.waitForSelector('input[name="email"]');
		await shot(page, "login.png");

		await login(page);
		await page.waitForSelector('[data-test="feed-expense-total"]');
		// Prefer a month with rows; otherwise settle for the empty Feed. Race
		// both since entries load asynchronously after the totals render.
		await page
			.locator('[data-test="date-group-header"]')
			.or(page.getByText("No activity this month"))
			.first()
			.waitFor();
		await shot(page, "feed.png");

		await page.locator('[data-test="fab"]').click();
		await page.waitForSelector('[data-test="expense-sheet"]');
		await shot(page, "add-expense.png");

		await page.locator('[data-test="tab-income"]').click();
		await page.waitForSelector('[data-test="income-sheet"]');
		await shot(page, "add-income.png");

		await page
			.locator('[data-test="income-sheet-backdrop"]')
			.click({ position: { x: 10, y: 10 } });
		await page.waitForSelector('[data-test="income-sheet"]', { state: "detached" });

		const expenseRow = page.locator('[data-test="expense-row"]').first();
		if ((await expenseRow.count()) > 0) {
			await expenseRow.click();
			await page.waitForSelector('[data-test="expense-sheet"]');
			await shot(page, "edit-expense.png");
			await page
				.locator('[data-test="sheet-backdrop"]')
				.click({ position: { x: 10, y: 10 } });
			await page.waitForSelector('[data-test="expense-sheet"]', { state: "detached" });
		}

		await page.goto("analytics");
		await page
			.locator('[data-test="category-row"]')
			.or(page.getByText("No expenses this month"))
			.first()
			.waitFor();
		await shot(page, "analytics.png");

		await page.goto("budget");
		await page
			.locator('[data-test="budget-category-row"], [data-test="budget-empty-state"]')
			.first()
			.waitFor();
		await shot(page, "budget.png");

		await page.goto("settings");
		await page.waitForSelector('[data-test="category-row"]');
		await shot(page, "settings.png");

		await page.goto("assistant");
		await page
			.locator('[data-test="assistant-input"], [data-test="assistant-not-configured"]')
			.first()
			.waitFor();
		await shot(page, "assistant.png");
	});
});
