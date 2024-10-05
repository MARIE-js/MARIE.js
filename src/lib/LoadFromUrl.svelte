<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from './Modal.svelte';

	export let active: boolean;

	const dispatch = createEventDispatcher();

	let url = '';
	let loading = false;

	$: resetLoading(active);

	function resetLoading(active: boolean) {
		loading = false;
		url = '';
	}

	function accept() {
		if (!loading) {
			loading = true;
			dispatch('loadFromUrl', { url });
		}
	}
</script>

<Modal
	{active}
	title="Load from URL"
	on:cancel={() => () => dispatch('cancel')}
>
	<div class="field">
		<p class="control is-expanded">
			<input class="input" type="text" bind:value={url} />
		</p>
	</div>
	<div slot="footer">
		<button
			class="button is-primary"
			class:is-loading={loading}
			on:click={accept}
		>
			Open
		</button>
		<button
			type="button"
			class="button"
			on:click={() => dispatch('cancel')}
			disabled={loading}
		>
			Cancel
		</button>
	</div>
</Modal>
