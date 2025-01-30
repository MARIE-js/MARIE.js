<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Action, Register, State } from '../marie';
	import { bin, dec, hex, oct } from '../utils';
	import Memory from './Memory.svelte';
	import Registers from './Registers.svelte';

	let {
		state: machine,
		log,
		showMemory = true,
		onEditRegister,
		onEditMemory,
		statusBar,
		header,
	}: {
		state: State;
		log: Action[];
		showMemory?: boolean;
		onEditRegister: (register: Register, value: number) => void;
		onEditMemory: (address: number, value: number) => void;
		statusBar?: Snippet;
		header?: Snippet;
	} = $props();

	let hoverAddress = $state<number | null>(null);
	let hoverRegister = $state<Register | null>(null);

	let hoverValue = $derived(
		hoverAddress !== null
			? machine.memory[hoverAddress]
			: hoverRegister === null
				? null
				: machine.registers[hoverRegister],
	);
	let readonly = $derived(machine.halted);

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
	{@render header?.()}
	<div class="registers">
		<Registers
			registers={machine.registers}
			{readonly}
			{onEditRegister}
			onHover={(register) => {
				hoverRegister = register;
			}}
		/>
	</div>
	{#if showMemory}
		<div class="memory">
			<Memory
				memory={machine.memory}
				{log}
				pc={machine.registers.PC}
				mar={machine.registers.MAR}
				{readonly}
				{onEditMemory}
				onHover={(address) => {
					hoverAddress = address;
				}}
			/>
		</div>
	{/if}
	<div class="info-bar">
		{#if hoverValue === null}
			{#if statusBar}
				<div>
					{@render statusBar()}
				</div>
			{/if}
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
