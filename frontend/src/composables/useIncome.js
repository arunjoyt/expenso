import { call } from "frappe-ui";

export async function createIncome({ amount, date, source, notes }) {
	return call("expenso.expenso.api.create_income", { amount, date, source, notes });
}

export async function updateIncome({ name, amount, date, source, notes }) {
	return call("expenso.expenso.api.update_income", { name, amount, date, source, notes });
}

export async function deleteIncome(name) {
	return call("expenso.expenso.api.delete_income", { name });
}
