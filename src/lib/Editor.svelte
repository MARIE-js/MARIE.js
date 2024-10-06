<script lang="ts">
	import {
		EditorView,
		Decoration,
		ViewUpdate,
		gutter,
		GutterMarker,
	} from '@codemirror/view';
	import {
		EditorState,
		Compartment,
		StateField,
		StateEffect,
	} from '@codemirror/state';
	import { syntaxHighlighting } from '@codemirror/language';
	import { onMount } from 'svelte';
	import { basicSetup } from 'codemirror';
	import { darkMode } from '../settings';

	import { debounce, throttle } from 'lodash';
	import { assemble, type AssemblyError } from '../marie';
	import { getCompletions, marieLanguage, styles } from '../syntax';

	export let text: string = '';
	export let modified = false;

	export let pcLine: number | undefined = undefined;
	export let marLine: number | undefined = undefined;
	export let hoverLine: number | undefined = undefined;

	export let breakpoints: { [line: number]: boolean | undefined } = {};

	export function getContents() {
		return view?.state.doc.toString() ?? '';
	}

	let div: HTMLDivElement | undefined;
	let view: EditorView | undefined;

	const theme = {
		'&': {
			backgroundColor: 'var(--bulma-scheme-main)',
			color: 'var(--bulma-text)',
			height: '100%',
		},
		'.cm-content': {
			caretColor: 'var(--bulma-text)',
		},
		'.cm-cursor, .cm-dropCursor': {
			borderLeftColor: 'var(--bulma-text)',
		},
		'.cm-activeLine': {
			backgroundColor: 'var(--marie-active-line-background)',
		},
		'.cm-gutters': {
			backgroundColor: 'var(--bulma-scheme-main-bis)',
			color: 'var(--bulma-text)',
		},
		'.cm-activeLineGutter': {
			backgroundColor: 'var(--bulma-background-active)',
		},
		'.cm-marie-highlight-error': {
			backgroundColor: 'var(--marie-highlight-error)',
		},
		'.cm-marie-highlight-pc': {
			backgroundColor: 'var(--marie-highlight-pc)',
		},
		'.cm-marie-highlight-mar': {
			backgroundColor: 'var(--marie-highlight-mar)',
		},
		'.cm-marie-highlight-pc-mar': {
			backgroundImage: `var(--marie-highlight-pc-mar)`,
		},
		'.cm-marie-highlight-hover': {
			backgroundColor: 'var(--marie-highlight-hover)',
		},
	};

	const themeCompartment = new Compartment();

	onMount(() => {
		view = new EditorView({
			parent: div,
			state: EditorState.create({
				doc: text,
				extensions: [
					breakpointGutter,
					basicSetup,
					syntaxHighlighting(styles),
					marieLanguage,
					marieLanguage.data.of({
						autocomplete: getCompletions,
					}),
					themeCompartment.of([]),
					EditorView.updateListener.of(debounce(checkCode, 250)),
					EditorView.updateListener.of(textUpdated),
				],
			}),
		});
		view.focus();
		return () => view?.destroy();
	});

	function configureTheme(view: EditorView | undefined, dark: boolean) {
		if (view) {
			view.dispatch({
				effects: themeCompartment.reconfigure(
					EditorView.theme(theme, { dark }),
				),
			});
		}
	}
	$: configureTheme(view, $darkMode);

	let oldText = text;
	function setContents(view: EditorView | undefined, text: string) {
		if (view && oldText !== text) {
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: text,
				},
			});
			modified = false;
		}
	}
	function textUpdated(v: ViewUpdate) {
		if (v.docChanged) {
			modified = true;
			const doc = v.view.state.doc.toString();
			oldText = doc;
			text = doc;
		}
	}
	$: setContents(view, text);

	let errors: AssemblyError[] = [];
	function checkCode() {
		const result = assemble(getContents());
		if (result.success) {
			errors = [];
		} else {
			errors = result.errors;
		}
	}

	// Line highlights for errors/registers
	const addLineHighlight = StateEffect.define<{
		pos: number;
		msg: string;
		type: string;
	}>({
		map: (e, change) => ({
			...e,
			pos: change.mapPos(e.pos),
		}),
	});
	const clearLineHighlights = StateEffect.define();
	const lineHighlightField = StateField.define({
		create() {
			return Decoration.none;
		},
		update(highlights, tr) {
			highlights = highlights.map(tr.changes);
			for (const e of tr.effects) {
				if (e.is(clearLineHighlights)) {
					highlights = Decoration.none;
				}
				if (e.is(addLineHighlight)) {
					highlights = highlights.update({
						add: [
							Decoration.line({
								class: `cm-marie-highlight-${e.value.type}`,
								attributes: { title: e.value.msg },
							}).range(e.value.pos),
						],
					});
				}
			}
			return highlights;
		},
		provide: (f) => EditorView.decorations.from(f),
	});
	const updateHighlights = throttle(
		(
			view: EditorView | undefined,
			errors: AssemblyError[],
			pcLine: number | undefined,
			marLine: number | undefined,
			hoverLine: number | undefined,
		) => {
			if (!view) {
				return;
			}
			const lines = view.state.doc.lines;
			const effects: StateEffect<any>[] = errors
				.filter((e) => e.line <= lines)
				.map((e) =>
					addLineHighlight.of({
						pos: view.state.doc.line(e.line).from,
						msg: `${e.type}: ${e.message}`,
						type: 'error',
					}),
				);

			if (pcLine !== undefined && pcLine === marLine && pcLine <= lines) {
				effects.push(
					addLineHighlight.of({
						pos: view.state.doc.line(pcLine).from,
						msg: 'Current program counter and memory address register',
						type: 'pc-mar',
					}),
				);
			} else {
				if (pcLine !== undefined && pcLine <= lines) {
					effects.push(
						addLineHighlight.of({
							pos: view.state.doc.line(pcLine).from,
							msg: 'Current program counter',
							type: 'pc',
						}),
					);
				}
				if (marLine !== undefined && marLine <= lines) {
					effects.push(
						addLineHighlight.of({
							pos: view.state.doc.line(marLine).from,
							msg: 'Current memory address register value',
							type: 'mar',
						}),
					);
				}
			}
			if (hoverLine !== undefined && hoverLine <= lines) {
				effects.push(
					addLineHighlight.of({
						pos: view.state.doc.line(hoverLine).from,
						msg: '',
						type: 'hover',
					}),
				);
			}
			if (!view.state.field(lineHighlightField, false)) {
				effects.push(StateEffect.appendConfig.of([lineHighlightField]));
			}
			view.dispatch({ effects: [clearLineHighlights.of(null), ...effects] });
		},
		100,
	);
	$: updateHighlights(view, errors, pcLine, marLine, hoverLine);

	// Breakpoints
	const updateBreakpointsEffect = StateEffect.define();
	const breakpointMarker = new (class extends GutterMarker {
		toDOM() {
			const span = document.createElement('span');
			span.title = 'Remove breakpoint';
			span.textContent = '⏺';
			return span;
		}
	})();
	const breakpointHoverMarker = new (class extends GutterMarker {
		elementClass = 'cm-marie-hover-breakpoint';
		toDOM() {
			const span = document.createElement('span');
			span.title = 'Set breakpoint';
			span.textContent = '⏺';
			return span;
		}
	})();
	let hoverBreakpointLine = 0;
	function updateBreakpoints(
		view: EditorView | undefined,
		_hoverBreakpointLine: number,
		_breakpoints: { [line: number]: boolean | undefined },
	) {
		view?.dispatch({ effects: updateBreakpointsEffect.of(null) });
	}
	$: updateBreakpoints(view, hoverBreakpointLine, breakpoints);
	const breakpointGutter = [
		gutter({
			class: 'cm-breakpoint-gutter',
			lineMarker: (view, line) => {
				const textLine = view.state.doc.lineAt(line.from);
				const lineNumber = textLine.number;
				if (/^\s*(\/.*)?$/.test(textLine.text)) {
					breakpoints = {
						...breakpoints,
						[lineNumber]: false,
					};
					return null;
				}
				if (breakpoints[lineNumber]) {
					return breakpointMarker;
				}
				if (lineNumber === hoverBreakpointLine) {
					return breakpointHoverMarker;
				}
				return null;
			},
			lineMarkerChange: (update) => {
				return (
					update.docChanged ||
					update.transactions.some((tr) =>
						tr.effects.some((e) => e.is(updateBreakpointsEffect)),
					)
				);
			},
			initialSpacer: () => breakpointMarker,
			domEventHandlers: {
				click(view, line) {
					const height = (event as MouseEvent).clientY - view.documentTop;
					if (height <= line.bottom) {
						const textLine = view.state.doc.lineAt(line.from);
						if (!/^\s*(\/.*)?$/.test(textLine.text)) {
							breakpoints = {
								...breakpoints,
								[textLine.number]: !breakpoints[textLine.number],
							};
						}
					}
					return true;
				},
				mousemove(view, line, event) {
					const height = (event as MouseEvent).clientY - view.documentTop;
					if (height > line.bottom) {
						hoverBreakpointLine = 0;
						view.dispatch({ effects: updateBreakpointsEffect.of(null) });
						return true;
					}
					hoverBreakpointLine = view.state.doc.lineAt(line.from).number;
					return true;
				},
				mouseleave(view) {
					hoverBreakpointLine = 0;
					return true;
				},
			},
		}),
		EditorView.baseTheme({
			'.cm-breakpoint-gutter .cm-gutterElement': {
				color: 'red',
				paddingLeft: '0.25rem',
				cursor: 'default',
			},
			'.cm-breakpoint-gutter .cm-gutterElement.cm-marie-hover-breakpoint': {
				color: 'rgba(255, 0, 0, 0.5)',
				cursor: 'pointer',
			},
		}),
	];

	export function scrollToPC() {
		if (pcLine === undefined || !view) {
			return;
		}

		const pos = view.state.doc.line(pcLine).from;
		const block = view.lineBlockAt(pos);
		if (
			block.top > view.scrollDOM.scrollTop + view.scrollDOM.offsetHeight ||
			block.bottom < view.scrollDOM.scrollTop
		) {
			view.scrollDOM.scrollTo({
				top: block.top - 100,
			});
		}
	}
</script>

<div class="editor" class:is-dark={$darkMode} bind:this={div} />

<style>
	.editor {
		height: 100%;
		overflow: auto;
		--marie-active-line-background: hsla(223, 14%, 50%, 0.1);
		--marie-highlight-error: hsla(348deg, 100%, 70%, 0.25);
	}
</style>
