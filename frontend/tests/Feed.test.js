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
	useIncome: vi.fn(),
	createIncome: vi.fn(),
	updateIncome: vi.fn(),
	deleteIncome: vi.fn(),
}));

import { useExpenses } from "@/composables/useExpenses";
import { useIncome } from "@/composables/useIncome";
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

function mockIncomes(incomes, loading = false) {
	const reload = vi.fn();
	useIncome.mockReturnValue({
		incomes: ref(incomes),
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
	mockIncomes([]);
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
	it("shows an empty state for a month with no Expenses or Income", () => {
		mockExpenses([]);
		const wrapper = mountFeed();
		expect(wrapper.text()).toContain("No activity this month");
	});

	// F101
	it("does not show the empty state when there is Income but no Expenses", () => {
		mockExpenses([]);
		mockIncomes([{ name: "INC-1", amount: 500, date: "2025-06-01", source_name: "Salary" }]);
		const wrapper = mountFeed();
		expect(wrapper.text()).not.toContain("No activity this month");
	});

	// F11
	it("shows an Expense total equal to the sum of rendered Expenses", () => {
		mockExpenses([
			{ name: "EXP-1", amount: 10, date: "2025-06-15", category_name: "Groceries" },
			{ name: "EXP-2", amount: 20, date: "2025-06-12", category_name: "Dining" },
		]);
		const wrapper = mountFeed();
		expect(wrapper.find('[data-test="feed-expense-total"]').text()).toBe(
			new Intl.NumberFormat().format(30)
		);
	});

	// F102
	it("shows an Income total equal to the sum of rendered Income", () => {
		mockExpenses([]);
		mockIncomes([
			{ name: "INC-1", amount: 500, date: "2025-06-01", source_name: "Salary" },
			{ name: "INC-2", amount: 100, date: "2025-06-02", source_name: "Freelance" },
		]);
		const wrapper = mountFeed();
		expect(wrapper.find('[data-test="feed-income-total"]').text()).toBe(
			new Intl.NumberFormat().format(600)
		);
	});

	// F141
	it("shows a Balance total equal to Income minus Expense", () => {
		mockExpenses([
			{ name: "EXP-1", amount: 10, date: "2025-06-15", category_name: "Groceries" },
		]);
		mockIncomes([{ name: "INC-1", amount: 500, date: "2025-06-01", source_name: "Salary" }]);
		const wrapper = mountFeed();
		expect(wrapper.find('[data-test="feed-balance-total"]').text()).toBe(
			new Intl.NumberFormat().format(490)
		);
	});

	// F12
	it("opens the ExpenseSheet directly in add mode on FAB click, defaulting to the Expense tab", async () => {
		mockExpenses([]);
		const wrapper = mountFeed();
		expect(wrapper.find('[data-test="expense-sheet"]').exists()).toBe(false);
		await wrapper.find('[data-test="fab"]').trigger("click");
		expect(wrapper.find('[data-test="expense-sheet"]').exists()).toBe(true);
		expect(wrapper.find('[data-test="income-sheet"]').exists()).toBe(false);
	});

	// F30
	it("switches to the IncomeSheet on the Income tab click, without an extra FAB tap", async () => {
		mockExpenses([]);
		const wrapper = mountFeed();
		await wrapper.find('[data-test="fab"]').trigger("click");
		await wrapper
			.find('[data-test="expense-sheet"] [data-test="tab-income"]')
			.trigger("click");
		expect(wrapper.find('[data-test="income-sheet"]').exists()).toBe(true);
		expect(wrapper.find('[data-test="expense-sheet"]').exists()).toBe(false);
	});

	// F79
	it("switches back to the ExpenseSheet on the Expense tab click", async () => {
		mockExpenses([]);
		const wrapper = mountFeed();
		await wrapper.find('[data-test="fab"]').trigger("click");
		await wrapper
			.find('[data-test="expense-sheet"] [data-test="tab-income"]')
			.trigger("click");
		await wrapper
			.find('[data-test="income-sheet"] [data-test="tab-expense"]')
			.trigger("click");
		expect(wrapper.find('[data-test="expense-sheet"]').exists()).toBe(true);
		expect(wrapper.find('[data-test="income-sheet"]').exists()).toBe(false);
	});

	// F80
	it("does not show tabs when editing an existing Expense", async () => {
		mockExpenses([
			{ name: "EXP-1", amount: 10, date: "2025-06-15", category_name: "Groceries" },
		]);
		const wrapper = mountFeed();
		await wrapper.find('[data-test="expense-row"]').trigger("click");
		expect(wrapper.find('[data-test="add-entry-tabs"]').exists()).toBe(false);
	});

	// F103
	it("shows Notes as the bold primary line and Category as the caption below it", () => {
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
		const rows = wrapper.findAll('[data-test="expense-row"]');
		expect(rows[0].text()).toContain("Weekly shop");
		expect(rows[0].text()).toContain("Groceries");
	});

	// F104
	it("falls back to Category as the primary line when there is no Notes", () => {
		mockExpenses([{ name: "EXP-1", amount: 10, date: "2025-06-15", category_name: "Dining" }]);
		const wrapper = mountFeed();
		expect(wrapper.find('[data-test="expense-notes"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="expense-row"]').text()).toContain("Dining");
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
	it("reloads both lists once the ExpenseSheet closes after a save", async () => {
		const reloadExpenses = mockExpenses([]);
		const reloadIncomes = mockIncomes([]);
		const wrapper = mountFeed();
		await wrapper.find('[data-test="fab"]').trigger("click");
		reloadExpenses.mockClear();
		reloadIncomes.mockClear();

		await wrapper.findComponent(ExpenseSheet).vm.$emit("close");

		expect(reloadExpenses).toHaveBeenCalled();
		expect(reloadIncomes).toHaveBeenCalled();
		expect(wrapper.find('[data-test="expense-sheet"]').exists()).toBe(false);
	});

	// F81 (superseded — Income now appears on Feed, so closing IncomeSheet must refresh it)
	it("reloads both lists once the IncomeSheet closes after a save", async () => {
		const reloadExpenses = mockExpenses([]);
		const reloadIncomes = mockIncomes([]);
		const wrapper = mountFeed();
		await wrapper.find('[data-test="fab"]').trigger("click");
		await wrapper
			.find('[data-test="expense-sheet"] [data-test="tab-income"]')
			.trigger("click");
		reloadExpenses.mockClear();
		reloadIncomes.mockClear();

		await wrapper.findComponent(IncomeSheet).vm.$emit("close");

		expect(reloadExpenses).toHaveBeenCalled();
		expect(reloadIncomes).toHaveBeenCalled();
		expect(wrapper.find('[data-test="income-sheet"]').exists()).toBe(false);
	});

	// F105
	it("renders Income rows with a green, plus-signed amount", () => {
		mockExpenses([]);
		mockIncomes([{ name: "INC-1", amount: 500, date: "2025-06-01", source_name: "Salary" }]);
		const wrapper = mountFeed();
		const row = wrapper.find('[data-test="income-row"]');
		expect(row.exists()).toBe(true);
		expect(row.text()).toContain("Salary");
		expect(row.text()).toContain(`+${new Intl.NumberFormat().format(500)}`);
	});

	// F106
	it("falls back to 'No source' as the primary line for an Income row with no Source or Notes", () => {
		mockExpenses([]);
		mockIncomes([{ name: "INC-1", amount: 500, date: "2025-06-01" }]);
		const wrapper = mountFeed();
		expect(wrapper.find('[data-test="income-row"]').text()).toContain("No source");
	});

	// F107
	it("shows Notes as the primary line on an Income row, Source as the caption", () => {
		mockExpenses([]);
		mockIncomes([
			{
				name: "INC-1",
				amount: 500,
				date: "2025-06-01",
				source_name: "Salary",
				notes: "July payout",
			},
		]);
		const wrapper = mountFeed();
		const notes = wrapper.find('[data-test="income-notes"]');
		expect(notes.exists()).toBe(true);
		expect(notes.text()).toBe("July payout");
		const row = wrapper.find('[data-test="income-row"]');
		expect(row.text()).toContain("Salary");
	});

	// F108
	it("interleaves Expense and Income rows within the same date group, newest first", () => {
		mockExpenses([{ name: "EXP-1", amount: 10, date: "2025-06-10", category_name: "Dining" }]);
		mockIncomes([
			{ name: "INC-1", amount: 500, date: "2025-06-15", source_name: "Salary" },
			{ name: "INC-2", amount: 50, date: "2025-06-05", source_name: "Freelance" },
		]);
		const wrapper = mountFeed();
		const groups = wrapper.findAll('[data-test="date-group-header"]');
		expect(groups.length).toBe(3);

		const rows = wrapper.findAll('[data-test="expense-row"], [data-test="income-row"]');
		expect(rows.map((row) => row.text())).toEqual([
			expect.stringContaining("Salary"),
			expect.stringContaining("Dining"),
			expect.stringContaining("Freelance"),
		]);
	});

	// F109
	it("opens the IncomeSheet in edit mode with fields pre-filled on Income row tap", async () => {
		mockExpenses([]);
		mockIncomes([{ name: "INC-1", amount: 500, date: "2025-06-15", source_name: "Salary" }]);
		const wrapper = mountFeed();
		await wrapper.find('[data-test="income-row"]').trigger("click");
		expect(wrapper.find('[data-test="income-sheet"]').exists()).toBe(true);
		expect(wrapper.text()).toContain("Edit Income");
		expect(wrapper.find('[data-test="income-amount-input"]').element.value).toBe("500");
	});
});
