<script lang="ts">
	import Fa from 'svelte-fa';
	import Modal from './Modal.svelte';
	import { faClipboard } from '@fortawesome/free-solid-svg-icons';

	export let shareUrl: string | null = null;

	let shareUrlInput: HTMLInputElement;
	let copiedShareUrl = false;

	function copyShareUrl() {
		shareUrlInput.select();
		shareUrlInput.setSelectionRange(0, shareUrl!.length);
		navigator.clipboard.writeText(shareUrl!);
		copiedShareUrl = true;
	}
</script>

<Modal
	active={shareUrl !== null}
	title="Share this program"
	on:cancel={() => (shareUrl = null)}
>
	<div class="field has-addons">
		<p class="control is-expanded">
			<input
				bind:this={shareUrlInput}
				class="input"
				type="text"
				value={shareUrl}
				on:click={() => shareUrlInput.select()}
				readonly
			/>
		</p>
		<p class="control">
			<button
				type="button"
				class="button"
				class:is-primary={!copiedShareUrl}
				class:is-success={copiedShareUrl}
				on:click={copyShareUrl}
			>
				<span class="icon"><Fa icon={faClipboard} /></span>
			</button>
		</p>
	</div>
	<div slot="footer">
		<button class="button is-primary" on:click={() => (shareUrl = null)}>
			Done
		</button>
	</div>
</Modal>
