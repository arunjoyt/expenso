import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createAppRouter } from "@/router";
import { useMonthStore } from "@/stores/month";
import Feed from "@/pages/Feed.vue";
import ExpenseSheet from "@/components/ExpenseSheet.vue";
import IncomeSheet from "@/components/IncomeSheet.vue";

vi.mock("@/composables/useExpenses", () => ({
	useExpenses: vi.fn(),
	createExpense: vi.fn(),
	updateExpense: vi.fn(),
	deleteExpense: vi.fn(),
}));
vi.mock("@/composables/useCategories", () => ({
	useCategories: vi.fn(() => ({
		categories: ref([]),
		loading: ref(false),
		reload: vi.fn(),
	})),
}));
vi.mock("@/composables/useFamily", () => ({
	useFamily: vi.fn(() => ({
		familyName: ref(""),
		loading: ref(false),
		reload: vi.fn(),
	})),
}));
vi.mock("@/composables/useSources", () => ({
	useSources: vi.fn(() => ({
		sources: ref([]),
		loading: ref(false),
		reload: vi.fn(),
	})),
}));
vi.mock("@/composables/useIncome", () => ({
	createIncome: vi.fn(),
	updateIncome: vi.fn(),
	deleteIncome: vi.fn(),
}));

import { useExpenses } from "@/composables/useExpenses";
import { useFamily } from "@/composables/useFamily";

function mockExpenses(expenses, loading = false) {
	const reload = vi.fn();
	useExpenses.mockReturnValue({
		expenses: ref(expenses),
		loading: ref(loading),
		reload,
	});
	return reload;
}

function mountFeed() {
	const router = createAppRouter();
	return mount(Feed, { global: { plugins: [router] } });
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe("Feed page", () => {
	// F6
	it("renders Expense rows grouped under date headers", () => {
		mockExpenses([
			{ name: "EXP-1", amount: 10, date: "2025-06-15", category_name: "Groceries" },
			{ name: "EXP-2", amount: 20, date: "2025-06-12", category_name: "Dining" },
		]);
		const wrapper = mountFeed();
		expect(wrapper.text()).toContain("Groceries");
		expect(wrapper.text()).toContain("Dining");
		// Two distinct date groups means two group headers rendered.
		expect(wrapper.findAll('[data-test="date-group-header"]').length).toBe(2);
	});

	// F7
	it("shows the month label from the store in the header", () => {
		const monthStore = useMonthStore();
		monthStore.month = 6;
		monthStore.year = 2025;
		mockExpenses([]);
		const wrapper = mountFeed();
		expect(wrapper.find("h1").text()).toBe("June 2025");
	});

	it("shows the app name and the family name in the header", () => {
		useFamily.mockReturnValue({
			familyName: ref("The Testers"),
			loading: ref(false),
			reload: vi.fn(),
		});
		mockExpenses([]);
		const wrapper = mountFeed();
		expect(wrapper.text()).toContain("Expenso");
		expect(wrapper.text()).toContain("The Testers");
	});

	// F8
	it("decrements the month store on prev month click", async () => {
		const monthStore = useMonthStore();
		monthStore.month = 6;
		monthStore.year = 2025;
		mockExpenses([]);
		const wrapper = mountFeed();
		await wrapper.find('[aria-label="Previous month"]').trigger("click");
		expect(monthStore.month).toBe(5);
	});

	// F9
	it("increments the month store on next month click", async () => {
		const monthStore = useMonthStore();
		monthStore.month = 6;
		monthStore.year = 2025;
		mockExpenses([]);
		const wrapper = mountFeed();
		await wrapper.find('[aria-label="Next month"]').trigger("click");
		expect(monthStore.month).toBe(7);
	});

	// F10
	it("shows an empty state for a month with no expenses", () => {
		mockExpenses([]);
		const wrapper = mountFeed();
		expect(wrapper.text()).toContain("No expenses this month");
	});

	// F11
	it("shows a monthly total equal to the sum of rendered expenses", () => {
		mockExpenses([
			{ name: "EXP-1", amount: 10, date: "2025-06-15", category_name: "Groceries" },
			{ name: "EXP-2", amount: 20, date: "2025-06-12", category_name: "Dining" },
		]);
		const wrapper = mountFeed();
		expect(wrapper.text()).toContain(new Intl.NumberFormat().format(30));
	});

	// F12
	it("shows the Add Expense / Add Income menu on FAB click", async () => {
		mockExpenses([]);
		const wrapper = mountFeed();
		expect(wrapper.find('[data-test="fab-add-expense"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="fab-add-income"]').exists()).toBe(false);
		await wrapper.find('[data-test="fab"]').trigger("click");
		expect(wrapper.find('[data-test="fab-add-expense"]').exists()).toBe(true);
		expect(wrapper.find('[data-test="fab-add-income"]').exists()).toBe(true);
	});

	// F79
	it("opens the ExpenseSheet in add mode on Add Expense menu click", async () => {
		mockExpenses([]);
		const wrapper = mountFeed();
		await wrapper.find('[data-test="fab"]').trigger("click");
		await wrapper.find('[data-test="fab-add-expense"]').trigger("click");
		expect(wrapper.find('[data-test="expense-sheet"]').exists()).toBe(true);
		expect(wrapper.text()).toContain("Add Expense");
		expect(wrapper.find('[data-test="fab-add-expense"]').exists()).toBe(false);
	});

	// F30
	it("opens the IncomeSheet on Add Income menu click", async () => {
		mockExpenses([]);
		const wrapper = mountFeed();
		expect(wrapper.find('[data-test="income-sheet"]').exists()).toBe(false);
		await wrapper.find('[data-test="fab"]').trigger("click");
		await wrapper.find('[data-test="fab-add-income"]').trigger("click");
		expect(wrapper.find('[data-test="income-sheet"]').exists()).toBe(true);
		expect(wrapper.find('[data-test="fab-add-income"]').exists()).toBe(false);
	});

	// F80
	it("closes the FAB menu without opening a sheet when the backdrop is tapped", async () => {
		mockExpenses([]);
		const wrapper = mountFeed();
		await wrapper.find('[data-test="fab"]').trigger("click");
		await wrapper.find('[data-test="fab-menu-backdrop"]').trigger("click");
		expect(wrapper.find('[data-test="fab-add-expense"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="expense-sheet"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="income-sheet"]').exists()).toBe(false);
	});

	it("shows a notes preview under the category when present", () => {
		mockExpenses([
			{
				name: "EXP-1",
				amount: 10,
				date: "2025-06-15",
				category_name: "Groceries",
				notes: "Weekly shop",
			},
			{ name: "EXP-2", amount: 20, date: "2025-06-12", category_name: "Dining" },
		]);
		const wrapper = mountFeed();
		const notes = wrapper.findAll('[data-test="expense-notes"]');
		expect(notes.length).toBe(1);
		expect(notes[0].text()).toBe("Weekly shop");
	});

	// F17
	it("opens the ExpenseSheet in edit mode with fields pre-filled on row tap", async () => {
		mockExpenses([
			{ name: "EXP-1", amount: 10, date: "2025-06-15", category_name: "Groceries" },
		]);
		const wrapper = mountFeed();
		await wrapper.find('[data-test="expense-row"]').trigger("click");
		expect(wrapper.find('[data-test="expense-sheet"]').exists()).toBe(true);
		expect(wrapper.text()).toContain("Edit Expense");
		expect(wrapper.find('[data-test="amount-input"]').element.value).toBe("10");
	});

	// F16
	it("reloads the Expense list once the ExpenseSheet closes after a save", async () => {
		const reload = mockExpenses([]);
		const wrapper = mountFeed();
		await wrapper.find('[data-test="fab"]').trigger("click");
		await wrapper.find('[data-test="fab-add-expense"]').trigger("click");
		reload.mockClear();

		await wrapper.findComponent(ExpenseSheet).vm.$emit("close");

		expect(reload).toHaveBeenCalled();
		expect(wrapper.find('[data-test="expense-sheet"]').exists()).toBe(false);
	});

	// F81
	it("closes the IncomeSheet without reloading Expenses", async () => {
		const reload = mockExpenses([]);
		const wrapper = mountFeed();
		await wrapper.find('[data-test="fab"]').trigger("click");
		await wrapper.find('[data-test="fab-add-income"]').trigger("click");
		reload.mockClear();

		await wrapper.findComponent(IncomeSheet).vm.$emit("close");

		expect(reload).not.toHaveBeenCalled();
		expect(wrapper.find('[data-test="income-sheet"]').exists()).toBe(false);
	});
});
