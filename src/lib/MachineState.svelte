<script lang="ts">
	import type { Action, Register, State } from '../marie';
	import { bin, dec, hex, oct } from '../utils';
	import Memory from './Memory.svelte';
	import Registers from './Registers.svelte';

	export let state: State;
	export let log: Action[];
	export let showMemory = true;

	let hoverAddress: number | null = null;
	let hoverRegister: Register | null = null;

	$: hoverValue =
		hoverAddress !== null
			? state.memory[hoverAddress]
			: hoverRegister === null
				? null
				: state.registers[hoverRegister];
	$: readonly = state.halted;

	const registerDescription = {
		AC: 'Accumulator',
		IR: 'Instruction register',
		MAR: 'Memory address register',
		MBR: 'Memory buffer register',
		PC: 'Program counter',
		IN: 'Input register',
		OUT: 'Output register',
	};
</script>

<div class="machine-state">
	<slot name="header" />
	<div class="registers">
		<Registers
			registers={state.registers}
			{readonly}
			on:edit-register
			on:hover={(e) => (hoverRegister = e.detail.register)}
		/>
	</div>
	{#if showMemory}
		<div class="memory">
			<Memory
				memory={state.memory}
				{log}
				pc={state.registers.PC}
				mar={state.registers.MAR}
				{readonly}
				on:edit-memory
				on:hover={(e) => (hoverAddress = e.detail.address)}
			/>
		</div>
	{/if}
	<div class="info-bar">
		{#if hoverValue === null}
			<div>
				<slot name="status-bar" />
			</div>
		{:else}
			{#if hoverAddress}
				<div>
					<span class="has-text-weight-bold">Address: </span>
					<span class="is-family-monospace">{hex(hoverAddress, 3)}</span>
				</div>
			{/if}
			{#if hoverRegister}
				<div>
					<span class="has-text-weight-bold"
						>{registerDescription[hoverRegister]}</span
					>
				</div>
			{/if}
			<div>
				<span class="has-text-weight-bold">DEC: </span>
				<span class="is-family-monospace">{dec(hoverValue)}</span>
			</div>
			<div>
				<span class="has-text-weight-bold">HEX: </span>
				<span class="is-family-monospace">{hex(hoverValue)}</span>
			</div>
			<div>
				<span class="has-text-weight-bold">OCT: </span>
				<span class="is-family-monospace">{oct(hoverValue)}</span>
			</div>
			<div>
				<span class="has-text-weight-bold">BIN: </span>
				<span class="is-family-monospace">{bin(hoverValue)}</span>
			</div>
			{#if !readonly}
				<div class="is-hidden-mobile">Double click value to edit</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.machine-state {
		margin: 0 auto;
		max-width: 1200px;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}
	.registers {
		margin: 0 auto;
	}
	.memory {
		flex: 1 1 0;
		height: 0;
		min-height: 100px;
	}
	.info-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		padding: 0.5rem;
		flex: 0 0 4rem;
		align-items: center;
	}
</style>
