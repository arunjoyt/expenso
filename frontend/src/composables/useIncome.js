import { onMounted, onUnmounted, ref, watch } from "vue";
import { call } from "frappe-ui";
import socket from "@/socket";

const REALTIME_EVENTS = ["income_created", "income_updated", "income_deleted"];

export function useIncome(monthStore) {
	const incomes = ref([]);
	const loading = ref(false);

	async function reload() {
		loading.value = true;
		try {
			incomes.value = await call("expenso.expenso.api.get_income", {
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

	return { incomes, loading, reload };
}

export async function createIncome({ amount, date, source, notes }) {
	return call("expenso.expenso.api.create_income", { amount, date, source, notes });
}

export async function updateIncome({ name, amount, date, source, notes }) {
	return call("expenso.expenso.api.update_income", { name, amount, date, source, notes });
}

export async function deleteIncome(name) {
	return call("expenso.expenso.api.delete_income", { name });
}
