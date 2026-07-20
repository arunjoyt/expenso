import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import Settings from "@/pages/Settings.vue";
import { createAppRouter } from "@/router";

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
import { session } from "@/data/session";
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
	session.user = "administrator";
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
	it("opens a RenameSheet on tapping a Category name and saves the rename on submit", async () => {
		const categoriesRef = ref([{ name: "CAT-1", category_name: "Groceries" }]);
		const reload = vi.fn(() => {
			categoriesRef.value = [{ name: "CAT-1", category_name: "Groceries & Household" }];
		});
		useBudgets.mockReturnValue({ categories: categoriesRef, loading: ref(false), reload });

		const wrapper = mount(Settings);
		expect(wrapper.find('[data-test="rename-sheet"]').exists()).toBe(false);

		await wrapper.find('[data-test="category-name"]').trigger("click");
		expect(wrapper.find('[data-test="rename-sheet"]').exists()).toBe(true);

		const input = wrapper.find('[data-test="rename-sheet-input"]');
		await input.setValue("Groceries & Household");
		await wrapper.find('[data-test="rename-sheet"] form').trigger("submit.prevent");
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
	it("opens a RenameSheet on tapping a Source name and saves the rename on submit", async () => {
		mockCategories([]);
		const sourcesRef = ref([{ name: "SRC-1", source_name: "Salary" }]);
		const reload = vi.fn(() => {
			sourcesRef.value = [{ name: "SRC-1", source_name: "Monthly Salary" }];
		});
		useSources.mockReturnValue({ sources: sourcesRef, loading: ref(false), reload });

		const wrapper = mount(Settings);
		expect(wrapper.find('[data-test="rename-sheet"]').exists()).toBe(false);

		await wrapper.find('[data-test="source-name"]').trigger("click");
		expect(wrapper.find('[data-test="rename-sheet"]').exists()).toBe(true);

		const input = wrapper.find('[data-test="rename-sheet-input"]');
		await input.setValue("Monthly Salary");
		await wrapper.find('[data-test="rename-sheet"] form').trigger("submit.prevent");
		await flushPromises();

		expect(renameSource).toHaveBeenCalledWith("SRC-1", "Monthly Salary");
		expect(wrapper.text()).toContain("Monthly Salary");
	});

	// F41
	it("shows a budget button next to each Category", () => {
		mockCategories([
			{ name: "CAT-1", category_name: "Groceries", budget_amount: null },
			{ name: "CAT-2", category_name: "Dining", budget_amount: null },
		]);
		const wrapper = mount(Settings);
		expect(wrapper.findAll('[data-test="budget-open-button"]')).toHaveLength(2);
	});

	// F52
	it('shows "Set Budget" on the button when the Category has no Budget', () => {
		mockCategories([{ name: "CAT-1", category_name: "Groceries", budget_amount: null }]);
		const wrapper = mount(Settings);
		expect(wrapper.find('[data-test="budget-open-button"]').text()).toBe("Set Budget");
	});

	// F53
	it("shows the Budget amount on the button when the Category has a Budget", () => {
		mockCategories([{ name: "CAT-1", category_name: "Groceries", budget_amount: 500 }]);
		const wrapper = mount(Settings);
		expect(wrapper.find('[data-test="budget-open-button"]').text()).toBe(
			new Intl.NumberFormat().format(500)
		);
	});

	// F42
	it("opens the BudgetSheet for a Category when its budget button is clicked", async () => {
		mockCategories([{ name: "CAT-1", category_name: "Groceries", budget_amount: null }]);
		const wrapper = mount(Settings);
		expect(wrapper.find('[data-test="budget-sheet"]').exists()).toBe(false);

		await wrapper.find('[data-test="budget-open-button"]').trigger("click");
		expect(wrapper.find('[data-test="budget-sheet"]').exists()).toBe(true);
	});

	// F54
	it("reloads Categories after the BudgetSheet closes", async () => {
		const reload = vi.fn();
		mockCategories(
			[{ name: "CAT-1", category_name: "Groceries", budget_amount: null }],
			reload
		);
		const wrapper = mount(Settings);

		await wrapper.find('[data-test="budget-open-button"]').trigger("click");
		await wrapper.find('[data-test="budget-sheet-backdrop"]').trigger("click");

		expect(wrapper.find('[data-test="budget-sheet"]').exists()).toBe(false);
		expect(reload).toHaveBeenCalled();
	});

	it("logs out and navigates to Login when Log out is clicked", async () => {
		mockCategories([]);
		const router = createAppRouter();
		await router.push("/settings");
		const wrapper = mount(Settings, { global: { plugins: [router] } });

		await wrapper.find('[data-test="logout-button"]').trigger("click");
		await flushPromises();

		expect(session.user).toBeNull();
		// router.replace() resolves the lazy Login.vue import asynchronously,
		// so poll instead of guessing how long that import takes.
		await vi.waitFor(() => {
			expect(router.currentRoute.value.name).toBe("Login");
		});
	});
});
