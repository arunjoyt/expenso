import { describe, it, expect, beforeEach } from "vitest";
import { useEntrySheet } from "@/composables/useEntrySheet";

// The composable is a module-scope singleton, so reset it between tests.
beforeEach(() => {
	useEntrySheet().close();
	useEntrySheet().switchMode("expense");
});

describe("useEntrySheet", () => {
	// F123
	it("openAdd opens one shared sheet in expense add mode", () => {
		const sheet = useEntrySheet();
		expect(sheet.open.value).toBe(false);
		sheet.openAdd();
		expect(sheet.open.value).toBe(true);
		expect(sheet.mode.value).toBe("expense");
		expect(sheet.editingExpense.value).toBe(null);
	});

	// F123
	it("openEditExpense / openEditIncome load the target into the same sheet", () => {
		const sheet = useEntrySheet();

		sheet.openEditExpense({ name: "EXP-1" });
		expect(sheet.mode.value).toBe("expense");
		expect(sheet.editingExpense.value).toEqual({ name: "EXP-1" });
		expect(sheet.editingIncome.value).toBe(null);

		sheet.openEditIncome({ name: "INC-1" });
		expect(sheet.mode.value).toBe("income");
		expect(sheet.editingIncome.value).toEqual({ name: "INC-1" });
		expect(sheet.editingExpense.value).toBe(null);
	});

	// F123
	it("switchMode flips between Expense and Income without closing", () => {
		const sheet = useEntrySheet();
		sheet.openAdd();
		sheet.switchMode("income");
		expect(sheet.open.value).toBe(true);
		expect(sheet.mode.value).toBe("income");
	});

	// F123
	it("close clears the sheet and its editing targets", () => {
		const sheet = useEntrySheet();
		sheet.openEditExpense({ name: "EXP-1" });
		sheet.close();
		expect(sheet.open.value).toBe(false);
		expect(sheet.editingExpense.value).toBe(null);
	});

	// F123
	it("every caller sees the same state (one singleton)", () => {
		useEntrySheet().openAdd();
		expect(useEntrySheet().open.value).toBe(true);
	});
});
