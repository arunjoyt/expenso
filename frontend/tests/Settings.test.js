import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import Settings from "@/pages/Settings.vue";

vi.mock("@/composables/useCategories", () => ({
	addCategory: vi.fn(),
	renameCategory: vi.fn(),
}));
vi.mock("@/composables/useSources", () => ({
	useSources: vi.fn(),
	addSource: vi.fn(),
	renameSource: vi.fn(),
}));
vi.mock("@/composables/useBudgets", () => ({
	useBudgets: vi.fn(),
	setBudget: vi.fn(),
}));
vi.mock("frappe-ui", async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, call: vi.fn() };
});

import { call } from "frappe-ui";
import { addCategory, renameCategory } from "@/composables/useCategories";
import { addSource, renameSource, useSources } from "@/composables/useSources";
import { setBudget, useBudgets } from "@/composables/useBudgets";

function mockCategories(categories, reload = vi.fn()) {
	useBudgets.mockReturnValue({
		categories: ref(categories),
		loading: ref(false),
		reload,
	});
}

function mockSources(sources, reload = vi.fn()) {
	useSources.mockReturnValue({
		sources: ref(sources),
		loading: ref(false),
		reload,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	call.mockResolvedValue("0.0.9");
	addCategory.mockResolvedValue({ name: "CAT-2" });
	renameCategory.mockResolvedValue({});
	addSource.mockResolvedValue({ name: "SRC-2" });
	renameSource.mockResolvedValue({});
	setBudget.mockResolvedValue({});
	mockSources([]);
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
		useBudgets.mockReturnValue({ categories: categoriesRef, loading: ref(false), reload });

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
		useBudgets.mockReturnValue({ categories: categoriesRef, loading: ref(false), reload });

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

	// F38
	it("lists all Sources for the Family", () => {
		mockCategories([]);
		mockSources([
			{ name: "SRC-1", source_name: "Salary" },
			{ name: "SRC-2", source_name: "Freelance" },
		]);
		const wrapper = mount(Settings);
		expect(wrapper.text()).toContain("Salary");
		expect(wrapper.text()).toContain("Freelance");
	});

	// F39
	it("shows the new Source in the list after the add form is submitted", async () => {
		mockCategories([]);
		const sourcesRef = ref([]);
		const reload = vi.fn(() => {
			sourcesRef.value = [{ name: "SRC-1", source_name: "Bonus" }];
		});
		useSources.mockReturnValue({ sources: sourcesRef, loading: ref(false), reload });

		const wrapper = mount(Settings);
		await wrapper.find('[data-test="add-source-input"]').setValue("Bonus");
		await wrapper.findAll("form")[1].trigger("submit.prevent");
		await flushPromises();

		expect(addSource).toHaveBeenCalledWith("Bonus");
		expect(wrapper.text()).toContain("Bonus");
	});

	// F40
	it("shows an input on tapping a Source name and saves the rename on blur", async () => {
		mockCategories([]);
		const sourcesRef = ref([{ name: "SRC-1", source_name: "Salary" }]);
		const reload = vi.fn(() => {
			sourcesRef.value = [{ name: "SRC-1", source_name: "Monthly Salary" }];
		});
		useSources.mockReturnValue({ sources: sourcesRef, loading: ref(false), reload });

		const wrapper = mount(Settings);
		expect(wrapper.find('[data-test="source-rename-input"]').exists()).toBe(false);

		await wrapper.find('[data-test="source-name"]').trigger("click");
		expect(wrapper.find('[data-test="source-rename-input"]').exists()).toBe(true);

		const input = wrapper.find('[data-test="source-rename-input"]');
		await input.setValue("Monthly Salary");
		await input.trigger("blur");
		await flushPromises();

		expect(renameSource).toHaveBeenCalledWith("SRC-1", "Monthly Salary");
		expect(wrapper.text()).toContain("Monthly Salary");
	});

	// F41
	it("shows a budget amount input next to each Category", () => {
		mockCategories([
			{ name: "CAT-1", category_name: "Groceries", budget_amount: null },
			{ name: "CAT-2", category_name: "Dining", budget_amount: null },
		]);
		const wrapper = mount(Settings);
		expect(wrapper.findAll('[data-test="budget-amount-input"]')).toHaveLength(2);
	});

	// F42
	it("persists the budget amount on save and reflects it in the input", async () => {
		const categoriesRef = ref([
			{ name: "CAT-1", category_name: "Groceries", budget_amount: null },
		]);
		const reload = vi.fn(() => {
			categoriesRef.value = [
				{ name: "CAT-1", category_name: "Groceries", budget_amount: 500 },
			];
		});
		useBudgets.mockReturnValue({ categories: categoriesRef, loading: ref(false), reload });

		const wrapper = mount(Settings);
		const input = wrapper.find('[data-test="budget-amount-input"]');
		await input.setValue("500");
		await input.trigger("blur");
		await flushPromises();

		expect(setBudget).toHaveBeenCalledWith("CAT-1", 500);
		expect(wrapper.find('[data-test="budget-amount-input"]').element.value).toBe("500");
	});

	// F43
	it("removes the budget when the amount is cleared and saved", async () => {
		const categoriesRef = ref([
			{ name: "CAT-1", category_name: "Groceries", budget_amount: 500 },
		]);
		const reload = vi.fn(() => {
			categoriesRef.value = [
				{ name: "CAT-1", category_name: "Groceries", budget_amount: null },
			];
		});
		useBudgets.mockReturnValue({ categories: categoriesRef, loading: ref(false), reload });

		const wrapper = mount(Settings);
		const input = wrapper.find('[data-test="budget-amount-input"]');
		await input.setValue("");
		await input.trigger("blur");
		await flushPromises();

		expect(setBudget).toHaveBeenCalledWith("CAT-1", null);
		expect(wrapper.find('[data-test="budget-amount-input"]').element.value).toBe("");
	});

	// F44
	it("pre-fills the budget input with the existing amount", () => {
		mockCategories([{ name: "CAT-1", category_name: "Groceries", budget_amount: 500 }]);
		const wrapper = mount(Settings);
		expect(wrapper.find('[data-test="budget-amount-input"]').element.value).toBe("500");
	});
});
