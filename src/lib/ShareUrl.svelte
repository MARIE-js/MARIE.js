<script lang="ts">
	import Fa from 'svelte-fa';
	import Modal from './Modal.svelte';
	import { faClipboard } from '@fortawesome/free-solid-svg-icons';

	let { shareUrl = null }: { shareUrl: string | null } = $props();

	let shareUrlInput = $state<HTMLInputElement>();
	let copiedShareUrl = $state(false);

	function copyShareUrl() {
		shareUrlInput?.select();
		shareUrlInput?.setSelectionRange(0, shareUrl!.length);
		navigator.clipboard.writeText(shareUrl!);
		copiedShareUrl = true;
	}
</script>

{#snippet footer()}
	<div>
		<button class="button is-primary" onclick={() => (shareUrl = null)}>
			Done
		</button>
	</div>
{/snippet}

<Modal
	active={shareUrl !== null}
	title="Share this program"
	onCancel={() => (shareUrl = null)}
	{footer}
>
	<div class="field has-addons">
		<p class="control is-expanded">
			<input
				bind:this={shareUrlInput}
				class="input"
				type="text"
				value={shareUrl}
				onclick={() => shareUrlInput?.select()}
				readonly
			/>
		</p>
		<p class="control">
			<button
				type="button"
				class="button"
				class:is-primary={!copiedShareUrl}
				class:is-success={copiedShareUrl}
				onclick={copyShareUrl}
			>
				<span class="icon"><Fa icon={faClipboard} /></span>
			</button>
		</p>
	</div>
</Modal>
