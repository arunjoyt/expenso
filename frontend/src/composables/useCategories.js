import { ref } from "vue";
import { call } from "frappe-ui";

export function useCategories() {
	const categories = ref([]);
	const loading = ref(false);

	async function reload() {
		loading.value = true;
		try {
			categories.value = await call("frappe.client.get_list", {
				doctype: "Category",
				fields: ["name", "category_name"],
				limit_page_length: 0,
				order_by: "category_name asc",
			});
		} finally {
			loading.value = false;
		}
	}

	reload();

	return { categories, loading, reload };
}

export async function addCategory(name) {
	return call("expenso.expenso.api.add_category", { name });
}

export async function renameCategory(name, newName) {
	return call("expenso.expenso.api.rename_category", { name, new_name: newName });
}
