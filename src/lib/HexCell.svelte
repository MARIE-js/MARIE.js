<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { hex } from '../utils';

	export let value: number;
	export let digits = 4;
	export let editing = false;

	let editInput: HTMLInputElement;
	let editValue = '';
	$: valueValid = /^[0-9a-fA-F]+$/.test(editValue);
	$: display = hex(value, digits);
	$: startEdit(editing);

	const dispatch = createEventDispatcher();

	async function startEdit(editing: boolean) {
		if (editing) {
			editValue = display;
			valueValid = true;
			await tick();
			editInput.focus();
			editInput.select();
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
			dispatch('edit', { value: newValue });
		}
	}

	function cancelEdit() {
		dispatch('cancel');
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
			on:focusout={finishEdit}
			on:keyup={onKeyUp}
		/>
	</div>
{:else}
	<!-- svelte-ignore a11y-no-static-element-interactions -->
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
