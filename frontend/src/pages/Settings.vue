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
					<Input
						v-if="editingCategoryName === category.name"
						data-test="rename-input"
						type="text"
						:model-value="editingCategoryValue"
						@input="editingCategoryValue = $event"
						@blur="saveCategoryRename(category)"
						@keyup.enter="$event.target.blur()"
					/>
					<span
						v-else
						data-test="category-name"
						class="cursor-pointer truncate font-medium"
						@click="startCategoryRename(category)"
					>
						{{ category.category_name }}
					</span>
				</div>

				<Input
					data-test="budget-amount-input"
					type="number"
					placeholder="Budget"
					inputClass="w-24"
					:model-value="budgetValue(category)"
					@input="budgetDrafts[category.name] = $event"
					@blur="saveBudget(category)"
					@keyup.enter="$event.target.blur()"
				/>
			</div>
		</div>

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
				<Input
					v-if="editingSourceName === source.name"
					data-test="source-rename-input"
					type="text"
					:model-value="editingSourceValue"
					@input="editingSourceValue = $event"
					@blur="saveSourceRename(source)"
					@keyup.enter="$event.target.blur()"
				/>
				<span
					v-else
					data-test="source-name"
					class="cursor-pointer font-medium"
					@click="startSourceRename(source)"
				>
					💵 {{ source.source_name }}
				</span>
			</div>
		</div>

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
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { call, Input, Button } from "frappe-ui";
import { session } from "@/data/session";
import { addCategory, renameCategory } from "@/composables/useCategories";
import { addSource, renameSource, useSources } from "@/composables/useSources";
import { setBudget, useBudgets } from "@/composables/useBudgets";
import { getCategoryVisual } from "@/utils/categoryStyle";

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

const editingCategoryName = ref(null);
const editingCategoryValue = ref("");

function startCategoryRename(category) {
	editingCategoryName.value = category.name;
	editingCategoryValue.value = category.category_name;
}

async function saveCategoryRename(category) {
	if (editingCategoryName.value !== category.name) return;
	editingCategoryName.value = null;

	const newName = editingCategoryValue.value;
	if (newName && newName !== category.category_name) {
		await renameCategory(category.name, newName);
		await reloadCategories();
	}
}

const budgetDrafts = reactive({});

function budgetValue(category) {
	if (category.name in budgetDrafts) return budgetDrafts[category.name];
	return category.budget_amount ?? "";
}

async function saveBudget(category) {
	const raw = budgetValue(category);
	const amount = raw === "" || raw === null ? null : Number(raw);
	delete budgetDrafts[category.name];
	await setBudget(category.name, amount);
	await reloadCategories();
}

const newSourceName = ref("");

async function submitAddSource() {
	if (!newSourceName.value) return;
	await addSource(newSourceName.value);
	newSourceName.value = "";
	await reloadSources();
}

const editingSourceName = ref(null);
const editingSourceValue = ref("");

function startSourceRename(source) {
	editingSourceName.value = source.name;
	editingSourceValue.value = source.source_name;
}

async function saveSourceRename(source) {
	if (editingSourceName.value !== source.name) return;
	editingSourceName.value = null;

	const newName = editingSourceValue.value;
	if (newName && newName !== source.source_name) {
		await renameSource(source.name, newName);
		await reloadSources();
	}
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
