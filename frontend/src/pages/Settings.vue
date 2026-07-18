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
				v-if="editingName === category.name"
				data-test="rename-input"
				type="text"
				:model-value="editingValue"
				@input="editingValue = $event"
				@blur="saveRename(category)"
				@keyup.enter="$event.target.blur()"
			/>
			<span
				v-else
				data-test="category-name"
				class="cursor-pointer"
				@click="startRename(category)"
			>
				{{ category.category_name }}
			</span>
		</div>

		<form class="mt-4 flex gap-2" @submit.prevent="submitAdd">
			<Input
				data-test="add-category-input"
				placeholder="New category"
				v-model="newCategoryName"
			/>
			<Button data-test="add-category-button" type="submit" variant="solid">Add</Button>
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

const { categories, reload } = useCategories();

const newCategoryName = ref("");

async function submitAdd() {
	if (!newCategoryName.value) return;
	await addCategory(newCategoryName.value);
	newCategoryName.value = "";
	await reload();
}

const editingName = ref(null);
const editingValue = ref("");

function startRename(category) {
	editingName.value = category.name;
	editingValue.value = category.category_name;
}

async function saveRename(category) {
	if (editingName.value !== category.name) return;
	editingName.value = null;

	const newName = editingValue.value;
	if (newName && newName !== category.category_name) {
		await renameCategory(category.name, newName);
		await reload();
	}
}

const appVersion = ref("");

onMounted(async () => {
	appVersion.value = await call("expenso.expenso.api.get_app_version");
});
</script>
