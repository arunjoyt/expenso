<template>
	<div class="min-h-screen px-4 pb-24 pt-5">
		<h1 class="mb-4 text-lg font-extrabold text-gray-900">💰 Budget</h1>

		<MonthNav />

		<div
			v-if="!loading && categories.length === 0"
			class="py-12 text-center text-gray-500"
			data-test="budget-empty-state"
		>
			No categories yet
		</div>

		<div class="mt-4 flex flex-col gap-2">
			<div
				v-for="category in categories"
				:key="category.name"
				data-test="budget-category-row"
				class="flex items-center justify-between gap-2 rounded-2xl bg-white p-3 shadow-sm"
			>
				<div class="flex min-w-0 items-center gap-2">
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
						:class="getCategoryVisual(category.category_name).bg"
					>
						{{ getCategoryVisual(category.category_name).emoji }}
					</span>
					<span class="truncate font-medium text-gray-800">{{ category.category_name }}</span>
				</div>

				<button
					type="button"
					data-test="budget-open-button"
					class="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition active:scale-95"
					@click="budgetSheetCategory = category"
				>
					{{
						category.budget_amount != null
							? formatAmount(category.budget_amount)
							: "Set Budget"
					}}
				</button>
			</div>
		</div>

		<BudgetSheet
			v-if="budgetSheetCategory"
			:category="budgetSheetCategory"
			:month="monthStore.month"
			:year="monthStore.year"
			@close="closeBudgetSheet"
		/>
	</div>
</template>

<script setup>
import { ref } from "vue";
import { useMonthStore } from "@/stores/month";
import { useBudgets } from "@/composables/useBudgets";
import { getCategoryVisual } from "@/utils/categoryStyle";
import BudgetSheet from "@/components/BudgetSheet.vue";
import MonthNav from "@/components/MonthNav.vue";

const monthStore = useMonthStore();
const { categories, loading, reload } = useBudgets(monthStore);

function formatAmount(amount) {
	return new Intl.NumberFormat().format(amount);
}

const budgetSheetCategory = ref(null);

async function closeBudgetSheet() {
	budgetSheetCategory.value = null;
	await reload();
}
</script>
