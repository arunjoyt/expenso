import { describe, it, expect, afterEach } from "vitest";
import { createAppRouter } from "@/router";
import { session } from "@/data/session";

afterEach(() => {
	session.user = null;
});

describe("router auth guard", () => {
	// F1
	it("redirects an unauthenticated user from / to /login", async () => {
		session.user = null;
		const router = createAppRouter();
		await router.push("/");
		expect(router.currentRoute.value.name).toBe("Login");
	});

	// F2
	it("redirects an authenticated user from /login to /feed", async () => {
		session.user = "administrator";
		const router = createAppRouter();
		await router.push("/login");
		expect(router.currentRoute.value.name).toBe("Feed");
	});
});
