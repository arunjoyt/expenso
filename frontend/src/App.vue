<template>
	<router-view />
	<BottomNav v-if="session.isLoggedIn" />
	<div
		class="pointer-events-none fixed bottom-1.5 left-1/2 z-[51] -translate-x-1/2 rounded-full bg-gray-900/5 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-gray-500"
		data-test="app-version"
	>
		v{{ appVersion }}
	</div>
</template>

<script setup>
import { session } from "@/data/session";
import BottomNav from "@/components/BottomNav.vue";

const appVersion = window.app_version || "";
</script>
