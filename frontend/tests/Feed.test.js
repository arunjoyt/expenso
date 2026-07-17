import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useMonthStore } from "@/stores/month";
import Feed from "@/pages/Feed.vue";

vi.mock("@/composables/useExpenses", () => ({
	useExpenses: vi.fn(),
}));

import { useExpenses } from "@/composables/useExpenses";

function mockExpenses(expenses, loading = false) {
	useExpenses.mockReturnValue({
		expenses: ref(expenses),
		loading: ref(loading),
		reload: vi.fn(),
	});
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
		const wrapper = mount(Feed);
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
		const wrapper = mount(Feed);
		expect(wrapper.find("h1").text()).toBe("June 2025");
	});

	// F8
	it("decrements the month store on prev month click", async () => {
		const monthStore = useMonthStore();
		monthStore.month = 6;
		monthStore.year = 2025;
		mockExpenses([]);
		const wrapper = mount(Feed);
		await wrapper.find('[aria-label="Previous month"]').trigger("click");
		expect(monthStore.month).toBe(5);
	});

	// F9
	it("increments the month store on next month click", async () => {
		const monthStore = useMonthStore();
		monthStore.month = 6;
		monthStore.year = 2025;
		mockExpenses([]);
		const wrapper = mount(Feed);
		await wrapper.find('[aria-label="Next month"]').trigger("click");
		expect(monthStore.month).toBe(7);
	});

	// F10
	it("shows an empty state for a month with no expenses", () => {
		mockExpenses([]);
		const wrapper = mount(Feed);
		expect(wrapper.text()).toContain("No expenses this month");
	});

	// F11
	it("shows a monthly total equal to the sum of rendered expenses", () => {
		mockExpenses([
			{ name: "EXP-1", amount: 10, date: "2025-06-15", category_name: "Groceries" },
			{ name: "EXP-2", amount: 20, date: "2025-06-12", category_name: "Dining" },
		]);
		const wrapper = mount(Feed);
		expect(wrapper.text()).toContain(new Intl.NumberFormat().format(30));
	});
});
