<template>
	<div class="p-4">
		<h1 class="mb-4 text-lg font-semibold text-gray-900">Analytics</h1>

		<div class="mb-4 text-2xl font-semibold text-gray-900" data-test="monthly-total">
			{{ formattedTotal }}
		</div>

		<div class="mb-1 flex justify-between text-sm text-gray-700" data-test="income-total">
			<span>Income</span>
			<span>{{ formattedIncomeTotal }}</span>
		</div>
		<div
			class="mb-4 flex justify-between text-sm font-medium text-gray-900"
			data-test="savings"
		>
			<span>Savings</span>
			<span>{{ formattedSavings }}</span>
		</div>

		<button
			type="button"
			data-test="add-income-button"
			class="mb-4 rounded-lg bg-accent-600 px-4 py-2 text-sm text-white hover:bg-accent-700"
			@click="sheetOpen = true"
		>
			Add Income
		</button>

		<div v-if="!loading && categories.length === 0" class="py-12 text-center text-gray-500">
			No expenses this month
		</div>

		<div
			v-for="category in categories"
			:key="category.name"
			data-test="category-row"
			class="flex justify-between border-b border-gray-100 py-2"
		>
			<span class="flex items-center gap-2">
				{{ category.name }}
				<span
					v-if="category.budget_status === 'Warning'"
					data-test="budget-status-warning"
					class="h-2 w-2 rounded-full bg-yellow-400"
				></span>
				<span
					v-if="category.budget_status === 'Exceeded'"
					data-test="budget-status-exceeded"
					class="h-2 w-2 rounded-full bg-red-500"
				></span>
			</span>
			<span>{{ formatAmount(category.amount) }}</span>
		</div>

		<IncomeSheet v-if="sheetOpen" @close="closeSheet" />
	</div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useMonthStore } from "@/stores/month";
import { useAnalytics } from "@/composables/useAnalytics";
import IncomeSheet from "@/components/IncomeSheet.vue";

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
</script>
