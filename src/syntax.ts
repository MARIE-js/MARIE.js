import {
	HighlightStyle,
	StreamLanguage,
	syntaxTree,
} from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { simpleMode } from '@codemirror/legacy-modes/mode/simple-mode';
import {
	CompletionContext,
	type CompletionResult,
} from '@codemirror/autocomplete';
import { hoverTooltip } from '@codemirror/view';
import { MarieSim } from './marie';
import { tags } from '@lezer/highlight';

const syntax = simpleMode({
	start: [
		{
			regex: /\s*[^\d,\/\s][^,\/\s]*,\s*/,
			token: 'labelName',
			next: 'operator',
		}, // Labels
		{
			regex:
				/(?:add|subt|addi|load|loadi|loadimmi|store|storei|jump|skipcond|jns|jumpi|adr)\b\s*/i,
			token: 'keyword',
			next: 'operand',
		}, // Operator
		{
			regex: /(?:clear|input|output|halt)\b\s*/i,
			token: 'keyword',
			next: 'start',
		}, // Operator
		{
			regex: /(?:org|dec|oct|hex)\b\s*/i,
			token: 'processingInstruction',
			next: 'literal',
		},
		{ regex: /\/.*/, token: 'comment' }, // Comments
		{ regex: /end\b\s*/i, token: 'comment', next: 'end' },
		{ regex: /\w+/i, token: 'invalid', next: 'start' },
	],
	operator: [
		{
			regex:
				/(?:add|subt|addi|load|loadi|loadimmi|store|storei|jump|skipcond|jns|jumpi|adr)\b\s*/i,
			token: 'keyword',
			next: 'operand',
		}, // Operator
		{
			regex: /(?:clear|input|output|halt)\b\s*/i,
			token: 'keyword',
			next: 'start',
		}, // Operator
		{
			regex: /(?:org|dec|oct|hex)\b\s*/i,
			token: 'processingInstruction',
			next: 'literal',
		}, // Literal
		{ regex: /\w+/i, token: 'invalid', next: 'start' },
	],
	operand: [
		{
			regex: /(?:org|dec|oct|hex)\b\s*/i,
			token: 'processingInstruction',
			next: 'literal',
		}, // Literal
		{ regex: /\d[0-9a-f]*\b\s*/i, token: 'number', next: 'start' }, // Address
		{ regex: /[^\d,\/\s][^,\/\s]*\b\s*/i, token: 'name', next: 'start' }, // Reference
		{ regex: /\w+/i, token: 'invalid', next: 'start' },
	],
	literal: [
		{ regex: /[0-9a-f]+/i, token: 'number', next: 'start' }, // Number
		{ regex: /\w+/i, token: 'invalid', next: 'start' },
	],
	end: [{ regex: /.*/, token: 'comment' }],
	meta: {
		lineComment: '/',
	} as any,
});

export const marieLanguage = StreamLanguage.define(syntax);

export const styles = HighlightStyle.define([
	{ tag: tags.keyword, color: 'var(--marie-syntax-keyword)' },
	{ tag: tags.comment, color: 'var(--marie-syntax-comment)' },
	{ tag: tags.labelName, color: 'var(--marie-syntax-label-name)' },
	{ tag: tags.name, color: 'var(--marie-syntax-name)' },
	{
		tag: tags.processingInstruction,
		color: 'var(--marie-syntax-processing-instruction)',
	},
	{ tag: tags.number, color: 'var(--marie-syntax-number)' },
]);

const instructions = [
	...MarieSim.instructions.map((instruction) => ({
		label: instruction.name,
		info: `${instruction.name}${instruction.operand ? ' X' : ''}\n\n${instruction.description}`,
	})),
	{ label: 'Adr', info: 'Adr X\n\nAlias for JnS X.' },
	{ label: 'Clear', info: 'Clear\n\nAlias for LoadImmi 0.' },
];
const instructionMap = instructions.reduce<{
	[key: string]: { label: string; info: string };
}>((acc, x) => ({ ...acc, [x.label.toLowerCase()]: x }), {});

const asmDirectives = {
	dec: { label: 'DEC', info: 'DEC X\n\nSigned or unsigned decimal value X.' },
	hex: { label: 'HEX', info: 'HEX X\n\nHexadecimal value X.' },
	oct: { label: 'OCT', info: 'OCT X\n\nOctal value X.' },
};
const orgDirective = {
	label: 'ORG',
	info: 'ORG X\n\nStarting address for program.',
};

const skipConditions = [
	{ label: '000', info: 'Skip if AC < 0' },
	{ label: '400', info: 'Skip if AC = 0' },
	{ label: '800', info: 'Skip if AC > 0' },
	{ label: '0C00', info: 'Skip if AC ≠ 0' },
];

function getLabels(state: EditorState) {
	const result: { label: string; info: string }[] = [];
	let i = 1;
	for (const line of state.doc.iterLines()) {
		const comma = line.indexOf(',');
		const comment = line.indexOf('/');
		if (comma !== -1 && (comment === -1 || comma < comment)) {
			const label = line.substring(0, comma).trim();
			const data = line
				.substring(comma + 1, comment === -1 ? undefined : comment)
				.trim();
			const info = `Address of line ${i} (${data})`;
			result.push({ label, info });
		}
		i++;
	}
	return result;
}

export function getCompletions(
	context: CompletionContext,
): CompletionResult | null {
	const nodeBefore = syntaxTree(context.state).resolveInner(context.pos, -1);
	const previous = nodeBefore.prevSibling;
	const atStart =
		!previous ||
		context.state.doc.lineAt(previous.to).number <
			context.state.doc.lineAt(nodeBefore.from).number;
	const [nodeType, nodeValue, position] = (() => {
		const text = context.state.doc
			.sliceString(nodeBefore.from, nodeBefore.to)
			.toLowerCase()
			.trimStart();
		const textTrimmed = text.trimEnd();
		const hasTrailingSpace = textTrimmed.length < text.length;

		if (atStart) {
			return [
				nodeBefore.name === 'invalid' || !hasTrailingSpace
					? 'start'
					: nodeBefore.name,
				textTrimmed,
				hasTrailingSpace ? nodeBefore.to : nodeBefore.from,
			];
		}

		if (hasTrailingSpace) {
			return [nodeBefore.name, textTrimmed, nodeBefore.to];
		}
		return [
			previous.name,
			context.state.doc
				.sliceString(previous.from, previous.to)
				.toLowerCase()
				.trim(),
			nodeBefore.from,
		];
	})();

	if (nodeType === 'start' || nodeType === 'labelName') {
		const cursor = nodeBefore.cursor();
		let hasOrigin = false;
		while (cursor.prevSibling()) {
			if (
				cursor.name === 'processingInstruction' &&
				context.state.doc
					.sliceString(cursor.from, cursor.to)
					.trim()
					.toLowerCase() === 'org'
			) {
				hasOrigin = true;
				break;
			}
		}
		const options = [asmDirectives.dec, asmDirectives.hex, asmDirectives.oct];
		if (!hasOrigin && nodeType === 'start') {
			options.push(orgDirective);
		}
		options.push(...instructions);
		return {
			from: position,
			options,
		};
	}

	if (nodeType === 'keyword') {
		if (nodeValue === 'skipcond') {
			return {
				from: position,
				options: skipConditions,
			};
		}
		if (MarieSim.instructionMap[nodeValue]?.operand) {
			return {
				from: position,
				options: getLabels(context.state),
			};
		}
	}

	return null;
}

export const getTooltip = hoverTooltip((view, pos, side) => {
	const node = syntaxTree(view.state).resolveInner(pos, side);
	if (node.name === 'keyword') {
		const name = view.state.doc
			.sliceString(node.from, node.to)
			.trim()
			.toLowerCase();
		const instruction = instructionMap[name];
		if (instruction) {
			return {
				pos: node.from,
				end: node.to,
				above: true,
				create(_view) {
					const dom = document.createElement('div');
					dom.style.whiteSpace = 'pre-wrap';
					dom.textContent = instruction.info;
					return { dom };
				},
			};
		}
	} else if (node.name === 'name') {
		const name = view.state.doc.sliceString(node.from, node.to).trim();
		const label = getLabels(view.state).find((l) => l.label === name);
		if (label) {
			return {
				pos: node.from,
				end: node.to,
				above: true,
				create(_view) {
					const dom = document.createElement('div');
					dom.style.whiteSpace = 'pre-wrap';
					dom.textContent = label.info;
					return { dom };
				},
			};
		}
	} else if (node.name === 'processingInstruction') {
		const name = view.state.doc
			.sliceString(node.from, node.to)
			.trim()
			.toLowerCase();
		const directive = (
			asmDirectives as {
				[key: string]: { label: string; info: string } | undefined;
			}
		)[name];
		if (directive) {
			return {
				pos: node.from,
				end: node.to,
				above: true,
				create(_view) {
					const dom = document.createElement('div');
					dom.style.whiteSpace = 'pre-wrap';
					dom.textContent = directive.info;
					return { dom };
				},
			};
		}
	} else if (
		node.name === 'number' &&
		node.prevSibling &&
		node.prevSibling.name === 'keyword'
	) {
		const instruction = view.state.doc
			.sliceString(node.prevSibling.from, node.prevSibling.to)
			.trim()
			.toLowerCase();
		if (instruction === 'skipcond') {
			const value = view.state.doc
				.sliceString(node.from, node.to)
				.trim()
				.toLowerCase();
			const condition = skipConditions.find(
				(c) => c.label.toLowerCase() === value,
			);
			if (condition) {
				return {
					pos: node.from,
					end: node.to,
					above: true,
					create(_view) {
						const dom = document.createElement('div');
						dom.style.whiteSpace = 'pre-wrap';
						dom.textContent = condition.info;
						return { dom };
					},
				};
			}
		}
	}
	return null;
});
