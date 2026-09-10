import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import { createAppRouter } from "@/router";
import { session } from "@/data/session";

const assistant = { unreadBadge: ref(false) };
vi.mock("@/composables/useAssistant", () => ({
	useAssistant: () => assistant,
}));

import BottomNav from "@/components/BottomNav.vue";

async function mountNav(path = "/feed") {
	const router = createAppRouter();
	await router.push(path);
	await router.isReady();
	return mount(BottomNav, { global: { plugins: [router] } });
}

beforeEach(() => {
	assistant.unreadBadge.value = false;
	session.user = "member@expenso.test";
});

afterEach(() => {
	session.user = null;
	vi.clearAllMocks();
});

describe("BottomNav", () => {
	// F121
	it("renders the five tabs in order, Assistant last with the 💬 icon", async () => {
		const wrapper = await mountNav();
		const links = wrapper.findAll("a");
		expect(links.map((l) => l.text().replace(/\s+/g, " ").trim())).toEqual([
			"🧾 Feed",
			"📊 Analytics",
			"💰 Budget",
			"⚙️ Settings",
			"💬 Assistant",
		]);
	});

	// F121
	it("points the Assistant tab at the Assistant route / pages/Assistant.vue", async () => {
		const wrapper = await mountNav();
		const assistantLink = wrapper.findAll("a")[4];
		expect(assistantLink.attributes("href")).toMatch(/\/assistant$/);

		const resolved = wrapper.vm.$router.resolve({ name: "Assistant" });
		expect(resolved.matched[0].components.default).toBeTypeOf("function"); // lazy import
	});

	// F133
	it("shows an unread dot on the Assistant tab only while the badge is set", async () => {
		let wrapper = await mountNav();
		expect(wrapper.find('[data-test="assistant-unread-dot"]').exists()).toBe(false);

		assistant.unreadBadge.value = true;
		wrapper = await mountNav();
		const dot = wrapper.find('[data-test="assistant-unread-dot"]');
		expect(dot.exists()).toBe(true);
		// The dot belongs to the Assistant tab, not any other.
		expect(wrapper.findAll("a")[4].find('[data-test="assistant-unread-dot"]').exists()).toBe(
			true
		);
	});
});
