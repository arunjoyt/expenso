<template>
	<div>
		<div
			data-test="rename-sheet-backdrop"
			class="fixed inset-0 z-40 bg-black/40"
			@click="$emit('close')"
		></div>
		<div
			data-test="rename-sheet"
			class="fixed inset-x-0 bottom-0 z-50 animate-sheet-up rounded-t-3xl bg-white p-4 pb-6 shadow-2xl"
			@touchstart="onTouchStart"
			@touchmove="onTouchMove"
			@touchend="onTouchEnd"
		>
			<div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200" aria-hidden="true"></div>
			<h2 class="mb-4 text-lg font-extrabold text-gray-900">{{ title }}</h2>

			<form class="flex flex-col gap-4" @submit.prevent="submit">
				<Input
					data-test="rename-sheet-input"
					label="Name"
					type="text"
					:model-value="value"
					@input="value = $event"
					required
				/>

				<ErrorMessage :message="errorMessage" />

				<Button
					data-test="rename-sheet-save-button"
					variant="solid"
					theme="blue"
					type="submit"
					:loading="saving"
					:disabled="!canSubmit"
				>
					✅ Save
				</Button>
			</form>
		</div>
	</div>
</template>

<script setup>
import { computed, ref } from "vue";
import { Input, Button, ErrorMessage } from "frappe-ui";

const props = defineProps({
	title: {
		type: String,
		required: true,
	},
	initialValue: {
		type: String,
		required: true,
	},
	renameFn: {
		type: Function,
		required: true,
	},
});

const emit = defineEmits(["close"]);

const value = ref(props.initialValue);
const canSubmit = computed(() => value.value.trim().length > 0);

const saving = ref(false);
const errorMessage = ref("");

async function submit() {
	if (!canSubmit.value) return;
	errorMessage.value = "";
	saving.value = true;
	try {
		if (value.value !== props.initialValue) {
			await props.renameFn(value.value);
		}
		emit("close");
	} catch (error) {
		errorMessage.value = error?.messages?.join("\n") || error?.message || "Failed to save";
	} finally {
		saving.value = false;
	}
}

let touchStartY = null;

function onTouchStart(event) {
	touchStartY = event.touches[0].clientY;
}

function onTouchMove(event) {
	if (touchStartY === null) return;
	const delta = event.touches[0].clientY - touchStartY;
	if (delta > 80) {
		touchStartY = null;
		emit("close");
	}
}

function onTouchEnd() {
	touchStartY = null;
}
</script>
