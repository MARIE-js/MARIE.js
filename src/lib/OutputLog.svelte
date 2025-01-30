<script lang="ts">
	import { tick } from 'svelte';
	import { bin, dec, hex, oct } from '../utils';
	import type { InputOutputMode } from '../settings';

	let {
		outputs,
		outputMode = $bindable(),
	}: {
		outputs: number[];
		outputMode: InputOutputMode;
	} = $props();

	let element = $state<HTMLDivElement>();

	function showValue(mode: InputOutputMode, value: number) {
		switch (mode) {
			case 'dec':
				return dec(value);
			case 'oct':
				return oct(value);
			case 'bin':
				return bin(value);
		}
		return hex(value);
	}

	function showUnicode(outputs: number[]) {
		const decoder = new TextDecoder('utf-16be', {
			ignoreBOM: true,
			fatal: false,
		});
		const array = new Uint16Array(outputs.length);
		const view = new DataView(array.buffer);
		outputs.forEach((v, i) => {
			view.setUint16(i * 2, v, false);
		});
		const decoded = decoder.decode(array);
		return decoded.replaceAll('\u{FFFE}', '');
	}

	async function update(outputs: number[]) {
		if (element) {
			await tick();
			element.scrollTo(0, element.scrollHeight);
		}
	}
	$effect(() => {
		update(outputs);
	});
</script>

<div class="outputs">
	<div class="top">
		<div class="select is-fullwidth">
			<select bind:value={outputMode}>
				<option value="hex">Hexadecimal</option>
				<option value="dec">Decimal</option>
				<option value="oct">Octal</option>
				<option value="bin">Binary</option>
				<option value="unicode">Unicode (UTF-16BE)</option>
			</select>
		</div>
	</div>
	<div class="log" bind:this={element}>
		{#if outputs.length === 0}
			<div class="has-text-centered has-text-grey">(no output)</div>
		{:else if outputMode === 'unicode'}
			<div class="unicode">
				{showUnicode(outputs)}
			</div>
		{:else}
			{#each outputs as output}
				<div class="output">
					{showValue(outputMode, output)}
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.outputs {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		overflow: hidden;
	}
	.top {
		flex: 0 0 auto;
	}
	.log {
		flex: 1 1 auto;
		overflow: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.output {
		text-align: right;
	}
	.unicode {
		white-space: pre;
	}
</style>
