<script lang="ts">
	import { fade } from 'svelte/transition';
	export let active = false;

	let beforeShowTimer: NodeJS.Timeout | null = null;
	let afterShowTimer: NodeJS.Timeout | null = null;

	let state = 0;

	$: onActiveChanged(active);

	function onActiveChanged(active: boolean) {
		if (active) {
			state = 0;

			if (beforeShowTimer !== null) {
				clearTimeout(beforeShowTimer);
			}
			beforeShowTimer = setTimeout(() => {
				state = 1;
			}, 100);

			if (afterShowTimer !== null) {
				clearTimeout(afterShowTimer);
			}
			afterShowTimer = setTimeout(() => {
				state = 2;
			}, 500);
		} else if (state === 0 && beforeShowTimer !== null) {
			clearTimeout(beforeShowTimer);
			beforeShowTimer = null;
		}
	}
</script>

{#if state === 1 || (state === 2 && active)}
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
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.spinner .button {
		font-size: 4rem;
	}
</style>
