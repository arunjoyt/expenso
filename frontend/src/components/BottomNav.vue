<template>
	<nav
		class="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-gray-100 bg-white/95 backdrop-blur"
		style="padding-bottom: env(safe-area-inset-bottom)"
	>
		<div
			class="pointer-events-none absolute right-2 top-1 rounded-full bg-gray-900/5 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-gray-500"
			data-test="app-version"
		>
			v{{ appVersion }}
		</div>
		<router-link
			v-for="tab in tabs"
			:key="tab.name"
			:to="{ name: tab.name }"
			class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition active:scale-95"
			:class="isActive(tab.name) ? 'text-accent-600' : 'text-gray-400'"
		>
			<span class="text-lg leading-none">{{ tab.icon }}</span>
			{{ tab.label }}
		</router-link>
	</nav>
</template>

<script setup>
import { useRoute } from "vue-router";

const route = useRoute();
const appVersion = window.app_version || "";

const tabs = [
	{ name: "Feed", icon: "🧾", label: "Feed" },
	{ name: "Analytics", icon: "📊", label: "Analytics" },
	{ name: "Budget", icon: "💰", label: "Budget" },
	{ name: "Settings", icon: "⚙️", label: "Settings" },
];

function isActive(name) {
	return route.name === name;
}
</script>
