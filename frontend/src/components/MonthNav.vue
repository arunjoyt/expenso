<template>
	<div
		class="mx-4 mt-4 flex items-center justify-between rounded-full bg-white/80 px-2 py-1 shadow-sm backdrop-blur"
	>
		<button
			type="button"
			aria-label="Previous month"
			class="flex h-9 w-9 items-center justify-center rounded-full text-lg text-gray-500 transition hover:bg-blue-50 active:scale-90"
			@click="monthStore.prevMonth()"
		>
			‹
		</button>
		<h1 class="text-base font-extrabold text-gray-900">{{ monthStore.label }}</h1>
		<button
			type="button"
			aria-label="Next month"
			class="flex h-9 w-9 items-center justify-center rounded-full text-lg text-gray-500 transition hover:bg-blue-50 active:scale-90"
			@click="monthStore.nextMonth()"
		>
			›
		</button>
	</div>
</template>

<script setup>
import { useMonthStore } from "@/stores/month";

const monthStore = useMonthStore();
</script>
