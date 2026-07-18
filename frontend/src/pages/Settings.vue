<template>
	<div class="p-4">
		<h1 class="mb-4 text-lg font-semibold text-gray-900">Settings</h1>

		<h2 class="mb-2 text-sm font-medium text-gray-500">Categories</h2>
		<div
			v-for="category in categories"
			:key="category.name"
			data-test="category-row"
			class="flex items-center border-b border-gray-100 py-2"
		>
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
				class="cursor-pointer"
				@click="startCategoryRename(category)"
			>
				{{ category.category_name }}
			</span>
		</div>

		<form class="mb-8 mt-4 flex gap-2" @submit.prevent="submitAddCategory">
			<Input
				data-test="add-category-input"
				placeholder="New category"
				v-model="newCategoryName"
			/>
			<Button data-test="add-category-button" type="submit" variant="solid">Add</Button>
		</form>

		<h2 class="mb-2 text-sm font-medium text-gray-500">Sources</h2>
		<div
			v-for="source in sources"
			:key="source.name"
			data-test="source-row"
			class="flex items-center border-b border-gray-100 py-2"
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
				class="cursor-pointer"
				@click="startSourceRename(source)"
			>
				{{ source.source_name }}
			</span>
		</div>

		<form class="mt-4 flex gap-2" @submit.prevent="submitAddSource">
			<Input data-test="add-source-input" placeholder="New source" v-model="newSourceName" />
			<Button data-test="add-source-button" type="submit" variant="solid">Add</Button>
		</form>

		<div class="mt-8 text-center text-xs text-gray-400" data-test="app-version">
			v{{ appVersion }}
		</div>
	</div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { call, Input, Button } from "frappe-ui";
import { addCategory, renameCategory, useCategories } from "@/composables/useCategories";
import { addSource, renameSource, useSources } from "@/composables/useSources";

const { categories, reload: reloadCategories } = useCategories();
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
</script>
