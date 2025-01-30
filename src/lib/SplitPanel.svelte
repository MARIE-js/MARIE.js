<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import Split from 'split.js';

	type Direction = 'horizontal' | 'vertical';
	type Panel = 'all' | 'a' | 'b';

	let {
		direction = 'horizontal',
		split = $bindable(50),
		showPanels = 'all',
		panelA,
		panelB,
	}: {
		direction?: Direction;
		split?: number;
		showPanels?: Panel;
		panelA: Snippet;
		panelB: Snippet;
	} = $props();

	let panelAElement = $state<HTMLDivElement>();
	let panelBElement = $state<HTMLDivElement>();

	let instance: Split.Instance | null = null;

	$effect(() => {
		init(direction, showPanels);
	});
	$effect(() => resize(split));

	async function init(direction: Direction, showPanels: Panel) {
		// Must only trigger on direction/showPanel changes.
		// Otherwise re-initialising can cause the scroll position to be set incorrectly
		await tick();
		cleanup();
		if (showPanels === 'all' && panelAElement && panelBElement) {
			instance = Split([panelAElement, panelBElement], {
				direction,
				minSize: 0,
				sizes: [split, 100 - split],
				onDragEnd(sizes) {
					split = sizes[0];
				},
			});
		}
	}

	function cleanup() {
		if (instance) {
			instance.destroy();
			instance = null;
		}
	}

	function resize(split: number) {
		if (instance && instance.getSizes()[0] !== split) {
			instance.setSizes([split, 100 - split]);
		}
	}

	function showPanel(panel: Panel, showPanels: Panel) {
		return showPanels === 'all' || showPanels === panel;
	}

	onMount(() => {
		init(direction, showPanels);
		return cleanup;
	});
</script>

<div
	class="split"
	class:horizontal={direction === 'horizontal'}
	class:vertical={direction === 'vertical'}
>
	<div
		bind:this={panelAElement}
		class="split-panel"
		class:no-splitter={showPanels !== 'all'}
		class:is-hidden={!showPanel('a', showPanels)}
	>
		{@render panelA()}
	</div>
	<div
		bind:this={panelBElement}
		class="split-panel"
		class:no-splitter={showPanels !== 'all'}
		class:is-hidden={!showPanel('b', showPanels)}
	>
		{@render panelB()}
	</div>
</div>

<style>
	.split {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.split.horizontal {
		flex-direction: row;
	}

	.split.vertical .split-panel {
		height: 100%;
	}

	.no-splitter {
		flex: 1 1 auto;
	}

	.split :global(.gutter) {
		background-color: var(--bulma-background-hover);
		background-repeat: no-repeat;
		background-position: 50%;
	}

	.split :global(.gutter.gutter-vertical) {
		background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAFAQMAAABo7865AAAABlBMVEVHcEzMzMzyAv2sAAAAAXRSTlMAQObYZgAAABBJREFUeF5jOAMEEAIEEFwAn3kMwcB6I2AAAAAASUVORK5CYII=');
		cursor: row-resize;
	}

	.split :global(.gutter.gutter-horizontal) {
		background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAeCAYAAADkftS9AAAAIklEQVQoU2M4c+bMfxAGAgYYmwGrIIiDjrELjpo5aiZeMwF+yNnOs5KSvgAAAABJRU5ErkJggg==');
		cursor: col-resize;
	}
</style>
