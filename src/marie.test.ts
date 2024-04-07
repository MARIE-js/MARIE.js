import { describe, expect, test } from 'vitest';
import { MarieSim, assemble } from './marie';

describe('assembler', () => {
	test('can assemble all instructions', () => {
		const result = assemble(`
 		Label, DEC 1
 		HEX 2
 		OCT 3
 		Add Label
 		Subt Label
 		AddI Label
 		Clear
 		Load Label
 		Store Label
 		Input
 		Output
 		Jump Label
 		Skipcond 800
 		JnS Label
 		LoadI Label
 		StoreI Label
 		Halt
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.assembled.program).toEqual([
				0x0001, 0x0002, 0x0003, 0x3000, 0x4000, 0xb000, 0xa000, 0x1000, 0x2000,
				0x5000, 0x6000, 0x9000, 0x8800, 0x0000, 0xd000, 0xe000, 0x7000,
			]);
		}
	});

	test('rejects duplicate labels', () => {
		const result = assemble(`
 		Label, Add Label
		Label, Halt
	`);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.length).toBe(1);
			expect(result.errors[0].message).toBe(
				`Labels must be unique. The label 'Label' was already defined on line 2.`,
			);
		}
	});

	test('rejects unknown labels', () => {
		const result = assemble(`
 		Add Foo
	`);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.length).toBe(1);
			expect(result.errors[0].message).toBe(`Unknown label 'Foo'.`);
		}
	});

	test('data accepts valid values', () => {
		const result = assemble(`
 		DEC -100
		DEC 0
		DEC 100
		HEX FFFF
		HEX 0A
		OCT 7
		OCT 177777
		OCT 004
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.assembled.program).toEqual([
				0xff9c, 0x0000, 0x0064, 0xffff, 0x000a, 0x0007, 0xffff, 0x0004,
			]);
		}
	});

	test('data rejects values out of range', () => {
		expect(assemble(`DEC 65535`).success).toBe(true);
		expect(assemble(`DEC 65536`).success).toBe(false);
		expect(assemble(`DEC -32768`).success).toBe(true);
		expect(assemble(`DEC -32769`).success).toBe(false);
		expect(assemble(`HEX 10000`).success).toBe(false);
		expect(assemble(`OCT 200000`).success).toBe(false);
	});

	test('rejects address literals out of range', () => {
		expect(assemble(`Add 123`).success).toBe(true);
		expect(assemble(`Add 0FFF`).success).toBe(true);
		expect(assemble(`Add 1000`).success).toBe(false);
	});
});

describe('simulator', () => {
	test('add instruction works', async () => {
		const result = assemble(`
		Load A
		Add B
		Halt
		A, DEC 1234
		B, DEC 1010
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.AC).toBe(2244);
		}
	});

	test('subt instruction works', async () => {
		const result = assemble(`
		Load A
		Subt B
		Halt
		A, DEC 1234
		B, DEC 123
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.AC).toBe(1111);
		}
	});

	test('addi instruction works', async () => {
		const result = assemble(`
		Load A
		AddI C
		Halt
		A, DEC 1234
		B, DEC 1010
		C, DEC 4
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.AC).toBe(2244);
		}
	});

	test('clear instruction works', async () => {
		const result = assemble(`
		Load A
		Clear
		Halt
		A, DEC 1234
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.AC).toBe(0);
		}
	});

	test('load instruction works', async () => {
		const result = assemble(`
		Load A
		Halt
		A, DEC 1234
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.AC).toBe(1234);
		}
	});

	test('store instruction works', async () => {
		const result = assemble(`
		Load A
		Store B
		Halt
		A, DEC 1234
		B, DEC 0
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.memory[result.assembled.symbols.B!]).toBe(1234);
		}
	});

	test('input instruction works', async () => {
		const result = assemble(`
		Input
		Halt
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 1234);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.IN).toBe(1234);
			expect(sim.registers.AC).toBe(1234);
		}
	});

	test('output instruction works', async () => {
		const result = assemble(`
		Load A
		Output
		Halt
		A, DEC 1234
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.OUT).toBe(1234);
		}
	});

	test('jump instruction works', async () => {
		const result = assemble(`
		Jump A
		Halt
		A, Load B
		Halt
		B, DEC 1234
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.AC).toBe(1234);
		}
	});

	test('skipcond instruction works for <0', async () => {
		const result = assemble(`
		Input
		Skipcond 000
		Jump NoSkip
		Load One
		Halt
		NoSkip, Load Zero
		Halt
		Zero, DEC 0
		One, DEC 1
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const inputs = [-1, 0, 1];
			const sim = new MarieSim(() => inputs.pop()!);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.AC).toBe(0);
			sim.resetRegisters();
			await sim.run();
			expect(sim.registers.AC).toBe(0);
			sim.resetRegisters();
			await sim.run();
			expect(sim.registers.AC).toBe(1);
		}
	});

	test('skipcond instruction works for =0', async () => {
		const result = assemble(`
		Input
		Skipcond 400
		Jump NoSkip
		Load One
		Halt
		NoSkip, Load Zero
		Halt
		Zero, DEC 0
		One, DEC 1
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const inputs = [-1, 0, 1];
			const sim = new MarieSim(() => inputs.pop()!);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.AC).toBe(0);
			sim.resetRegisters();
			await sim.run();
			expect(sim.registers.AC).toBe(1);
			sim.resetRegisters();
			await sim.run();
			expect(sim.registers.AC).toBe(0);
		}
	});

	test('skipcond instruction works for >0', async () => {
		const result = assemble(`
		Input
		Skipcond 800
		Jump NoSkip
		Load One
		Halt
		NoSkip, Load Zero
		Halt
		Zero, DEC 0
		One, DEC 1
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const inputs = [-1, 0, 1];
			const sim = new MarieSim(() => inputs.pop()!);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.AC).toBe(1);
			sim.resetRegisters();
			await sim.run();
			expect(sim.registers.AC).toBe(0);
			sim.resetRegisters();
			await sim.run();
			expect(sim.registers.AC).toBe(0);
		}
	});

	test('jns instruction works', async () => {
		const result = assemble(`
		Jns A
		A, DEC 1234
		Halt
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.memory[result.assembled.symbols.A!]).toBe(1);
		}
	});

	test('jumpi instruction works', async () => {
		const result = assemble(`
		JumpI A
		Halt
		Load B
		Halt
		A, DEC 2
		B, DEC 1234
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.AC).toBe(1234);
		}
	});

	test('loadi instruction works', async () => {
		const result = assemble(`
		LoadI A
		Halt
		A, DEC 3
		DEC 1234
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.AC).toBe(1234);
		}
	});

	test('storei instruction works', async () => {
		const result = assemble(`
		Load A
		StoreI B
		Halt
		A, DEC 1234
		B, DEC 5
		C, DEC 4321
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.memory[result.assembled.symbols.C!]).toBe(1234);
		}
	});

	test('halt instruction works', async () => {
		const result = assemble(`Halt`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			expect(sim.registers.IR).toBe(0x7000);
			expect(sim.halted).toBe(true);
		}
	});

	test('can microstep back', async () => {
		const result = assemble(`
		Start, Load A
		Add B
		Store A
		Skipcond 000
		Jump Start
		Halt
		A, DEC 0
		B, DEC 10000
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			const fullLog = sim.log.map((x) => Object.assign({}, x));
			const endState = sim.state();
			for (let i = 1; i <= fullLog.length; i++) {
				for (let j = 0; j < i; j++) {
					sim.microStepBack();
				}
				await sim.run();
				expect(sim.log).toEqual(fullLog);
				expect(sim.state()).toEqual(endState);
			}
		}
	});

	test('can step back', async () => {
		const result = assemble(`
		Start, Load A
		Add B
		Store A
		Skipcond 000
		Jump Start
		Halt
		A, DEC 0
		B, DEC 10000
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			const fullLog = sim.log.map((x) => Object.assign({}, x));
			const endState = sim.state();
			const steps = fullLog.filter((x) => x.type === 'step').length;
			for (let i = 1; i <= steps; i++) {
				for (let j = 0; j < i; j++) {
					sim.stepBack();
				}
				await sim.run();
				expect(sim.log).toEqual(fullLog);
				expect(sim.state()).toEqual(endState);
			}
		}
	});

	test('can set memory', async () => {
		const result = assemble(`
		Load A
		Halt
		A, DEC 0
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			sim.memory[result.assembled.symbols.A!] = 1234;
			await sim.run();
			expect(sim.registers.AC).toBe(1234);
		}
	});

	test('can set registers', async () => {
		const result = assemble(`
		Output
		Halt
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			sim.registers.AC = 1234;
			await sim.run();
			expect(sim.registers.OUT).toBe(1234);
		}
	});

	test('can interleave microsteps, steps, and resets', async () => {
		const result = assemble(`
		Start, Load A
		Add B
		Store A
		Skipcond 000
		Jump Start
		Halt
		A, DEC 0
		B, DEC 10000
	`);
		expect(result.success).toBe(true);
		if (result.success) {
			const sim = new MarieSim(() => 0);
			sim.load(result.assembled);
			await sim.run();
			const fullLog = sim.log.map((x) => Object.assign({}, x));
			const endState = sim.state();
			sim.stepBack();
			await sim.microStep();
			sim.load(result.assembled);
			await sim.step();
			await sim.microStep();
			await sim.microStep();
			await sim.step();
			await sim.run();
			expect(sim.log).toEqual(fullLog);
			expect(sim.state()).toEqual(endState);
		}
	});
});
