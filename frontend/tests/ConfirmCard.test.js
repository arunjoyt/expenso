import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ConfirmCard from "@/components/ConfirmCard.vue";

const ACTIONS = [
	{
		id: "a1",
		tool: "update_expense",
		kind: "update",
		entity: "expense",
		summary: "Coffee · Dining · 2026-03-14",
		changes: [
			{ field: "amount", from: 4.5, to: 6 },
			{ field: "notes", from: null, to: "oat milk" },
		],
	},
	{
		id: "a2",
		tool: "create_expense",
		kind: "create",
		entity: "expense",
		summary: "New expense",
		values: { amount: 12, category: "Groceries", notes: null, name: "hidden" },
	},
];

function mountCard(props = {}) {
	return mount(ConfirmCard, { props: { actions: ACTIONS, ...props } });
}

describe("ConfirmCard", () => {
	// F131
	it("renders a row per action with the concrete values and an edit diff", () => {
		const wrapper = mountCard();
		const rows = wrapper.findAll('[data-test="confirm-action"]');
		expect(rows.length).toBe(2);

		const diff = wrapper.find('[data-test="confirm-diff"]').text();
		expect(diff).toContain("amount");
		expect(diff).toContain("4.5");
		expect(diff).toContain("6");

		const inputs = wrapper.findAll('[data-test="confirm-value-input"]');
		const fields = inputs.map((i) => i.attributes("data-field"));
		expect(fields).toEqual(["amount", "category", "notes"]);
		expect(fields).not.toContain("name"); // `name` is filtered out
		expect(inputs[0].element.value).toBe("12");
		expect(inputs[1].element.value).toBe("Groceries");
	});

	// F131
	it("has a checkbox per action, all checked, plus Confirm and Cancel", () => {
		const wrapper = mountCard();
		const boxes = wrapper.findAll('[data-test="confirm-action-checkbox"]');
		expect(boxes.length).toBe(2);
		expect(boxes.every((b) => b.element.checked)).toBe(true);
		expect(wrapper.find('[data-test="confirm-apply"]').exists()).toBe(true);
		expect(wrapper.find('[data-test="confirm-cancel"]').exists()).toBe(true);
	});

	// F132
	it("Confirm emits the checked ids; deselecting a row drops its id", async () => {
		const wrapper = mountCard();
		await wrapper.findAll('[data-test="confirm-action-checkbox"]')[1].setValue(false);
		await wrapper.find('[data-test="confirm-apply"]').trigger("click");
		expect(wrapper.emitted("confirm")[0]).toEqual([["a1"], {}]);
	});

	// F142/F143
	it("editing a create action's field sends it in the edits map; untouched ones are absent", async () => {
		const wrapper = mountCard();
		const amountInput = wrapper.findAll('[data-test="confirm-value-input"]')[0];
		await amountInput.setValue("15");
		await wrapper.find('[data-test="confirm-apply"]').trigger("click");
		expect(wrapper.emitted("confirm")[0]).toEqual([["a1", "a2"], { a2: { amount: 15 } }]);
	});

	// F142 — update/delete actions never get inline edit inputs
	it("does not render edit inputs for update/delete actions", () => {
		const wrapper = mountCard();
		const fields = wrapper
			.findAll('[data-test="confirm-value-input"]')
			.map((i) => i.attributes("data-field"));
		expect(fields).toEqual(["amount", "category", "notes"]); // only a2 (create)
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
	});
});
