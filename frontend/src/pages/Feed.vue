<template>
	<div class="min-h-screen pb-32">
		<div class="px-4 pt-5">
			<div class="flex items-center justify-between">
				<p class="text-base font-extrabold text-gray-900">Expenso</p>
				<p v-if="familyName" class="text-base font-extrabold text-gray-900">
					{{ familyName }}
				</p>
			</div>
		</div>

		<MonthNav />

		<div
			class="mx-4 mb-6 mt-4 rounded-3xl bg-gradient-to-br from-accent-500 to-purple-600 p-5 text-white shadow-lg shadow-blue-200"
		>
			<p class="text-sm font-semibold text-blue-100">💸 Spent this month</p>
			<p class="mt-1 text-3xl font-extrabold tracking-tight">{{ formattedTotal }}</p>
		</div>

		<div class="px-4">
			<div
				v-if="!loading && groupedExpenses.length === 0"
				class="flex flex-col items-center gap-1 py-16 text-center text-gray-500"
			>
				<span class="text-4xl">🎉</span>
				<span>No expenses this month</span>
				<span class="text-sm text-gray-400">Tap + to log your first one</span>
			</div>

			<div v-for="group in groupedExpenses" :key="group.label" class="mb-5">
				<div
					data-test="date-group-header"
					class="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-gray-400"
				>
					{{ group.label }}
				</div>
				<div class="flex flex-col gap-2">
					<div
						v-for="expense in group.expenses"
						:key="expense.name"
						data-test="expense-row"
						class="flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-3 shadow-sm transition active:scale-[0.98]"
						@click="openEdit(expense)"
					>
						<span
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
							:class="getCategoryVisual(expense.category_name).bg"
						>
							{{ getCategoryVisual(expense.category_name).emoji }}
						</span>
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="font-medium text-gray-800">{{
								expense.category_name || "Uncategorized"
							}}</span>
							<span
								v-if="expense.notes"
								data-test="expense-notes"
								class="truncate text-sm text-gray-400"
							>
								{{ expense.notes }}
							</span>
						</span>
						<span class="font-bold text-gray-900">{{
							formatAmount(expense.amount)
						}}</span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div
		v-if="menuOpen"
		data-test="fab-menu-backdrop"
		class="fixed inset-0 z-30"
		@click="menuOpen = false"
	></div>

	<div class="fixed bottom-20 right-6 z-40 flex flex-col items-end gap-3">
		<template v-if="menuOpen">
			<button
				type="button"
				data-test="fab-add-income"
				class="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-lg transition active:scale-95"
				@click="openAddIncome"
			>
				💰 Add Income
			</button>
			<button
				type="button"
				data-test="fab-add-expense"
				class="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-lg transition active:scale-95"
				@click="openAddExpense"
			>
				💸 Add Expense
			</button>
		</template>
		<button
			type="button"
			data-test="fab"
			aria-label="Add"
			class="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-purple-600 text-2xl text-white shadow-lg shadow-blue-300 transition hover:scale-105 active:scale-90"
			@click="menuOpen = !menuOpen"
		>
			+
		</button>
	</div>

	<ExpenseSheet v-if="expenseSheetOpen" :expense="editingExpense" @close="closeExpenseSheet" />
	<IncomeSheet v-if="incomeSheetOpen" @close="closeIncomeSheet" />
</template>

<script setup>
import { computed, ref } from "vue";
import { useMonthStore } from "@/stores/month";
import { useExpenses } from "@/composables/useExpenses";
import { useFamily } from "@/composables/useFamily";
import { dateGroupLabel } from "@/utils/dateGroup";
import { getCategoryVisual } from "@/utils/categoryStyle";
import ExpenseSheet from "@/components/ExpenseSheet.vue";
import IncomeSheet from "@/components/IncomeSheet.vue";
import MonthNav from "@/components/MonthNav.vue";

const monthStore = useMonthStore();
const { expenses, loading, reload } = useExpenses(monthStore);
const { familyName } = useFamily();

const menuOpen = ref(false);
const expenseSheetOpen = ref(false);
const incomeSheetOpen = ref(false);
const editingExpense = ref(null);

function openAddExpense() {
	menuOpen.value = false;
	editingExpense.value = null;
	expenseSheetOpen.value = true;
}

function openAddIncome() {
	menuOpen.value = false;
	incomeSheetOpen.value = true;
}

function openEdit(expense) {
	editingExpense.value = expense;
	expenseSheetOpen.value = true;
}

function closeExpenseSheet() {
	expenseSheetOpen.value = false;
	editingExpense.value = null;
	reload();
}

function closeIncomeSheet() {
	incomeSheetOpen.value = false;
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
