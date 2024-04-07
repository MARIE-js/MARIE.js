<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		MarieSim,
		type AssembledProgram,
		assemble,
		type Register,
		type Action,
	} from '../marie';
	import { throttle } from 'lodash';
	import {
		faAngleLeft,
		faAngleRight,
		faCaretLeft,
		faCaretRight,
		faCheck,
		faClockRotateLeft,
		faHammer,
		faPause,
		faPlay,
	} from '@fortawesome/free-solid-svg-icons';
	import Fa from 'svelte-fa';

	export let sim: MarieSim;
	export let code: string;
	export let codeModified: boolean;
	export let breakpoints: { [line: number]: boolean | undefined } = {};
	export let speed: number;

	const dispatch = createEventDispatcher();

	let error = false;
	let program: AssembledProgram | null = null;
	let state = sim.state();
	let log: Action[] = [];
	let running = false;
	let hasBeenRun = false;

	$: canStepBack = log.length > 0;

	const updateState = throttle(() => {
		state = sim.state();
		log = [...sim.log];
		dispatch('update', { state, log });
	}, 50);

	function assembleCode() {
		running = false;
		error = false;
		hasBeenRun = false;
		program = null;
		const result = assemble(code);
		if (result.success) {
			try {
				sim.load(result.assembled);
				updateState();
				program = result.assembled;
				dispatch('assembled', { program });
			} catch (e) {
				error = true;
				dispatch('error', { message: (e as Error).message });
			}
		} else {
			error = true;
			dispatch('error', {
				message: `Failed to assemble program. ${result.errors[0].type} on line ${result.errors[0].line}.`,
			});
		}
	}

	function checkBreakPoint() {
		if (!program) {
			return;
		}
		const line = program.sourceMap[sim.registers.PC];
		if (line === undefined) {
			return;
		}
		if (breakpoints[line]) {
			running = false;
			dispatch('break', { line });
		}
	}

	const speeds = [
		{ maxSteps: 0, delay: 1000 },
		{ maxSteps: 0, delay: 500 },
		{ maxSteps: 0, delay: 250 },
		{ maxSteps: 0, delay: 10 },
		{ maxSteps: 0, delay: 30 },
		{ maxSteps: 0, delay: 0 },
		{ maxSteps: 10, delay: 0 },
		{ maxSteps: 50, delay: 0 },
		{ maxSteps: 100, delay: 0 },
		{ maxSteps: Infinity, delay: 0 },
	];
	$: speedSetting = speeds[speed];
	async function run() {
		running = true;
		hasBeenRun = true;
		dispatch('action', { type: 'run' });
		while (running && !sim.halted) {
			const start = performance.now();
			await doRunStep();
			for (
				let i = 0;
				i < speedSetting.maxSteps &&
				running &&
				!sim.halted &&
				performance.now() - start < 20;
				i++
			) {
				await doRunStep();
			}
			await new Promise((resolve) => {
				setTimeout(() => resolve(null), speedSetting.delay);
			});
		}
		running = false;
	}

	async function doRunStep() {
		// When running continuously, skip over some virtual actions so that the clock pulses are more regular
		while (running && !sim.halted) {
			const action = await doMicroStep();
			if (action?.type === 'decode' || action?.type == 'step-end') {
				continue;
			}
			if (action?.type === 'step') {
				checkBreakPoint();
				continue;
			}
			return;
		}
	}

	export function pause(reason?: string) {
		dispatch('pause', { reason });
		running = false;
	}

	async function step() {
		running = true;
		while (running && !sim.halted) {
			const result = await doMicroStep();
			if (result?.type === 'step-end') {
				updateState();
				dispatch('step', { didAction: result?.type === 'step-end' });
				break;
			}
		}
		running = false;
	}

	async function microStep() {
		running = true;
		while (running && !sim.halted) {
			const result = await doMicroStep();
			if (result !== null && result.type !== 'step') {
				if (result.type !== 'halt') {
					dispatch('microStep', { type: result.type });
				}
				break;
			}
		}
		running = false;
	}

	async function doMicroStep() {
		const result = await sim.microStep();
		updateState();
		if (result?.type === 'halt' && result.halt) {
			dispatch('halt', { error: result.error });
		}
		return result;
	}

	function stepBack() {
		sim.stepBack();
		updateState();
		dispatch('action', { type: 'stepBack' });
	}

	function microStepBack() {
		while (true) {
			const result = sim.microStepBack();
			if (result?.type !== 'step' && result?.type !== 'step-end') {
				break;
			}
		}
		updateState();
		dispatch('action', { type: 'microStepBack' });
	}

	function restart() {
		running = false;
		hasBeenRun = false;
		sim.resetRegisters();
		updateState();
		dispatch('action', { type: 'restart' });
	}

	export function editMemory(address: number, value: number) {
		sim.memory[address] = value;
		updateState();
	}

	export function editRegister(register: Register, value: number) {
		sim.registers[register] = value;
		updateState();
	}
</script>

<div class="controls">
	<button
		class="button"
		class:is-info={codeModified || (program === null && !error) || state.halted}
		class:is-danger={!codeModified && error}
		title="Assemble the program and load it into memory"
		on:click={assembleCode}
	>
		<span class="icon"><Fa icon={faHammer} /></span>
		<span>Assemble</span>
	</button>
	{#if state.halted}
		<button class="button" title="The simulator has halted" disabled>
			<span>Halted</span>
			<span class="icon"><Fa icon={faCheck} /></span>
		</button>
	{:else if running}
		<button
			class="button"
			class:is-info={!codeModified && program}
			title="Pause the simulator"
			disabled={state.halted}
			on:click={() => pause()}
		>
			<span>Pause</span>
			<span class="icon"><Fa icon={faPause} /></span>
		</button>
	{:else}
		<button
			class="button"
			class:is-info={!codeModified && program}
			title={hasBeenRun
				? 'Unpause the simulator'
				: 'Run the program until it halts'}
			on:click={run}
		>
			<span>
				{#if hasBeenRun}
					Continue
				{:else}
					Run
				{/if}
			</span>
			<span class="icon"><Fa icon={faPlay} /></span>
		</button>
	{/if}

	<div class="field has-addons mb-0">
		<p class="control">
			<button
				class="button"
				title="Rewind to the previous instruction"
				on:click={stepBack}
				disabled={running || !canStepBack}
			>
				<span class="icon">
					<Fa icon={faAngleLeft} />
				</span>
			</button>
		</p>
		<p class="control">
			<button
				class="button"
				title="Perform one instruction"
				on:click={step}
				disabled={state.halted || running}
			>
				<span>Step</span>
				<span class="icon">
					<Fa icon={faAngleRight} />
				</span>
			</button>
		</p>
	</div>

	<div class="field has-addons mb-0">
		<p class="control">
			<button
				class="button"
				title="Step back to previous micro instruction"
				on:click={microStepBack}
				disabled={!canStepBack}
			>
				<span class="icon">
					<Fa icon={faCaretLeft} />
				</span>
			</button>
		</p>
		<p class="control">
			<button
				class="button"
				title="Perform one micro instruction"
				on:click={microStep}
				disabled={state.halted || running}
			>
				<span>Micro step</span>
				<span class="icon">
					<Fa icon={faCaretRight} />
				</span>
			</button>
		</p>
	</div>
	<button
		class="button"
		class:is-info={state.halted}
		title="Reset the registers to their initial values"
		on:click={restart}
	>
		<span class="icon"><Fa icon={faClockRotateLeft} /></span>
		<span>Restart</span>
	</button>
	<div class="speed" title="Set the execution speed">
		<div>Speed:</div>
		<input type="range" bind:value={speed} min="0" max="9" step="1" />
	</div>
</div>

<style>
	.controls {
		padding-top: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.speed {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.speed input {
		width: 10rem;
	}
</style>
