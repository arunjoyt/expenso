import { ref } from "vue";
import { call } from "frappe-ui";

export function useBudgets() {
	const categories = ref([]);
	const loading = ref(false);

	async function reload() {
		loading.value = true;
		try {
			categories.value = await call("expenso.expenso.api.get_categories_with_budgets");
		} finally {
			loading.value = false;
		}
	}

	reload();

	return { categories, loading, reload };
}

export async function setBudget(category, amount) {
	return call("expenso.expenso.api.set_budget", { category, amount });
}
