<template>
	<div class="p-4">
		<h1 class="mb-4 text-lg font-semibold text-gray-900">Analytics</h1>

		<div class="mb-4 text-2xl font-semibold text-gray-900" data-test="monthly-total">
			{{ formattedTotal }}
		</div>

		<div v-if="!loading && categories.length === 0" class="py-12 text-center text-gray-500">
			No expenses this month
		</div>

		<div
			v-for="category in categories"
			:key="category.name"
			data-test="category-row"
			class="flex justify-between border-b border-gray-100 py-2"
		>
			<span>{{ category.name }}</span>
			<span>{{ formatAmount(category.amount) }}</span>
		</div>
	</div>
</template>

<script setup>
import { computed } from "vue";
import { useMonthStore } from "@/stores/month";
import { useAnalytics } from "@/composables/useAnalytics";

const monthStore = useMonthStore();
const { total, categories, loading } = useAnalytics(monthStore);

function formatAmount(amount) {
	return new Intl.NumberFormat().format(amount);
}

const formattedTotal = computed(() => formatAmount(total.value));
</script>
