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
			class="mx-4 mb-6 mt-4 flex items-center justify-between rounded-3xl bg-gradient-to-br from-accent-500 to-purple-600 p-5 text-white shadow-lg shadow-blue-200"
		>
			<div>
				<p class="text-sm font-semibold text-blue-100">💰 Income</p>
				<p
					class="mt-1 text-2xl font-extrabold tracking-tight"
					data-test="feed-income-total"
				>
					{{ formattedIncomeTotal }}
				</p>
			</div>
			<div class="text-center">
				<p class="text-sm font-semibold text-blue-100">💸 Expense</p>
				<p
					class="mt-1 text-2xl font-extrabold tracking-tight"
					data-test="feed-expense-total"
				>
					{{ formattedTotal }}
				</p>
			</div>
			<div class="text-right">
				<p class="text-sm font-semibold text-blue-100">⚖️ Balance</p>
				<p
					class="mt-1 text-2xl font-extrabold tracking-tight"
					data-test="feed-balance-total"
				>
					{{ formattedBalance }}
				</p>
			</div>
		</div>

		<div class="px-4">
			<div
				v-if="!loading && groupedEntries.length === 0"
				class="flex flex-col items-center gap-1 py-16 text-center text-gray-500"
			>
				<span class="text-4xl">🎉</span>
				<span>No activity this month</span>
				<span class="text-sm text-gray-400">Tap + to log your first one</span>
			</div>

			<div v-for="group in groupedEntries" :key="group.label" class="mb-5">
				<div
					data-test="date-group-header"
					class="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-gray-400"
				>
					{{ group.label }}
				</div>
				<div class="flex flex-col gap-2">
					<div
						v-for="entry in group.entries"
						:key="`${entry.type}-${entry.name}`"
						:data-test="entry.type === 'income' ? 'income-row' : 'expense-row'"
						class="flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-3 shadow-sm transition active:scale-[0.98]"
						@click="
							entry.type === 'income'
								? openEditIncome(entry)
								: openEditExpense(entry)
						"
					>
						<span
							v-if="entry.type === 'income'"
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-lg"
						>
							💰
						</span>
						<span
							v-else
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
							:class="getCategoryVisual(entry.category_name).bg"
						>
							{{ getCategoryVisual(entry.category_name).emoji }}
						</span>
						<span class="flex min-w-0 flex-1 flex-col">
							<template v-if="entry.notes">
								<span
									:data-test="
										entry.type === 'income' ? 'income-notes' : 'expense-notes'
									"
									class="truncate font-medium text-gray-800"
								>
									{{ entry.notes }}
								</span>
								<span class="truncate text-sm text-gray-400">
									{{ entryLabel(entry) }}
								</span>
							</template>
							<span v-else class="truncate font-medium text-gray-800">
								{{ entryLabel(entry) }}
							</span>
						</span>
						<span
							class="font-bold"
							:class="entry.type === 'income' ? 'text-green-600' : 'text-gray-900'"
						>
							{{ entry.type === "income" ? "+" : ""
							}}{{ formatAmount(entry.amount) }}
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed } from "vue";
import { useMonthStore } from "@/stores/month";
import { useExpenses } from "@/composables/useExpenses";
import { useIncome } from "@/composables/useIncome";
import { useFamily } from "@/composables/useFamily";
import { useEntrySheet } from "@/composables/useEntrySheet";
import { dateGroupLabel } from "@/utils/dateGroup";
import { getCategoryVisual } from "@/utils/categoryStyle";
import MonthNav from "@/components/MonthNav.vue";

const monthStore = useMonthStore();
const { expenses, loading: expensesLoading } = useExpenses(monthStore);
const { incomes, loading: incomeLoading } = useIncome(monthStore);
const { familyName } = useFamily();
// The Add/Edit sheet is global (App.vue); a row tap just opens it. After a save
// the realtime socket events refresh the lists, so Feed no longer reloads here.
const { openEditExpense, openEditIncome } = useEntrySheet();

const loading = computed(() => expensesLoading.value || incomeLoading.value);

function formatAmount(amount) {
	return new Intl.NumberFormat().format(amount);
}

function entryLabel(entry) {
	const label = entry.type === "income" ? entry.source_name : entry.category_name;
	if (label) return label;
	return entry.type === "income" ? "No source" : "Uncategorized";
}

const total = computed(() => expenses.value.reduce((sum, expense) => sum + expense.amount, 0));
const formattedTotal = computed(() => formatAmount(total.value));

const incomeTotal = computed(() => incomes.value.reduce((sum, income) => sum + income.amount, 0));
const formattedIncomeTotal = computed(() => formatAmount(incomeTotal.value));

const balance = computed(() => incomeTotal.value - total.value);
const formattedBalance = computed(() => formatAmount(balance.value));

const groupedEntries = computed(() => {
	const merged = [
		...expenses.value.map((expense) => ({ ...expense, type: "expense" })),
		...incomes.value.map((income) => ({ ...income, type: "income" })),
	];
	merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

	const groups = [];
	const byLabel = new Map();

	for (const entry of merged) {
		const label = dateGroupLabel(entry.date);
		if (!byLabel.has(label)) {
			const group = { label, entries: [] };
			byLabel.set(label, group);
			groups.push(group);
		}
		byLabel.get(label).entries.push(entry);
	}

	return groups;
});
</script>
