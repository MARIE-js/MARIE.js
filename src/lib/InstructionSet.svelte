<script lang="ts">
	import { MarieSim } from '../marie';
	import { hex } from '../utils';
</script>

<div>
	<div class="p-2 content">
		<p>Syntax: <code>[Label, ]Operation[ Operand]</code></p>
		<p>
			The optional <code>Label</code> must not start with a number, and cannot
			contain whitespace or commas.<br />
			This may be used as an operand and resolves to the address of its instruction/directive.
		</p>
		<p>
			The <code>Operation</code> is case-insensitive and may be an assembly directive
			or instruction.
		</p>
		<p>
			For instructions, the <code>Operand</code> may be a label, or a
			hexadecimal value.<br />A leading zero is required if the first digit is
			greater than 9.
		</p>
		<p>A forward slash <code>/</code> denotes a line comment.</p>
	</div>
	<table class="table is-striped is-fullwidth">
		<thead>
			<tr
				><th title="Assembly directive">Directive</th><th
					class="Directive description">Description</th
				></tr
			>
		</thead>
		<tbody>
			<tr>
				<td>DEC X</td>
				<td>Literal signed/unsigned decimal value X.</td>
			</tr>
			<tr>
				<td>HEX X</td>
				<td>Literal hexadecimal value X.</td>
			</tr>
			<tr>
				<td>OCT X</td>
				<td>Literal octal value X.</td>
			</tr>
			<tr>
				<td>ORG X</td>
				<td>Starting address for program (hexadecimal).</td>
			</tr>
		</tbody>
	</table>
	<table class="table is-striped is-fullwidth">
		<thead>
			<tr>
				<th title="Instruction name">Instruction</th>
				<th title="Instruction description">Description</th>
			</tr>
		</thead>
		<tbody>
			{#each MarieSim.instructions as inst}
				<tr>
					<td
						><div>
							{inst.name}
							{#if inst.operand}
								X
							{/if}
						</div>
						<div>
							<code>0x{hex(inst.opcode, 1)}</code>
						</div>
					</td>
					<td>
						<div class="desc">{inst.description}</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.desc {
		white-space: pre-wrap;
	}
</style>
