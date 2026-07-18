<template>
	<div class="p-4">
		<div class="mb-2 flex justify-end">
			<router-link to="/settings" aria-label="Settings" class="text-xl">⚙</router-link>
		</div>

		<div class="mb-4 flex items-center justify-between">
			<button type="button" aria-label="Previous month" @click="monthStore.prevMonth()">
				‹
			</button>
			<h1 class="text-lg font-semibold text-gray-900">{{ monthStore.label }}</h1>
			<button type="button" aria-label="Next month" @click="monthStore.nextMonth()">
				›
			</button>
		</div>

		<div class="mb-4 text-2xl font-semibold text-gray-900">{{ formattedTotal }}</div>

		<div
			v-if="!loading && groupedExpenses.length === 0"
			class="py-12 text-center text-gray-500"
		>
			No expenses this month
		</div>

		<div v-for="group in groupedExpenses" :key="group.label" class="mb-4">
			<div data-test="date-group-header" class="mb-2 text-sm font-medium text-gray-500">
				{{ group.label }}
			</div>
			<div
				v-for="expense in group.expenses"
				:key="expense.name"
				data-test="expense-row"
				class="flex cursor-pointer justify-between border-b border-gray-100 py-2"
				@click="openEdit(expense)"
			>
				<span>{{ expense.category_name || "Uncategorized" }}</span>
				<span>{{ formatAmount(expense.amount) }}</span>
			</div>
		</div>
	</div>

	<button
		type="button"
		data-test="fab"
		aria-label="Add expense"
		class="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-2xl text-white shadow-lg"
		@click="openAdd"
	>
		+
	</button>

	<ExpenseSheet v-if="sheetOpen" :expense="editingExpense" @close="closeSheet" />
</template>

<script setup>
import { computed, ref } from "vue";
import { useMonthStore } from "@/stores/month";
import { useExpenses } from "@/composables/useExpenses";
import { dateGroupLabel } from "@/utils/dateGroup";
import ExpenseSheet from "@/components/ExpenseSheet.vue";

const monthStore = useMonthStore();
const { expenses, loading } = useExpenses(monthStore);

const sheetOpen = ref(false);
const editingExpense = ref(null);

function openAdd() {
	editingExpense.value = null;
	sheetOpen.value = true;
}

function openEdit(expense) {
	editingExpense.value = expense;
	sheetOpen.value = true;
}

function closeSheet() {
	sheetOpen.value = false;
	editingExpense.value = null;
}

function formatAmount(amount) {
	return new Intl.NumberFormat().format(amount);
}

const total = computed(() => expenses.value.reduce((sum, expense) => sum + expense.amount, 0));
const formattedTotal = computed(() => formatAmount(total.value));

const groupedExpenses = computed(() => {
	const groups = [];
	const byLabel = new Map();

	for (const expense of expenses.value) {
		const label = dateGroupLabel(expense.date);
		if (!byLabel.has(label)) {
			const group = { label, expenses: [] };
			byLabel.set(label, group);
			groups.push(group);
		}
		byLabel.get(label).expenses.push(expense);
	}

	return groups;
});
</script>
