import { describe, it, expect } from "vitest";
import { parseAmount, sanitizeAmountInput } from "@/utils/parseAmount";

describe("parseAmount", () => {
	// U35
	it("parses a period-decimal amount", () => {
		expect(parseAmount("12.50")).toBe(12.5);
	});

	// U35
	it("parses a comma-decimal amount", () => {
		expect(parseAmount("12,50")).toBe(12.5);
	});

	// U35
	it("parses a plain integer amount", () => {
		expect(parseAmount("25")).toBe(25);
	});

	// U35
	it("returns null for an empty string", () => {
		expect(parseAmount("")).toBeNull();
	});

	// U35
	it("returns null for null/undefined", () => {
		expect(parseAmount(null)).toBeNull();
		expect(parseAmount(undefined)).toBeNull();
	});
});

describe("sanitizeAmountInput", () => {
	// U35
	it("keeps digits, periods, and commas", () => {
		expect(sanitizeAmountInput("12,50")).toBe("12,50");
		expect(sanitizeAmountInput("12.50")).toBe("12.50");
	});

	// U35
	it("strips letters and other characters", () => {
		expect(sanitizeAmountInput("12,50a€ 3")).toBe("12,503");
	});
});
