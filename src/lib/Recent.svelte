<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { getProjects, type Project } from '../project';
	import Modal from './Modal.svelte';
	import { highlightCode } from '@lezer/highlight';
	import { marieLanguage, styles } from '../syntax';

	export let currentKey: string;
	export let active: boolean;

	const dispatch = createEventDispatcher();

	let currentIndex = 0;

	function projectsList() {
		return Object.entries(getProjects())
			.filter(([k, _v]) => k !== currentKey)
			.reduce<
				{ id: string; code: string; timestamp: string; _timestamp: number }[]
			>(
				(acc, [key, project]) => [
					...acc,
					{
						id: key,
						code: project.code,
						timestamp: new Date(project._timestamp).toLocaleString(),
						_timestamp: project._timestamp,
					},
				],
				[],
			)
			.sort((a, b) => b._timestamp - a._timestamp);
	}

	$: projects = active ? projectsList() : [];

	function syntaxHighlight(code: string) {
		const tree = marieLanguage.parser.parse(code);
		let result = document.createElement('code');
		highlightCode(
			code,
			tree,
			styles,
			(code, classes) => {
				if (classes) {
					const span = document.createElement('span');
					span.textContent = code;
					span.className = classes;
					result.appendChild(span);
				} else {
					result.appendChild(document.createTextNode(code));
				}
			},
			() => {
				result.appendChild(document.createTextNode('\n'));
			},
		);
		return result.outerHTML;
	}
</script>

<Modal
	title="Recent files"
	{active}
	on:activate
	on:cancel
	on:submit={() => dispatch('open', { key: projects[currentIndex].id })}
>
	{#if projects.length === 0}
		<div class="has-text-centered">No recent projects.</div>
	{:else}
		<div class="recent">
			<div class="menu">
				<ul class="menu-list">
					{#each projects as project, i}
						<li>
							<button
								type="button"
								class:is-active={currentIndex === i}
								on:click={() => (currentIndex = i)}
								on:dblclick={() => dispatch('open', { key: projects[i].id })}
							>
								Project modified at {project.timestamp}
							</button>
						</li>
					{/each}
				</ul>
			</div>
			{#if currentIndex < projects.length}
				<pre class="preview">{@html syntaxHighlight(
						projects[currentIndex].code,
					)}</pre>
			{/if}
		</div>
	{/if}
	<div slot="footer">
		<button class="button is-info" disabled={currentIndex >= projects.length}
			>Open</button
		>
		<button type="button" class="button" on:click={() => dispatch('cancel')}>
			Cancel
		</button>
	</div>
</Modal>

<style>
	.menu {
		overflow: auto;
		min-height: 100px;
	}
	.preview {
		margin-top: 1rem;
		overflow: auto;
		max-height: 400px;
	}
	.recent {
		height: 100%;
		display: flex;
		flex-direction: column;
	}
</style>
