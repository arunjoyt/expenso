<template>
	<div>
		<div
			data-test="income-sheet-backdrop"
			class="fixed inset-0 z-40 bg-black/40"
			@click="$emit('close')"
		></div>
		<div
			data-test="income-sheet"
			class="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white p-4 pb-6"
			@touchstart="onTouchStart"
			@touchmove="onTouchMove"
			@touchend="onTouchEnd"
		>
			<h2 class="mb-4 text-lg font-semibold text-gray-900">
				{{ isEdit ? "Edit Income" : "Add Income" }}
			</h2>

			<form class="flex flex-col gap-4" @submit.prevent="submit">
				<Input
					data-test="income-amount-input"
					label="Amount"
					type="number"
					:model-value="amount"
					@input="amount = $event"
					required
				/>
				<Input
					data-test="income-date-input"
					label="Date"
					type="date"
					:model-value="date"
					@input="date = $event"
				/>
				<Input
					data-test="income-source-select"
					label="Source"
					type="select"
					v-model="source"
					:options="sourceOptions"
				/>

				<ErrorMessage :message="errorMessage" />

				<Button
					data-test="income-submit-button"
					variant="solid"
					type="submit"
					:loading="saving"
					:disabled="!canSubmit"
				>
					{{ isEdit ? "Save" : "Add" }}
				</Button>

				<template v-if="isEdit && !confirmingDelete">
					<Button
						data-test="income-delete-button"
						variant="ghost"
						@click="confirmingDelete = true"
					>
						Delete
					</Button>
				</template>

				<div v-if="isEdit && confirmingDelete" class="flex flex-col gap-2">
					<p class="text-sm text-gray-700">Delete this income?</p>
					<div class="flex gap-2">
						<Button
							data-test="income-confirm-delete-button"
							variant="solid"
							theme="red"
							:loading="deleting"
							@click="confirmDelete"
						>
							Confirm Delete
						</Button>
						<Button
							data-test="income-cancel-delete-button"
							variant="ghost"
							@click="confirmingDelete = false"
						>
							Cancel
						</Button>
					</div>
				</div>
			</form>
		</div>
	</div>
</template>

<script setup>
import { computed, ref } from "vue";
import { Input, Button, ErrorMessage } from "frappe-ui";
import { useSources } from "@/composables/useSources";
import { createIncome, updateIncome, deleteIncome } from "@/composables/useIncome";

const props = defineProps({
	income: {
		type: Object,
		default: null,
	},
});

const emit = defineEmits(["close"]);

const isEdit = computed(() => !!props.income);

function today() {
	return new Date().toISOString().slice(0, 10);
}

const amount = ref(props.income?.amount ?? "");
const date = ref(props.income?.date ?? today());
const source = ref(props.income?.source ?? "");

const { sources } = useSources();
const sourceOptions = computed(() => [
	{ label: "None", value: "" },
	...sources.value.map((s) => ({ label: s.source_name, value: s.name })),
]);

const canSubmit = computed(() => Number(amount.value) > 0);

const saving = ref(false);
const deleting = ref(false);
const confirmingDelete = ref(false);
const errorMessage = ref("");

async function submit() {
	if (!canSubmit.value) return;
	errorMessage.value = "";
	saving.value = true;
	try {
		const payload = {
			amount: Number(amount.value),
			date: date.value,
			source: source.value || null,
		};
		if (isEdit.value) {
			await updateIncome({ name: props.income.name, ...payload });
		} else {
			await createIncome(payload);
		}
		emit("close");
	} catch (error) {
		errorMessage.value = error?.messages?.join("\n") || error?.message || "Failed to save";
	} finally {
		saving.value = false;
	}
}

async function confirmDelete() {
	errorMessage.value = "";
	deleting.value = true;
	try {
		await deleteIncome(props.income.name);
		emit("close");
	} catch (error) {
		errorMessage.value = error?.messages?.join("\n") || error?.message || "Failed to delete";
	} finally {
		deleting.value = false;
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
