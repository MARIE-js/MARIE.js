<script lang="ts" module>
	export type InputItem = {
		format: InputOutputMode;
		consumed: string;
		queued: string;
	};
</script>

<script lang="ts">
	import Fa from 'svelte-fa';
	import type { InputOutputMode } from '../settings';
	import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';

	let { inputs = $bindable() }: { inputs: InputItem[] } = $props();

	let inputTextareas = $state<(HTMLTextAreaElement | undefined)[]>([]);
	let inputTextareaElements = $derived(
		inputTextareas.filter((x) => x) as HTMLTextAreaElement[],
	);
	export function focus() {
		inputTextareaElements[inputTextareaElements.length - 1].focus();
	}

	let unconsumed = $derived(
		Math.max(
			inputs.findLastIndex((input) => input.consumed !== ''),
			0,
		),
	);

	function addInput() {
		inputs = [...inputs, { format: 'hex', consumed: '', queued: '' }];
	}

	function deleteInput(index: number) {
		inputs = [...inputs.slice(0, index), ...inputs.slice(index + 1)];
	}

	function ensureValid(_items: InputItem[]) {
		if (inputs.length === 0) {
			inputs = [{ format: 'hex', consumed: '', queued: '' }];
		}
	}
	$effect(() => ensureValid(inputs));
</script>

<div class="inputs">
	<table class="table is-fullwidth mb-0">
		<thead>
			<tr>
				<td class="inputs-header">Inputs</td>
				<td>Format</td>
				<td></td>
			</tr>
		</thead>
		<tbody>
			{#each inputs as item, i}
				<tr>
					<td>
						{#if item.consumed !== ''}
							<div class="previous">{item.consumed}</div>
						{/if}
						{#if i >= unconsumed}
							<textarea
								class="textarea"
								bind:this={inputTextareas[i]}
								bind:value={item.queued}
								rows={item.queued.split('\n').length}
								placeholder={item.format === 'unicode'
									? 'Enter input text'
									: 'Enter inputs separated by line breaks.'}
							></textarea>
						{/if}
					</td>
					<td>
						<div class="select">
							<select
								bind:value={item.format}
								disabled={item.consumed !== '' || i < unconsumed}
								title={item.consumed !== '' || i < unconsumed
									? 'Cannot change format of consumed item'
									: 'Change input mode'}
							>
								<option value="hex">Hexadecimal</option>
								<option value="dec">Decimal</option>
								<option value="oct">Octal</option>
								<option value="bin">Binary</option>
								<option value="unicode">Unicode (UTF-16BE)</option>
							</select>
						</div>
					</td>
					<td>
						<button
							class="button is-small mt-1"
							title={item.consumed === ''
								? 'Delete this input'
								: 'Cannot delete consumed input'}
							disabled={item.consumed !== '' || inputs.length === 1}
							onclick={() => deleteInput(i)}
						>
							<span class="icon">
								<Fa icon={faTrash} />
							</span>
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<div class="p-4">
		<button
			class="button is-fullwidth"
			title="Add additional inputs to the queue, possibly with a different format."
			onclick={addInput}
		>
			<span class="icon"> <Fa icon={faPlus}></Fa> </span>
			<span>Add additional input</span>
		</button>
	</div>
</div>

<style>
	.inputs {
		height: 100%;
		overflow: auto;
	}
	.inputs-header {
		width: 100%;
	}
	td {
		padding-left: 0.5rem;
		padding-right: 0.5rem;
	}
	td:first-child {
		padding-left: 1rem;
	}
	td:last-child {
		padding-right: 1rem;
	}
	.previous {
		background-color: var(--bulma-scheme-main-bis);
		border: solid 1px var(--bulma-border);
		border-radius: var(--bulma-radius);
		white-space: pre;
		padding: 1rem;
		overflow: auto;
	}
	.previous:not(:only-child) {
		border-bottom: 0;
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
	}
	.textarea {
		resize: none;
		max-height: 500px;
		white-space: pre;
	}
	.textarea:not(:first-child) {
		border-top-left-radius: 0;
		border-top-right-radius: 0;
	}
</style>
