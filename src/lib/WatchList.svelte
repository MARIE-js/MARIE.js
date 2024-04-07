<script lang="ts">
	import Fa from 'svelte-fa';
	import { bin, dec, hex, oct } from '../utils';
	import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
	import { createEventDispatcher } from 'svelte';

	export let symbols: { [label: string]: number | undefined };
	export let pointers: { [label: string]: boolean | undefined };
	export let memory: number[];

	const dispatch = createEventDispatcher();

	function getItems(
		symbols: { [label: string]: number | undefined },
		pointers: { [label: string]: boolean | undefined },
		memory: number[],
	) {
		return Object.entries(symbols).map(([label, address]) => {
			let addr = address!;
			let value = memory[addr];
			const canBePtr = value <= 0xfff;
			if (canBePtr && pointers[label]) {
				addr = value;
				value = memory[addr];
			}
			return {
				label,
				canBePtr,
				address: addr,
				value,
			};
		});
	}
	$: items = getItems(symbols, pointers, memory);
</script>

<div class="watches">
	{#if Object.keys(symbols).length > 0}
		<table class="table is-striped is-fullwidth">
			<thead>
				<tr>
					<th>Label</th>
					<th class="has-text-right">Address</th>
					<th class="has-text-right">HEX</th>
					<th class="has-text-right">DEC</th>
					<th class="has-text-right">OCT</th>
					<th class="has-text-right">BIN</th>
				</tr>
			</thead>
			<tbody>
				{#each items as item}
					<tr
						on:mouseenter={() =>
							dispatch('hover-watch', { address: item.address })}
						on:mouseleave={() => dispatch('hover-watch', { address: null })}
					>
						<td>
							<div
								class="is-flex is-align-items-center is-justify-content-space-between"
							>
								<span>{item.label}</span>
								{#if item.canBePtr}
									<span>
										<button
											class="button is-small"
											class:is-info={pointers[item.label]}
											title={pointers[item.label]
												? 'Click to interpret directly'
												: 'Click to interpret as pointer'}
											on:click={() =>
												(pointers[item.label] = !pointers[item.label])}
										>
											<Fa icon={faArrowRight} />
										</button></span
									>
								{/if}
							</div>
						</td>
						<td class="has-text-right">{hex(item.address, 3)}</td>
						<td class="has-text-right">{hex(item.value)}</td>
						<td class="has-text-right">{dec(item.value)}</td>
						<td class="has-text-right">{oct(item.value)}</td>
						<td class="has-text-right">{bin(item.value)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<div class="has-text-centered has-text-grey p-4 empty">
			(no labels in assembled program)
		</div>
	{/if}
</div>

<style>
	.watches {
		height: 100%;
		overflow: auto;
	}
	.empty {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
	}
	.watches thead {
		position: sticky;
		z-index: 1;
		top: 0;
		background-color: var(--bulma-scheme-main);
	}
</style>
