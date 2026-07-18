import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import IncomeSheet from "@/components/IncomeSheet.vue";

vi.mock("@/composables/useSources", () => ({
	useSources: vi.fn(),
}));
vi.mock("@/composables/useIncome", () => ({
	createIncome: vi.fn(),
	updateIncome: vi.fn(),
	deleteIncome: vi.fn(),
}));

import { useSources } from "@/composables/useSources";
import { createIncome, updateIncome, deleteIncome } from "@/composables/useIncome";

beforeEach(() => {
	vi.clearAllMocks();
	useSources.mockReturnValue({
		sources: ref([{ name: "SRC-1", source_name: "Salary" }]),
		loading: ref(false),
		reload: vi.fn(),
	});
	createIncome.mockResolvedValue({ name: "INC-NEW" });
	updateIncome.mockResolvedValue({ name: "INC-1" });
	deleteIncome.mockResolvedValue();
});

function amountInput(wrapper) {
	return wrapper.find('[data-test="income-amount-input"]');
}

describe("IncomeSheet", () => {
	// F32
	it("disables submit while amount is empty", async () => {
		const wrapper = mount(IncomeSheet);
		expect(
			wrapper.find('[data-test="income-submit-button"]').attributes("disabled")
		).toBeDefined();
		await amountInput(wrapper).setValue("100");
		expect(
			wrapper.find('[data-test="income-submit-button"]').attributes("disabled")
		).toBeUndefined();
	});

	// F33
	it("defaults the date field to today in add mode", () => {
		const wrapper = mount(IncomeSheet);
		const today = new Date().toISOString().slice(0, 10);
		expect(wrapper.find('[data-test="income-date-input"]').element.value).toBe(today);
	});

	// F34 / F35
	it("submits an add without a source and closes", async () => {
		const wrapper = mount(IncomeSheet);
		await amountInput(wrapper).setValue("100");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(createIncome).toHaveBeenCalledWith(
			expect.objectContaining({ amount: 100, source: null })
		);
		expect(wrapper.emitted("close")).toBeTruthy();
	});

	it("pre-fills fields in edit mode and submits an update", async () => {
		const wrapper = mount(IncomeSheet, {
			props: {
				income: { name: "INC-1", amount: 200, date: "2025-06-10", source: "SRC-1" },
			},
		});
		expect(amountInput(wrapper).element.value).toBe("200");
		expect(wrapper.text()).toContain("Edit Income");

		await amountInput(wrapper).setValue("250");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(updateIncome).toHaveBeenCalledWith(
			expect.objectContaining({ name: "INC-1", amount: 250 })
		);
		expect(wrapper.emitted("close")).toBeTruthy();
	});

	// F36
	it("shows a confirmation prompt before deleting", async () => {
		const wrapper = mount(IncomeSheet, {
			props: {
				income: { name: "INC-1", amount: 200, date: "2025-06-10", source: "SRC-1" },
			},
		});
		expect(wrapper.find('[data-test="income-confirm-delete-button"]').exists()).toBe(false);
		await wrapper.find('[data-test="income-delete-button"]').trigger("click");
		expect(wrapper.find('[data-test="income-confirm-delete-button"]').exists()).toBe(true);
		expect(deleteIncome).not.toHaveBeenCalled();
	});

	// F37
	it("deletes the income once the delete is confirmed", async () => {
		const wrapper = mount(IncomeSheet, {
			props: {
				income: { name: "INC-1", amount: 200, date: "2025-06-10", source: "SRC-1" },
			},
		});
		await wrapper.find('[data-test="income-delete-button"]').trigger("click");
		await wrapper.find('[data-test="income-confirm-delete-button"]').trigger("click");
		await flushPromises();

		expect(deleteIncome).toHaveBeenCalledWith("INC-1");
		expect(wrapper.emitted("close")).toBeTruthy();
	});

	it("closes without saving when the backdrop is clicked", async () => {
		const wrapper = mount(IncomeSheet);
		await amountInput(wrapper).setValue("100");
		await wrapper.find('[data-test="income-sheet-backdrop"]').trigger("click");

		expect(wrapper.emitted("close")).toBeTruthy();
		expect(createIncome).not.toHaveBeenCalled();
	});
});
