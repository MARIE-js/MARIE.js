<script lang="ts">
	import { rgb } from '../utils';

	export let memory: number[];

	function getColor(memory: number[], i: number, j: number) {
		const address = 0xf00 + 16 * i + j;
		const value = memory[address];
		return rgb(value);
	}
</script>

<div class="display">
	<div>16x16 display, 0xF00-0xFFF:</div>
	<div class="pixels">
		{#each [...Array(16)].map((_, i) => i) as i}
			<div class="row">
				{#each [...Array(16)].map((_, j) => j) as j}
					<div
						class="pixel"
						style:background-color={getColor(memory, i, j)}
					></div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.display {
		height: 100%;
		overflow: auto;
		padding: 1rem;
	}

	.pixels {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 1px;
		background-color: var(--bulma-border);
		width: min-content;
	}

	.row {
		display: flex;
		gap: 1px;
	}

	.pixel {
		width: 1rem;
		height: 1rem;
	}
</style>
