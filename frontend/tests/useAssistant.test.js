import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("frappe-ui", async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, call: vi.fn() };
});

import { call } from "frappe-ui";
import { useAssistant, resetAssistantState } from "@/composables/useAssistant";

const SERVICE = "https://assistant.test";

// Build a fake fetch Response whose body streams `chunks` (raw SSE strings).
function sseResponse(chunks, { status = 200 } = {}) {
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
			controller.close();
		},
	});
	return { ok: status < 400, status, body: stream };
}

function jsonResponse(data, { status = 200 } = {}) {
	return { ok: status < 400, status, json: async () => data };
}

function frame(event, data) {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

beforeEach(() => {
	window.assistant_url = SERVICE;
	localStorage.clear();
	resetAssistantState();
	call.mockReset();
	call.mockResolvedValue({
		access_token: "tok-1",
		expires_in: 3600,
		scope: "all openid expenso:read",
	});
	global.fetch = vi.fn();
});

afterEach(() => {
	delete window.assistant_url;
	vi.restoreAllMocks();
});

describe("useAssistant — SSE parser (F134)", () => {
	it("accumulates token deltas and returns the committed message on done", async () => {
		fetch.mockResolvedValueOnce(
			sseResponse([
				frame("step", { text: "Reading expenses for March" }),
				frame("token", { text: "You " }),
				frame("token", { text: "spent $12." }),
				frame("done", { message_id: "m-1" }),
			])
		);
		const steps = [];
		const tokens = [];
		const message = await useAssistant().sendMessage("march?", {
			onStep: (s) => steps.push(s),
			onToken: (t) => tokens.push(t),
		});

		expect(steps).toEqual(["Reading expenses for March"]);
		expect(tokens).toEqual(["You ", "spent $12."]);
		expect(message).toEqual({
			kind: "message",
			id: "m-1",
			role: "assistant",
			content: "You spent $12.",
		});
	});

	it("buffers a frame split across two stream chunks", async () => {
		fetch.mockResolvedValueOnce(
			sseResponse([
				'event: token\ndata: {"te',
				'xt":"hi"}\n\nevent: done\ndata: {"message_id":"m-2"}\n\n',
			])
		);
		const message = await useAssistant().sendMessage("hi", {});
		expect(message.content).toBe("hi");
		expect(message.id).toBe("m-2");
	});

	it("rejects on an error event without committing the partial answer", async () => {
		fetch.mockResolvedValueOnce(
			sseResponse([
				frame("token", { text: "partial…" }),
				frame("error", {
					code: "tool_cap",
					message: "The assistant tried too many steps.",
				}),
			])
		);
		await expect(useAssistant().sendMessage("go", {})).rejects.toMatchObject({
			code: "tool_cap",
		});
	});

	// F135
	it("resolves as a confirm result when the leg ends on needs_confirmation", async () => {
		const actions = [{ id: "a1", tool: "update_expense", kind: "update", summary: "Coffee" }];
		fetch.mockResolvedValueOnce(
			sseResponse([
				frame("step", { text: "Reading expenses for March" }),
				frame("needs_confirmation", { actions }),
			])
		);
		const result = await useAssistant().sendMessage("bump the coffee", {});
		expect(result).toEqual({ kind: "confirm", actions });
	});
});

// F139/F140
describe("useAssistant — attaching a photo (P7-S1)", () => {
	it("includes the image field in the /chat body when given", async () => {
		fetch.mockResolvedValueOnce(sseResponse([frame("done", { message_id: "m" })]));
		const image = "data:image/jpeg;base64,Zm9v";

		await useAssistant().sendMessage("lunch", {}, { image });

		const [, options] = fetch.mock.calls[0];
		expect(JSON.parse(options.body)).toEqual({ message: "lunch", image });
	});

	it("omits the image field entirely for a plain text message", async () => {
		fetch.mockResolvedValueOnce(sseResponse([frame("done", { message_id: "m" })]));

		await useAssistant().sendMessage("hello", {});

		const [, options] = fetch.mock.calls[0];
		expect(JSON.parse(options.body)).toEqual({ message: "hello" });
	});
});

describe("useAssistant — resume (F136)", () => {
	it("POSTs /resume with the decision and streams the continuation to done", async () => {
		fetch.mockResolvedValueOnce(
			sseResponse([
				frame("token", { text: "Updated it." }),
				frame("done", { message_id: "m9" }),
			])
		);
		const result = await useAssistant().resume({ selected: ["a1"] }, {});

		const [url, options] = fetch.mock.calls[0];
		expect(url).toBe(`${SERVICE}/resume`);
		expect(options.method).toBe("POST");
		expect(options.headers.Authorization).toBe("Bearer tok-1");
		expect(JSON.parse(options.body)).toEqual({ decision: { selected: ["a1"] } });
		expect(result).toEqual({
			kind: "message",
			id: "m9",
			role: "assistant",
			content: "Updated it.",
		});
	});

	// F143
	it("passes edits through in the resume decision body", async () => {
		fetch.mockResolvedValueOnce(
			sseResponse([
				frame("token", { text: "Updated." }),
				frame("done", { message_id: "m10" }),
			])
		);
		await useAssistant().resume({ selected: ["a1"], edits: { a1: { amount: 15 } } }, {});

		const [, options] = fetch.mock.calls[0];
		expect(JSON.parse(options.body)).toEqual({
			decision: { selected: ["a1"], edits: { a1: { amount: 15 } } },
		});
	});

	it("can resolve into a second confirm card", async () => {
		const actions = [{ id: "b1", tool: "update_expense", kind: "update", summary: "Retry" }];
		fetch.mockResolvedValueOnce(sseResponse([frame("needs_confirmation", { actions })]));
		const result = await useAssistant().resume({ selected: ["a1"] }, {});
		expect(result).toEqual({ kind: "confirm", actions });
	});
});

describe("useAssistant — token lifecycle (F129)", () => {
	it("mints lazily and reuses the cached token for a second call", async () => {
		fetch.mockImplementation(() =>
			Promise.resolve(sseResponse([frame("done", { message_id: "m" })]))
		);
		await useAssistant().sendMessage("one", {});
		await useAssistant().sendMessage("two", {});
		expect(call).toHaveBeenCalledTimes(1);
		// F138 — P6-S7 raised the mint to write scope for the confirm-gated tools.
		expect(call).toHaveBeenCalledWith("expenso.assistant.auth.mint_assistant_token", {
			write: true,
		});
	});

	it("re-mints once and retries after a 401, then succeeds", async () => {
		call.mockResolvedValueOnce({
			access_token: "stale",
			expires_in: 3600,
		}).mockResolvedValueOnce({ access_token: "fresh", expires_in: 3600 });
		fetch
			.mockResolvedValueOnce(sseResponse([], { status: 401 }))
			.mockResolvedValueOnce(sseResponse([frame("done", { message_id: "m-3" })]));

		const message = await useAssistant().sendMessage("retry", {});
		expect(message.id).toBe("m-3");
		expect(call).toHaveBeenCalledTimes(2);
		expect(fetch.mock.calls[1][1].headers.Authorization).toBe("Bearer fresh");
	});

	it("surfaces an error when a second 401 follows the re-mint", async () => {
		fetch.mockImplementation(() => Promise.resolve(sseResponse([], { status: 401 })));
		await expect(useAssistant().sendMessage("nope", {})).rejects.toThrow(/401/);
		expect(call).toHaveBeenCalledTimes(2);
	});
});

describe("useAssistant — history and badge", () => {
	it("fetchHistory GETs /history with the bearer and returns its messages", async () => {
		const messages = [
			{ id: "u1", role: "user", content: "hi" },
			{ id: "a1", role: "assistant", content: "hello" },
		];
		fetch.mockResolvedValueOnce(jsonResponse({ messages }));

		const result = await useAssistant().fetchHistory();
		expect(result).toEqual(messages);
		const [url, options] = fetch.mock.calls[0];
		expect(url).toBe(`${SERVICE}/history`);
		expect(options.method).toBe("GET");
		expect(options.headers.Authorization).toBe("Bearer tok-1");
	});

	// F133
	it("lights the badge when the newest history message is an unseen assistant message", async () => {
		const { unreadBadge, recordHistory, markAllSeen } = useAssistant();
		expect(unreadBadge.value).toBe(false);

		recordHistory([
			{ id: "u1", role: "user", content: "hi" },
			{ id: "a9", role: "assistant", content: "here's an insight" },
		]);
		expect(unreadBadge.value).toBe(true);

		markAllSeen();
		expect(unreadBadge.value).toBe(false);
		expect(localStorage.getItem("expenso.assistant.lastSeenMessageId")).toBe("a9");
	});

	it("clearChat DELETEs /history and resets the badge state", async () => {
		fetch.mockResolvedValueOnce(jsonResponse({ status: "cleared" }));
		const assistant = useAssistant();
		assistant.recordHistory([{ id: "a1", role: "assistant", content: "x" }]);

		await assistant.clearChat();
		expect(fetch.mock.calls[0][1].method).toBe("DELETE");
		expect(assistant.unreadBadge.value).toBe(false);
		expect(localStorage.getItem("expenso.assistant.lastSeenMessageId")).toBe(null);
	});

	it("isConfigured reflects window.assistant_url", () => {
		expect(useAssistant().isConfigured()).toBe(true);
		delete window.assistant_url;
		expect(useAssistant().isConfigured()).toBe(false);
	});
});
