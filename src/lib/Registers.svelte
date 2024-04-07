<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { type Register, type Registers } from '../marie';
	import HexCell from './HexCell.svelte';
	export let registers: Registers;
	export let readonly = false;

	let hoverRegister: Register | null = null;
	let editRegister: Register | null = null;

	const dispatch = createEventDispatcher();

	$: dispatch('hover', {
		register: editRegister === null ? hoverRegister : null,
	});

	function checkReadOnly(readonly: boolean) {
		if (readonly) {
			editRegister = null;
		}
	}
	$: checkReadOnly(readonly);

	function edit(register: Register) {
		if (!readonly) {
			editRegister = register;
		}
	}

	const regs: Register[] = ['AC', 'IR', 'MAR', 'MBR', 'PC', 'IN', 'OUT'];
</script>

<div class="registers">
	{#each regs as reg}
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<!-- svelte-ignore a11y-mouse-events-have-key-events -->
		<div
			class={`register register-${reg}`}
			on:mouseenter={() => (hoverRegister = reg)}
			on:mouseleave={() => (hoverRegister = null)}
		>
			<div class="name">{reg}</div>
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="value" on:dblclick={() => edit(reg)}>
				<HexCell
					value={registers[reg]}
					editing={editRegister === reg}
					digits={reg === 'PC' || reg === 'MAR' ? 3 : 4}
					on:edit={(e) => {
						dispatch('edit-register', { register: reg, value: e.detail.value });
						editRegister = null;
					}}
					on:cancel={() => (editRegister = null)}
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
