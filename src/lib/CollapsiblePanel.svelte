<script lang="ts">
	import Fa from 'svelte-fa';
	import { faCaretRight, faCaretDown } from '@fortawesome/free-solid-svg-icons';
	import type { Snippet } from 'svelte';
	let {
		title,
		open = $bindable(false),
		alert = false,
		children,
	}: {
		title: string;
		open?: boolean;
		alert?: boolean;
		children: Snippet;
	} = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="top" class:alert onclick={() => (open = !open)}>
	<span class="icon">
		<Fa icon={open ? faCaretDown : faCaretRight} />
	</span>
	<span>{title}</span>
</div>
{#if open}
	<div class="bottom">
		{@render children()}
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

	@keyframes flash {
		0% {
			background-color: var(--bulma-scheme-main-bis);
			color: var(--bulma-body-color);
		}
		70% {
			background-color: var(--bulma-warning);
			color: var(--bulma-warning-invert);
		}
	}

	.alert {
		animation-name: flash;
		animation-duration: 0.3s;
		animation-direction: alternate-reverse;
		animation-iteration-count: 6;
		background-color: var(--bulma-warning);
		color: var(--bulma-warning-invert);
	}
	.bottom {
		flex: 0 1 auto;
		overflow: auto;
		border-bottom: solid 1px var(--bulma-border);
		min-height: 6rem;
	}
</style>
