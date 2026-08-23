import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import IncomeSheet from "@/components/IncomeSheet.vue";

vi.mock("@/composables/useSources", () => ({
	useSources: vi.fn(),
	addSource: vi.fn(),
}));
vi.mock("@/composables/useIncome", () => ({
	createIncome: vi.fn(),
	updateIncome: vi.fn(),
	deleteIncome: vi.fn(),
}));

import { useSources, addSource } from "@/composables/useSources";
import { createIncome, updateIncome, deleteIncome } from "@/composables/useIncome";

let reloadSources;
let sourcesRef;

beforeEach(() => {
	vi.clearAllMocks();
	sourcesRef = ref([{ name: "SRC-1", source_name: "Salary" }]);
	reloadSources = vi.fn(async () => {
		sourcesRef.value = [...sourcesRef.value, { name: "SRC-NEW", source_name: "Dividends" }];
	});
	useSources.mockReturnValue({
		sources: sourcesRef,
		loading: ref(false),
		reload: reloadSources,
	});
	createIncome.mockResolvedValue({ name: "INC-NEW" });
	updateIncome.mockResolvedValue({ name: "INC-1" });
	deleteIncome.mockResolvedValue();
	addSource.mockResolvedValue({ name: "SRC-NEW" });
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
			expect.objectContaining({ amount: 100, source: null, notes: null })
		);
		expect(wrapper.emitted("close")).toBeTruthy();
	});

	// F138
	it("accepts a comma as the decimal separator in the amount field", async () => {
		const wrapper = mount(IncomeSheet);
		await amountInput(wrapper).setValue("12,50");
		expect(
			wrapper.find('[data-test="income-submit-button"]').attributes("disabled")
		).toBeUndefined();
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(createIncome).toHaveBeenCalledWith(expect.objectContaining({ amount: 12.5 }));
	});

	it("submits an add with notes", async () => {
		const wrapper = mount(IncomeSheet);
		await amountInput(wrapper).setValue("100");
		await wrapper.find('[data-test="income-notes-input"]').setValue("Year-end bonus");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(createIncome).toHaveBeenCalledWith(
			expect.objectContaining({ amount: 100, notes: "Year-end bonus" })
		);
	});

	it("pre-fills fields in edit mode and submits an update", async () => {
		const wrapper = mount(IncomeSheet, {
			props: {
				income: {
					name: "INC-1",
					amount: 200,
					date: "2025-06-10",
					source: "SRC-1",
					notes: "Year-end bonus",
				},
			},
		});
		expect(amountInput(wrapper).element.value).toBe("200");
		expect(wrapper.find('[data-test="income-notes-input"]').element.value).toBe(
			"Year-end bonus"
		);
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

	// F79
	it("shows Expense / Income tabs in add mode and emits switch-mode with 'expense' on Expense tab click", async () => {
		const wrapper = mount(IncomeSheet);
		expect(wrapper.find('[data-test="add-entry-tabs"]').exists()).toBe(true);
		await wrapper.find('[data-test="tab-expense"]').trigger("click");
		expect(wrapper.emitted("switch-mode")).toEqual([["expense"]]);
	});

	// F98
	it("reveals an inline name input when '+ New source' is selected", async () => {
		const wrapper = mount(IncomeSheet);
		expect(wrapper.find('[data-test="new-source-inline"]').exists()).toBe(false);
		await wrapper.find('[data-test="income-source-select"]').setValue("__new_source__");
		expect(wrapper.find('[data-test="new-source-inline"]').exists()).toBe(true);
	});

	// F99
	it("creates and selects a new source without leaving the sheet", async () => {
		const wrapper = mount(IncomeSheet);
		await wrapper.find('[data-test="income-source-select"]').setValue("__new_source__");
		await wrapper.find('[data-test="new-source-input"]').setValue("Dividends");
		await wrapper.find('[data-test="new-source-create-button"]').trigger("click");
		await flushPromises();

		expect(addSource).toHaveBeenCalledWith("Dividends");
		expect(reloadSources).toHaveBeenCalled();
		expect(wrapper.find('[data-test="new-source-inline"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="income-source-select"]').element.value).toBe("SRC-NEW");
	});

	// F100
	it("cancels inline source creation and resets the source select", async () => {
		const wrapper = mount(IncomeSheet);
		await wrapper.find('[data-test="income-source-select"]').setValue("__new_source__");
		await wrapper.find('[data-test="new-source-cancel-button"]').trigger("click");

		expect(wrapper.find('[data-test="new-source-inline"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="income-source-select"]').element.value).toBe("");
		expect(addSource).not.toHaveBeenCalled();
	});

	it("hides the tabs in edit mode", () => {
		const wrapper = mount(IncomeSheet, {
			props: {
				income: { name: "INC-1", amount: 200, date: "2025-06-10", source: "SRC-1" },
			},
		});
		expect(wrapper.find('[data-test="add-entry-tabs"]').exists()).toBe(false);
	});

	// F142
	it("shows the unreviewed-external-write marker and verbatim message for a chat-created Income", () => {
		const wrapper = mount(IncomeSheet, {
			props: {
				income: {
					name: "INC-1",
					amount: 200,
					date: "2025-06-10",
					is_external_write: 1,
					external_write_message: "got paid $200",
				},
			},
		});
		expect(wrapper.find('[data-test="external-write-marker"]').exists()).toBe(true);
		expect(wrapper.find('[data-test="external-write-message"]').text()).toContain(
			"got paid $200"
		);
	});

	// F143
	it("shows no marker or message for a normally-created Income", () => {
		const wrapper = mount(IncomeSheet, {
			props: {
				income: { name: "INC-1", amount: 200, date: "2025-06-10", source: "SRC-1" },
			},
		});
		expect(wrapper.find('[data-test="external-write-marker"]').exists()).toBe(false);
	});
});
