<template>
	<div>
		<div
			data-test="sheet-backdrop"
			class="fixed inset-0 z-40 bg-black/40"
			@click="$emit('close')"
		></div>
		<div
			data-test="expense-sheet"
			class="fixed inset-x-0 bottom-0 z-50 animate-sheet-up rounded-t-3xl bg-white p-4 pb-6 shadow-2xl"
			@touchstart="onTouchStart"
			@touchmove="onTouchMove"
			@touchend="onTouchEnd"
		>
			<div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200" aria-hidden="true"></div>

			<div v-if="isEdit" class="mb-4">
				<h2 class="text-lg font-extrabold text-gray-900">✏️ Edit Expense</h2>
			</div>
			<div v-else class="mb-4 flex gap-2" data-test="add-entry-tabs">
				<button
					type="button"
					data-test="tab-expense"
					class="rounded-full bg-gradient-to-br from-accent-500 to-purple-600 px-4 py-1.5 text-sm font-semibold text-white"
				>
					💸 Expense
				</button>
				<button
					type="button"
					data-test="tab-income"
					class="rounded-full bg-gray-100 px-4 py-1.5 text-sm font-semibold text-gray-500"
					@click="$emit('switch-mode', 'income')"
				>
					💰 Income
				</button>
			</div>
			<div
				v-if="isEdit && expense.is_external_write"
				data-test="external-write-marker"
				class="mb-4 flex flex-col gap-1 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800"
			>
				<span class="font-semibold">💬 Unreviewed external write</span>
				<span v-if="expense.external_write_message" data-test="external-write-message">
					"{{ expense.external_write_message }}"
				</span>
			</div>

			<form class="flex flex-col gap-4" @submit.prevent="submit">
				<Input
					data-test="amount-input"
					label="Amount"
					type="text"
					inputmode="decimal"
					:model-value="amount"
					@input="amount = sanitizeAmountInput($event)"
					required
				/>
				<Input
					data-test="date-input"
					label="Date"
					type="date"
					:model-value="date"
					@input="date = $event"
				/>
				<Input
					data-test="notes-input"
					label="Notes"
					type="textarea"
					:model-value="notes"
					@input="notes = $event"
				/>
				<Input
					data-test="category-select"
					label="Category"
					type="select"
					v-model="category"
					:options="categoryOptions"
				/>
				<div
					v-if="creatingCategory"
					data-test="new-category-inline"
					class="flex flex-col gap-2 rounded-2xl bg-gray-50 p-3"
				>
					<Input
						data-test="new-category-input"
						placeholder="New category name"
						:model-value="newCategoryName"
						@input="newCategoryName = $event"
					/>
					<ErrorMessage :message="newCategoryError" />
					<div class="flex gap-2">
						<Button
							data-test="new-category-create-button"
							variant="solid"
							theme="blue"
							type="button"
							:loading="savingNewCategory"
							:disabled="!newCategoryName"
							@click="submitNewCategory"
						>
							Create
						</Button>
						<Button
							data-test="new-category-cancel-button"
							variant="ghost"
							type="button"
							@click="cancelNewCategory"
						>
							Cancel
						</Button>
					</div>
				</div>

				<ErrorMessage :message="errorMessage" />

				<Button
					data-test="submit-button"
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
						data-test="delete-button"
						variant="ghost"
						@click="confirmingDelete = true"
					>
						🗑️ Delete
					</Button>
				</template>

				<div v-if="isEdit && confirmingDelete" class="flex flex-col gap-2">
					<p class="text-sm text-gray-700">Delete this expense?</p>
					<div class="flex gap-2">
						<Button
							data-test="confirm-delete-button"
							variant="solid"
							theme="red"
							:loading="deleting"
							@click="confirmDelete"
						>
							Confirm Delete
						</Button>
						<Button
							data-test="cancel-delete-button"
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
import { addCategory, useCategories } from "@/composables/useCategories";
import { createExpense, updateExpense, deleteExpense } from "@/composables/useExpenses";
import { getCategoryVisual } from "@/utils/categoryStyle";
import { parseAmount, sanitizeAmountInput } from "@/utils/parseAmount";

const NEW_CATEGORY_VALUE = "__new_category__";

const props = defineProps({
	expense: {
		type: Object,
		default: null,
	},
});

const emit = defineEmits(["close", "switch-mode"]);

const isEdit = computed(() => !!props.expense);

function today() {
	return new Date().toISOString().slice(0, 10);
}

const amount = ref(props.expense?.amount ?? "");
const date = ref(props.expense?.date ?? today());
const category = ref(props.expense?.category ?? "");
const notes = ref(props.expense?.notes ?? "");

const { categories, reload: reloadCategories } = useCategories();
const categoryOptions = computed(() => [
	{ label: `${getCategoryVisual().emoji} Uncategorized`, value: "" },
	...categories.value.map((c) => ({
		label: `${getCategoryVisual(c.category_name).emoji} ${c.category_name}`,
		value: c.name,
	})),
	{ label: "➕ New category", value: NEW_CATEGORY_VALUE },
]);

const creatingCategory = ref(false);
const newCategoryName = ref("");
const newCategoryError = ref("");
const savingNewCategory = ref(false);

watch(category, (value) => {
	if (value === NEW_CATEGORY_VALUE) {
		creatingCategory.value = true;
	}
});

async function submitNewCategory() {
	if (!newCategoryName.value) return;
	newCategoryError.value = "";
	savingNewCategory.value = true;
	try {
		const created = await addCategory(newCategoryName.value);
		await reloadCategories();
		category.value = created.name;
		creatingCategory.value = false;
		newCategoryName.value = "";
	} catch (error) {
		newCategoryError.value =
			error?.messages?.join("\n") || error?.message || "Failed to create category";
	} finally {
		savingNewCategory.value = false;
	}
}

function cancelNewCategory() {
	creatingCategory.value = false;
	newCategoryName.value = "";
	newCategoryError.value = "";
	category.value = "";
}

const canSubmit = computed(() => parseAmount(amount.value) > 0 && !creatingCategory.value);

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
			category: category.value || null,
			notes: notes.value || null,
		};
		if (isEdit.value) {
			await updateExpense({ name: props.expense.name, ...payload });
		} else {
			await createExpense(payload);
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
		await deleteExpense(props.expense.name);
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
