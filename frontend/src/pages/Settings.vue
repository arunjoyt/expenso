<template>
	<div class="min-h-screen p-4 pb-24">
		<h1 class="mb-4 text-lg font-extrabold text-gray-900">⚙️ Settings</h1>

		<h2 class="mb-2 flex items-center gap-1 text-sm font-bold text-gray-500">🏷️ Categories</h2>
		<div class="mb-4 flex flex-col gap-2">
			<div
				v-for="category in categories"
				:key="category.name"
				data-test="category-row"
				class="flex items-center justify-between gap-2 rounded-2xl bg-white p-3 shadow-sm"
			>
				<div class="flex min-w-0 items-center gap-2">
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
						:class="getCategoryVisual(category.category_name).bg"
					>
						{{ getCategoryVisual(category.category_name).emoji }}
					</span>
					<span
						data-test="category-name"
						class="cursor-pointer truncate font-medium"
						@click="renameCategoryTarget = category"
					>
						{{ category.category_name }}
					</span>
				</div>

				<button
					type="button"
					data-test="budget-open-button"
					class="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition active:scale-95"
					@click="budgetSheetCategory = category"
				>
					{{
						category.budget_amount != null
							? formatAmount(category.budget_amount)
							: "Set Budget"
					}}
				</button>
			</div>
		</div>

		<BudgetSheet
			v-if="budgetSheetCategory"
			:category="budgetSheetCategory"
			@close="closeBudgetSheet"
		/>

		<RenameSheet
			v-if="renameCategoryTarget"
			title="✏️ Rename Category"
			:initial-value="renameCategoryTarget.category_name"
			:rename-fn="(newName) => renameCategory(renameCategoryTarget.name, newName)"
			@close="closeCategoryRenameSheet"
		/>

		<form class="mb-8 flex gap-2" @submit.prevent="submitAddCategory">
			<Input
				data-test="add-category-input"
				placeholder="New category"
				:model-value="newCategoryName"
				@input="newCategoryName = $event"
			/>
			<Button data-test="add-category-button" type="submit" variant="solid" theme="blue"
				>➕ Add</Button
			>
		</form>

		<h2 class="mb-2 flex items-center gap-1 text-sm font-bold text-gray-500">💳 Sources</h2>
		<div class="mb-4 flex flex-col gap-2">
			<div
				v-for="source in sources"
				:key="source.name"
				data-test="source-row"
				class="flex items-center rounded-2xl bg-white p-3 shadow-sm"
			>
				<span
					data-test="source-name"
					class="cursor-pointer font-medium"
					@click="renameSourceTarget = source"
				>
					💵 {{ source.source_name }}
				</span>
			</div>
		</div>

		<RenameSheet
			v-if="renameSourceTarget"
			title="✏️ Rename Source"
			:initial-value="renameSourceTarget.source_name"
			:rename-fn="(newName) => renameSource(renameSourceTarget.name, newName)"
			@close="closeSourceRenameSheet"
		/>

		<form class="mt-4 flex gap-2" @submit.prevent="submitAddSource">
			<Input
				data-test="add-source-input"
				placeholder="New source"
				:model-value="newSourceName"
				@input="newSourceName = $event"
			/>
			<Button data-test="add-source-button" type="submit" variant="solid" theme="blue"
				>➕ Add</Button
			>
		</form>

		<button
			type="button"
			data-test="logout-button"
			class="mx-auto mt-8 block w-fit rounded-full bg-white px-4 py-2 text-center text-sm font-semibold text-red-500 shadow-sm transition active:scale-95"
			@click="logout"
		>
			🚪 Log out
		</button>

		<div
			class="mx-auto mt-3 w-fit rounded-full bg-white px-3 py-1 text-center text-xs font-semibold text-gray-400 shadow-sm"
			data-test="app-version"
		>
			v{{ appVersion }}
		</div>
	</div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { call, Input, Button } from "frappe-ui";
import { session } from "@/data/session";
import { addCategory, renameCategory } from "@/composables/useCategories";
import { addSource, renameSource, useSources } from "@/composables/useSources";
import { useBudgets } from "@/composables/useBudgets";
import { getCategoryVisual } from "@/utils/categoryStyle";
import BudgetSheet from "@/components/BudgetSheet.vue";
import RenameSheet from "@/components/RenameSheet.vue";

const router = useRouter();

const { categories, reload: reloadCategories } = useBudgets();
const { sources, reload: reloadSources } = useSources();

const newCategoryName = ref("");

async function submitAddCategory() {
	if (!newCategoryName.value) return;
	await addCategory(newCategoryName.value);
	newCategoryName.value = "";
	await reloadCategories();
}

const renameCategoryTarget = ref(null);

async function closeCategoryRenameSheet() {
	renameCategoryTarget.value = null;
	await reloadCategories();
}

function formatAmount(amount) {
	return new Intl.NumberFormat().format(amount);
}

const budgetSheetCategory = ref(null);

async function closeBudgetSheet() {
	budgetSheetCategory.value = null;
	await reloadCategories();
}

const newSourceName = ref("");

async function submitAddSource() {
	if (!newSourceName.value) return;
	await addSource(newSourceName.value);
	newSourceName.value = "";
	await reloadSources();
}

const renameSourceTarget = ref(null);

async function closeSourceRenameSheet() {
	renameSourceTarget.value = null;
	await reloadSources();
}

const appVersion = ref("");

onMounted(async () => {
	appVersion.value = await call("expenso.expenso.api.get_app_version");
});

async function logout() {
	await session.logout();
	await router.replace({ name: "Login" });
}
</script>
