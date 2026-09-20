import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useMonthStore } from "@/stores/month";
import Analytics from "@/pages/Analytics.vue";

vi.mock("@/composables/useAnalytics", () => ({
	useAnalytics: vi.fn(),
}));
vi.mock("@/composables/useExpenses", () => ({
	useExpenses: vi.fn(),
}));
const entrySheet = {
	openEditExpense: vi.fn(),
};
vi.mock("@/composables/useEntrySheet", () => ({
	useEntrySheet: () => entrySheet,
}));

import { useAnalytics } from "@/composables/useAnalytics";
import { useExpenses } from "@/composables/useExpenses";

function mockAnalytics(total, categories, { incomeTotal = 0, balance = 0, loading = false } = {}) {
	useAnalytics.mockReturnValue({
		total: ref(total),
		categories: ref(categories),
		incomeTotal: ref(incomeTotal),
		balance: ref(balance),
		loading: ref(loading),
		reload: vi.fn(),
	});
}

function mockExpenses(expenses, loading = false) {
	useExpenses.mockReturnValue({
		expenses: ref(expenses),
		loading: ref(loading),
		reload: vi.fn(),
	});
}

beforeEach(() => {
	setActivePinia(createPinia());
	entrySheet.openEditExpense.mockClear();
	mockExpenses([]);
});

describe("Analytics page", () => {
	// F21
	it("shows the monthly total", () => {
		mockAnalytics(50, []);
		const wrapper = mount(Analytics);
		expect(wrapper.find('[data-test="monthly-total"]').text()).toBe(
			new Intl.NumberFormat().format(50)
		);
	});

	// F22
	it("shows a category row with name and amount for each category", () => {
		mockAnalytics(50, [
			{ name: "Groceries", amount: 30 },
			{ name: "Dining", amount: 20 },
		]);
		const wrapper = mount(Analytics);
		const rows = wrapper.findAll('[data-test="category-row"]');
		expect(rows).toHaveLength(2);
		expect(rows[0].text()).toContain("Groceries");
		expect(rows[0].text()).toContain(new Intl.NumberFormat().format(30));
		expect(rows[1].text()).toContain("Dining");
		expect(rows[1].text()).toContain(new Intl.NumberFormat().format(20));
	});

	// F23
	it("shows an Uncategorized row when expenses have no category", () => {
		mockAnalytics(15, [{ name: "Uncategorized", amount: 15 }]);
		const wrapper = mount(Analytics);
		expect(wrapper.text()).toContain("Uncategorized");
	});

	// F28
	it("shows the income total", () => {
		mockAnalytics(50, [], { incomeTotal: 200 });
		const wrapper = mount(Analytics);
		expect(wrapper.find('[data-test="income-total"]').text()).toContain(
			new Intl.NumberFormat().format(200)
		);
	});

	// F29
	it("shows the balance, including when negative", () => {
		mockAnalytics(50, [], { incomeTotal: 20, balance: -30 });
		const wrapper = mount(Analytics);
		expect(wrapper.find('[data-test="balance"]').text()).toContain(
			new Intl.NumberFormat().format(-30)
		);
	});

	it("does not show an Add Income entry point (moved to Feed's FAB menu)", () => {
		mockAnalytics(50, []);
		const wrapper = mount(Analytics);
		expect(wrapper.find('[data-test="add-income-button"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="income-sheet"]').exists()).toBe(false);
	});

	// F45
	it("shows no threshold indicator for a Category with no Budget", () => {
		mockAnalytics(50, [{ name: "Groceries", amount: 50, budget_status: null }]);
		const wrapper = mount(Analytics);
		expect(wrapper.find('[data-test="budget-status-warning"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="budget-status-exceeded"]').exists()).toBe(false);
	});

	// F46
	it("shows a yellow indicator for a Warning budget status", () => {
		mockAnalytics(50, [{ name: "Groceries", amount: 50, budget_status: "Warning" }]);
		const wrapper = mount(Analytics);
		expect(wrapper.find('[data-test="budget-status-warning"]').exists()).toBe(true);
		expect(wrapper.find('[data-test="budget-status-exceeded"]').exists()).toBe(false);
	});

	// F47
	it("shows a red indicator for an Exceeded budget status", () => {
		mockAnalytics(50, [{ name: "Groceries", amount: 50, budget_status: "Exceeded" }]);
		const wrapper = mount(Analytics);
		expect(wrapper.find('[data-test="budget-status-exceeded"]').exists()).toBe(true);
		expect(wrapper.find('[data-test="budget-status-warning"]').exists()).toBe(false);
	});

	// F48
	it("shows no threshold indicator for a Normal budget status", () => {
		mockAnalytics(50, [{ name: "Groceries", amount: 50, budget_status: "Normal" }]);
		const wrapper = mount(Analytics);
		expect(wrapper.find('[data-test="budget-status-warning"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="budget-status-exceeded"]').exists()).toBe(false);
	});

	// F49
	it("sizes the progress bar as percent-of-budget, not relative to the top spender", () => {
		mockAnalytics(34.48, [
			{ name: "Groceries", amount: 24.48, budget: 240 },
			{ name: "Utilities", amount: 10, budget: null },
		]);
		const wrapper = mount(Analytics);
		const fills = wrapper.findAll('[data-test="budget-bar-fill"]');
		const groceriesWidth = parseFloat(
			fills[0].attributes("style").match(/width:\s*([\d.]+)%/)[1]
		);
		expect(groceriesWidth).toBeCloseTo((24.48 / 240) * 100, 5);
	});

	// F50
	it("shows the budget, balance, and percent-used for a category with a budget", () => {
		mockAnalytics(24.48, [{ name: "Groceries", amount: 24.48, budget: 240 }]);
		const wrapper = mount(Analytics);
		const summary = wrapper.find('[data-test="budget-summary"]');
		expect(summary.text()).toContain(new Intl.NumberFormat().format(240));
		expect(summary.text()).toContain(new Intl.NumberFormat().format(240 - 24.48));
		expect(summary.text()).toContain("10%");
	});

	// F51
	it("falls back to relative-to-max-spend sizing and shows no budget set when Category has no Budget", () => {
		mockAnalytics(34.48, [
			{ name: "Groceries", amount: 24.48, budget: null },
			{ name: "Utilities", amount: 10, budget: null },
		]);
		const wrapper = mount(Analytics);
		const fills = wrapper.findAll('[data-test="budget-bar-fill"]');
		const groceriesWidth = parseFloat(
			fills[0].attributes("style").match(/width:\s*([\d.]+)%/)[1]
		);
		const utilitiesWidth = parseFloat(
			fills[1].attributes("style").match(/width:\s*([\d.]+)%/)[1]
		);
		expect(groceriesWidth).toBe(100);
		expect(utilitiesWidth).toBeCloseTo((10 / 24.48) * 100, 5);
		expect(wrapper.findAll('[data-test="budget-summary-none"]')).toHaveLength(2);
	});

	// F93
	it("shows a category row with $0 spent when only a Budget is set for it", () => {
		mockAnalytics(0, [{ name: "Groceries", amount: 0, budget: 200, budget_status: "Normal" }]);
		const wrapper = mount(Analytics);
		const rows = wrapper.findAll('[data-test="category-row"]');
		expect(rows).toHaveLength(1);
		expect(rows[0].text()).toContain("Groceries");
		const summary = wrapper.find('[data-test="budget-summary"]');
		expect(summary.text()).toContain(new Intl.NumberFormat().format(200));
		expect(summary.text()).toContain("0%");
		expect(wrapper.find('[data-test="budget-summary-none"]').exists()).toBe(false);
	});

	// F67
	it("shows the month label from the store", () => {
		const monthStore = useMonthStore();
		monthStore.month = 6;
		monthStore.year = 2025;
		mockAnalytics(0, []);
		const wrapper = mount(Analytics);
		expect(wrapper.text()).toContain("June 2025");
	});

	// F68
	it("decrements the month store on prev month click", async () => {
		const monthStore = useMonthStore();
		monthStore.month = 6;
		monthStore.year = 2025;
		mockAnalytics(0, []);
		const wrapper = mount(Analytics);
		await wrapper.find('[aria-label="Previous month"]').trigger("click");
		expect(monthStore.month).toBe(5);
	});

	// F69
	it("increments the month store on next month click", async () => {
		const monthStore = useMonthStore();
		monthStore.month = 6;
		monthStore.year = 2025;
		mockAnalytics(0, []);
		const wrapper = mount(Analytics);
		await wrapper.find('[aria-label="Next month"]').trigger("click");
		expect(monthStore.month).toBe(7);
	});

	describe("category drill-down", () => {
		// F146
		it("expands a category with spend to show its matching Expenses", async () => {
			mockAnalytics(50, [{ name: "Groceries", amount: 30 }]);
			mockExpenses([
				{
					name: "EXP-1",
					amount: 20,
					date: "2026-09-03",
					category_name: "Groceries",
					notes: "",
				},
				{
					name: "EXP-2",
					amount: 10,
					date: "2026-09-08",
					category_name: "Groceries",
					notes: "",
				},
				{
					name: "EXP-3",
					amount: 20,
					date: "2026-09-05",
					category_name: "Dining",
					notes: "",
				},
			]);
			const wrapper = mount(Analytics);
			expect(wrapper.find('[data-test="category-expanded-expenses"]').exists()).toBe(false);

			await wrapper.find('[data-test="category-row"]').trigger("click");

			const rows = wrapper.findAll('[data-test="category-expense-row"]');
			expect(rows).toHaveLength(2);
		});

		// F147
		it("does not expand a category with zero spend", async () => {
			mockAnalytics(0, [{ name: "Groceries", amount: 0, budget: 200 }]);
			const wrapper = mount(Analytics);
			expect(wrapper.find('[data-test="category-expand-chevron"]').exists()).toBe(false);

			await wrapper.find('[data-test="category-row"]').trigger("click");
			expect(wrapper.find('[data-test="category-expanded-expenses"]').exists()).toBe(false);
		});

		// F148
		it("keeps multiple categories expanded at once", async () => {
			mockAnalytics(50, [
				{ name: "Groceries", amount: 30 },
				{ name: "Dining", amount: 20 },
			]);
			mockExpenses([
				{
					name: "EXP-1",
					amount: 30,
					date: "2026-09-03",
					category_name: "Groceries",
					notes: "",
				},
				{
					name: "EXP-2",
					amount: 20,
					date: "2026-09-05",
					category_name: "Dining",
					notes: "",
				},
			]);
			const wrapper = mount(Analytics);
			const categoryRows = wrapper.findAll('[data-test="category-row"]');
			await categoryRows[0].trigger("click");
			await categoryRows[1].trigger("click");

			expect(wrapper.findAll('[data-test="category-expanded-expenses"]')).toHaveLength(2);
		});

		// F149
		it("shows the date and notes on an expanded Expense row, falling back to date only", async () => {
			mockAnalytics(50, [{ name: "Groceries", amount: 50 }]);
			mockExpenses([
				{
					name: "EXP-1",
					amount: 30,
					date: "2026-09-12",
					category_name: "Groceries",
					notes: "Farmer's market",
				},
				{
					name: "EXP-2",
					amount: 20,
					date: "2026-09-13",
					category_name: "Groceries",
					notes: "",
				},
			]);
			const wrapper = mount(Analytics);
			await wrapper.find('[data-test="category-row"]').trigger("click");

			const rows = wrapper.findAll('[data-test="category-expense-row"]');
			expect(rows[0].text()).toContain("Sep 12");
			expect(rows[0].text()).toContain("Farmer's market");
			expect(rows[1].text()).toContain("Sep 13");
			expect(rows[1].text()).not.toContain("·");
		});

		// F150
		it("groups Expenses with no category under Uncategorized", async () => {
			mockAnalytics(15, [{ name: "Uncategorized", amount: 15 }]);
			mockExpenses([
				{ name: "EXP-1", amount: 15, date: "2026-09-01", category_name: null, notes: "" },
			]);
			const wrapper = mount(Analytics);
			await wrapper.find('[data-test="category-row"]').trigger("click");

			expect(wrapper.findAll('[data-test="category-expense-row"]')).toHaveLength(1);
		});

		// F151
		it("opens the Edit sheet for an Expense tapped inside the expanded list", async () => {
			mockAnalytics(30, [{ name: "Groceries", amount: 30 }]);
			const expense = {
				name: "EXP-1",
				amount: 30,
				date: "2026-09-03",
				category_name: "Groceries",
				notes: "",
			};
			mockExpenses([expense]);
			const wrapper = mount(Analytics);
			await wrapper.find('[data-test="category-row"]').trigger("click");
			await wrapper.find('[data-test="category-expense-row"]').trigger("click");

			expect(entrySheet.openEditExpense).toHaveBeenCalledWith(expense);
		});

		// F152
		it("collapses an expanded category on a second tap", async () => {
			mockAnalytics(30, [{ name: "Groceries", amount: 30 }]);
			mockExpenses([
				{
					name: "EXP-1",
					amount: 30,
					date: "2026-09-03",
					category_name: "Groceries",
					notes: "",
				},
			]);
			const wrapper = mount(Analytics);
			const row = wrapper.find('[data-test="category-row"]');
			await row.trigger("click");
			expect(wrapper.find('[data-test="category-expanded-expenses"]').exists()).toBe(true);

			await row.trigger("click");
			expect(wrapper.find('[data-test="category-expanded-expenses"]').exists()).toBe(false);
		});
	});
});
