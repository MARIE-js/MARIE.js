<script lang="ts">
	import { fade } from 'svelte/transition';
	export let active = false;
</script>

{#if active}
	<div class="spinner" transition:fade={{ duration: 200 }}>
		<!-- svelte-ignore a11y_consider_explicit_label -->
		<button class="button is-large is-text is-loading"></button>
	</div>
{/if}

<style>
	.spinner {
		position: absolute;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(0, 0, 0, 0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.spinner .button {
		font-size: 4rem;
	}
</style>
