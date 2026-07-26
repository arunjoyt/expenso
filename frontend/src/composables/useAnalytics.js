import { ref, watch } from "vue";
import { call } from "frappe-ui";

export function useAnalytics(monthStore) {
	const total = ref(0);
	const categories = ref([]);
	const incomeTotal = ref(0);
	const savings = ref(0);
	const budgetTotal = ref(0);
	const loading = ref(false);

	async function reload() {
		loading.value = true;
		try {
			const result = await call("expenso.expenso.api.get_analytics", {
				month: monthStore.month,
				year: monthStore.year,
			});
			total.value = result.total;
			categories.value = result.categories;
			incomeTotal.value = result.income_total;
			savings.value = result.savings;
			budgetTotal.value = result.budget_total;
		} finally {
			loading.value = false;
		}
	}

	watch(() => [monthStore.month, monthStore.year], reload, { immediate: true });

	return { total, categories, incomeTotal, savings, budgetTotal, loading, reload };
}
