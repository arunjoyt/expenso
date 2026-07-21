import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import BudgetSheet from "@/components/BudgetSheet.vue";

vi.mock("@/composables/useBudgets", () => ({
	setBudget: vi.fn(),
}));

import { setBudget } from "@/composables/useBudgets";

beforeEach(() => {
	vi.clearAllMocks();
	setBudget.mockResolvedValue({});
});

function amountInput(wrapper) {
	return wrapper.find('[data-test="budget-sheet-amount-input"]');
}

const groceries = { name: "CAT-1", category_name: "Groceries", budget_amount: null };
const groceriesWithBudget = { name: "CAT-1", category_name: "Groceries", budget_amount: 240 };

describe("BudgetSheet", () => {
	// F55
	it("shows the Category name in the sheet title", () => {
		const wrapper = mount(BudgetSheet, {
			props: { category: groceries, month: 6, year: 2025 },
		});
		expect(wrapper.text()).toContain("Groceries");
	});

	// F44
	it("pre-fills the amount input with the existing Budget", () => {
		const wrapper = mount(BudgetSheet, {
			props: { category: groceriesWithBudget, month: 6, year: 2025 },
		});
		expect(amountInput(wrapper).element.value).toBe("240");
	});

	// F56
	it("leaves the amount input empty when there is no existing Budget", () => {
		const wrapper = mount(BudgetSheet, {
			props: { category: groceries, month: 6, year: 2025 },
		});
		expect(amountInput(wrapper).element.value).toBe("");
	});

	// F43
	it("saves the Budget for the given month/year on submit and closes", async () => {
		const wrapper = mount(BudgetSheet, {
			props: { category: groceries, month: 6, year: 2025 },
		});
		await amountInput(wrapper).setValue("240");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(setBudget).toHaveBeenCalledWith("CAT-1", 6, 2025, 240);
		expect(wrapper.emitted("close")).toBeTruthy();
	});

	// F57
	it("does not show a Remove Budget button when there is no existing Budget", () => {
		const wrapper = mount(BudgetSheet, {
			props: { category: groceries, month: 6, year: 2025 },
		});
		expect(wrapper.find('[data-test="budget-sheet-remove-button"]').exists()).toBe(false);
	});

	// F58
	it("removes the Budget for the given month/year when Remove Budget is clicked", async () => {
		const wrapper = mount(BudgetSheet, {
			props: { category: groceriesWithBudget, month: 6, year: 2025 },
		});
		await wrapper.find('[data-test="budget-sheet-remove-button"]').trigger("click");
		await flushPromises();

		expect(setBudget).toHaveBeenCalledWith("CAT-1", 6, 2025, null);
		expect(wrapper.emitted("close")).toBeTruthy();
	});

	// F59
	it("closes without saving when the backdrop is clicked", async () => {
		const wrapper = mount(BudgetSheet, {
			props: { category: groceries, month: 6, year: 2025 },
		});
		await amountInput(wrapper).setValue("240");
		await wrapper.find('[data-test="budget-sheet-backdrop"]').trigger("click");

		expect(wrapper.emitted("close")).toBeTruthy();
		expect(setBudget).not.toHaveBeenCalled();
	});
});
