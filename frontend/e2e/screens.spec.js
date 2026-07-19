import { test, expect } from "@playwright/test";

async function login(page) {
	await page.goto("login");
	await page.fill('input[name="email"]', "administrator");
	await page.fill('input[name="password"]', "admin");
	await page.click('button[type="submit"]');
	await page.waitForURL(/\/feed/);
}

test.describe("Expenso — visual regression", () => {
	test("login screen", async ({ page }) => {
		await page.goto("login");
		await page.waitForSelector('input[name="email"]');
		await expect(page).toHaveScreenshot("login.png");
	});

	test("feed screen", async ({ page }) => {
		await login(page);
		await page.waitForSelector('[data-test="date-group-header"]');
		await page.waitForTimeout(300);
		await expect(page).toHaveScreenshot("feed.png");
	});

	test("analytics screen", async ({ page }) => {
		await login(page);
		await page.goto("analytics");
		await page.waitForSelector('[data-test="category-row"]');
		await page.waitForTimeout(300);
		await expect(page).toHaveScreenshot("analytics.png");
	});

	test("settings screen", async ({ page }) => {
		await login(page);
		await page.goto("settings");
		await page.waitForSelector('[data-test="category-row"]');
		await page.waitForTimeout(300);
		await expect(page).toHaveScreenshot("settings.png");
	});
});
