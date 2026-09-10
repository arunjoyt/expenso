import { ref } from "vue";

// One Add/Edit sheet for the whole app. The state lives at module scope so the
// FAB (global, in App.vue), a Feed row tap, and the sheet components all read
// and write the same sheet — the sheet is mounted once, not per page.
const open = ref(false);
const mode = ref("expense");
const editingExpense = ref(null);
const editingIncome = ref(null);

function openAdd() {
	mode.value = "expense";
	editingExpense.value = null;
	editingIncome.value = null;
	open.value = true;
}

function openEditExpense(expense) {
	mode.value = "expense";
	editingExpense.value = expense;
	editingIncome.value = null;
	open.value = true;
}

function openEditIncome(income) {
	mode.value = "income";
	editingIncome.value = income;
	editingExpense.value = null;
	open.value = true;
}

// The Expense/Income tab switcher inside the sheet (add mode only).
function switchMode(next) {
	mode.value = next;
}

function close() {
	open.value = false;
	editingExpense.value = null;
	editingIncome.value = null;
}

export function useEntrySheet() {
	return {
		open,
		mode,
		editingExpense,
		editingIncome,
		openAdd,
		openEditExpense,
		openEditIncome,
		switchMode,
		close,
	};
}
