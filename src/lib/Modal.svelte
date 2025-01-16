<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	export let title: string;
	export let active: boolean;
	const dispatch = createEventDispatcher();
	let form: HTMLFormElement | undefined;

	$: setFocus(active);

	async function setFocus(active: boolean) {
		if (active) {
			await tick();
			if (form) {
				form.focus();
			}
			dispatch('activate');
		}
	}

	function cancel() {
		dispatch('cancel');
	}
</script>

{#if active}
	<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
	<form
		tabindex="0"
		bind:this={form}
		transition:fade={{ duration: 200 }}
		class="modal is-active"
		on:submit|preventDefault={() => dispatch('submit')}
	>
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions-->
		<div class="modal-background" on:click={cancel}></div>
		<div transition:fly={{ y: -200, duration: 200 }} class="modal-card">
			<header class="modal-card-head">
				<p class="modal-card-title">{title}</p>
				<button
					type="button"
					class="delete"
					aria-label="close"
					on:click={cancel}
				></button>
			</header>
			<section class="modal-card-body">
				<slot />
			</section>
			<footer class="modal-card-foot">
				<slot name="footer">
					<button class="button" on:click={cancel}>Cancel</button>
				</slot>
			</footer>
		</div>
	</form>
{/if}
