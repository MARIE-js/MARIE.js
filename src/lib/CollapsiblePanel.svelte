<script lang="ts">
	import Fa from 'svelte-fa';
	import { faCaretRight, faCaretDown } from '@fortawesome/free-solid-svg-icons';
	export let title: string;
	export let open = false;
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="top" on:click={() => (open = !open)}>
	<span class="icon">
		<Fa icon={open ? faCaretDown : faCaretRight} />
	</span>
	<span>{title}</span>
</div>
{#if open}
	<div class="bottom">
		<slot />
	</div>
{/if}

<style>
	.top {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		flex: 0 0 auto;
		border-bottom: solid 1px var(--bulma-border);
		cursor: pointer;
		background-color: var(--bulma-scheme-main-bis);
	}
	.bottom {
		flex: 0 1 auto;
		overflow: auto;
		border-bottom: solid 1px var(--bulma-border);
		min-height: 6rem;
	}
</style>
