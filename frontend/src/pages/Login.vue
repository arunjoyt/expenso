<template>
	<div
		class="flex h-screen w-screen flex-col justify-center bg-gradient-to-br from-cyan-100 via-blue-200 to-violet-200 px-6"
	>
		<div class="mx-auto w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
			<div class="mb-6 text-center">
				<div
					class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-purple-600 text-3xl shadow-lg shadow-blue-200"
				>
					🧾
				</div>
				<h1 class="text-2xl font-extrabold text-gray-900">Welcome back!</h1>
				<p class="mt-1 text-sm text-gray-400">Log in to your family ledger</p>
			</div>
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
					Log In
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
