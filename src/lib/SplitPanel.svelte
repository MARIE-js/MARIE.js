<script lang="ts">
	import { onMount } from 'svelte';
	import Split from 'split.js';

	type Direction = 'horizontal' | 'vertical';
	type Panel = 'all' | 'a' | 'b';

	export let direction: Direction = 'horizontal';
	export let split = 50;
	export let showPanels: Panel = 'all';

	let panelA: HTMLDivElement;
	let panelB: HTMLDivElement;

	let instance: Split.Instance | null = null;

	$: init(direction, showPanels);
	$: resize(split);

	function init(direction: Direction, showPanels: Panel) {
		cleanup();
		if (showPanels === 'all' && panelA && panelB) {
			instance = Split([panelA, panelB], {
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

<div class="split" class:horizontal={direction === 'horizontal'}>
	<div
		bind:this={panelA}
		class="split-panel"
		class:no-splitter={showPanels !== 'all'}
		class:is-hidden={!showPanel('a', showPanels)}
	>
		<slot name="panelA" />
	</div>
	<div
		bind:this={panelB}
		class="split-panel"
		class:no-splitter={showPanels !== 'all'}
		class:is-hidden={!showPanel('b', showPanels)}
	>
		<slot name="panelB" />
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
