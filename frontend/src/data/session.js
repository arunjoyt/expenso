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
	// Frappe's `sid` cookie (the actual auth session) is persistent, but the
	// `user_id` cookie sessionUser() reads is a session-only cookie with no
	// expiry. Mobile browsers/PWAs routinely kill the backgrounded webview
	// process after a few hours, wiping session-only cookies while `sid`
	// survives on disk — so on relaunch we'd otherwise show Login despite a
	// still-valid server session. Only hit the network when the cookie
	// already looks logged out, so normal boots pay no extra latency.
	async restore() {
		if (session.user) return;
		try {
			const user = await call("frappe.auth.get_logged_user");
			session.user = user && user !== "Guest" ? user : null;
		} catch {
			session.user = null;
		}
	},
});
