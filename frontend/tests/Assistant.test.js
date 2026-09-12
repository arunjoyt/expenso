import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const assistant = {
	isConfigured: vi.fn(() => true),
	fetchHistory: vi.fn(),
	sendMessage: vi.fn(),
	resume: vi.fn(),
	clearChat: vi.fn(),
	markAllSeen: vi.fn(),
};
vi.mock("@/composables/useAssistant", () => ({
	useAssistant: () => assistant,
}));

const message = (content, id = "a1") => ({ kind: "message", id, role: "assistant", content });
const confirm = (actions) => ({ kind: "confirm", actions });

import Assistant from "@/pages/Assistant.vue";

function mountAssistant() {
	return mount(Assistant);
}

beforeEach(() => {
	assistant.isConfigured.mockReturnValue(true);
	assistant.fetchHistory.mockResolvedValue([]);
	assistant.sendMessage.mockReset();
	assistant.resume.mockReset();
	assistant.clearChat.mockReset();
	assistant.clearChat.mockResolvedValue();
	assistant.markAllSeen.mockClear();

	// jsdom has no real canvas/image decoder — stub the client-side re-encode
	// pipeline (P7-S1) so the attach-photo flow can be exercised end to end.
	global.Image = class {
		set src(_value) {
			queueMicrotask(() => this.onload?.());
		}
	};
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() });
	vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
		"data:image/jpeg;base64,MOCKED"
	);
});

async function pickPhoto(wrapper, filename = "receipt.jpg") {
	const input = wrapper.find('[data-test="attach-photo-input"]');
	const file = new File(["fake-bytes"], filename, { type: "image/jpeg" });
	Object.defineProperty(input.element, "files", { value: [file], configurable: true });
	await input.trigger("change");
	// jsdom's FileReader schedules its load event on a real timer, not a
	// microtask — poll rather than guess how many ticks that takes.
	await vi.waitFor(async () => {
		await flushPromises();
		expect(wrapper.find('[data-test="pending-photo"]').exists()).toBe(true);
	});
}

afterEach(() => {
	vi.clearAllMocks();
});

async function typeAndSend(wrapper, text) {
	await wrapper.find('[data-test="assistant-input"]').setValue(text);
	await wrapper.find("form").trigger("submit");
}

describe("Assistant screen", () => {
	// F124
	it("loads history on mount and renders user + assistant messages in order", async () => {
		assistant.fetchHistory.mockResolvedValue([
			{ id: "u1", role: "user", content: "what did I spend in March?" },
			{ id: "a1", role: "assistant", content: "You spent $412 in March." },
		]);
		const wrapper = mountAssistant();
		await flushPromises();

		expect(assistant.fetchHistory).toHaveBeenCalledOnce();
		const bubbles = wrapper.findAll("[data-test$='-message']");
		expect(bubbles.map((b) => b.attributes("data-test"))).toEqual([
			"user-message",
			"assistant-message",
		]);
		expect(bubbles[0].text()).toContain("what did I spend in March?");
		expect(bubbles[1].text()).toContain("You spent $412 in March.");
	});

	// F145
	it("labels a proactive Insight message; an ordinary reply gets no label", async () => {
		assistant.fetchHistory.mockResolvedValue([
			{
				id: "i1",
				role: "assistant",
				content: "August was quiet — you spent 100.",
				kind: "insight",
				posted_at: "2026-09-01T03:00:00+00:00",
			},
			{ id: "a1", role: "assistant", content: "You spent $412 in March." },
		]);
		const wrapper = mountAssistant();
		await flushPromises();

		const labels = wrapper.findAll('[data-test="insight-label"]');
		expect(labels).toHaveLength(1);
		expect(labels[0].text()).toContain("Insight");

		const bubbles = wrapper.findAll('[data-test="assistant-message"]');
		expect(bubbles[0].text()).toContain("August was quiet");
		expect(bubbles[1].text()).toContain("You spent $412 in March.");
	});

	// F133
	it("marks the thread seen on open (clears the nav badge)", async () => {
		mountAssistant();
		await flushPromises();
		expect(assistant.markAllSeen).toHaveBeenCalledOnce();
	});

	// F125
	it("shows an 'isn't configured' notice and does not touch the network when the URL is unset", async () => {
		assistant.isConfigured.mockReturnValue(false);
		const wrapper = mountAssistant();
		await flushPromises();

		expect(wrapper.find('[data-test="assistant-not-configured"]').exists()).toBe(true);
		expect(assistant.fetchHistory).not.toHaveBeenCalled();
		expect(wrapper.find('[data-test="assistant-input"]').exists()).toBe(false);
	});

	// F126
	it("streams a turn: transient step log, then the answer, then the step log clears", async () => {
		let releaseTokens;
		assistant.sendMessage.mockImplementation(async (text, { onStep, onToken }) => {
			onStep("Reading expenses for March");
			await new Promise((resolve) => {
				releaseTokens = resolve;
			});
			onToken("You spent ");
			onToken("$412.");
			return message("You spent $412.");
		});

		const wrapper = mountAssistant();
		await flushPromises();
		await typeAndSend(wrapper, "march spend?");
		await flushPromises();

		// Mid-stream: the humanized step log is visible.
		expect(wrapper.find('[data-test="assistant-step-log"]').text()).toContain(
			"Reading expenses for March"
		);
		expect(assistant.sendMessage).toHaveBeenCalledWith("march spend?", expect.any(Object));

		releaseTokens();
		await flushPromises();

		// After done: the answer is committed and the step log is gone.
		const assistantBubble = wrapper.find('[data-test="assistant-message"]');
		expect(assistantBubble.text()).toContain("You spent $412.");
		expect(wrapper.find('[data-test="assistant-step-log"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="user-message"]').text()).toContain("march spend?");
	});

	// F127
	it("shows a transient error notice on a failed stream and leaves the thread unchanged", async () => {
		assistant.sendMessage.mockRejectedValue(new Error("The assistant hit an error."));
		const wrapper = mountAssistant();
		await flushPromises();
		await typeAndSend(wrapper, "break it");
		await flushPromises();

		expect(wrapper.text()).toContain("The assistant hit an error.");
		expect(wrapper.find('[data-test="user-message"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="assistant-message"]').exists()).toBe(false);
		// Input stays usable.
		expect(
			wrapper.find('[data-test="assistant-input"]').attributes("disabled")
		).toBeUndefined();
	});

	// F128
	it("shows the cap warning on an error with code daily_cap, input still usable", async () => {
		assistant.sendMessage.mockRejectedValue(
			Object.assign(new Error("limit"), { code: "daily_cap" })
		);
		const wrapper = mountAssistant();
		await flushPromises();
		await typeAndSend(wrapper, "again");
		await flushPromises();

		expect(wrapper.text()).toMatch(/today's Assistant limit/i);
		expect(
			wrapper.find('[data-test="assistant-input"]').attributes("disabled")
		).toBeUndefined();
	});

	// F130
	it("Clear chat confirms inline, then DELETEs and empties the visible list", async () => {
		assistant.fetchHistory.mockResolvedValue([
			{ id: "a1", role: "assistant", content: "hello" },
		]);
		const wrapper = mountAssistant();
		await flushPromises();

		// Cancel path: no call.
		await wrapper.find('[data-test="clear-chat"]').trigger("click");
		await wrapper.find('[data-test="clear-chat-cancel"]').trigger("click");
		expect(assistant.clearChat).not.toHaveBeenCalled();

		// Confirm path: DELETE, list empties.
		await wrapper.find('[data-test="clear-chat"]').trigger("click");
		await wrapper.find('[data-test="clear-chat-confirm"]').trigger("click");
		await flushPromises();

		expect(assistant.clearChat).toHaveBeenCalledOnce();
		expect(wrapper.find('[data-test="assistant-message"]').exists()).toBe(false);
	});

	it("uses no window.confirm for Clear chat", async () => {
		const confirmSpy = vi.spyOn(window, "confirm");
		assistant.fetchHistory.mockResolvedValue([{ id: "a1", role: "assistant", content: "x" }]);
		const wrapper = mountAssistant();
		await flushPromises();
		await wrapper.find('[data-test="clear-chat"]').trigger("click");
		await wrapper.find('[data-test="clear-chat-confirm"]').trigger("click");
		await flushPromises();
		expect(confirmSpy).not.toHaveBeenCalled();
	});

	const ACTIONS = [
		{
			id: "a1",
			tool: "update_expense",
			kind: "update",
			entity: "expense",
			summary: "Coffee",
			changes: [{ field: "amount", from: 4.5, to: 6 }],
		},
	];

	// F137
	it("renders the confirm card inline and drives resume on Confirm", async () => {
		assistant.sendMessage.mockResolvedValue(confirm(ACTIONS));
		assistant.resume.mockResolvedValue(message("Updated the coffee to 6."));

		const wrapper = mountAssistant();
		await flushPromises();
		await typeAndSend(wrapper, "bump the coffee to 6");
		await flushPromises();

		expect(wrapper.find('[data-test="confirm-card"]').exists()).toBe(true);

		await wrapper.find('[data-test="confirm-apply"]').trigger("click");
		await flushPromises();

		expect(assistant.resume).toHaveBeenCalledWith({ selected: ["a1"] }, expect.any(Object));
		expect(wrapper.find('[data-test="assistant-message"]').text()).toContain(
			"Updated the coffee to 6."
		);
		expect(wrapper.find('[data-test="confirm-card"]').exists()).toBe(false);
	});

	// F137
	it("Cancel resumes with an empty selection", async () => {
		assistant.sendMessage.mockResolvedValue(confirm(ACTIONS));
		assistant.resume.mockResolvedValue(message("Okay, left it as is."));

		const wrapper = mountAssistant();
		await flushPromises();
		await typeAndSend(wrapper, "bump the coffee");
		await flushPromises();
		await wrapper.find('[data-test="confirm-cancel"]').trigger("click");
		await flushPromises();

		expect(assistant.resume).toHaveBeenCalledWith({ selected: [] }, expect.any(Object));
	});

	// F137
	it("a second needs_confirmation replaces the card", async () => {
		const RETRY = [
			{
				id: "b1",
				tool: "update_expense",
				kind: "update",
				entity: "expense",
				summary: "Retry",
				changes: [{ field: "amount", from: 5, to: 6 }],
			},
		];
		assistant.sendMessage.mockResolvedValue(confirm(ACTIONS));
		assistant.resume.mockResolvedValue(confirm(RETRY));

		const wrapper = mountAssistant();
		await flushPromises();
		await typeAndSend(wrapper, "bump it");
		await flushPromises();
		await wrapper.find('[data-test="confirm-apply"]').trigger("click");
		await flushPromises();

		expect(wrapper.find('[data-test="confirm-card"]').exists()).toBe(true);
		expect(wrapper.find('[data-test="confirm-card"]').text()).toContain("Retry");
	});

	// F139
	it("picking a photo shows a removable thumbnail chip", async () => {
		const wrapper = mountAssistant();
		await flushPromises();
		expect(wrapper.find('[data-test="pending-photo"]').exists()).toBe(false);

		await pickPhoto(wrapper);
		expect(wrapper.find('[data-test="pending-photo"]').exists()).toBe(true);

		await wrapper.find('[data-test="remove-photo"]').trigger("click");
		expect(wrapper.find('[data-test="pending-photo"]').exists()).toBe(false);
	});

	// F140/F141
	it("sending a photo alone sends the image and shows the bare marker bubble", async () => {
		assistant.sendMessage.mockResolvedValue(message("Got it."));
		const wrapper = mountAssistant();
		await flushPromises();
		await pickPhoto(wrapper);

		await wrapper.find("form").trigger("submit");
		await flushPromises();

		expect(assistant.sendMessage).toHaveBeenCalledWith("", expect.any(Object), {
			image: "data:image/jpeg;base64,MOCKED",
		});
		expect(wrapper.find('[data-test="user-message"]').text()).toBe("[Attached a photo]");
		// the picker clears once sent
		expect(wrapper.find('[data-test="pending-photo"]').exists()).toBe(false);
	});

	// F141
	it("sending a photo with a caption includes both in the marker bubble", async () => {
		assistant.sendMessage.mockResolvedValue(message("Got it."));
		const wrapper = mountAssistant();
		await flushPromises();
		await pickPhoto(wrapper);
		await wrapper.find('[data-test="assistant-input"]').setValue("lunch with the team");

		await wrapper.find("form").trigger("submit");
		await flushPromises();

		expect(assistant.sendMessage).toHaveBeenCalledWith(
			"lunch with the team",
			expect.any(Object),
			{ image: "data:image/jpeg;base64,MOCKED" }
		);
		expect(wrapper.find('[data-test="user-message"]').text()).toBe(
			"[Attached a photo] lunch with the team"
		);
	});

	// F143
	it("Confirm on an edited create action sends edits through to resume", async () => {
		const CREATE_ACTIONS = [
			{
				id: "a2",
				tool: "create_expense",
				kind: "create",
				entity: "expense",
				summary: "New expense",
				values: { amount: 12, category: "Groceries" },
			},
		];
		assistant.sendMessage.mockResolvedValue(confirm(CREATE_ACTIONS));
		assistant.resume.mockResolvedValue(message("Added it."));

		const wrapper = mountAssistant();
		await flushPromises();
		await typeAndSend(wrapper, "add a 12 groceries expense");
		await flushPromises();

		const amountInput = wrapper.find('[data-field="amount"]');
		await amountInput.setValue("15");
		await wrapper.find('[data-test="confirm-apply"]').trigger("click");
		await flushPromises();

		expect(assistant.resume).toHaveBeenCalledWith(
			{ selected: ["a2"], edits: { a2: { amount: 15 } } },
			expect.any(Object)
		);
	});
});
