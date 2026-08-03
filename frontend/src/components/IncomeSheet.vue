<template>
	<div>
		<div
			data-test="income-sheet-backdrop"
			class="fixed inset-0 z-40 bg-black/40"
			@click="$emit('close')"
		></div>
		<div
			data-test="income-sheet"
			class="fixed inset-x-0 bottom-0 z-50 animate-sheet-up rounded-t-3xl bg-white p-4 pb-6 shadow-2xl"
			@touchstart="onTouchStart"
			@touchmove="onTouchMove"
			@touchend="onTouchEnd"
		>
			<div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200" aria-hidden="true"></div>

			<div v-if="isEdit" class="mb-4">
				<h2 class="text-lg font-extrabold text-gray-900">✏️ Edit Income</h2>
			</div>
			<div v-else class="mb-4 flex gap-2" data-test="add-entry-tabs">
				<button
					type="button"
					data-test="tab-expense"
					class="rounded-full bg-gray-100 px-4 py-1.5 text-sm font-semibold text-gray-500"
					@click="$emit('switch-mode', 'expense')"
				>
					💸 Expense
				</button>
				<button
					type="button"
					data-test="tab-income"
					class="rounded-full bg-gradient-to-br from-accent-500 to-purple-600 px-4 py-1.5 text-sm font-semibold text-white"
				>
					💰 Income
				</button>
			</div>

			<form class="flex flex-col gap-4" @submit.prevent="submit">
				<Input
					data-test="income-amount-input"
					label="Amount"
					type="text"
					inputmode="decimal"
					:model-value="amount"
					@input="amount = sanitizeAmountInput($event)"
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
					data-test="income-notes-input"
					label="Notes"
					type="textarea"
					:model-value="notes"
					@input="notes = $event"
				/>
				<Input
					data-test="income-source-select"
					label="Source"
					type="select"
					v-model="source"
					:options="sourceOptions"
				/>
				<div
					v-if="creatingSource"
					data-test="new-source-inline"
					class="flex flex-col gap-2 rounded-2xl bg-gray-50 p-3"
				>
					<Input
						data-test="new-source-input"
						placeholder="New source name"
						:model-value="newSourceName"
						@input="newSourceName = $event"
					/>
					<ErrorMessage :message="newSourceError" />
					<div class="flex gap-2">
						<Button
							data-test="new-source-create-button"
							variant="solid"
							theme="blue"
							type="button"
							:loading="savingNewSource"
							:disabled="!newSourceName"
							@click="submitNewSource"
						>
							Create
						</Button>
						<Button
							data-test="new-source-cancel-button"
							variant="ghost"
							type="button"
							@click="cancelNewSource"
						>
							Cancel
						</Button>
					</div>
				</div>

				<ErrorMessage :message="errorMessage" />

				<Button
					data-test="income-submit-button"
					variant="solid"
					theme="blue"
					type="submit"
					:loading="saving"
					:disabled="!canSubmit"
				>
					{{ isEdit ? "✅ Save" : "✨ Add" }}
				</Button>

				<template v-if="isEdit && !confirmingDelete">
					<Button
						data-test="income-delete-button"
						variant="ghost"
						@click="confirmingDelete = true"
					>
						🗑️ Delete
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
import { computed, ref, watch } from "vue";
import { Input, Button, ErrorMessage } from "frappe-ui";
import { addSource, useSources } from "@/composables/useSources";
import { createIncome, updateIncome, deleteIncome } from "@/composables/useIncome";
import { parseAmount, sanitizeAmountInput } from "@/utils/parseAmount";

const NEW_SOURCE_VALUE = "__new_source__";

const props = defineProps({
	income: {
		type: Object,
		default: null,
	},
});

const emit = defineEmits(["close", "switch-mode"]);

const isEdit = computed(() => !!props.income);

function today() {
	return new Date().toISOString().slice(0, 10);
}

const amount = ref(props.income?.amount ?? "");
const date = ref(props.income?.date ?? today());
const source = ref(props.income?.source ?? "");
const notes = ref(props.income?.notes ?? "");

const { sources, reload: reloadSources } = useSources();
const sourceOptions = computed(() => [
	{ label: "None", value: "" },
	...sources.value.map((s) => ({ label: `💵 ${s.source_name}`, value: s.name })),
	{ label: "➕ New source", value: NEW_SOURCE_VALUE },
]);

const creatingSource = ref(false);
const newSourceName = ref("");
const newSourceError = ref("");
const savingNewSource = ref(false);

watch(source, (value) => {
	if (value === NEW_SOURCE_VALUE) {
		creatingSource.value = true;
	}
});

async function submitNewSource() {
	if (!newSourceName.value) return;
	newSourceError.value = "";
	savingNewSource.value = true;
	try {
		const created = await addSource(newSourceName.value);
		await reloadSources();
		source.value = created.name;
		creatingSource.value = false;
		newSourceName.value = "";
	} catch (error) {
		newSourceError.value =
			error?.messages?.join("\n") || error?.message || "Failed to create source";
	} finally {
		savingNewSource.value = false;
	}
}

function cancelNewSource() {
	creatingSource.value = false;
	newSourceName.value = "";
	newSourceError.value = "";
	source.value = "";
}

const canSubmit = computed(() => parseAmount(amount.value) > 0 && !creatingSource.value);

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
			amount: parseAmount(amount.value),
			date: date.value,
			source: source.value || null,
			notes: notes.value || null,
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
