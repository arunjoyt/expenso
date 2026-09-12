import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createAppRouter } from "@/router";
import { session } from "@/data/session";
import { useEntrySheet } from "@/composables/useEntrySheet";
import Fab from "@/components/Fab.vue";
import ExpenseSheet from "@/components/ExpenseSheet.vue";
import App from "@/App.vue";

const STUBS = {
	BottomNav: true,
	ExpenseSheet: true,
	IncomeSheet: true,
	RouterView: true,
};

async function mountAppAt(path) {
	const router = createAppRouter();
	await router.push(path);
	await router.isReady();
	return mount(App, { global: { plugins: [router], stubs: STUBS } });
}

beforeEach(() => {
	session.user = "member@expenso.test";
	useEntrySheet().close();
});

afterEach(() => {
	session.user = null;
	vi.restoreAllMocks();
});

describe("Fab", () => {
	// F122
	it("opens the Add sheet in expense add mode on click", async () => {
		const sheet = useEntrySheet();
		const wrapper = mount(Fab);
		await wrapper.find('[data-test="fab"]').trigger("click");
		expect(sheet.open.value).toBe(true);
		expect(sheet.mode.value).toBe("expense");
		expect(sheet.editingExpense.value).toBe(null);
	});

	// F122
	it("is rendered on Feed, Analytics, Budget, and Settings", async () => {
		for (const path of ["/feed", "/analytics", "/budget", "/settings"]) {
			const wrapper = await mountAppAt(path);
			expect(wrapper.find('[data-test="fab"]').exists(), path).toBe(true);
		}
	});

	// F122
	it("is not rendered on the Assistant screen", async () => {
		const wrapper = await mountAppAt("/assistant");
		expect(wrapper.find('[data-test="fab"]').exists()).toBe(false);
	});

	// F123 — the sheet is mounted once, at the App level, not per page.
	it("App mounts exactly one ExpenseSheet when the shared sheet opens", async () => {
		const wrapper = await mountAppAt("/feed");
		expect(wrapper.findAllComponents(ExpenseSheet).length).toBe(0);
		useEntrySheet().openAdd();
		await wrapper.vm.$nextTick();
		expect(wrapper.findAllComponents(ExpenseSheet).length).toBe(1);
	});
});
