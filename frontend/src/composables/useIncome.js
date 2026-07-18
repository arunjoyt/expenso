import { call } from "frappe-ui";

export async function createIncome({ amount, date, source }) {
	return call("expenso.expenso.api.create_income", { amount, date, source });
}

export async function updateIncome({ name, amount, date, source }) {
	return call("expenso.expenso.api.update_income", { name, amount, date, source });
}

export async function deleteIncome(name) {
	return call("expenso.expenso.api.delete_income", { name });
}
