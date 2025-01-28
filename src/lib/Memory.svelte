<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { hex, logWatcher, rgb } from '../utils';
	import HexCell from './HexCell.svelte';
	import type { Action, MemoryWriteAction } from '../marie';
	export let memory: number[];
	export let log: Action[];
	export let pc: number;
	export let mar: number;
	export let readonly = false;

	const dispatch = createEventDispatcher();

	let hoverAddress: number | null = null;
	let editAddress: number | null = null;

	let changed: Set<number> = new Set();
	const updateLogs = logWatcher(
		(logs) => {
			for (const action of logs) {
				if (action.type === 'memwrite') {
					changed.add(action.address);
				}
			}
			changed = changed;
		},
		() => {
			changed.clear();
			changed = changed;
		},
	);
	$: updateLogs(log);

	function checkReadOnly(readonly: boolean) {
		if (readonly) {
			editAddress = null;
		}
	}
	$: checkReadOnly(readonly);

	function edit(address: number) {
		if (!readonly) {
			editAddress = address;
		}
	}

	$: dispatch('hover', { address: editAddress === null ? hoverAddress : null });
</script>

<div class="memory-view">
	<table class="is-family-monospace">
		<thead>
			<tr>
				<th class="corner"></th>
				{#each [...Array(16)].map((_, j) => j) as j}
					<th
						class:active-col={hoverAddress !== null && hoverAddress % 16 === j}
						>+{j.toString(16).toUpperCase()}</th
					>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each [...Array(256)].map((_, i) => i) as i}
				<tr>
					<th>{hex(16 * i, 3)}</th>
					{#each [...Array(16)].map((_, j) => [j, 16 * i + j]) as [j, address]}
						<!-- svelte-ignore a11y-mouse-events-have-key-events -->
						<td
							class:is-pc={pc === address}
							class:is-mar={mar === address}
							class:active={hoverAddress === address}
							class:active-col={hoverAddress !== null &&
								hoverAddress % 16 === j}
							class:color={address >= 0xf00}
							class:has-text-link={changed.has(address)}
							style:outline-color={address >= 0xf00
								? rgb(memory[address])
								: undefined}
							on:mouseenter={() => (hoverAddress = address)}
							on:mouseleave={() => (hoverAddress = null)}
							on:dblclick={() => edit(address)}
						>
							<HexCell
								value={memory[address]}
								editing={editAddress === address}
								on:cancel={() => (editAddress = null)}
								on:edit={(e) => {
									dispatch('edit-memory', { address, value: e.detail.value });
									editAddress = null;
								}}
							/>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.memory-view {
		background-color: var(--bulma-scheme-main);
		text-align: center;
		overflow: auto;
		height: 100%;
	}

	.memory-view table {
		width: 100%;
		background-color: var(--bulma-scheme-main);
		text-align: center;
		overflow: auto;
		height: 100%;
		border: solid 1px var(--bulma-border);
	}

	.memory-view th,
	.memory-view td {
		vertical-align: middle;
	}

	.memory-view th {
		background-color: var(--bulma-scheme-main);
		padding: 0 0.5rem;
	}

	.memory-view th,
	.memory-view td {
		border: solid 1px var(--bulma-border);
	}

	.memory-view thead {
		position: sticky;
		top: 0;
		z-index: 1;
	}

	.memory-view tbody tr th {
		position: sticky;
		left: 0;
	}

	.memory-view .corner {
		position: sticky;
		left: 0;
	}

	.memory-view tbody tr:hover td,
	.memory-view tbody tr:hover th,
	.memory-view .active-col {
		background-color: var(--bulma-scheme-main-bis);
	}

	.memory-view td.active {
		background-color: var(--bulma-background-active) !important;
	}

	.is-pc:not(.is-mar) {
		background-color: var(--marie-highlight-pc) !important;
	}
	.is-mar:not(.is-pc) {
		background-color: var(--marie-highlight-mar) !important;
	}
	.is-pc.is-mar {
		background-image: var(--marie-highlight-pc-mar);
	}

	.memory-view .color {
		outline-style: solid;
		outline-width: 1px;
		outline-offset: -1px;
	}
</style>
