import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("frappe-ui", async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, call: vi.fn() };
});

import { call } from "frappe-ui";
import { session } from "@/data/session";

afterEach(() => {
	session.user = null;
	vi.clearAllMocks();
});

describe("session.restore", () => {
	it("does not call the server when a user is already known from the cookie", async () => {
		session.user = "administrator";
		await session.restore();
		expect(call).not.toHaveBeenCalled();
		expect(session.user).toBe("administrator");
	});

	it("recovers the logged-in user from the server when the user_id cookie is missing but the sid session is still valid", async () => {
		session.user = null;
		call.mockResolvedValue("member@expenso.test");
		await session.restore();
		expect(call).toHaveBeenCalledWith("frappe.auth.get_logged_user");
		expect(session.user).toBe("member@expenso.test");
	});

	it("stays logged out when the server reports Guest", async () => {
		session.user = null;
		call.mockResolvedValue("Guest");
		await session.restore();
		expect(session.user).toBe(null);
	});

	it("stays logged out when the server call fails", async () => {
		session.user = null;
		call.mockRejectedValue(new Error("network error"));
		await session.restore();
		expect(session.user).toBe(null);
	});
});
