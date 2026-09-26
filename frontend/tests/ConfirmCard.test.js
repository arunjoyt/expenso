import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ConfirmCard from "@/components/ConfirmCard.vue";

// Stock LangChain human-in-the-loop `action_requests` (ADR 0010).
const REQUESTS = [
	{
		name: "update_expense",
		args: { name: "EXP-17", amount: 6, notes: "oat milk" },
		description:
			"Edit expense 4.5 · Dining · 2026-03-14 — amount: 4.5 → 6; notes: None → oat milk",
	},
	{
		name: "create_expense",
		args: { amount: 12, category: "Groceries", notes: null },
		description: "New expense: 12, Groceries",
	},
	{
		name: "delete_expense",
		args: { name: "EXP-18" },
		description: "Delete expense 3 · Dining · 2026-03-12",
	},
];

function mountCard(props = {}) {
	return mount(ConfirmCard, { props: { requests: REQUESTS, ...props } });
}

function inputsOf(row) {
	return row.findAll('[data-test="confirm-value-input"]');
}

describe("ConfirmCard", () => {
	// F131
	it("renders a row per request with its description", () => {
		const wrapper = mountCard();
		const rows = wrapper.findAll('[data-test="confirm-action"]');
		expect(rows.length).toBe(3);
		const descriptions = wrapper.findAll('[data-test="confirm-description"]');
		expect(descriptions[0].text()).toContain("amount: 4.5 → 6");
		expect(descriptions[2].text()).toBe("Delete expense 3 · Dining · 2026-03-12");
	});

	// F131/F142 — every write's args are editable, never the row id
	it("shows editable args per row, hiding the row id", () => {
		const rows = mountCard().findAll('[data-test="confirm-action"]');
		expect(inputsOf(rows[0]).map((i) => i.attributes("data-field"))).toEqual([
			"amount",
			"notes",
		]);
		expect(inputsOf(rows[1]).map((i) => i.attributes("data-field"))).toEqual([
			"amount",
			"category",
			"notes",
		]);
		expect(inputsOf(rows[2])).toHaveLength(0); // a delete has only the row id
		expect(inputsOf(rows[1])[0].element.value).toBe("12");
	});

	// F131
	it("has a checkbox per request, all checked, plus Confirm and Cancel", () => {
		const wrapper = mountCard();
		const boxes = wrapper.findAll('[data-test="confirm-action-checkbox"]');
		expect(boxes.length).toBe(3);
		expect(boxes.every((b) => b.element.checked)).toBe(true);
		expect(wrapper.find('[data-test="confirm-apply"]').text()).toBe("Confirm all");
		expect(wrapper.find('[data-test="confirm-cancel"]').exists()).toBe(true);
	});

	// F132
	it("Confirm emits one decision per request; an unchecked row rejects", async () => {
		const wrapper = mountCard();
		await wrapper.findAll('[data-test="confirm-action-checkbox"]')[1].setValue(false);
		expect(wrapper.find('[data-test="confirm-apply"]').text()).toBe("Confirm 2");
		await wrapper.find('[data-test="confirm-apply"]').trigger("click");
		expect(wrapper.emitted("confirm")[0]).toEqual([
			[{ type: "approve" }, { type: "reject" }, { type: "approve" }],
		]);
	});

	// F142/F143
	it("an edited field sends an edit decision with the full args", async () => {
		const wrapper = mountCard();
		const createRow = wrapper.findAll('[data-test="confirm-action"]')[1];
		await inputsOf(createRow)[0].setValue("15");
		await wrapper.find('[data-test="confirm-apply"]').trigger("click");
		const [decisions] = wrapper.emitted("confirm")[0];
		expect(decisions[1]).toEqual({
			type: "edit",
			edited_action: {
				name: "create_expense",
				args: { amount: 15, category: "Groceries", notes: null },
			},
		});
		expect(decisions[0]).toEqual({ type: "approve" }); // untouched rows approve
	});

	// F132
	it("Cancel emits cancel", async () => {
		const wrapper = mountCard();
		await wrapper.find('[data-test="confirm-cancel"]').trigger("click");
		expect(wrapper.emitted("cancel")).toHaveLength(1);
	});

	// F131 — read-only once resume is running
	it("disables the controls while pending", () => {
		const wrapper = mountCard({ pending: true });
		expect(
			wrapper.find('[data-test="confirm-action-checkbox"]').attributes("disabled")
		).toBeDefined();
		expect(wrapper.find('[data-test="confirm-cancel"]').attributes("disabled")).toBeDefined();
		expect(
			wrapper.find('[data-test="confirm-value-input"]').attributes("disabled")
		).toBeDefined();
	});
});
