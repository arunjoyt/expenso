import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import Settings from "@/pages/Settings.vue";

vi.mock("@/composables/useCategories", () => ({
	useCategories: vi.fn(),
	addCategory: vi.fn(),
	renameCategory: vi.fn(),
}));
vi.mock("frappe-ui", async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, call: vi.fn() };
});

import { call } from "frappe-ui";
import { addCategory, renameCategory, useCategories } from "@/composables/useCategories";

function mockCategories(categories, reload = vi.fn()) {
	useCategories.mockReturnValue({
		categories: ref(categories),
		loading: ref(false),
		reload,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	call.mockResolvedValue("0.0.9");
	addCategory.mockResolvedValue({ name: "CAT-2" });
	renameCategory.mockResolvedValue({});
});

describe("Settings page", () => {
	// F24
	it("lists all Categories for the Family", () => {
		mockCategories([
			{ name: "CAT-1", category_name: "Groceries" },
			{ name: "CAT-2", category_name: "Dining" },
		]);
		const wrapper = mount(Settings);
		expect(wrapper.text()).toContain("Groceries");
		expect(wrapper.text()).toContain("Dining");
	});

	// F25
	it("shows the new Category in the list after the add form is submitted", async () => {
		const reload = vi.fn(() => {
			categoriesRef.value = [{ name: "CAT-1", category_name: "Travel" }];
		});
		const categoriesRef = ref([]);
		useCategories.mockReturnValue({ categories: categoriesRef, loading: ref(false), reload });

		const wrapper = mount(Settings);
		await wrapper.find('[data-test="add-category-input"]').setValue("Travel");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(addCategory).toHaveBeenCalledWith("Travel");
		expect(wrapper.text()).toContain("Travel");
	});

	// F26
	it("shows an input on tapping a Category name and saves the rename on blur", async () => {
		const categoriesRef = ref([{ name: "CAT-1", category_name: "Groceries" }]);
		const reload = vi.fn(() => {
			categoriesRef.value = [{ name: "CAT-1", category_name: "Groceries & Household" }];
		});
		useCategories.mockReturnValue({ categories: categoriesRef, loading: ref(false), reload });

		const wrapper = mount(Settings);
		expect(wrapper.find('[data-test="rename-input"]').exists()).toBe(false);

		await wrapper.find('[data-test="category-name"]').trigger("click");
		expect(wrapper.find('[data-test="rename-input"]').exists()).toBe(true);

		const input = wrapper.find('[data-test="rename-input"]');
		await input.setValue("Groceries & Household");
		await input.trigger("blur");
		await flushPromises();

		expect(renameCategory).toHaveBeenCalledWith("CAT-1", "Groceries & Household");
		expect(wrapper.text()).toContain("Groceries & Household");
	});

	// F27
	it("shows the app version in the footer from the API", async () => {
		mockCategories([]);
		call.mockResolvedValue("1.2.3");
		const wrapper = mount(Settings);
		await flushPromises();
		expect(wrapper.find('[data-test="app-version"]').text()).toContain("1.2.3");
	});
});
