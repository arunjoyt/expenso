import { computed, ref, watch } from "vue";
import { call } from "frappe-ui";

export function useBudgets(monthStore) {
	const categories = ref([]);
	const loading = ref(false);

	const budgetTotal = computed(() =>
		categories.value.reduce((sum, category) => sum + (category.budget_amount || 0), 0)
	);

	async function reload() {
		loading.value = true;
		try {
			categories.value = await call("expenso.expenso.api.get_budgets", {
				month: monthStore.month,
				year: monthStore.year,
			});
		} finally {
			loading.value = false;
		}
	}

	watch(() => [monthStore.month, monthStore.year], reload, { immediate: true });

	return { categories, budgetTotal, loading, reload };
}

export async function setBudget(category, month, year, amount) {
	return call("expenso.expenso.api.set_budget", { category, month, year, amount });
}
