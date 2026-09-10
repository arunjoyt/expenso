import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const assistant = {
	isConfigured: vi.fn(() => true),
	fetchHistory: vi.fn(),
	sendMessage: vi.fn(),
	clearChat: vi.fn(),
	markAllSeen: vi.fn(),
};
vi.mock("@/composables/useAssistant", () => ({
	useAssistant: () => assistant,
}));

import Assistant from "@/pages/Assistant.vue";

function mountAssistant() {
	return mount(Assistant);
}

beforeEach(() => {
	assistant.isConfigured.mockReturnValue(true);
	assistant.fetchHistory.mockResolvedValue([]);
	assistant.sendMessage.mockReset();
	assistant.clearChat.mockReset();
	assistant.clearChat.mockResolvedValue();
	assistant.markAllSeen.mockClear();
});

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
			return { id: "a1", role: "assistant", content: "You spent $412." };
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
});
