import { reactive, computed } from "vue";
import { call } from "frappe-ui";

function sessionUser() {
	const cookies = new URLSearchParams(document.cookie.split("; ").join("&"));
	const user = cookies.get("user_id");
	return user && user !== "Guest" ? user : null;
}

export const session = reactive({
	user: sessionUser(),
	isLoggedIn: computed(() => !!session.user),
	async login(email, password) {
		const response = await call("login", { usr: email, pwd: password });
		session.user = sessionUser();
		return response;
	},
	async logout() {
		await call("logout");
		session.user = null;
	},
});
