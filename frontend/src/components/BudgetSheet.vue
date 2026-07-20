<template>
	<div>
		<div
			data-test="budget-sheet-backdrop"
			class="fixed inset-0 z-40 bg-black/40"
			@click="$emit('close')"
		></div>
		<div
			data-test="budget-sheet"
			class="fixed inset-x-0 bottom-0 z-50 animate-sheet-up rounded-t-3xl bg-white p-4 pb-6 shadow-2xl"
			@touchstart="onTouchStart"
			@touchmove="onTouchMove"
			@touchend="onTouchEnd"
		>
			<div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200" aria-hidden="true"></div>
			<h2 class="mb-4 text-lg font-extrabold text-gray-900">
				💰 Set Budget: {{ category.category_name }}
			</h2>

			<form class="flex flex-col gap-4" @submit.prevent="submit">
				<Input
					data-test="budget-sheet-amount-input"
					label="Budget Amount"
					type="number"
					:model-value="amount"
					@input="amount = $event"
				/>

				<ErrorMessage :message="errorMessage" />

				<Button
					data-test="budget-sheet-save-button"
					variant="solid"
					theme="blue"
					type="submit"
					:loading="saving"
				>
					✅ Save
				</Button>

				<Button
					v-if="hasBudget"
					data-test="budget-sheet-remove-button"
					variant="ghost"
					type="button"
					:loading="removing"
					@click="remove"
				>
					🗑️ Remove Budget
				</Button>
			</form>
		</div>
	</div>
</template>

<script setup>
import { computed, ref } from "vue";
import { Input, Button, ErrorMessage } from "frappe-ui";
import { setBudget } from "@/composables/useBudgets";

const props = defineProps({
	category: {
		type: Object,
		required: true,
	},
});

const emit = defineEmits(["close"]);

const amount = ref(props.category.budget_amount ?? "");
const hasBudget = computed(() => props.category.budget_amount != null);

const saving = ref(false);
const removing = ref(false);
const errorMessage = ref("");

async function submit() {
	errorMessage.value = "";
	saving.value = true;
	try {
		const raw = amount.value;
		const value = raw === "" || raw === null ? null : Number(raw);
		await setBudget(props.category.name, value);
		emit("close");
	} catch (error) {
		errorMessage.value = error?.messages?.join("\n") || error?.message || "Failed to save";
	} finally {
		saving.value = false;
	}
}

async function remove() {
	errorMessage.value = "";
	removing.value = true;
	try {
		await setBudget(props.category.name, null);
		emit("close");
	} catch (error) {
		errorMessage.value = error?.messages?.join("\n") || error?.message || "Failed to remove";
	} finally {
		removing.value = false;
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
