import { ref } from "vue";
import { call } from "frappe-ui";

export function useSources() {
	const sources = ref([]);
	const loading = ref(false);

	async function reload() {
		loading.value = true;
		try {
			sources.value = await call("frappe.client.get_list", {
				doctype: "Source",
				fields: ["name", "source_name"],
				limit_page_length: 0,
				order_by: "source_name asc",
			});
		} finally {
			loading.value = false;
		}
	}

	reload();

	return { sources, loading, reload };
}

export async function addSource(name) {
	return call("expenso.expenso.api.add_source", { name });
}

export async function renameSource(name, newName) {
	return call("expenso.expenso.api.rename_source", { name, new_name: newName });
}
