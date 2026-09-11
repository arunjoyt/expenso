<template>
	<div class="fixed inset-0 flex flex-col bg-gray-50">
		<header
			class="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3"
		>
			<h1 class="text-lg font-extrabold text-gray-900">💬 Assistant</h1>

			<div v-if="messages.length" class="flex items-center gap-1">
				<span v-if="confirmingClear" class="flex items-center gap-1">
					<Button
						data-test="clear-chat-confirm"
						variant="solid"
						theme="red"
						:loading="clearing"
						@click="confirmClear"
					>
						Confirm
					</Button>
					<Button
						data-test="clear-chat-cancel"
						variant="ghost"
						@click="confirmingClear = false"
					>
						Cancel
					</Button>
				</span>
				<button
					v-else
					type="button"
					data-test="clear-chat"
					class="text-sm font-semibold text-gray-400 transition active:scale-95"
					@click="confirmingClear = true"
				>
					Clear chat
				</button>
			</div>
		</header>

		<div
			v-if="!configured"
			data-test="assistant-not-configured"
			class="flex flex-1 flex-col items-center justify-center gap-1 px-8 text-center text-gray-500"
		>
			<span class="text-4xl">🤖</span>
			<span>The Assistant isn't configured for this site.</span>
		</div>

		<div v-else class="flex min-h-0 flex-1 flex-col">
			<div class="flex-1 space-y-3 overflow-y-auto px-4 py-4">
				<div
					v-if="!loading && messages.length === 0"
					class="flex flex-col items-center gap-1 py-16 text-center text-gray-500"
				>
					<span class="text-4xl">💬</span>
					<span>Ask about your spending, income, or budgets.</span>
				</div>

				<div
					v-for="(message, index) in messages"
					:key="message.id ?? `pending-${index}`"
					:data-test="message.role === 'user' ? 'user-message' : 'assistant-message'"
					class="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm"
					:class="
						message.role === 'user'
							? 'ml-auto bg-accent-500 text-white'
							: 'mr-auto bg-white text-gray-800'
					"
				>
					<span>{{ message.content }}</span>
					<span v-if="message.streaming" data-test="streaming-cursor" class="ml-0.5"
						>▍</span
					>
				</div>

				<ConfirmCard
					v-if="card"
					:key="card.actions.map((a) => a.id).join(',')"
					:actions="card.actions"
					:pending="card.pending"
					@confirm="onConfirm"
					@cancel="onCancel"
				/>

				<div
					v-if="steps.length"
					data-test="assistant-step-log"
					class="mr-auto max-w-[85%] rounded-2xl bg-gray-100 px-3 py-2 text-xs text-gray-500"
				>
					<div v-for="(step, i) in steps" :key="i">{{ step }}</div>
				</div>
			</div>

			<div
				class="border-t border-gray-100 bg-white px-4 pt-3"
				style="padding-bottom: calc(env(safe-area-inset-bottom) + 4.5rem)"
			>
				<ErrorMessage v-if="notice" class="mb-2" :message="notice" />

				<div
					v-if="pendingPhoto"
					data-test="pending-photo"
					class="mb-2 flex items-center gap-2 rounded-xl bg-gray-100 p-1.5"
				>
					<img
						:src="pendingPhoto.dataUri"
						class="h-10 w-10 rounded-lg object-cover"
						alt="Attached photo"
					/>
					<button
						type="button"
						data-test="remove-photo"
						class="text-xs font-semibold text-gray-400"
						@click="pendingPhoto = null"
					>
						Remove
					</button>
				</div>

				<form class="flex gap-2" @submit.prevent="send">
					<input
						ref="fileInput"
						type="file"
						accept="image/*"
						capture="environment"
						class="hidden"
						data-test="attach-photo-input"
						@change="onPickPhoto"
					/>
					<button
						type="button"
						data-test="attach-photo"
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg"
						:disabled="sending"
						@click="fileInput.click()"
					>
						📎
					</button>
					<Input
						data-test="assistant-input"
						placeholder="Ask the Assistant"
						:disabled="sending"
						:model-value="draft"
						@input="draft = $event"
					/>
					<Button
						data-test="assistant-send"
						type="submit"
						variant="solid"
						theme="blue"
						:loading="sending"
					>
						Send
					</Button>
				</form>
			</div>
		</div>
	</div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { Button, Input, ErrorMessage } from "frappe-ui";
import { useAssistant } from "@/composables/useAssistant";
import ConfirmCard from "@/components/ConfirmCard.vue";

const { isConfigured, fetchHistory, sendMessage, resume, clearChat, markAllSeen } = useAssistant();

const configured = isConfigured();
const messages = ref([]);
const steps = ref([]);
const draft = ref("");
const notice = ref("");
const loading = ref(false);
const sending = ref(false);
const confirmingClear = ref(false);
const clearing = ref(false);
// The pending confirm card, or null. { actions, pending }.
const card = ref(null);
const fileInput = ref(null);
// A picked-but-not-yet-sent photo: { dataUri }. Replaced, not accumulated —
// one photo per turn (P7-S1).
const pendingPhoto = ref(null);

onMounted(async () => {
	if (!configured) return;
	loading.value = true;
	try {
		messages.value = await fetchHistory();
		// Opening the tab is "seeing" the thread — clears the nav badge.
		markAllSeen();
	} catch {
		notice.value = "Couldn't load your conversation. Try again.";
	} finally {
		loading.value = false;
	}
});

// Re-encodes to JPEG client-side (canvas), downscaled to a capped long edge —
// so the service only ever sees one mime type and a bounded payload (P7-S1).
// Decoding relies on the browser's own <img> support (HEIC included, on iOS
// Safari where phone photos are commonly HEIC).
const MAX_EDGE = 1600;

function readAsDataUri(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

async function toJpegDataUri(file) {
	const img = await loadImage(await readAsDataUri(file));
	const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(img.width * scale);
	canvas.height = Math.round(img.height * scale);
	canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL("image/jpeg", 0.85);
}

async function onPickPhoto(event) {
	const file = event.target.files?.[0];
	event.target.value = ""; // let picking the same file again still fire `change`
	if (!file) return;
	try {
		pendingPhoto.value = { dataUri: await toJpegDataUri(file) };
	} catch {
		notice.value = "Couldn't read that photo. Try a different one.";
	}
}

async function send() {
	const text = draft.value.trim();
	const photo = pendingPhoto.value;
	if ((!text && !photo) || sending.value) return;

	draft.value = "";
	pendingPhoto.value = null;
	notice.value = "";
	steps.value = [];
	card.value = null;
	sending.value = true;

	// What the service checkpoints in place of the image (agent/session.py's
	// `_human_text`) — mirrored here so the optimistic bubble matches history.
	const displayText = photo
		? text
			? `[Attached a photo] ${text}`
			: "[Attached a photo]"
		: text;

	// Everything the turn adds sits past `baseline`; a failed turn is undone
	// with one splice, matching the service rolling it back.
	const baseline = messages.value.length;
	messages.value.push({ id: null, role: "user", content: displayText });
	await runLeg(
		(handlers) =>
			photo
				? sendMessage(text, handlers, { image: photo.dataUri })
				: sendMessage(text, handlers),
		baseline
	);
}

async function onConfirm(selectedIds, edits) {
	if (!card.value) return;
	card.value.pending = true;
	const decision = { selected: selectedIds };
	if (edits && Object.keys(edits).length) decision.edits = edits;
	await runResume(decision);
}

async function onCancel() {
	if (!card.value) return;
	card.value.pending = true;
	await runResume({ selected: [] });
}

async function runResume(decision) {
	notice.value = "";
	steps.value = [];
	sending.value = true;
	await runLeg((handlers) => resume(decision, handlers));
}

// Streams one SSE leg into the thread. `rollbackTo` (send only) is the message
// count to splice back to if the leg errors.
async function runLeg(runner, rollbackTo) {
	let streamIndex = -1;
	const onToken = (delta) => {
		if (streamIndex === -1) {
			streamIndex =
				messages.value.push({
					id: null,
					role: "assistant",
					content: "",
					streaming: true,
				}) - 1;
		}
		messages.value[streamIndex].content += delta;
	};

	try {
		const result = await runner({ onStep: (line) => steps.value.push(line), onToken });

		if (result.kind === "confirm") {
			if (streamIndex !== -1 && !messages.value[streamIndex].content) {
				messages.value.splice(streamIndex, 1);
			}
			card.value = { actions: result.actions, pending: false };
			return;
		}

		const final = { id: result.id, role: "assistant", content: result.content };
		if (streamIndex === -1) messages.value.push(final);
		else messages.value[streamIndex] = final;
		card.value = null;
	} catch (error) {
		if (rollbackTo !== undefined) messages.value.splice(rollbackTo);
		if (card.value) card.value.pending = false;
		notice.value =
			error.code === "daily_cap"
				? "You've reached today's Assistant limit. Try again tomorrow."
				: error.message || "The Assistant hit an error. Try again.";
	} finally {
		steps.value = [];
		sending.value = false;
	}
}

async function confirmClear() {
	clearing.value = true;
	try {
		await clearChat();
		messages.value = [];
		card.value = null;
		confirmingClear.value = false;
	} catch {
		notice.value = "Couldn't clear the chat. Try again.";
	} finally {
		clearing.value = false;
	}
}
</script>
