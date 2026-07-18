import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import Analytics from "@/pages/Analytics.vue";

vi.mock("@/composables/useAnalytics", () => ({
	useAnalytics: vi.fn(),
}));

import { useAnalytics } from "@/composables/useAnalytics";

function mockAnalytics(total, categories, loading = false) {
	useAnalytics.mockReturnValue({
		total: ref(total),
		categories: ref(categories),
		loading: ref(loading),
		reload: vi.fn(),
	});
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe("Analytics page", () => {
	// F21
	it("shows the monthly total", () => {
		mockAnalytics(50, []);
		const wrapper = mount(Analytics);
		expect(wrapper.find('[data-test="monthly-total"]').text()).toBe(
			new Intl.NumberFormat().format(50)
		);
	});

	// F22
	it("shows a category row with name and amount for each category", () => {
		mockAnalytics(50, [
			{ name: "Groceries", amount: 30 },
			{ name: "Dining", amount: 20 },
		]);
		const wrapper = mount(Analytics);
		const rows = wrapper.findAll('[data-test="category-row"]');
		expect(rows).toHaveLength(2);
		expect(rows[0].text()).toContain("Groceries");
		expect(rows[0].text()).toContain(new Intl.NumberFormat().format(30));
		expect(rows[1].text()).toContain("Dining");
		expect(rows[1].text()).toContain(new Intl.NumberFormat().format(20));
	});

	// F23
	it("shows an Uncategorized row when expenses have no category", () => {
		mockAnalytics(15, [{ name: "Uncategorized", amount: 15 }]);
		const wrapper = mount(Analytics);
		expect(wrapper.text()).toContain("Uncategorized");
	});
});
