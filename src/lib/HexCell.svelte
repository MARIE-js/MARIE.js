<script lang="ts">
	import { tick } from 'svelte';
	import { hex } from '../utils';

	let {
		value,
		digits = 4,
		editing = false,
		onEdit,
		onCancel,
	}: {
		value: number;
		digits?: number;
		editing: boolean;
		onEdit: (value: number) => void;
		onCancel: () => void;
	} = $props();

	let editInput = $state<HTMLInputElement>();
	let editValue = $state('');
	let valueValid = $derived(/^[0-9a-fA-F]+$/.test(editValue));
	let display = $derived(hex(value, digits));
	$effect(() => {
		startEdit(editing);
	});

	async function startEdit(editing: boolean) {
		if (editing) {
			editValue = display;
			await tick();
			editInput?.focus();
			editInput?.select();
		}
	}

	function finishEdit() {
		if (!editing) {
			return;
		}
		if (editValue === '') {
			cancelEdit();
		}
		if (!valueValid) {
			return;
		}
		const newValue = parseInt(editValue, 16);
		if (newValue === value) {
			cancelEdit();
		} else {
			onEdit(newValue);
		}
	}

	function cancelEdit() {
		onCancel();
	}

	function onKeyUp(e: KeyboardEvent) {
		if (!editing) {
			return;
		}
		if (e.key === 'Enter') {
			finishEdit();
		} else if (e.key === 'Escape') {
			cancelEdit();
		}
	}
</script>

{#if editing}
	<div class="editor">
		<input
			type="text"
			class="input is-small is-family-monospace"
			class:is-danger={!valueValid}
			style:width={`${Math.max(4, digits)}em`}
			bind:this={editInput}
			maxlength={digits}
			bind:value={editValue}
			onfocusout={finishEdit}
			onkeyup={onKeyUp}
		/>
	</div>
{:else}
	<div class="value is-family-monospace">
		{display}
	</div>
{/if}

<style>
	.editor,
	.value {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.value {
		padding: 0 0.5rem;
	}
	.input {
		text-align: right;
	}
</style>
