<script lang="ts">
	import {
		MarieSim,
		type AssembledProgram,
		assemble,
		type Register,
		type Action,
		type State,
	} from '../marie';
	import { throttle } from 'lodash';
	import {
		faAngleLeft,
		faAngleRight,
		faCaretLeft,
		faCaretRight,
		faCheck,
		faClockRotateLeft,
		faForward,
		faHammer,
		faPause,
		faPlay,
	} from '@fortawesome/free-solid-svg-icons';
	import Fa from 'svelte-fa';

	let {
		sim,
		code,
		codeModified,
		breakpoints = {},
		speed = $bindable(),
		onAssembled,
		onError,
		onOutput,
		onUpdate,
		onPause,
		onStep,
		onMicroStep,
		onAction,
		onBreak,
		onHalt,
	}: {
		sim: MarieSim;
		code: string;
		codeModified: boolean;
		breakpoints: { [line: number]: boolean | undefined };
		speed: number;
		onAssembled: (program: AssembledProgram) => void;
		onError: (message: string) => void;
		onOutput: (index: number, value: number) => void;
		onUpdate: (state: State, log: Action[]) => void;
		onPause: (reason?: string) => void;
		onStep: (didAction: boolean) => void;
		onMicroStep: (type: Action['type']) => void;
		onAction: (type: 'run' | 'stepBack' | 'microStepBack' | 'restart') => void;
		onBreak: (line: number) => void;
		onHalt: (error?: string) => void;
	} = $props();

	let error = $state(false);
	let program = $state<AssembledProgram | null>(null);
	let machineState = $state(sim.state());
	let log = $state<Action[]>([]);
	let running = $state(false);
	let hasBeenRun = $state(false);
	let fastMode = $state(false);
	let lockFastMode = $state(false);

	let canStepBack = $derived(log.length > 0);
	$effect(() => {
		sim.enableLog = !fastMode;
	});

	function forceUpdateState() {
		machineState = sim.state();
		log = [...sim.log];
		onUpdate(machineState, log);
	}
	const updateState = throttle(forceUpdateState, 50);

	function assembleCode() {
		lockFastMode = false;
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
				onAssembled(program);
			} catch (e) {
				error = true;
				onError((e as Error).message);
			}
		} else {
			error = true;
			onError(
				`Failed to assemble program. ${result.errors[0].type} on line ${result.errors[0].line}.`,
			);
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
			onBreak(line);
		}
	}

	const speeds = [
		{ maxSteps: 1, delay: 1000 },
		{ maxSteps: 1, delay: 500 },
		{ maxSteps: 1, delay: 250 },
		{ maxSteps: 1, delay: 10 },
		{ maxSteps: 1, delay: 30 },
		{ maxSteps: 1, delay: 0 },
		{ maxSteps: 10, delay: 0 },
		{ maxSteps: 50, delay: 0 },
		{ maxSteps: 100, delay: 0 },
		{ maxSteps: Infinity, delay: 0 },
	];
	let speedSetting = $derived(speeds[speed]);
	async function run() {
		if (fastMode) {
			runFast();
			return;
		}
		lockFastMode = true;
		running = true;
		hasBeenRun = true;
		onAction('run');
		while (running) {
			const start = performance.now();
			for (
				let i = 0;
				i < speedSetting.maxSteps && running && performance.now() - start < 20;
				i++
			) {
				await doRunStep();
			}
			updateState();
			await new Promise((resolve) => {
				setTimeout(() => resolve(null), speedSetting.delay);
			});
		}
		running = false;
	}

	async function runFast() {
		lockFastMode = true;
		running = true;
		hasBeenRun = true;
		onAction('run');
		while (running) {
			const actions = [];
			const start = performance.now();
			while (performance.now() - start < 200) {
				for (let i = 0; i < 100000; i++) {
					actions.push(await sim.microStep());
				}
			}
			for (const action of actions) {
				if (action?.type === 'output') {
					onOutput(0, action.value);
				} else if (action?.type === 'halt' && action.halt) {
					onHalt(action.error);
					running = false;
				}
			}
			updateState();
			await new Promise((resolve) => {
				setTimeout(() => resolve(null), 0);
			});
		}
		running = false;
	}

	async function doRunStep() {
		// When running continuously, skip over some virtual actions so that the clock pulses are more regular
		while (running) {
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
		onPause(reason);
		running = false;
	}

	async function step() {
		running = true;
		while (running) {
			const result = await doMicroStep();
			if (result?.type === 'step-end') {
				updateState();
				onStep(result?.type === 'step-end');
				break;
			}
		}
		running = false;
	}

	async function microStep() {
		running = true;
		while (running) {
			const result = await doMicroStep();
			if (result !== null && result.type !== 'step') {
				updateState();
				if (result.type !== 'halt') {
					onMicroStep(result.type);
				}
				break;
			}
		}
		running = false;
	}

	async function doMicroStep() {
		const result = await sim.microStep();
		if (result?.type === 'halt' && result.halt) {
			onHalt(result.error);
			running = false;
			forceUpdateState();
		} else if (result?.type === 'output') {
			onOutput(sim.log.length, result.value);
		}
		return result;
	}

	function stepBack() {
		sim.stepBack();
		updateState();
		onAction('stepBack');
	}

	function microStepBack() {
		while (true) {
			const result = sim.microStepBack();
			if (result?.type !== 'step' && result?.type !== 'step-end') {
				break;
			}
		}
		updateState();
		onAction('microStepBack');
	}

	function restart() {
		lockFastMode = false;
		running = false;
		hasBeenRun = false;
		sim.resetRegisters();
		updateState();
		onAction('restart');
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
		class:is-info={codeModified ||
			(program === null && !error) ||
			machineState.halted}
		class:is-danger={!codeModified && error}
		title="Assemble the program and load it into memory"
		onclick={assembleCode}
	>
		<span class="icon"><Fa icon={faHammer} /></span>
		<span>Assemble</span>
	</button>
	{#if machineState.halted}
		<button class="button" title="The simulator has halted" disabled>
			<span>Halted</span>
			<span class="icon"><Fa icon={faCheck} /></span>
		</button>
	{:else if running}
		<button
			class="button"
			class:is-info={!codeModified && program}
			title="Pause the simulator"
			disabled={machineState.halted}
			onclick={() => pause()}
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
			onclick={run}
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
				onclick={stepBack}
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
				onclick={step}
				disabled={machineState.halted || running}
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
				onclick={microStepBack}
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
				onclick={microStep}
				disabled={machineState.halted || running}
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
		class:is-info={machineState.halted}
		title="Reset the registers to their initial values"
		onclick={restart}
	>
		<span class="icon"><Fa icon={faClockRotateLeft} /></span>
		<span>Restart</span>
	</button>
	<div class="speed" title="Set the execution speed">
		<div>Speed:</div>
		<input
			type="range"
			disabled={fastMode}
			bind:value={speed}
			min="0"
			max="9"
			step="1"
		/>
	</div>

	<button
		class="button"
		class:is-info={fastMode}
		title={lockFastMode
			? `Cannot be toggled until the simulator is restarted.`
			: `Click to ${fastMode ? 'disable' : 'enable'} running as fast as possible, disregarding breakpoints and the RTL log.`}
		disabled={lockFastMode}
		onclick={() => (fastMode = !fastMode)}
	>
		<span class="icon"><Fa icon={faForward} /></span>
	</button>
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
