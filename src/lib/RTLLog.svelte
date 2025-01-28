<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import type { Action, Register } from '../marie';
	import { dec, hex, logWatcher } from '../utils';

	const dispatch = createEventDispatcher();

	export let log: Action[];
	let startStep = 0;
	let element: HTMLDivElement | undefined;

	type Step = { pc: number; actions: (string | string[])[]; key: number };
	let steps: Step[] = [];

	function isAddressRegister(x: Register) {
		return x === 'PC' || x === 'MAR';
	}

	const updateLogs = logWatcher(
		(logs) => {
			steps = logs.reduce<Step[]>((steps, action) => {
				if (action.type === 'step') {
					steps.push({ pc: action.pc, actions: [], key: steps.length });
				} else {
					const s = getAction(action);
					if (s !== null) {
						steps[steps.length - 1].actions.push(s);
					}
				}
				return steps;
			}, steps);
		},
		() => (steps = []),
	);
	$: updateLogs(log);

	function getAction(action: Action) {
		switch (action.type) {
			case 'regtransfer':
				return [
					action.target,
					`${action.source}${isAddressRegister(action.target) && !isAddressRegister(action.source) ? '[11-0]' : ''}`,
				];
			case 'memread':
				return ['MBR', 'M[MAR]'];
			case 'memwrite':
				return ['M[MAR]', 'MBR'];
			case 'decode':
				return `Decoded opcode 0x${hex(action.opcode, 1)} in IR[15-12] as ${action.name}`;
			case 'incpc':
				return ['PC', 'PC + 1'];
			case 'comparison':
				switch (action.operation) {
					case 'AC_NEG':
						return `Is AC < 0? ${action.result ? 'Yes!' : 'No'}`;
					case 'AC_ZERO':
						return `Is AC = 0? ${action.result ? 'Yes!' : 'No'}`;
					case 'AC_POS':
						return `Is AC > 0? ${action.result ? 'Yes!' : 'No'}`;
				}
			case 'arithmetic':
				switch (action.operation) {
					case 'ADD':
						return 'AC ← AC + MBR';
					case 'SUB':
						return 'AC ← AC - MBR';
					case 'CLEAR':
						return 'AC ← 0';
				}
			case 'input':
				return ['IN', dec(action.newInput)];
			case 'halt':
				return 'Halted';
		}
		return null;
	}

	async function update(steps: Step[]) {
		startStep = Math.max(0, steps.length - 5);
		await tick();
		if (element) {
			element.scrollTo(0, element.scrollHeight);
		}
	}
	$: update(steps);

	async function showPrevious() {
		if (!element) {
			return;
		}
		const el = element
			.getElementsByClassName('step')
			.item(0) as HTMLDivElement | null;
		if (!el) {
			return;
		}
		const oldOffsetTop = el.offsetTop;
		startStep = Math.max(0, startStep - 5);
		if (el) {
			await tick();
			element.scrollBy(0, el.offsetTop - oldOffsetTop);
		}
	}
</script>

<div class="log" bind:this={element}>
	{#if startStep > 0}
		<div class="show-prev">
			<button class="button is-fullwidth" on:click={showPrevious}
				>Show previous</button
			>
		</div>
	{/if}
	{#each steps.slice(startStep) as step (step.key)}
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="step"
			on:mouseenter={() => dispatch('hover-rtl', { pc: step.pc })}
			on:mouseleave={() => dispatch('hover-rtl', { pc: null })}
		>
			{#each step.actions as action}
				<div class="action">
					{#if Array.isArray(action)}
						<div class="left">{action[0]}</div>
						<div class="arrow">←</div>
						<div class="right">{action[1]}</div>
					{:else}
						<div class="single">
							{action}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div class="has-text-centered has-text-grey p-4 empty">(log empty)</div>
	{/each}
</div>

<style>
	.log {
		height: 100%;
		overflow: auto;
	}
	.empty {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.show-prev {
		padding: 1rem;
	}
	.step {
		padding: 1rem;
	}
	.step:hover {
		background-color: var(--bulma-scheme-main-bis);
	}
	.step:not(:first-child) {
		border-top: solid 1px var(--bulma-border);
	}
	.action {
		display: flex;
		justify-content: center;
	}
	.single {
		text-align: center;
	}
	.left {
		text-align: right;
	}
	.arrow {
		padding-left: 0.5rem;
		padding-right: 0.5rem;
	}
	.right {
		text-align: left;
	}
	.left,
	.right {
		flex: 1 0 0;
	}
</style>
