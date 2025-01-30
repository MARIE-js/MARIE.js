<script lang="ts">
	import { type Register, type Registers } from '../marie';
	import HexCell from './HexCell.svelte';

	let {
		registers,
		readonly = false,
		onHover,
		onEditRegister,
	}: {
		registers: Registers;
		readonly: boolean;
		onHover: (register: Register | null) => void;
		onEditRegister: (register: Register, value: number) => void;
	} = $props();

	let hoverRegister = $state<Register | null>(null);
	let editRegister = $state<Register | null>(null);

	$effect(() => onHover(editRegister === null ? hoverRegister : null));

	function checkReadOnly(readonly: boolean) {
		if (readonly) {
			editRegister = null;
		}
	}
	$effect(() => checkReadOnly(readonly));

	function edit(register: Register) {
		if (!readonly) {
			editRegister = register;
		}
	}

	const regs: Register[] = ['AC', 'IR', 'MAR', 'MBR', 'PC', 'IN', 'OUT'];
</script>

<div class="registers">
	{#each regs as reg}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class={`register register-${reg}`}
			onmouseenter={() => (hoverRegister = reg)}
			onmouseleave={() => (hoverRegister = null)}
		>
			<div class="name">{reg}</div>
			<div class="value" ondblclick={() => edit(reg)}>
				<HexCell
					value={registers[reg]}
					editing={editRegister === reg}
					digits={reg === 'PC' || reg === 'MAR' ? 3 : 4}
					onEdit={(value) => {
						onEditRegister(reg, value);
						editRegister = null;
					}}
					onCancel={() => (editRegister = null)}
				/>
			</div>
		</div>
	{/each}
</div>

<style>
	.registers {
		padding: 1rem;
		text-align: center;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
	}
	.register {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.name {
		font-weight: bold;
	}
	.value {
		background-color: var(--bulma-scheme-main);
		border: solid 1px var(--bulma-border);
	}
	.register-PC .value {
		background-color: var(--marie-highlight-pc);
	}
	.register-MAR .value {
		background-color: var(--marie-highlight-mar);
	}
</style>
