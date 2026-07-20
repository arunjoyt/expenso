import { onMounted, onUnmounted, ref, watch } from "vue";
import { call } from "frappe-ui";
import socket from "@/socket";

const REALTIME_EVENTS = ["expense_created", "expense_updated", "expense_deleted"];

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

	onMounted(() => {
		for (const event of REALTIME_EVENTS) {
			socket.on(event, reload);
		}
	});

	onUnmounted(() => {
		for (const event of REALTIME_EVENTS) {
			socket.off(event, reload);
		}
	});

	return { expenses, loading, reload };
}

export async function createExpense({ amount, date, category, notes }) {
	return call("expenso.expenso.api.create_expense", { amount, date, category, notes });
}

export async function updateExpense({ name, amount, date, category, notes }) {
	return call("expenso.expenso.api.update_expense", { name, amount, date, category, notes });
}

export async function deleteExpense(name) {
	return call("expenso.expenso.api.delete_expense", { name });
}
