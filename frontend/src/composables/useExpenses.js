import { ref, watch } from "vue";
import { call } from "frappe-ui";

export function useExpenses(monthStore) {
	const expenses = ref([]);
	const loading = ref(false);

	async function reload() {
		loading.value = true;
		try {
			expenses.value = await call("expenso.expenso.api.get_expenses", {
				month: monthStore.month,
				year: monthStore.year,
			});
		} finally {
			loading.value = false;
		}
	}

	watch(() => [monthStore.month, monthStore.year], reload, { immediate: true });

	return { expenses, loading, reload };
}
