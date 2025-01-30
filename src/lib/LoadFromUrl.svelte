<script lang="ts">
	import Modal from './Modal.svelte';

	let {
		active,
		onLoadFromUrl,
		onCancel,
	}: {
		active: boolean;
		onLoadFromUrl: (url: string) => void;
		onCancel: () => void;
	} = $props();

	let url = $state('');
	let loading = $state(false);

	$effect(() => resetLoading(active));

	function resetLoading(active: boolean) {
		loading = false;
		url = '';
	}

	function accept() {
		if (!loading) {
			loading = true;
			onLoadFromUrl(url);
		}
	}
</script>

{#snippet footer()}
	<div>
		<button
			class="button is-primary"
			class:is-loading={loading}
			onclick={accept}
		>
			Open
		</button>
		<button
			type="button"
			class="button"
			onclick={() => onCancel()}
			disabled={loading}
		>
			Cancel
		</button>
	</div>
{/snippet}

<Modal {active} title="Load from URL" onCancel={() => onCancel()} {footer}>
	<div class="field">
		<p class="control is-expanded">
			<input class="input" type="text" bind:value={url} />
		</p>
	</div>
</Modal>
