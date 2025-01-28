import {
	HighlightStyle,
	StreamLanguage,
	syntaxTree,
} from '@codemirror/language';
import { simpleMode } from '@codemirror/legacy-modes/mode/simple-mode';
import {
	CompletionContext,
	type CompletionResult,
} from '@codemirror/autocomplete';
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
				/(?:add|subt|addi|load|loadi|store|storei|jump|skipcond|jns|jumpi|adr)\b\s*/i,
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
				/(?:add|subt|addi|load|loadi|store|storei|jump|skipcond|jns|jumpi|adr)\b\s*/i,
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

export function getCompletions(
	context: CompletionContext,
): CompletionResult | null {
	const nodeBefore = syntaxTree(context.state).resolveInner(context.pos, -1);
	const previous = nodeBefore.prevSibling;
	const atStart =
		!previous ||
		context.state.doc.lineAt(previous.to).number <
			context.state.doc.lineAt(nodeBefore.from).number;
	if (!atStart && previous?.name === 'keyword') {
		const operator = context.state.doc
			.sliceString(previous.from, previous.to)
			.trim()
			.toLowerCase();
		const options: { label: string; info: string }[] = [];
		if (MarieSim.instructionMap[operator]?.operand) {
			const cursor = nodeBefore.cursor();
			while (cursor.parent());
			cursor.iterate((node) => {
				if (node.name === 'labelName') {
					const line = context.state.doc.lineAt(cursor.to).text;
					const commaPos = line.indexOf(',');
					const commentPos = line.indexOf('/');
					const label = line.substring(0, commaPos).trim();
					const data = line
						.substring(commaPos + 1, commentPos === -1 ? undefined : commentPos)
						.trim();
					const info = `Address of '${data}'`;
					options.push({ label, info });
				}
			});
			return {
				from: nodeBefore.from,
				options,
			};
		}
		return null;
	}
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
	const options = [
		{ label: 'DEC', info: 'DEC X\n\nSigned or unsigned decimal value X.' },
		{ label: 'HEX', info: 'HEX X\n\nHexadecimal value X.' },
		{ label: 'OCT', info: 'OCT X\n\nOctal value X.' },
	];
	if (!hasOrigin) {
		options.push({
			label: 'ORG',
			info: 'ORG X\n\nStarting address for program.',
		});
	}
	options.push(
		...MarieSim.instructions.map((instruction) => ({
			label: instruction.name,
			info: `${instruction.name}${instruction.operand ? ' X' : ''}\n\n${instruction.description}`,
		})),
	);
	return {
		from: nodeBefore.from,
		options,
	};
}
