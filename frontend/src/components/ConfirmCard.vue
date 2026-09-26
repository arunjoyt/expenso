<template>
	<div
		data-test="confirm-card"
		class="mr-auto max-w-[92%] rounded-2xl border border-accent-200 bg-white p-3 shadow-sm"
	>
		<p class="mb-2 text-xs font-bold uppercase tracking-wide text-accent-600">
			{{
				requests.length === 1
					? "Confirm this change"
					: `Confirm ${requests.length} changes`
			}}
		</p>

		<ul class="flex flex-col gap-2">
			<li
				v-for="(request, index) in requests"
				:key="index"
				data-test="confirm-action"
				class="rounded-xl bg-gray-50 p-2"
			>
				<label class="flex items-start gap-2">
					<input
						type="checkbox"
						class="mt-0.5"
						data-test="confirm-action-checkbox"
						:checked="rows[index].checked"
						:disabled="pending"
						@change="rows[index].checked = $event.target.checked"
					/>
					<span class="min-w-0 flex-1">
						<span
							data-test="confirm-description"
							class="block text-sm font-semibold text-gray-800"
							>{{ request.description }}</span
						>

						<span
							v-if="Object.keys(rows[index].values).length"
							data-test="confirm-values"
							class="mt-1 flex flex-col gap-1 text-xs text-gray-600"
						>
							<span
								v-for="(value, key) in rows[index].values"
								:key="key"
								class="flex items-center gap-1"
							>
								<span class="w-14 shrink-0 text-gray-500">{{ key }}:</span>
								<input
									:type="inputType(key)"
									:step="key === 'amount' ? '0.01' : undefined"
									data-test="confirm-value-input"
									:data-field="key"
									class="min-w-0 flex-1 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
									:disabled="pending"
									:value="value"
									@input="onEdit(index, key, $event.target.value)"
								/>
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
				@click="$emit('confirm', decisions())"
			>
				{{ checkedCount === requests.length ? "Confirm all" : `Confirm ${checkedCount}` }}
			</Button>
		</div>
	</div>
</template>

<script setup>
import { computed, reactive } from "vue";
import { Button } from "frappe-ui";

// `requests` are the stock LangChain human-in-the-loop `action_requests`
// (ADR 0010): `{ name, args, description }` per proposed write.
const props = defineProps({
	requests: { type: Array, required: true },
	// True once the member has confirmed and the resume stream is running — the
	// card is then read-only.
	pending: { type: Boolean, default: false },
});

defineEmits(["confirm", "cancel"]);

// The row id and the stale-write stamp are never member-editable.
const HIDDEN_ARGS = new Set(["name", "if_modified_since"]);

// Every row starts checked, with its editable args seeded from the proposal.
const rows = reactive(
	props.requests.map((request) => ({
		checked: true,
		values: Object.fromEntries(
			Object.entries(request.args ?? {})
				.filter(([key]) => !HIDDEN_ARGS.has(key))
				.map(([key, value]) => [key, value ?? ""])
		),
	}))
);

const checkedCount = computed(() => rows.filter((row) => row.checked).length);

function inputType(key) {
	if (key === "amount") return "number";
	if (key === "date") return "date";
	return "text";
}

function onEdit(index, key, value) {
	rows[index].values[key] = key === "amount" ? Number(value) : value;
}

// One stock decision per request, in order: unchecked rejects, a changed
// field edits (the full args, as the stock middleware expects), else approve.
function decisions() {
	return props.requests.map((request, index) => {
		if (!rows[index].checked) return { type: "reject" };
		const args = request.args ?? {};
		const changed = Object.entries(rows[index].values).filter(
			([key, value]) => String(args[key] ?? "") !== String(value)
		);
		if (!changed.length) return { type: "approve" };
		return {
			type: "edit",
			edited_action: {
				name: request.name,
				args: { ...args, ...Object.fromEntries(changed) },
			},
		};
	});
}
</script>
