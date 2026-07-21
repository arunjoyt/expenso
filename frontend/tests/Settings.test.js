import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import Settings from "@/pages/Settings.vue";
import { createAppRouter } from "@/router";

vi.mock("@/composables/useCategories", () => ({
	useCategories: vi.fn(),
	addCategory: vi.fn(),
	renameCategory: vi.fn(),
	deleteCategory: vi.fn(),
}));
vi.mock("@/composables/useSources", () => ({
	useSources: vi.fn(),
	addSource: vi.fn(),
	renameSource: vi.fn(),
	deleteSource: vi.fn(),
}));
vi.mock("frappe-ui", async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, call: vi.fn() };
});

import { call } from "frappe-ui";
import { session } from "@/data/session";
import {
	addCategory,
	deleteCategory,
	renameCategory,
	useCategories,
} from "@/composables/useCategories";
import { addSource, deleteSource, renameSource, useSources } from "@/composables/useSources";

function mockCategories(categories, reload = vi.fn()) {
	useCategories.mockReturnValue({
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
	deleteCategory.mockResolvedValue();
	addSource.mockResolvedValue({ name: "SRC-2" });
	renameSource.mockResolvedValue({});
	deleteSource.mockResolvedValue();
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
		useCategories.mockReturnValue({ categories: categoriesRef, loading: ref(false), reload });

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
		useCategories.mockReturnValue({ categories: categoriesRef, loading: ref(false), reload });

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

	// F82
	it("shows a delete button on Category rows", () => {
		mockCategories([{ name: "CAT-1", category_name: "Groceries" }]);
		const wrapper = mount(Settings);
		expect(wrapper.find('[data-test="category-delete-button"]').exists()).toBe(true);
	});

	// F83
	it("shows a confirmation prompt on Category delete button click", async () => {
		mockCategories([{ name: "CAT-1", category_name: "Groceries" }]);
		const wrapper = mount(Settings);
		expect(wrapper.find('[data-test="category-confirm-delete-button"]').exists()).toBe(false);

		await wrapper.find('[data-test="category-delete-button"]').trigger("click");

		expect(wrapper.find('[data-test="category-confirm-delete-button"]').exists()).toBe(true);
		expect(deleteCategory).not.toHaveBeenCalled();
	});

	// F84
	it("dismisses the Category delete confirmation on Cancel without deleting", async () => {
		mockCategories([{ name: "CAT-1", category_name: "Groceries" }]);
		const wrapper = mount(Settings);
		await wrapper.find('[data-test="category-delete-button"]').trigger("click");

		await wrapper.find('[data-test="category-cancel-delete-button"]').trigger("click");

		expect(wrapper.find('[data-test="category-confirm-delete-button"]').exists()).toBe(false);
		expect(deleteCategory).not.toHaveBeenCalled();
	});

	// F85
	it("deletes the Category and reloads the list once the delete is confirmed", async () => {
		const categoriesRef = ref([{ name: "CAT-1", category_name: "Groceries" }]);
		const reload = vi.fn(() => {
			categoriesRef.value = [];
		});
		useCategories.mockReturnValue({ categories: categoriesRef, loading: ref(false), reload });

		const wrapper = mount(Settings);
		await wrapper.find('[data-test="category-delete-button"]').trigger("click");
		await wrapper.find('[data-test="category-confirm-delete-button"]').trigger("click");
		await flushPromises();

		expect(deleteCategory).toHaveBeenCalledWith("CAT-1");
		expect(reload).toHaveBeenCalled();
		expect(wrapper.text()).not.toContain("Groceries");
	});

	// F86
	it("shows an error and keeps the Category when delete is blocked", async () => {
		deleteCategory.mockRejectedValue({
			messages: ["Cannot delete: Category is linked with Expense"],
		});
		mockCategories([{ name: "CAT-1", category_name: "Groceries" }]);
		const wrapper = mount(Settings);
		await wrapper.find('[data-test="category-delete-button"]').trigger("click");
		await wrapper.find('[data-test="category-confirm-delete-button"]').trigger("click");
		await flushPromises();

		expect(wrapper.text()).toContain("Cannot delete: Category is linked with Expense");
		expect(wrapper.text()).toContain("Groceries");
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

	// F87
	it("shows a delete button on Source rows", () => {
		mockCategories([]);
		mockSources([{ name: "SRC-1", source_name: "Salary" }]);
		const wrapper = mount(Settings);
		expect(wrapper.find('[data-test="source-delete-button"]').exists()).toBe(true);
	});

	// F88
	it("shows a confirmation prompt on Source delete button click", async () => {
		mockCategories([]);
		mockSources([{ name: "SRC-1", source_name: "Salary" }]);
		const wrapper = mount(Settings);
		expect(wrapper.find('[data-test="source-confirm-delete-button"]').exists()).toBe(false);

		await wrapper.find('[data-test="source-delete-button"]').trigger("click");

		expect(wrapper.find('[data-test="source-confirm-delete-button"]').exists()).toBe(true);
		expect(deleteSource).not.toHaveBeenCalled();
	});

	// F89
	it("dismisses the Source delete confirmation on Cancel without deleting", async () => {
		mockCategories([]);
		mockSources([{ name: "SRC-1", source_name: "Salary" }]);
		const wrapper = mount(Settings);
		await wrapper.find('[data-test="source-delete-button"]').trigger("click");

		await wrapper.find('[data-test="source-cancel-delete-button"]').trigger("click");

		expect(wrapper.find('[data-test="source-confirm-delete-button"]').exists()).toBe(false);
		expect(deleteSource).not.toHaveBeenCalled();
	});

	// F90
	it("deletes the Source and reloads the list once the delete is confirmed", async () => {
		mockCategories([]);
		const sourcesRef = ref([{ name: "SRC-1", source_name: "Salary" }]);
		const reload = vi.fn(() => {
			sourcesRef.value = [];
		});
		useSources.mockReturnValue({ sources: sourcesRef, loading: ref(false), reload });

		const wrapper = mount(Settings);
		await wrapper.find('[data-test="source-delete-button"]').trigger("click");
		await wrapper.find('[data-test="source-confirm-delete-button"]').trigger("click");
		await flushPromises();

		expect(deleteSource).toHaveBeenCalledWith("SRC-1");
		expect(reload).toHaveBeenCalled();
		expect(wrapper.text()).not.toContain("Salary");
	});

	// F91
	it("shows an error and keeps the Source when delete is blocked", async () => {
		mockCategories([]);
		deleteSource.mockRejectedValue({
			messages: ["Cannot delete: Source is linked with Income"],
		});
		mockSources([{ name: "SRC-1", source_name: "Salary" }]);
		const wrapper = mount(Settings);
		await wrapper.find('[data-test="source-delete-button"]').trigger("click");
		await wrapper.find('[data-test="source-confirm-delete-button"]').trigger("click");
		await flushPromises();

		expect(wrapper.text()).toContain("Cannot delete: Source is linked with Income");
		expect(wrapper.text()).toContain("Salary");
	});

	// F66
	it("does not show a budget button on Category rows", () => {
		mockCategories([{ name: "CAT-1", category_name: "Groceries" }]);
		const wrapper = mount(Settings);
		expect(wrapper.find('[data-test="budget-open-button"]').exists()).toBe(false);
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
