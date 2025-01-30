<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	let {
		title,
		active,
		onActivate = () => {},
		onCancel = () => {},
		onSubmit = () => {},
		children,
		footer,
	}: {
		title: string;
		active: boolean;
		onActivate?: () => void;
		onCancel?: () => void;
		onSubmit?: () => void;
		children: Snippet;
		footer?: Snippet;
	} = $props();
	let form = $state<HTMLFormElement>();

	$effect(() => {
		setFocus(active);
	});

	async function setFocus(active: boolean) {
		if (active) {
			await tick();
			if (form) {
				form.focus();
			}
			if (onActivate) {
				onActivate();
			}
		}
	}
</script>

{#if active}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<form
		tabindex="0"
		bind:this={form}
		transition:fade={{ duration: 200 }}
		class="modal is-active"
		onsubmit={(e) => {
			e.preventDefault();
			onSubmit();
		}}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-background" onclick={onCancel}></div>
		<div transition:fly={{ y: -200, duration: 200 }} class="modal-card">
			<header class="modal-card-head">
				<p class="modal-card-title">{title}</p>
				<button
					type="button"
					class="delete"
					aria-label="close"
					onclick={onCancel}
				></button>
			</header>
			<section class="modal-card-body">
				{@render children()}
			</section>
			<footer class="modal-card-foot">
				{#if footer}
					{@render footer()}
				{:else}
					<button class="button" onclick={onCancel}>Cancel</button>
				{/if}
			</footer>
		</div>
	</form>
{/if}
