import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useMonthStore } from "@/stores/month";

beforeEach(() => {
	setActivePinia(createPinia());
});

describe("month store", () => {
	// U6
	it("prevMonth from Jan 2025 becomes Dec 2024", () => {
		const store = useMonthStore();
		store.month = 1;
		store.year = 2025;
		store.prevMonth();
		expect(store.month).toBe(12);
		expect(store.year).toBe(2024);
	});

	// U7
	it("nextMonth from Dec 2024 becomes Jan 2025", () => {
		const store = useMonthStore();
		store.month = 12;
		store.year = 2024;
		store.nextMonth();
		expect(store.month).toBe(1);
		expect(store.year).toBe(2025);
	});
});
