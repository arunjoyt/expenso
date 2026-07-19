<template>
	<router-view />
	<BottomNav v-if="session.isLoggedIn" />
</template>

<script setup>
import { session } from "@/data/session";
import BottomNav from "@/components/BottomNav.vue";
</script>
