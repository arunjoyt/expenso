<template>
	<div class="min-h-screen px-4 pb-24 pt-5">
		<h1 class="mb-4 text-lg font-extrabold text-gray-900">📊 Analytics</h1>

		<MonthNav />

		<div class="mb-5 mt-4 grid grid-cols-3 gap-2">
			<div class="rounded-2xl bg-white p-3 text-center shadow-sm">
				<p class="text-lg">💸</p>
				<p class="text-xs font-semibold text-gray-400">Spent</p>
				<p class="text-sm font-bold text-gray-900" data-test="monthly-total">
					{{ formattedTotal }}
				</p>
			</div>
			<div class="rounded-2xl bg-white p-3 text-center shadow-sm" data-test="income-total">
				<p class="text-lg">💰</p>
				<p class="text-xs font-semibold text-gray-400">Income</p>
				<p class="text-sm font-bold text-green-600">{{ formattedIncomeTotal }}</p>
			</div>
			<div class="rounded-2xl bg-white p-3 text-center shadow-sm" data-test="savings">
				<p class="text-lg">{{ savings >= 0 ? "🐷" : "😬" }}</p>
				<p class="text-xs font-semibold text-gray-400">Savings</p>
				<p
					class="text-sm font-bold"
					:class="savings >= 0 ? 'text-green-600' : 'text-red-600'"
				>
					{{ formattedSavings }}
				</p>
			</div>
		</div>

		<button
			type="button"
			data-test="add-income-button"
			class="mb-5 flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-95"
			@click="sheetOpen = true"
		>
			<span>➕</span> Add Income
		</button>

		<div v-if="!loading && categories.length === 0" class="py-12 text-center text-gray-500">
			No expenses this month
		</div>

		<div class="flex flex-col gap-2">
			<div
				v-for="category in categories"
				:key="category.name"
				data-test="category-row"
				class="rounded-2xl bg-white p-3 shadow-sm"
			>
				<div class="mb-2 flex items-center justify-between gap-2">
					<span class="flex min-w-0 items-center gap-2 font-medium text-gray-800">
						<span
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
							:class="getCategoryVisual(category.name).bg"
						>
							{{ getCategoryVisual(category.name).emoji }}
						</span>
						<span class="truncate">{{ category.name }}</span>
						<span
							v-if="category.budget_status === 'Warning'"
							data-test="budget-status-warning"
							class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
						>
							⚠️ Near limit
						</span>
						<span
							v-if="category.budget_status === 'Exceeded'"
							data-test="budget-status-exceeded"
							class="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
						>
							🚨 Over budget
						</span>
					</span>
					<span class="shrink-0 font-bold text-gray-900">{{
						formatAmount(category.amount)
					}}</span>
				</div>
				<div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
					<div
						data-test="budget-bar-fill"
						class="h-full rounded-full bg-accent-500 transition-all duration-500"
						:style="{ width: barWidth(category) + '%' }"
					></div>
				</div>
				<div
					v-if="category.budget"
					data-test="budget-summary"
					class="mt-1.5 flex items-center justify-between gap-2 text-xs text-gray-600"
				>
					<span
						>Budget {{ formatAmount(category.budget) }} · Balance
						{{ formatAmount(category.budget - category.amount) }}</span
					>
					<span class="shrink-0 font-semibold text-gray-800"
						>{{ budgetPercent(category) }}%</span
					>
				</div>
				<div v-else data-test="budget-summary-none" class="mt-1.5 text-xs text-gray-400">
					No budget set
				</div>
			</div>
		</div>

		<IncomeSheet v-if="sheetOpen" @close="closeSheet" />
	</div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useMonthStore } from "@/stores/month";
import { useAnalytics } from "@/composables/useAnalytics";
import { getCategoryVisual } from "@/utils/categoryStyle";
import IncomeSheet from "@/components/IncomeSheet.vue";
import MonthNav from "@/components/MonthNav.vue";

const monthStore = useMonthStore();
const { total, categories, incomeTotal, savings, loading, reload } = useAnalytics(monthStore);

const sheetOpen = ref(false);

function closeSheet() {
	sheetOpen.value = false;
	reload();
}

function formatAmount(amount) {
	return new Intl.NumberFormat().format(amount);
}

const formattedTotal = computed(() => formatAmount(total.value));
const formattedIncomeTotal = computed(() => formatAmount(incomeTotal.value));
const formattedSavings = computed(() => formatAmount(savings.value));

const maxCategoryAmount = computed(() =>
	categories.value.reduce((max, category) => Math.max(max, category.amount), 0)
);

function barWidth(category) {
	if (category.budget) {
		return Math.min(100, (category.amount / category.budget) * 100);
	}
	if (!maxCategoryAmount.value) return 0;
	return Math.min(100, (category.amount / maxCategoryAmount.value) * 100);
}

function budgetPercent(category) {
	return Math.round((category.amount / category.budget) * 100);
}
</script>
