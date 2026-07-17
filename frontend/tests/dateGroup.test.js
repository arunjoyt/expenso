import { describe, it, expect } from "vitest";
import { dateGroupLabel } from "@/utils/dateGroup";

const REFERENCE = new Date(2025, 5, 15); // Jun 15, 2025

describe("dateGroupLabel", () => {
	// U3
	it("labels today's date as Today", () => {
		expect(dateGroupLabel("2025-06-15", REFERENCE)).toBe("Today");
	});

	// U4
	it("labels yesterday's date as Yesterday", () => {
		expect(dateGroupLabel("2025-06-14", REFERENCE)).toBe("Yesterday");
	});

	// U5
	it("labels an older date as e.g. Jun 12", () => {
		expect(dateGroupLabel("2025-06-12", REFERENCE)).toBe("Jun 12");
	});
});
