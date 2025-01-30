<script lang="ts">
	import Editor from './lib/Editor.svelte';
	import MachineState from './lib/MachineState.svelte';
	import SplitPanel from './lib/SplitPanel.svelte';
	import {
		MarieSim,
		type AssembledProgram,
		type Action,
		type State,
		parseIntLit,
	} from './marie';
	import { constructURL, settings, isMobile } from './settings';
	import RtlLog from './lib/RTLLog.svelte';
	import CollapsiblePanel from './lib/CollapsiblePanel.svelte';
	import OutputLog from './lib/OutputLog.svelte';
	import WatchList from './lib/WatchList.svelte';
	import Display from './lib/Display.svelte';
	import InputsPanel from './lib/InputsPanel.svelte';
	import Simulator from './lib/Simulator.svelte';
	import { onMount, tick } from 'svelte';
	import {
		saveProject,
		restoreProject,
		loadProject,
		newProject,
		migrateProject,
	} from './project';
	import { debounce } from 'lodash';
	import DataPath from './lib/DataPath.svelte';
	import Fa from 'svelte-fa';
	import {
		faPalette,
		faDatabase,
		faDownload,
		faFile,
		faFolderOpen,
		faGlobe,
		faMicrochip,
		faLightbulb,
		faUpload,
		faShareNodes,
		faQuestionCircle,
	} from '@fortawesome/free-solid-svg-icons';
	import Recent from './lib/Recent.svelte';
	import examples, { getExampleURL } from './examples';
	import LoadFromUrl from './lib/LoadFromUrl.svelte';
	import ShareUrl from './lib/ShareUrl.svelte';
	import Spinner from './lib/Spinner.svelte';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import InstructionSet from './lib/InstructionSet.svelte';

	type MenuType = 'file' | 'examples';

	let { projectId, project } = $state(restoreProject());

	const sim = new MarieSim(getInput);
	let program = $state<AssembledProgram | null>(null);
	let machineState = $state(sim.state());
	let log = $state<Action[]>([]);
	let simulator = $state<Simulator>();
	let editor = $state<Editor>();
	let codeModified = $state(false);
	let statusText = $state<{ cls?: string; msg: string }>();
	let addressHover = $state<number | null>(null);
	let inputLogIndices = $state<number[]>([]);
	let inputsPanel: InputsPanel | undefined;
	let showDataPath = $state(false);
	let recentOpen = $state(false);
	let fileInput: HTMLInputElement;
	let files = $state<FileList>();
	let fileMenu: HTMLDivElement;
	let examplesMenu: HTMLDivElement;
	let menuOpen = $state<MenuType | null>(null);
	let loadFromURLOpen = $state(false);
	let shareUrl = $state<string | null>(null);
	let menuActive = $state(false);
	let showInstructions = $state(false);
	let busyState = $state(0);

	let pcLine = $derived(program?.sourceMap[machineState.registers.PC]);
	let marLine = $derived(program?.sourceMap[machineState.registers.MAR]);
	let hoverLine = $derived(
		program && addressHover !== null
			? program.sourceMap[addressHover]
			: undefined,
	);

	const autoSave = debounce(saveProject, 5000);
	$effect(() => autoSave(projectId, project));

	let isLoading = $derived(busyState > 0);

	function setStatus(msg: string, cls?: string) {
		statusText = { cls, msg };
	}

	function onUpdate(newState: State, newLog: Action[]) {
		machineState = newState;
		log = newLog;
	}

	function onAssembled(assembled: AssembledProgram) {
		codeModified = false;
		program = assembled;
		setStatus('Successfully assembled program.');
		reset();
		saveProject(projectId, project);
	}

	function onError(message: string) {
		codeModified = false;
		setStatus(message, 'has-text-danger');
	}

	function onBreak(line: number) {
		setStatus(`Paused at breakpoint on line ${line}.`);
		editor?.scrollToPC();
	}

	function onHalt(error?: string) {
		if (error) {
			setStatus(`Machine halted abnormally: ${error}`);
		} else {
			setStatus('Machine halted normally.');
		}
	}

	function onAction(type: string) {
		switch (type) {
			case 'run':
				setStatus('Running.');
				break;
			case 'stepBack':
				setStatus('Moved one step back.');
				break;
			case 'microStepBack':
				setStatus('Moved one microstep back.');
				break;
			case 'restart':
				reset();
				setStatus('Reset machine state (memory contents preserved).');
				break;
		}
	}

	async function onPause(reason?: string) {
		if (reason === 'input-empty') {
			setStatus(
				'Input required. Please enter input and press continue.',
				'has-text-warning',
			);
			$settings.inputsOpen = true;
			await tick();
			inputsPanel?.focus();
		} else if (reason === 'input-error') {
			setStatus('Invalid input. Please edit and try again.', 'has-text-danger');
			$settings.inputsOpen = true;
			await tick();
			inputsPanel?.focus();
		} else {
			editor?.scrollToPC();
			setStatus('Paused.');
		}
	}

	function onStep(didAction: boolean) {
		if (didAction) {
			setStatus('Executed one step.');
		}
	}
	function onMicroStep(type?: string) {
		if (type === 'step-end') {
			setStatus('Completed executing instruction.');
		} else {
			setStatus('Executed one microstep.');
		}
	}

	function getInput() {
		let hadError = false;
		let value: number | null = null;
		project.inputs = project.inputs.map((input) => {
			if (
				hadError ||
				value !== null ||
				input.queued === null ||
				input.queued === ''
			) {
				return input;
			}
			if (input.format === 'unicode') {
				input.consumed = `${input.consumed}${input.queued[0]}`;
				value = input.queued.charCodeAt(0);
				input.queued = input.queued.substring(1);
				return input;
			}
			const lines = input.queued
				.split('\n')
				.map((l) => l.trim())
				.filter((l) => l !== '');
			if (lines.length === 0) {
				input.queued = '';
				return input;
			}

			let radix = 10;
			switch (input.format) {
				case 'hex':
					radix = 16;
					break;
				case 'oct':
					radix = 8;
					break;
				case 'bin':
					radix = 2;
					break;
			}
			const n = parseIntLit(lines[0], radix);
			if (n === null) {
				hadError = true;
				return input;
			}
			value = n;
			input.consumed =
				input.consumed === '' ? lines[0] : `${input.consumed}\n${lines[0]}`;
			input.queued = lines.slice(1).join('\n');
			return input;
		});

		if (value === null) {
			// No input available
			simulator!.pause(hadError ? 'input-error' : 'input-empty');
			return null;
		}

		inputLogIndices.push(sim.log.length);
		return value;
	}

	let oldLogLength = 0;
	function rewind(log: Action[]) {
		if (oldLogLength <= log.length) {
			oldLogLength = log.length;
			return;
		}
		const rewindFrom = inputLogIndices.findIndex((i) => i >= log.length);
		const toRewind = rewindFrom >= 0 ? inputLogIndices.length - rewindFrom : 0;
		let count = 0;
		let i = project.inputs.length - 1;
		while (i >= 0 && count < toRewind) {
			const input = project.inputs[i];
			if (input.consumed === '') {
				i--;
				continue;
			}
			if (input.format === 'unicode') {
				input.queued = `${input.consumed[input.consumed.length - 1]}${input.queued}`;
				input.consumed = input.consumed.substring(0, input.consumed.length - 1);
			} else {
				const idx = input.consumed.lastIndexOf('\n');
				const line = input.consumed.substring(idx + 1);
				input.queued = input.queued === '' ? line : `${line}\n${input.queued}`;
				input.consumed = input.consumed.substring(0, idx);
			}
			inputLogIndices.pop();
			count++;
		}
		project.inputs = project.inputs;
		outputActions = outputActions.filter((x) => x.index < log.length);
		oldLogLength = log.length;
	}
	$effect(() => rewind(log));

	let outputActions = $state<{ value: number; index: number }[]>([]);
	let outputs = $derived(outputActions.map((x) => x.value));
	function onOutput(index: number, value: number) {
		outputActions = [...outputActions, { index, value }];
	}

	function reset() {
		for (const input of project.inputs) {
			if (input.format === 'unicode') {
				input.queued = `${input.consumed}${input.queued}`;
			} else if (input.consumed !== '') {
				input.queued = `${input.consumed}\n${input.queued}`;
			}
			input.consumed = '';
		}
		project.inputs = project.inputs;
		inputLogIndices = [];
		outputActions = [];
	}

	function downloadCode() {
		const a = document.createElement('a');
		a.style.display = 'none';
		a.href = `data:text/plain;charset=utf-8,${encodeURIComponent(project.code)}`;
		a.download = 'code.mar';
		document.body.appendChild(a);
		a.click();
		a.remove();
		menuOpen = null;
	}

	function downloadBin() {
		const array = new ArrayBuffer(sim.memory.length * 2);
		const view = new DataView(array);
		for (let i = 0; i < sim.memory.length; i++) {
			view.setInt16(i * 2, sim.memory[i], true);
		}
		const blob = new Blob([view]);
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.style.display = 'none';
		a.href = url;
		a.download = 'marie.bin';
		document.body.appendChild(a);
		a.click();
		window.URL.revokeObjectURL(url);
		a.remove();
		menuOpen = null;
	}

	function toggleDataPath() {
		showDataPath = !showDataPath;
		if (showDataPath) {
			$settings.rtlLogOpen = true;
		}
	}

	function toggleInstructionSet() {
		showInstructions = !showInstructions;
	}

	function openProject(key: string) {
		if (project.code !== '') {
			saveProject(projectId, project);
		}
		projectId = '';
		project = loadProject(key);
		projectId = key;
		recentOpen = false;
		menuOpen = null;
	}

	function toggleTheme() {
		$settings.invertTheme = !$settings.invertTheme;
	}

	async function uploaded() {
		if (files && files.length > 0) {
			const code = await files[0].text();
			if (project.code !== '') {
				saveProject(projectId, project);
			}
			projectId = '';
			const np = newProject();
			np.project.code = code;
			projectId = np.projectId;
			project = np.project;
			menuOpen = null;
		}
	}

	function clearProject() {
		if (project.code !== '') {
			saveProject(projectId, project);
		}
		projectId = '';
		const np = newProject();
		projectId = np.projectId;
		project = np.project;
		menuOpen = null;
	}

	function onWindowClick(e: Event) {
		if (
			(menuOpen === 'file' && !e.composedPath().includes(fileMenu)) ||
			(menuOpen === 'examples' && !e.composedPath().includes(examplesMenu))
		) {
			menuOpen = null;
		}
	}

	function toggleMenu(menu: MenuType) {
		if (menuOpen === menu) {
			menuOpen = null;
		} else {
			menuOpen = menu;
		}
	}

	function shareProject() {
		shareUrl = constructURL(`#project=${JSON.stringify(project)}`);
	}

	async function loadFromURL(url: string) {
		busyState++;
		try {
			const response = await fetch(url);
			const code = await response.text();
			loadFromString(code);
		} catch (e) {
			console.error(e);
			setStatus(`Error: ${e}`, 'has-text-danger');
		}
		busyState--;
		menuOpen = null;
		loadFromURLOpen = false;
	}

	function loadFromJSON(p: any) {
		saveProject(projectId, project);
		projectId = '';
		const np = newProject();
		Object.assign(np.project, p);
		projectId = np.projectId;
		project = np.project;
	}

	function loadFromString(code: string) {
		saveProject(projectId, project);
		projectId = '';
		const np = newProject();
		np.project.code = code;
		projectId = np.projectId;
		project = np.project;
	}

	function hashChange() {
		const example = window.location.search.substring(1);
		if (example.length > 0) {
			try {
				const url = decodeURIComponent(example);
				loadFromURL(getExampleURL(url));
				return;
			} catch (e) {
				console.error(e);
			}
		}

		const hash = window.location.hash;
		if (hash.length === 0) {
			return;
		}

		window.history.replaceState(
			undefined,
			'',
			window.location.pathname + window.location.search,
		);

		if (hash.startsWith('#project=')) {
			try {
				const json = decodeURIComponent(hash.substring(9));
				loadFromJSON(JSON.parse(json));
				return;
			} catch (e) {
				console.error(e);
			}
		}

		if (hash.startsWith('#code=')) {
			try {
				const code = decodeURIComponent(hash.substring(6));
				loadFromString(code);
				return;
			} catch (e) {
				console.error(e);
			}
		}

		if (hash.startsWith('#url=')) {
			try {
				const url = decodeURIComponent(hash.substring(5));
				loadFromURL(url);
				return;
			} catch (e) {
				console.error(e);
			}
		}
	}

	onMount(hashChange);
	onMount(migrateProject);
</script>

<svelte:window
	onbeforeunload={() => saveProject(projectId, project)}
	onclick={onWindowClick}
	onhashchange={hashChange}
/>

<main>
	<nav class="navbar" aria-label="main navigation">
		<div class="navbar-brand">
			<!-- svelte-ignore a11y_missing_attribute -->
			<!-- svelte-ignore a11y_interactive_supports_focus -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<a
				role="button"
				class="navbar-burger"
				class:is-active={menuActive}
				aria-label="menu"
				aria-expanded="false"
				onclick={() => (menuActive = !menuActive)}
			>
				<span aria-hidden="true"></span>
				<span aria-hidden="true"></span>
				<span aria-hidden="true"></span>
				<span aria-hidden="true"></span>
			</a>
		</div>
		<div class="navbar-menu" class:is-active={menuActive}>
			<div class="navbar-start">
				<div
					class="navbar-item has-dropdown"
					class:is-active={menuOpen === 'file'}
					bind:this={fileMenu}
				>
					<!-- svelte-ignore a11y_missing_attribute -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<a class="navbar-link" onclick={() => toggleMenu('file')}>
						<span class="icon">
							<Fa icon={faFile} />
						</span>
						<span>File</span>
					</a>
					<!-- svelte-ignore a11y_missing_attribute -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="navbar-dropdown">
						<a class="navbar-item" onclick={clearProject}>
							<span class="icon">
								<Fa icon={faFile} />
							</span>
							<span>New</span>
						</a>
						<hr class="navbar-divider" />
						<a class="navbar-item" onclick={() => (recentOpen = true)}>
							<span class="icon">
								<Fa icon={faFolderOpen} />
							</span>
							<span>Recent files</span>
						</a>
						<a class="navbar-item" onclick={() => fileInput.click()}>
							<span class="icon">
								<Fa icon={faUpload} />
							</span>
							<span>Upload file</span>
						</a>
						<a class="navbar-item" onclick={() => (loadFromURLOpen = true)}>
							<span class="icon">
								<Fa icon={faGlobe} />
							</span>
							<span>Load from URL</span>
						</a>
						<hr class="navbar-divider" />
						<a class="navbar-item" onclick={downloadCode}>
							<span class="icon">
								<Fa icon={faDownload} />
							</span>
							<span>Download code</span>
						</a>
						<a class="navbar-item" onclick={shareProject}>
							<span class="icon">
								<Fa icon={faShareNodes} />
							</span>
							<span>Get share URL</span>
						</a>
						<hr class="navbar-divider" />
						<a class="navbar-item" onclick={downloadBin}>
							<span class="icon">
								<Fa icon={faDatabase} />
							</span>
							<span>Download binary memory dump</span>
						</a>
					</div>
				</div>
				<div
					class="navbar-item has-dropdown"
					class:is-active={menuOpen === 'examples'}
					bind:this={examplesMenu}
				>
					<!-- svelte-ignore a11y_missing_attribute -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<a class="navbar-link" onclick={() => toggleMenu('examples')}>
						<span class="icon">
							<Fa icon={faLightbulb} />
						</span>
						<span>Examples</span>
					</a>
					<div class="navbar-dropdown">
						{#each examples as example}
							<!-- svelte-ignore a11y_missing_attribute -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<a onclick={() => loadFromURL(example.url)} class="navbar-item">
								<span class="icon"><Fa icon={example.icon} /></span>
								<span>{example.name}</span>
							</a>
						{/each}
					</div>
				</div>
			</div>

			<div class="navbar-end">
				<div class="navbar-item">
					<div class="buttons">
						<button
							class="button"
							class:is-info={showDataPath}
							onclick={toggleDataPath}
							title={`Click to ${showDataPath ? 'hide' : 'show'} data path visualisation`}
						>
							<span class="icon">
								<Fa icon={faMicrochip} />
							</span>
							<span>Data Path</span>
						</button>

						<button
							class="button"
							class:is-info={showInstructions}
							onclick={toggleInstructionSet}
							title={`Click to ${showInstructions ? 'hide' : 'show'} instruction set`}
						>
							<span class="icon">
								<Fa icon={faQuestionCircle} />
							</span>
							<span>Instruction Set</span>
						</button>

						<button class="button" onclick={toggleTheme} title={`Switch theme`}>
							<span class="icon">
								<Fa icon={faPalette} />
							</span>
						</button>

						<a
							href="https://github.com/MARIE-js/MARIE.js"
							class="button"
							title="View on GitHub"
							target="_blank"
						>
							<span class="icon">
								<Fa icon={faGithub} />
							</span>
						</a>
					</div>
				</div>
			</div>
		</div>
	</nav>
	<div class="panels">
		{#snippet editorPanel()}
			<div class="panel">
				<Editor
					bind:this={editor}
					bind:text={project.code}
					bind:modified={codeModified}
					bind:breakpoints={project.breakpoints}
					{pcLine}
					{marLine}
					{hoverLine}
				/>
			</div>
		{/snippet}

		{#snippet dataPathPanel()}
			<div class="panel">
				<DataPath state={machineState} {log} />
			</div>
		{/snippet}

		{#snippet editorAndDataPathPanel()}
			<div class="panel">
				<SplitPanel
					direction="vertical"
					bind:split={$settings.editorPanel}
					showPanels={showDataPath ? 'all' : 'a'}
					panelA={editorPanel}
					panelB={dataPathPanel}
				/>
			</div>
		{/snippet}

		{#snippet simulatorComponent()}
			<Simulator
				bind:this={simulator}
				bind:speed={$settings.speed}
				{sim}
				breakpoints={project.breakpoints}
				code={project.code}
				{codeModified}
				{onAssembled}
				{onError}
				{onOutput}
				{onUpdate}
				{onPause}
				{onStep}
				{onMicroStep}
				{onAction}
				{onBreak}
				{onHalt}
			/>
		{/snippet}

		{#snippet statusBar()}
			{#if statusText}
				<span class={statusText.cls}>{statusText.msg}</span>
			{/if}
		{/snippet}

		{#snippet machineStatePanel()}
			<div slot="panelB" class="panel machine-state">
				<MachineState
					state={machineState}
					{log}
					onEditMemory={(address, value) =>
						simulator?.editMemory(address, value)}
					onEditRegister={(register, value) =>
						simulator?.editRegister(register, value)}
					header={simulatorComponent}
					{statusBar}
				/>
			</div>
		{/snippet}

		{#snippet leftInnerPanelA()}
			<div class="panel">
				<SplitPanel
					direction="vertical"
					bind:split={$settings.topPanel}
					panelA={editorAndDataPathPanel}
					panelB={machineStatePanel}
				></SplitPanel>
			</div>
		{/snippet}
		{#snippet leftInnerPanelB()}
			<div class="panel">
				<InstructionSet />
			</div>
		{/snippet}

		{#snippet leftPanel()}
			<div class="panel">
				<SplitPanel
					direction="horizontal"
					bind:split={$settings.instructionPanel}
					showPanels={showInstructions ? 'all' : 'a'}
					panelA={leftInnerPanelA}
					panelB={leftInnerPanelB}
				></SplitPanel>
			</div>
		{/snippet}

		{#snippet outputPanels()}
			<div class="panel output-panels" slot="panelB">
				<div class="output-panels-inner">
					<CollapsiblePanel
						title="Output log"
						bind:open={$settings.outputLogOpen}
					>
						<OutputLog {outputs} bind:outputMode={project.outputMode} />
					</CollapsiblePanel>
					<CollapsiblePanel title="RTL log" bind:open={$settings.rtlLogOpen}>
						<RtlLog {log} onHoverRTL={(pc) => (addressHover = pc)} />
					</CollapsiblePanel>
					<CollapsiblePanel
						title="Watch list"
						bind:open={$settings.watchListOpen}
					>
						<WatchList
							bind:pointers={project.pointers}
							onHoverWatch={(address) => (addressHover = address)}
							memory={machineState.memory}
							symbols={program?.symbols ?? {}}
						/>
					</CollapsiblePanel>
					<CollapsiblePanel title="Inputs" bind:open={$settings.inputsOpen}>
						<InputsPanel bind:this={inputsPanel} bind:inputs={project.inputs} />
					</CollapsiblePanel>
					<CollapsiblePanel title="Display" bind:open={$settings.displayOpen}>
						<Display memory={machineState.memory} />
					</CollapsiblePanel>
				</div>
			</div>
		{/snippet}

		<SplitPanel
			direction={$isMobile ? 'vertical' : 'horizontal'}
			bind:split={$settings.leftPanel}
			panelA={leftPanel}
			panelB={outputPanels}
		></SplitPanel>
	</div>
	<Recent
		active={recentOpen}
		currentKey={projectId}
		onCancel={() => (recentOpen = false)}
		onOpen={openProject}
	/>
	<LoadFromUrl
		active={loadFromURLOpen}
		onCancel={() => (loadFromURLOpen = false)}
		onLoadFromUrl={(url) => {
			loadFromURL(url);
		}}
	/>
	<ShareUrl {shareUrl} />
	<input
		class="is-hidden"
		type="file"
		bind:this={fileInput}
		bind:files
		onchange={uploaded}
		accept=".mar"
	/>
	<Spinner active={isLoading} />
</main>

<style>
	main {
		background-color: var(--bulma-scheme-main);
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
	}
	.panels {
		flex: 1 1 0;
		height: 0;
		border-top: solid 1px var(--bulma-border);
	}
	.panel {
		height: 100%;
		overflow: auto;
	}
	.machine-state {
		background-color: var(--bulma-scheme-main-bis);
	}
	.output-panels-inner {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		overflow: hidden;
		height: 100%;
	}
</style>
