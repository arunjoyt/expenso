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
				<form class="flex gap-2" @submit.prevent="send">
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

const { isConfigured, fetchHistory, sendMessage, clearChat, markAllSeen } = useAssistant();

const configured = isConfigured();
const messages = ref([]);
const steps = ref([]);
const draft = ref("");
const notice = ref("");
const loading = ref(false);
const sending = ref(false);
const confirmingClear = ref(false);
const clearing = ref(false);

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

async function send() {
	const text = draft.value.trim();
	if (!text || sending.value) return;

	draft.value = "";
	notice.value = "";
	steps.value = [];
	sending.value = true;

	// Everything this turn adds sits past `baseline`, so a failed turn is undone
	// with a single splice — matching the service, which rolls the turn back.
	const baseline = messages.value.length;
	messages.value.push({ id: null, role: "user", content: text });
	let streamIndex = -1;

	try {
		const committed = await sendMessage(text, {
			onStep: (line) => steps.value.push(line),
			onToken: (delta) => {
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
			},
		});
		const final = { id: committed.id, role: "assistant", content: committed.content };
		if (streamIndex === -1) messages.value.push(final);
		else messages.value[streamIndex] = final;
	} catch (error) {
		messages.value.splice(baseline);
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
		confirmingClear.value = false;
	} catch {
		notice.value = "Couldn't clear the chat. Try again.";
	} finally {
		clearing.value = false;
	}
}
</script>
