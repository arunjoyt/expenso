import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import ExpenseSheet from "@/components/ExpenseSheet.vue";

vi.mock("@/composables/useCategories", () => ({
	useCategories: vi.fn(),
}));
vi.mock("@/composables/useExpenses", () => ({
	createExpense: vi.fn(),
	updateExpense: vi.fn(),
	deleteExpense: vi.fn(),
}));

import { useCategories } from "@/composables/useCategories";
import { createExpense, updateExpense, deleteExpense } from "@/composables/useExpenses";

beforeEach(() => {
	vi.clearAllMocks();
	useCategories.mockReturnValue({
		categories: ref([{ name: "CAT-1", category_name: "Groceries" }]),
		loading: ref(false),
		reload: vi.fn(),
	});
	createExpense.mockResolvedValue({ name: "EXP-NEW" });
	updateExpense.mockResolvedValue({ name: "EXP-1" });
	deleteExpense.mockResolvedValue();
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
			expect.objectContaining({ amount: 25, category: null }),
		);
		expect(wrapper.emitted("close")).toBeTruthy();
	});

	// F17
	it("pre-fills fields in edit mode", () => {
		const wrapper = mount(ExpenseSheet, {
			props: {
				expense: { name: "EXP-1", amount: 40, date: "2025-06-10", category: "CAT-1" },
			},
		});
		expect(amountInput(wrapper).element.value).toBe("40");
		expect(wrapper.find('[data-test="date-input"]').element.value).toBe("2025-06-10");
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
			expect.objectContaining({ name: "EXP-1", amount: 99 }),
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
});
