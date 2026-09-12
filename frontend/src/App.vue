<template>
	<router-view />

	<template v-if="session.isLoggedIn">
		<Fab v-if="route.name !== 'Assistant'" />
		<BottomNav />

		<ExpenseSheet
			v-if="open && mode === 'expense'"
			:expense="editingExpense"
			@close="close"
			@switch-mode="switchMode"
		/>
		<IncomeSheet
			v-if="open && mode === 'income'"
			:income="editingIncome"
			@close="close"
			@switch-mode="switchMode"
		/>
	</template>
</template>

<script setup>
import { useRoute } from "vue-router";
import { session } from "@/data/session";
import { useEntrySheet } from "@/composables/useEntrySheet";
import BottomNav from "@/components/BottomNav.vue";
import Fab from "@/components/Fab.vue";
import ExpenseSheet from "@/components/ExpenseSheet.vue";
import IncomeSheet from "@/components/IncomeSheet.vue";

const route = useRoute();
const { open, mode, editingExpense, editingIncome, switchMode, close } = useEntrySheet();
</script>
