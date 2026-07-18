<template>
	<div class="flex h-screen w-screen flex-col justify-center bg-white px-6">
		<div class="mx-auto w-full max-w-sm">
			<h1 class="mb-8 text-center text-2xl font-semibold text-gray-900">
				Log in to Expenso
			</h1>
			<form class="flex flex-col gap-4" @submit.prevent="submit">
				<Input
					label="Email"
					type="text"
					name="email"
					v-model="email"
					autocomplete="username"
					required
				/>
				<Input
					label="Password"
					type="password"
					name="password"
					v-model="password"
					autocomplete="current-password"
					required
				/>
				<ErrorMessage :message="errorMessage" />
				<Button variant="solid" theme="blue" :loading="loading" type="submit">
					Login
				</Button>
			</form>
		</div>
	</div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { Input, Button, ErrorMessage } from "frappe-ui";
import { session } from "@/data/session";

const router = useRouter();
const email = ref("");
const password = ref("");
const errorMessage = ref("");
const loading = ref(false);

async function submit() {
	errorMessage.value = "";
	loading.value = true;
	try {
		await session.login(email.value, password.value);
		await router.replace({ name: "Feed" });
	} catch (error) {
		errorMessage.value = error?.messages?.join("\n") || error?.message || "Login failed";
	} finally {
		loading.value = false;
	}
}
</script>
