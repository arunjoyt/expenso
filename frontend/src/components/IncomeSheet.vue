<template>
	<div>
		<div
			data-test="income-sheet-backdrop"
			class="fixed inset-0 z-40 bg-black/40"
			@click="$emit('close')"
		></div>
		<div
			data-test="income-sheet"
			class="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white p-4 pb-6"
		>
			<h2 class="mb-4 text-lg font-semibold text-gray-900">Add Income</h2>
		</div>
	</div>
</template>

<script setup>
defineEmits(["close"]);
</script>
