import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useMonthStore } from "@/stores/month";
import Analytics from "@/pages/Analytics.vue";

vi.mock("@/composables/useAnalytics", () => ({
	useAnalytics: vi.fn(),
}));
vi.mock("@/composables/useSources", () => ({
	useSources: vi.fn(() => ({
		sources: ref([]),
		loading: ref(false),
		reload: vi.fn(),
	})),
}));
vi.mock("@/composables/useIncome", () => ({
	createIncome: vi.fn(),
	updateIncome: vi.fn(),
	deleteIncome: vi.fn(),
}));

import { useAnalytics } from "@/composables/useAnalytics";

function mockAnalytics(total, categories, { incomeTotal = 0, savings = 0, loading = false } = {}) {
	useAnalytics.mockReturnValue({
		total: ref(total),
		categories: ref(categories),
		incomeTotal: ref(incomeTotal),
		savings: ref(savings),
		loading: ref(loading),
		reload: vi.fn(),
	});
}

beforeEach(() => {
	setActivePinia(createPinia());
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
	it("shows the savings, including when negative", () => {
		mockAnalytics(50, [], { incomeTotal: 20, savings: -30 });
		const wrapper = mount(Analytics);
		expect(wrapper.find('[data-test="savings"]').text()).toContain(
			new Intl.NumberFormat().format(-30)
		);
	});

	// F30
	it("shows an Add Income button", () => {
		mockAnalytics(50, []);
		const wrapper = mount(Analytics);
		expect(wrapper.find('[data-test="add-income-button"]').exists()).toBe(true);
	});

	// F31
	it("opens the IncomeSheet on Add Income click", async () => {
		mockAnalytics(50, []);
		const wrapper = mount(Analytics);
		expect(wrapper.find('[data-test="income-sheet"]').exists()).toBe(false);
		await wrapper.find('[data-test="add-income-button"]').trigger("click");
		expect(wrapper.find('[data-test="income-sheet"]').exists()).toBe(true);
	});

	// F35 / F37
	it("reloads analytics totals when the IncomeSheet closes", async () => {
		const reload = vi.fn();
		useAnalytics.mockReturnValue({
			total: ref(50),
			categories: ref([]),
			incomeTotal: ref(0),
			savings: ref(0),
			loading: ref(false),
			reload,
		});
		const wrapper = mount(Analytics);
		await wrapper.find('[data-test="add-income-button"]').trigger("click");
		await wrapper.find('[data-test="income-sheet-backdrop"]').trigger("click");

		expect(wrapper.find('[data-test="income-sheet"]').exists()).toBe(false);
		expect(reload).toHaveBeenCalled();
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
});
