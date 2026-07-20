import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import RenameSheet from "@/components/RenameSheet.vue";

function inputEl(wrapper) {
	return wrapper.find('[data-test="rename-sheet-input"]');
}

function mountSheet(overrides = {}) {
	return mount(RenameSheet, {
		props: {
			title: "✏️ Rename Category",
			initialValue: "Groceries",
			renameFn: vi.fn().mockResolvedValue({}),
			...overrides,
		},
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("RenameSheet", () => {
	it("shows the given title", () => {
		const wrapper = mountSheet({ title: "✏️ Rename Source" });
		expect(wrapper.text()).toContain("Rename Source");
	});

	it("pre-fills the input with the initial value", () => {
		const wrapper = mountSheet({ initialValue: "Dining" });
		expect(inputEl(wrapper).element.value).toBe("Dining");
	});

	it("calls renameFn with the new value on submit and closes", async () => {
		const renameFn = vi.fn().mockResolvedValue({});
		const wrapper = mountSheet({ initialValue: "Groceries", renameFn });

		await inputEl(wrapper).setValue("Groceries & Household");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(renameFn).toHaveBeenCalledWith("Groceries & Household");
		expect(wrapper.emitted("close")).toBeTruthy();
	});

	it("does not call renameFn when the value is unchanged, but still closes", async () => {
		const renameFn = vi.fn().mockResolvedValue({});
		const wrapper = mountSheet({ initialValue: "Groceries", renameFn });

		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(renameFn).not.toHaveBeenCalled();
		expect(wrapper.emitted("close")).toBeTruthy();
	});

	it("disables the save button when the input is cleared", async () => {
		const wrapper = mountSheet();
		await inputEl(wrapper).setValue("");
		expect(wrapper.find('[data-test="rename-sheet-save-button"]').attributes("disabled")).toBeDefined();
	});

	it("closes without saving when the backdrop is clicked", async () => {
		const renameFn = vi.fn().mockResolvedValue({});
		const wrapper = mountSheet({ renameFn });

		await inputEl(wrapper).setValue("Something else");
		await wrapper.find('[data-test="rename-sheet-backdrop"]').trigger("click");

		expect(wrapper.emitted("close")).toBeTruthy();
		expect(renameFn).not.toHaveBeenCalled();
	});
});
