<template>
	<button
		type="button"
		data-test="fab"
		aria-label="Add"
		class="fixed bottom-20 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-purple-600 text-2xl text-white shadow-lg shadow-blue-300 transition hover:scale-105 active:scale-90"
		@click="openAdd"
	>
		+
	</button>
</template>

<script setup>
import { useEntrySheet } from "@/composables/useEntrySheet";

const { openAdd } = useEntrySheet();
</script>
