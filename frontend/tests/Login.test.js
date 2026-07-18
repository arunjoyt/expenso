import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createAppRouter } from "@/router";
import { session } from "@/data/session";
import Login from "@/pages/Login.vue";

beforeEach(() => {
	session.user = null;
});

async function mountLogin() {
	const router = createAppRouter();
	await router.push("/login");
	const wrapper = mount(Login, {
		global: { plugins: [router] },
	});
	return { wrapper, router };
}

describe("Login page", () => {
	// F3
	it("renders username field, password field, and submit button", async () => {
		const { wrapper } = await mountLogin();
		expect(wrapper.find('input[name="email"]').exists()).toBe(true);
		expect(wrapper.find('input[name="password"]').exists()).toBe(true);
		expect(wrapper.find('button[type="submit"]').exists()).toBe(true);
	});

	// F4
	it("shows an error message when submitted with wrong credentials", async () => {
		const { wrapper } = await mountLogin();
		vi.spyOn(session, "login").mockRejectedValue({
			messages: ["Incorrect password"],
		});

		await wrapper.find('input[name="email"]').setValue("member@expenso.test");
		await wrapper.find('input[name="password"]').setValue("wrong-password");
		await wrapper.find("form").trigger("submit");
		await flushPromises();

		expect(wrapper.find('[role="alert"]').text()).toContain("Incorrect password");
	});

	// F5
	it("redirects to /feed when submitted with valid credentials", async () => {
		const { wrapper, router } = await mountLogin();
		vi.spyOn(session, "login").mockImplementation(async () => {
			session.user = "member@expenso.test";
			return { message: "Logged In" };
		});

		await wrapper.find('input[name="email"]').setValue("member@expenso.test");
		await wrapper.find('input[name="password"]').setValue("correct-password");
		await wrapper.find("form").trigger("submit");
		await flushPromises();
		// router.replace() resolves the lazy Feed.vue import asynchronously,
		// so poll instead of guessing how long that import takes.
		await vi.waitFor(() => {
			expect(router.currentRoute.value.name).toBe("Feed");
		});
	});
});
