import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useMonthStore } from "@/stores/month";
import Budget from "@/pages/Budget.vue";

vi.mock("@/composables/useBudgets", () => ({
	useBudgets: vi.fn(),
	setBudget: vi.fn(),
}));

import { useBudgets } from "@/composables/useBudgets";

function mockBudgets(categories, reload = vi.fn(), budgetTotal = 0) {
	useBudgets.mockReturnValue({
		categories: ref(categories),
		budgetTotal: ref(budgetTotal),
		loading: ref(false),
		reload,
	});
}

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe("Budget page", () => {
	// F70
	it("lists all Categories with a budget button", () => {
		mockBudgets([
			{ name: "CAT-1", category_name: "Groceries", budget_amount: null },
			{ name: "CAT-2", category_name: "Dining", budget_amount: null },
		]);
		const wrapper = mount(Budget);
		expect(wrapper.text()).toContain("Groceries");
		expect(wrapper.text()).toContain("Dining");
		expect(wrapper.findAll('[data-test="budget-open-button"]')).toHaveLength(2);
	});

	// F71
	it('shows "Set Budget" on the button when the Category has no Budget for the month', () => {
		mockBudgets([{ name: "CAT-1", category_name: "Groceries", budget_amount: null }]);
		const wrapper = mount(Budget);
		expect(wrapper.find('[data-test="budget-open-button"]').text()).toBe("Set Budget");
	});

	// F72
	it("shows the Budget amount on the button when the Category has a Budget for the month", () => {
		mockBudgets([{ name: "CAT-1", category_name: "Groceries", budget_amount: 500 }]);
		const wrapper = mount(Budget);
		expect(wrapper.find('[data-test="budget-open-button"]').text()).toBe(
			new Intl.NumberFormat().format(500)
		);
	});

	// F73
	it("opens the BudgetSheet for a Category when its budget button is clicked", async () => {
		mockBudgets([{ name: "CAT-1", category_name: "Groceries", budget_amount: null }]);
		const wrapper = mount(Budget);
		expect(wrapper.find('[data-test="budget-sheet"]').exists()).toBe(false);

		await wrapper.find('[data-test="budget-open-button"]').trigger("click");
		expect(wrapper.find('[data-test="budget-sheet"]').exists()).toBe(true);
	});

	// F74
	it("reloads Budgets after the BudgetSheet closes", async () => {
		const reload = vi.fn();
		mockBudgets([{ name: "CAT-1", category_name: "Groceries", budget_amount: null }], reload);
		const wrapper = mount(Budget);

		await wrapper.find('[data-test="budget-open-button"]').trigger("click");
		await wrapper.find('[data-test="budget-sheet-backdrop"]').trigger("click");

		expect(wrapper.find('[data-test="budget-sheet"]').exists()).toBe(false);
		expect(reload).toHaveBeenCalled();
	});

	// F75
	it("shows the month label from the store", () => {
		const monthStore = useMonthStore();
		monthStore.month = 6;
		monthStore.year = 2025;
		mockBudgets([]);
		const wrapper = mount(Budget);
		expect(wrapper.text()).toContain("June 2025");
	});

	// F76
	it("decrements the month store on prev month click", async () => {
		const monthStore = useMonthStore();
		monthStore.month = 6;
		monthStore.year = 2025;
		mockBudgets([]);
		const wrapper = mount(Budget);
		await wrapper.find('[aria-label="Previous month"]').trigger("click");
		expect(monthStore.month).toBe(5);
	});

	// F77
	it("increments the month store on next month click", async () => {
		const monthStore = useMonthStore();
		monthStore.month = 6;
		monthStore.year = 2025;
		mockBudgets([]);
		const wrapper = mount(Budget);
		await wrapper.find('[aria-label="Next month"]').trigger("click");
		expect(monthStore.month).toBe(7);
	});

	// F78
	it("shows an empty state when there are no Categories", () => {
		mockBudgets([]);
		const wrapper = mount(Budget);
		expect(wrapper.find('[data-test="budget-empty-state"]').exists()).toBe(true);
	});

	// F140
	it("shows the total Budget for the month", () => {
		mockBudgets(
			[
				{ name: "CAT-1", category_name: "Groceries", budget_amount: 500 },
				{ name: "CAT-2", category_name: "Dining", budget_amount: null },
			],
			vi.fn(),
			500
		);
		const wrapper = mount(Budget);
		expect(wrapper.find('[data-test="budget-summary-total"]').text()).toContain(
			new Intl.NumberFormat().format(500)
		);
	});
});
