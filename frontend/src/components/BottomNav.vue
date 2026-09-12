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
			class="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition active:scale-95"
			:class="isActive(tab.name) ? 'text-accent-600' : 'text-gray-400'"
		>
			<span class="text-lg leading-none">{{ tab.icon }}</span>
			{{ tab.label }}
			<span
				v-if="tab.name === 'Assistant' && unreadBadge"
				data-test="assistant-unread-dot"
				class="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-accent-500"
			></span>
		</router-link>
	</nav>
</template>

<script setup>
import { onMounted } from "vue";
import { useRoute } from "vue-router";
import { useAssistant } from "@/composables/useAssistant";

const route = useRoute();
const appVersion = window.app_version || "";
const { isConfigured, unreadBadge, fetchHistory } = useAssistant();

// The unread badge is discovered on app-shell mount only, not polled (P7-S2
// grill: matches the no-Realtime rule — no push notifications, no background
// refresh — already governing the Feed's own update model). A proactive
// Insight posted while the Member wasn't on the Assistant tab shows up the
// next time the app loads.
onMounted(() => {
	if (isConfigured()) fetchHistory().catch(() => {});
});

const tabs = [
	{ name: "Feed", icon: "🧾", label: "Feed" },
	{ name: "Analytics", icon: "📊", label: "Analytics" },
	{ name: "Assistant", icon: "💬", label: "Assistant" },
	{ name: "Budget", icon: "💰", label: "Budget" },
	{ name: "Settings", icon: "⚙️", label: "Settings" },
];

function isActive(name) {
	return route.name === name;
}
</script>
