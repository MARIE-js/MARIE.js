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
	} from '@fortawesome/free-solid-svg-icons';
	import Recent from './lib/Recent.svelte';
	import examples from './examples';
	import LoadFromUrl from './lib/LoadFromUrl.svelte';
	import ShareUrl from './lib/ShareUrl.svelte';
	import Spinner from './lib/Spinner.svelte';

	type MenuType = 'file' | 'examples';

	let { projectId, project } = restoreProject();

	const sim = new MarieSim(getInput);
	let program: AssembledProgram | null = null;
	let state = sim.state();
	let log: Action[] = [];
	let simulator: Simulator | undefined;
	let editor: Editor | undefined;
	let codeModified = false;
	let statusText: { cls?: string; msg: string } | undefined = undefined;
	let addressHover: number | null = null;
	let inputLogIndices: number[] = [];
	let inputsPanel: InputsPanel | undefined;
	let showDataPath = false;
	let recentOpen = false;
	let fileInput: HTMLInputElement;
	let files: FileList;
	let fileMenu: HTMLDivElement;
	let examplesMenu: HTMLDivElement;
	let menuOpen: MenuType | null = null;
	let loadFromURLOpen = false;
	let shareUrl: string | null = null;
	let menuActive = false;
	let busyState = 0;

	$: pcLine = program?.sourceMap[state.registers.PC];
	$: marLine = program?.sourceMap[state.registers.MAR];
	$: hoverLine =
		program && addressHover !== null
			? program.sourceMap[addressHover]
			: undefined;

	const autoSave = debounce(saveProject, 5000);
	$: autoSave(projectId, project);

	$: isLoading = busyState > 0;

	function setStatus(msg: string, cls?: string) {
		statusText = { cls, msg };
	}

	function onUpdate(e: { detail: { state: State; log: Action[] } }) {
		state = e.detail.state;
		log = e.detail.log;
	}

	function onAssembled(e: { detail: { program: AssembledProgram } }) {
		codeModified = false;
		program = e.detail.program;
		setStatus('Successfully assembled program.');
		reset();
		saveProject(projectId, project);
	}

	function onError(e: { detail: { message: string } }) {
		codeModified = false;
		setStatus(e.detail.message, 'has-text-danger');
	}

	function onBreak(e: { detail: { line: number } }) {
		setStatus(`Paused at breakpoint on line ${e.detail.line}.`);
		editor?.scrollToPC();
	}

	function onHalt(e: { detail: { error?: string } }) {
		if (e.detail.error) {
			setStatus(`Machine halted abnormally: ${e.detail.error}`);
		} else {
			setStatus('Machine halted normally.');
		}
	}

	function onAction(e: { detail: { type: string } }) {
		switch (e.detail.type) {
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

	async function onPause(e: { detail: { reason?: string } }) {
		if (e.detail.reason === 'input-empty') {
			setStatus(
				'Input required. Please enter input and press continue.',
				'has-text-warning',
			);
			$settings.inputsOpen = true;
			await tick();
			inputsPanel?.focus();
		} else if (e.detail.reason === 'input-error') {
			setStatus('Invalid input. Please edit and try again.', 'has-text-danger');
			$settings.inputsOpen = true;
			await tick();
			inputsPanel?.focus();
		} else {
			editor?.scrollToPC();
			setStatus('Paused.');
		}
	}

	function onStep(e: { detail: { didAction: boolean } }) {
		if (e.detail.didAction) {
			setStatus('Executed one step.');
		}
	}
	function onMicroStep(e: { detail: { type?: string } }) {
		if (e.detail.type === 'step-end') {
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
	$: rewind(log);

	let outputActions: { value: number; index: number }[] = [];
	$: outputs = outputActions.map((x) => x.value);
	function onOutput(e: { detail: { index: number; value: number } }) {
		outputActions = [...outputActions, e.detail];
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
		outputs = [];
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

	function openProject(e: { detail: { key: string } }) {
		if (project.code !== '') {
			saveProject(projectId, project);
		}
		projectId = '';
		project = loadProject(e.detail.key);
		projectId = e.detail.key;
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
		const response = await fetch(url);
		const code = await response.text();
		loadFromString(code);
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
</script>

<svelte:window
	on:beforeunload={() => saveProject(projectId, project)}
	on:click={onWindowClick}
	on:hashchange={hashChange}
/>

<main>
	<nav class="navbar" aria-label="main navigation">
		<div class="navbar-brand">
			<!-- svelte-ignore a11y-missing-attribute -->
			<!-- svelte-ignore a11y_interactive_supports_focus -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<a
				role="button"
				class="navbar-burger"
				class:is-active={menuActive}
				aria-label="menu"
				aria-expanded="false"
				on:click={() => (menuActive = !menuActive)}
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
					<!-- svelte-ignore a11y-missing-attribute -->
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<a class="navbar-link" on:click={() => toggleMenu('file')}>
						<span class="icon">
							<Fa icon={faFile} />
						</span>
						<span>File</span>
					</a>
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-missing-attribute -->
					<div class="navbar-dropdown">
						<a class="navbar-item" on:click={clearProject}>
							<span class="icon">
								<Fa icon={faFile} />
							</span>
							<span>New</span>
						</a>
						<hr class="navbar-divider" />
						<a class="navbar-item" on:click={() => (recentOpen = true)}>
							<span class="icon">
								<Fa icon={faFolderOpen} />
							</span>
							<span>Recent files</span>
						</a>
						<a class="navbar-item" on:click={() => fileInput.click()}>
							<span class="icon">
								<Fa icon={faUpload} />
							</span>
							<span>Upload file</span>
						</a>
						<a class="navbar-item" on:click={() => (loadFromURLOpen = true)}>
							<span class="icon">
								<Fa icon={faGlobe} />
							</span>
							<span>Load from URL</span>
						</a>
						<hr class="navbar-divider" />
						<a class="navbar-item" on:click={downloadCode}>
							<span class="icon">
								<Fa icon={faDownload} />
							</span>
							<span>Download code</span>
						</a>
						<a class="navbar-item" on:click={shareProject}>
							<span class="icon">
								<Fa icon={faShareNodes} />
							</span>
							<span>Get share URL</span>
						</a>
						<hr class="navbar-divider" />
						<a class="navbar-item" on:click={downloadBin}>
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
					<!-- svelte-ignore a11y-missing-attribute -->
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<a class="navbar-link" on:click={() => toggleMenu('examples')}>
						<span class="icon">
							<Fa icon={faLightbulb} />
						</span>
						<span>Examples</span>
					</a>
					<div class="navbar-dropdown">
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						{#each examples as example}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-missing-attribute -->
							<a on:click={() => loadFromURL(example.url)} class="navbar-item">
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
							on:click={toggleDataPath}
							title={`Click to ${showDataPath ? 'hide' : 'show'} data path visualisation`}
						>
							<span class="icon">
								<Fa icon={faMicrochip} />
							</span>
							<span>Data Path</span>
						</button>

						<button
							class="button"
							on:click={toggleTheme}
							title={`Switch theme`}
						>
							<span class="icon">
								<Fa icon={faPalette} />
							</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	</nav>
	<div class="panels">
		<SplitPanel
			direction={$isMobile ? 'vertical' : 'horizontal'}
			bind:split={$settings.leftPanel}
		>
			<div class="panel" slot="panelA">
				<SplitPanel direction="vertical" bind:split={$settings.topPanel}>
					<div slot="panelA" class="panel">
						<SplitPanel
							direction="vertical"
							bind:split={$settings.editorPanel}
							showPanels={showDataPath ? 'all' : 'a'}
						>
							<div class="panel" slot="panelA">
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
							<div class="panel" slot="panelB">
								<DataPath {state} {log} />
							</div>
						</SplitPanel>
					</div>
					<div slot="panelB" class="panel machine-state">
						<MachineState
							{state}
							{log}
							on:edit-memory={(e) =>
								simulator?.editMemory(e.detail.address, e.detail.value)}
							on:edit-register={(e) =>
								simulator?.editRegister(e.detail.register, e.detail.value)}
						>
							<Simulator
								slot="header"
								bind:this={simulator}
								bind:speed={$settings.speed}
								{sim}
								breakpoints={project.breakpoints}
								code={project.code}
								{codeModified}
								on:assembled={onAssembled}
								on:error={onError}
								on:output={onOutput}
								on:update={onUpdate}
								on:pause={onPause}
								on:step={onStep}
								on:microStep={onMicroStep}
								on:action={onAction}
								on:break={onBreak}
								on:halt={onHalt}
							></Simulator>
							<div slot="status-bar">
								{#if statusText}
									<span class={statusText.cls}>{statusText.msg}</span>
								{/if}
							</div>
						</MachineState>
					</div>
				</SplitPanel>
			</div>
			<div class="panel output-panels" slot="panelB">
				<div class="output-panels-inner">
					<CollapsiblePanel
						title="Output log"
						bind:open={$settings.outputLogOpen}
					>
						<OutputLog {outputs} bind:outputMode={project.outputMode} />
					</CollapsiblePanel>
					<CollapsiblePanel title="RTL log" bind:open={$settings.rtlLogOpen}>
						<RtlLog {log} on:hover-rtl={(e) => (addressHover = e.detail.pc)} />
					</CollapsiblePanel>
					<CollapsiblePanel
						title="Watch list"
						bind:open={$settings.watchListOpen}
					>
						<WatchList
							bind:pointers={project.pointers}
							on:hover-watch={(e) => (addressHover = e.detail.address)}
							memory={state.memory}
							symbols={program?.symbols ?? {}}
						/>
					</CollapsiblePanel>
					<CollapsiblePanel title="Inputs" bind:open={$settings.inputsOpen}>
						<InputsPanel bind:this={inputsPanel} bind:inputs={project.inputs} />
					</CollapsiblePanel>
					<CollapsiblePanel title="Display" bind:open={$settings.displayOpen}>
						<Display memory={state.memory} />
					</CollapsiblePanel>
				</div>
			</div>
		</SplitPanel>
	</div>
	<Recent
		active={recentOpen}
		currentKey={projectId}
		on:cancel={() => (recentOpen = false)}
		on:open={openProject}
	/>
	<LoadFromUrl
		active={loadFromURLOpen}
		on:cancel={() => (loadFromURLOpen = false)}
		on:loadFromUrl={(e) => loadFromURL(e.detail.url)}
	/>
	<ShareUrl {shareUrl} />
	<input
		class="is-hidden"
		type="file"
		bind:this={fileInput}
		bind:files
		on:change={uploaded}
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
