import { computed, ref } from "vue";
import { call } from "frappe-ui";

// Talks to the standalone `expenso-assistant` service (separate origin). The
// bearer is minted by Frappe and rides an Authorization header, so the SSE
// stream is read with fetch() + ReadableStream, not EventSource.
//
// Base URL comes from Frappe's boot context; empty means the deployment has
// not wired the service and the Assistant tab shows an "isn't configured"
// notice instead of erroring.

const SEEN_KEY = "expenso.assistant.lastSeenMessageId";
// Re-mint a little before the token actually expires so a long turn does not
// die mid-stream.
const REMINT_MARGIN_MS = 60 * 1000;

let cachedToken = null;
let tokenExpiresAt = 0;

// Newest assistant message id we know about, and the newest the Member has
// seen. The badge is the gap between them. Nothing lights it in P6-S6 — the
// Assistant page marks everything seen on open — but P6-S7/P7-S2 push messages
// through recordHistory() without marking them seen.
const newestAssistantId = ref(null);
const lastSeenId = ref(readSeen());

export function useAssistant() {
	return {
		isConfigured,
		unreadBadge: computed(
			() => !!newestAssistantId.value && newestAssistantId.value !== lastSeenId.value
		),
		fetchHistory,
		sendMessage,
		resume,
		clearChat,
		recordHistory,
		markAllSeen,
	};
}

export function serviceUrl() {
	return (window.assistant_url || "").replace(/\/$/, "");
}

// Test seam: the token cache and badge state live at module scope.
export function resetAssistantState() {
	cachedToken = null;
	tokenExpiresAt = 0;
	newestAssistantId.value = null;
	lastSeenId.value = readSeen();
}

function isConfigured() {
	return !!serviceUrl();
}

async function fetchHistory() {
	const { messages } = await request("GET", "/history");
	recordHistory(messages);
	return messages;
}

// Runs one turn. `onStep` gets each humanized activity line; `onToken` gets
// each answer delta. Resolves with either
//   { kind: "message", id, content }  — a `done` leg, or
//   { kind: "confirm", actions }      — the leg ended on a confirm card;
// rejects with an Error carrying `.code` on an `error` event.
function sendMessage(text, handlers) {
	return runLeg("/chat", { message: text }, handlers);
}

// The member's decision on a pending confirm card. `decision` is
// `{ selected: [actionId, …] }` — an empty list cancels.
function resume(decision, handlers) {
	return runLeg("/resume", { decision }, handlers);
}

async function runLeg(path, body, { onStep, onToken } = {}) {
	const response = await request("POST", path, body, { raw: true });
	const result = await consumeSSE(response, { onStep, onToken });

	if (result.error) {
		const error = new Error(result.error.message || "The assistant hit an error.");
		error.code = result.error.code;
		throw error;
	}
	if (result.confirm) {
		return { kind: "confirm", actions: result.confirm.actions ?? [] };
	}

	const message = { id: result.messageId, role: "assistant", content: result.text };
	// A live turn is on screen already — never let it badge itself.
	recordHistory([message]);
	markAllSeen();
	return { kind: "message", ...message };
}

async function clearChat() {
	await request("DELETE", "/history");
	newestAssistantId.value = null;
	writeSeen(null);
	lastSeenId.value = null;
}

function recordHistory(messages) {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		if (messages[i].role === "assistant") {
			newestAssistantId.value = messages[i].id;
			return;
		}
	}
}

function markAllSeen() {
	lastSeenId.value = newestAssistantId.value;
	writeSeen(newestAssistantId.value);
}

// --- transport ----------------------------------------------------------

// One HTTP call to the service. Mints (and re-mints) the bearer, retries once
// on a 401. `raw` returns the Response untouched for the SSE reader.
async function request(method, path, body, { raw = false } = {}) {
	let response = await fetchWithToken(method, path, body, await mintToken());
	if (response.status === 401) {
		response = await fetchWithToken(method, path, body, await mintToken({ force: true }));
	}
	if (!response.ok) {
		throw new Error(`Assistant request failed (${response.status})`);
	}
	return raw ? response : response.json();
}

function fetchWithToken(method, path, body, token) {
	return fetch(`${serviceUrl()}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			...(body ? { "Content-Type": "application/json" } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
}

async function mintToken({ force = false } = {}) {
	const fresh = cachedToken && Date.now() < tokenExpiresAt - REMINT_MARGIN_MS;
	if (fresh && !force) return cachedToken;

	// write scope: the confirm-gated tools run on the member's approval (P6-S7).
	const { access_token, expires_in } = await call(
		"expenso.assistant.auth.mint_assistant_token",
		{ write: true }
	);
	cachedToken = access_token;
	tokenExpiresAt = Date.now() + expires_in * 1000;
	return cachedToken;
}

// Hand-rolled SSE reader: frames are separated by a blank line, and a chunk
// boundary can fall anywhere, so a partial frame is held over to the next read.
async function consumeSSE(response, { onStep, onToken } = {}) {
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	const state = { buffer: "", text: "", messageId: null };

	for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
		state.buffer += decoder.decode(chunk.value, { stream: true });
		const outcome = drainFrames(state, { onStep, onToken });
		if (outcome) return outcome;
	}

	return { text: state.text, messageId: state.messageId };
}

// Pull every complete frame out of the buffer. Returns `{error}` to stop the
// stream early, otherwise undefined.
function drainFrames(state, { onStep, onToken }) {
	let split;
	while ((split = state.buffer.indexOf("\n\n")) !== -1) {
		const frame = parseFrame(state.buffer.slice(0, split));
		state.buffer = state.buffer.slice(split + 2);
		if (!frame) continue;

		if (frame.event === "step") {
			onStep?.(frame.data.text);
		} else if (frame.event === "token") {
			state.text += frame.data.text;
			onToken?.(frame.data.text);
		} else if (frame.event === "done") {
			state.messageId = frame.data.message_id;
		} else if (frame.event === "needs_confirmation") {
			return { confirm: frame.data };
		} else if (frame.event === "error") {
			return { error: frame.data };
		}
	}
}

function parseFrame(raw) {
	let event = null;
	const dataLines = [];
	for (const line of raw.split("\n")) {
		if (line.startsWith("event:")) event = line.slice(6).trim();
		else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
	}
	if (!event || dataLines.length === 0) return null;
	return { event, data: JSON.parse(dataLines.join("\n")) };
}

function readSeen() {
	try {
		return localStorage.getItem(SEEN_KEY);
	} catch {
		return null;
	}
}

function writeSeen(id) {
	try {
		if (id) localStorage.setItem(SEEN_KEY, id);
		else localStorage.removeItem(SEEN_KEY);
	} catch {
		// storage disabled — the badge just won't persist across reloads
	}
}
