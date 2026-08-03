import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import ExpenseSheet from "@/components/ExpenseSheet.vue";

vi.mock("@/composables/useCategories", () => ({
	useCategories: vi.fn(),
	addCategory: vi.fn(),
}));
vi.mock("@/composables/useExpenses", () => ({
	createExpense: vi.fn(),
	updateExpense: vi.fn(),
	deleteExpense: vi.fn(),
}));

import { useCategories, addCategory } from "@/composables/useCategories";
import { createExpense, updateExpense, deleteExpense } from "@/composables/useExpenses";

let reloadCategories;
let categoriesRef;

beforeEach(() => {
	vi.clearAllMocks();
	categoriesRef = ref([{ name: "CAT-1", category_name: "Groceries" }]);
	reloadCategories = vi.fn(async () => {
		categoriesRef.value = [...categoriesRef.value, { name: "CAT-NEW", category_name: "Pets" }];
	});
	useCategories.mockReturnValue({
		categories: categoriesRef,
		loading: ref(false),
		reload: reloadCategories,
	});
	createExpense.mockResolvedValue({ name: "EXP-NEW" });
	updateExpense.mockResolvedValue({ name: "EXP-1" });
	deleteExpense.mockResolvedValue();
	addCategory.mockResolvedValue({ name: "CAT-NEW" });
});

function amountInput(wrapper) {
	return wrapper.find('[data-test="amount-input"]');
}

describe("ExpenseSheet", () => {
	// F13
	it("disables submit while amount is empty", async () => {
		const wrapper = mount(ExpenseSheet);
		expect(wrapper.find('[data-test="submit-button"]').attributes("disabled")).toBeDefined();
		await amountInput(wrapper).setValue("25");
		expect(wrapper.find('[data-test="submit-button"]').attributes("disabled")).toBeUndefined();
	});

	// F14
	it("defaults the date field to today in add mode", () => {
		const wrapper = mount(ExpenseSheet);
		const today = new Date().toISOString().slice(0, 10);
		expect(wrapper.find('[data-test="date-input"]').element.value).toBe(today);
	});

	// F15 / F16
	it("submits an add without a category and closes", async () => {
		const wrapper = mount(ExpenseSheet);
		await amountInput(wrapper).setValue("25");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(createExpense).toHaveBeenCalledWith(
			expect.objectContaining({ amount: 25, category: null, notes: null })
		);
		expect(wrapper.emitted("close")).toBeTruthy();
	});

	// F137
	it("accepts a comma as the decimal separator in the amount field", async () => {
		const wrapper = mount(ExpenseSheet);
		await amountInput(wrapper).setValue("12,50");
		expect(wrapper.find('[data-test="submit-button"]').attributes("disabled")).toBeUndefined();
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(createExpense).toHaveBeenCalledWith(expect.objectContaining({ amount: 12.5 }));
	});

	it("submits an add with notes", async () => {
		const wrapper = mount(ExpenseSheet);
		await amountInput(wrapper).setValue("25");
		await wrapper.find('[data-test="notes-input"]').setValue("Dinner with the Smiths");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(createExpense).toHaveBeenCalledWith(
			expect.objectContaining({ amount: 25, notes: "Dinner with the Smiths" })
		);
	});

	// F17
	it("pre-fills fields in edit mode", () => {
		const wrapper = mount(ExpenseSheet, {
			props: {
				expense: {
					name: "EXP-1",
					amount: 40,
					date: "2025-06-10",
					category: "CAT-1",
					notes: "Dinner with the Smiths",
				},
			},
		});
		expect(amountInput(wrapper).element.value).toBe("40");
		expect(wrapper.find('[data-test="date-input"]').element.value).toBe("2025-06-10");
		expect(wrapper.find('[data-test="notes-input"]').element.value).toBe(
			"Dinner with the Smiths"
		);
		expect(wrapper.text()).toContain("Edit Expense");
	});

	it("submits an edit with the updated field", async () => {
		const wrapper = mount(ExpenseSheet, {
			props: {
				expense: { name: "EXP-1", amount: 40, date: "2025-06-10", category: "CAT-1" },
			},
		});
		await amountInput(wrapper).setValue("99");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(updateExpense).toHaveBeenCalledWith(
			expect.objectContaining({ name: "EXP-1", amount: 99 })
		);
		expect(wrapper.emitted("close")).toBeTruthy();
	});

	// F18
	it("shows a confirmation prompt before deleting", async () => {
		const wrapper = mount(ExpenseSheet, {
			props: {
				expense: { name: "EXP-1", amount: 40, date: "2025-06-10", category: "CAT-1" },
			},
		});
		expect(wrapper.find('[data-test="confirm-delete-button"]').exists()).toBe(false);
		await wrapper.find('[data-test="delete-button"]').trigger("click");
		expect(wrapper.find('[data-test="confirm-delete-button"]').exists()).toBe(true);
		expect(deleteExpense).not.toHaveBeenCalled();
	});

	// F19
	it("deletes the expense once the delete is confirmed", async () => {
		const wrapper = mount(ExpenseSheet, {
			props: {
				expense: { name: "EXP-1", amount: 40, date: "2025-06-10", category: "CAT-1" },
			},
		});
		await wrapper.find('[data-test="delete-button"]').trigger("click");
		await wrapper.find('[data-test="confirm-delete-button"]').trigger("click");
		await flushPromises();

		expect(deleteExpense).toHaveBeenCalledWith("EXP-1");
		expect(wrapper.emitted("close")).toBeTruthy();
	});

	// F20
	it("closes without saving when the backdrop is clicked", async () => {
		const wrapper = mount(ExpenseSheet);
		await amountInput(wrapper).setValue("25");
		await wrapper.find('[data-test="sheet-backdrop"]').trigger("click");

		expect(wrapper.emitted("close")).toBeTruthy();
		expect(createExpense).not.toHaveBeenCalled();
	});

	// F12
	it("shows Expense / Income tabs in add mode", () => {
		const wrapper = mount(ExpenseSheet);
		expect(wrapper.find('[data-test="add-entry-tabs"]').exists()).toBe(true);
		expect(wrapper.find('[data-test="tab-income"]').exists()).toBe(true);
	});

	// F30
	it("emits switch-mode with 'income' on Income tab click", async () => {
		const wrapper = mount(ExpenseSheet);
		await wrapper.find('[data-test="tab-income"]').trigger("click");
		expect(wrapper.emitted("switch-mode")).toEqual([["income"]]);
	});

	// F94
	it("reveals an inline name input when '+ New category' is selected", async () => {
		const wrapper = mount(ExpenseSheet);
		expect(wrapper.find('[data-test="new-category-inline"]').exists()).toBe(false);
		await wrapper.find('[data-test="category-select"]').setValue("__new_category__");
		expect(wrapper.find('[data-test="new-category-inline"]').exists()).toBe(true);
	});

	// F95
	it("creates and selects a new category without leaving the sheet", async () => {
		const wrapper = mount(ExpenseSheet);
		await wrapper.find('[data-test="category-select"]').setValue("__new_category__");
		await wrapper.find('[data-test="new-category-input"]').setValue("Pets");
		await wrapper.find('[data-test="new-category-create-button"]').trigger("click");
		await flushPromises();

		expect(addCategory).toHaveBeenCalledWith("Pets");
		expect(reloadCategories).toHaveBeenCalled();
		expect(wrapper.find('[data-test="new-category-inline"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="category-select"]').element.value).toBe("CAT-NEW");
	});

	// F96
	it("cancels inline category creation and resets the category select", async () => {
		const wrapper = mount(ExpenseSheet);
		await wrapper.find('[data-test="category-select"]').setValue("__new_category__");
		await wrapper.find('[data-test="new-category-cancel-button"]').trigger("click");

		expect(wrapper.find('[data-test="new-category-inline"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="category-select"]').element.value).toBe("");
		expect(addCategory).not.toHaveBeenCalled();
	});

	// F97
	it("disables submit while inline category creation is open", async () => {
		const wrapper = mount(ExpenseSheet);
		await amountInput(wrapper).setValue("25");
		await wrapper.find('[data-test="category-select"]').setValue("__new_category__");
		expect(wrapper.find('[data-test="submit-button"]').attributes("disabled")).toBeDefined();
	});

	// F80
	it("hides the tabs in edit mode", () => {
		const wrapper = mount(ExpenseSheet, {
			props: {
				expense: { name: "EXP-1", amount: 40, date: "2025-06-10", category: "CAT-1" },
			},
		});
		expect(wrapper.find('[data-test="add-entry-tabs"]').exists()).toBe(false);
	});
});
