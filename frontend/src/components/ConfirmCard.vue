<template>
	<div
		data-test="confirm-card"
		class="mr-auto max-w-[92%] rounded-2xl border border-accent-200 bg-white p-3 shadow-sm"
	>
		<p class="mb-2 text-xs font-bold uppercase tracking-wide text-accent-600">
			{{
				actions.length === 1 ? "Confirm this change" : `Confirm ${actions.length} changes`
			}}
		</p>

		<ul class="flex flex-col gap-2">
			<li
				v-for="action in actions"
				:key="action.id"
				data-test="confirm-action"
				class="rounded-xl bg-gray-50 p-2"
			>
				<label class="flex items-start gap-2">
					<input
						type="checkbox"
						class="mt-0.5"
						data-test="confirm-action-checkbox"
						:checked="selected[action.id]"
						:disabled="pending"
						@change="selected[action.id] = $event.target.checked"
					/>
					<span class="min-w-0 flex-1">
						<span class="flex items-center gap-1 text-sm font-semibold text-gray-800">
							<span>{{ verb(action.kind) }} {{ action.entity }}</span>
						</span>
						<span class="block truncate text-xs text-gray-500">{{
							action.summary
						}}</span>

						<span
							v-if="action.changes"
							data-test="confirm-diff"
							class="mt-1 flex flex-col gap-0.5"
						>
							<span
								v-for="change in action.changes"
								:key="change.field"
								class="text-xs"
							>
								<span class="text-gray-500">{{ change.field }}:</span>
								<span class="text-gray-400 line-through">{{
									show(change.from)
								}}</span>
								<span class="mx-1">→</span>
								<span class="font-medium text-gray-800">{{
									show(change.to)
								}}</span>
							</span>
						</span>

						<span
							v-else-if="action.values"
							data-test="confirm-values"
							class="mt-1 flex flex-col gap-0.5 text-xs text-gray-600"
						>
							<span v-for="(value, key) in visibleValues(action.values)" :key="key">
								<span class="text-gray-500">{{ key }}:</span>
								{{ show(value) }}
							</span>
						</span>
					</span>
				</label>
			</li>
		</ul>

		<div class="mt-3 flex items-center justify-end gap-2">
			<Button
				data-test="confirm-cancel"
				variant="ghost"
				:disabled="pending"
				@click="$emit('cancel')"
			>
				Cancel
			</Button>
			<Button
				data-test="confirm-apply"
				variant="solid"
				theme="blue"
				:loading="pending"
				@click="$emit('confirm', checkedIds)"
			>
				{{
					checkedIds.length === actions.length
						? "Confirm all"
						: `Confirm ${checkedIds.length}`
				}}
			</Button>
		</div>
	</div>
</template>

<script setup>
import { computed, reactive } from "vue";
import { Button } from "frappe-ui";

const props = defineProps({
	actions: { type: Array, required: true },
	// True once the member has confirmed and the resume stream is running — the
	// card is then read-only.
	pending: { type: Boolean, default: false },
});

defineEmits(["confirm", "cancel"]);

// Every action starts checked.
const selected = reactive(Object.fromEntries(props.actions.map((a) => [a.id, true])));

const checkedIds = computed(() => props.actions.filter((a) => selected[a.id]).map((a) => a.id));

function verb(kind) {
	return { create: "Add", update: "Edit", delete: "Delete" }[kind] ?? kind;
}

function show(value) {
	if (value === null || value === undefined || value === "") return "—";
	return String(value);
}

function visibleValues(values) {
	return Object.fromEntries(
		Object.entries(values).filter(([key]) => key !== "name" && key !== "if_modified_since")
	);
}
</script>
