import { ref } from "vue";
import { call } from "frappe-ui";

export function useFamily() {
	const familyName = ref("");
	const loading = ref(false);

	async function reload() {
		loading.value = true;
		try {
			familyName.value = await call("expenso.expenso.api.get_family_name");
		} finally {
			loading.value = false;
		}
	}

	reload();

	return { familyName, loading, reload };
}
