import { createRouter as createVueRouter, createWebHistory } from "vue-router";
import { session } from "@/data/session";

const routes = [
	{ path: "/", redirect: "/feed" },
	{
		path: "/login",
		name: "Login",
		component: () => import("@/pages/Login.vue"),
	},
	{
		path: "/feed",
		name: "Feed",
		component: () => import("@/pages/Feed.vue"),
		meta: { requiresAuth: true },
	},
	{
		path: "/analytics",
		name: "Analytics",
		component: () => import("@/pages/Analytics.vue"),
		meta: { requiresAuth: true },
	},
	{
		path: "/budget",
		name: "Budget",
		component: () => import("@/pages/Budget.vue"),
		meta: { requiresAuth: true },
	},
	{
		path: "/settings",
		name: "Settings",
		component: () => import("@/pages/Settings.vue"),
		meta: { requiresAuth: true },
	},
];

export function createAppRouter() {
	const router = createVueRouter({
		history: createWebHistory("/expenso"),
		routes,
	});

	router.beforeEach((to) => {
		if (to.meta.requiresAuth && !session.isLoggedIn) {
			return { name: "Login" };
		}
		if (to.name === "Login" && session.isLoggedIn) {
			return { name: "Feed" };
		}
	});

	return router;
}

const router = createAppRouter();

export default router;
