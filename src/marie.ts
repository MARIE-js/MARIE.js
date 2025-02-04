/**
 * An assembled program to be loaded into the MARIE simulator.
 */
export interface AssembledProgram {
	/** Offset from start of memory where program starts */
	origin: number;
	/** The assembled program */
	program: number[];
	/** Mapping from label to memory address */
	symbols: { [label: string]: number | undefined };
	/** Mapping from memory address to line number */
	sourceMap: { [address: number]: number | undefined };
}

/** Machine register identifier */
export type Register = 'PC' | 'AC' | 'IR' | 'MAR' | 'MBR' | 'IN' | 'OUT';

/** Machine registers */
export type Registers = { [r in Register]: number };

/** Machine memory */
export type Memory = { [address: number]: number; length: number };

/** Snapshot of the machine's state */
export type State = {
	/** Contents of memory */
	memory: number[];
	/** Contents of registers */
	registers: Registers;
	/** Whether the machine is halted */
	halted: boolean;
};

/** Arithmetic operations which can be performed by the ALU */
export type ArithmeticOperation = 'ADD' | 'SUB' | 'LOAD_IMMI';

/** Comparison operations which can be performed by the ALU */
export type ComparisonOperation =
	| 'AC_NEG'
	| 'AC_ZERO'
	| 'AC_POS'
	| 'AC_NON_ZERO';

/** Actions recorded in the replay log */
export type Action =
	| StepAction
	| StepEndAction
	| DecodeAction
	| ArithmeticAction
	| ComparisonAction
	| IncrementPCAction
	| MemoryReadAction
	| MemoryWriteAction
	| MemorySetAction
	| RegisterTransferAction
	| RegisterSetAction
	| InputAction
	| OutputAction
	| HaltAction;

/** Signifies the start of a step */
export interface StepAction {
	type: 'step';
	/** The instruction about to be executed */
	pc: number;
}

/** Signifies the end of a step */
export interface StepEndAction {
	type: 'step-end';
}

/** Signifies that an instruction was decoded */
export interface DecodeAction {
	type: 'decode';
	/** The old decoded opcode */
	oldOpcode: number | undefined;
	/** The opcode */
	opcode: number;
	/** The name of the instruction */
	name: string;
}

/** PC ← PC + 1 */
export interface IncrementPCAction {
	type: 'incpc';
	/** The previous value of the PC register */
	oldPC: number;
}

/** An arithmetic operation on the AC */
export interface ArithmeticAction {
	type: 'arithmetic';
	/** The operation which occurred */
	operation: ArithmeticOperation;
	/** The previous value of the AC register */
	oldAC: number;
}

/** A comparison operation on the AC */
export interface ComparisonAction {
	type: 'comparison';
	/** The operation which occurred */
	operation: ComparisonOperation;
	/** The result the previous comparison */
	oldResult: boolean;
	/** The result of a comparison */
	result: boolean;
}

/** A word was read from memory */
export interface MemoryReadAction {
	type: 'memread';
	/** The address read from */
	address: number;
	/** The previous value of the MBR */
	oldMBR: number;
}

/** A word was written into memory */
export interface MemoryWriteAction {
	type: 'memwrite';
	/** The memory address */
	address: number;
	/** The previous memory contents at the address */
	oldContents: number;
}

/** A word was written into memory from outside the simulator */
export interface MemorySetAction {
	type: 'memset';
	/** The memory address */
	address: number;
	/** The previous memory contents at the address */
	oldContents: number;
	/** The new memory contents at the address */
	newContents: number;
}

/** A register transfer occurred */
export interface RegisterTransferAction {
	type: 'regtransfer';
	/** The target register */
	target: Register;
	/** The previous value of the target register */
	oldTargetValue: number;
	/** The source register */
	source: Register;
}

/** A register was set from outside the simulator */
export interface RegisterSetAction {
	type: 'regset';
	/** The register being set */
	register: Register;
	/** The previous value of the register */
	oldValue: number;
	/** The new value of the register */
	newValue: number;
}

/** The input register was set */
export interface InputAction {
	type: 'input';
	/** The previous value of the IN register */
	oldInput: number;
	/** The new input value */
	newInput: number;
}

/** The output register was output */
export interface OutputAction {
	type: 'output';
	/** The value output */
	value: number;
}

/** The simulator halted */
export interface HaltAction {
	type: 'halt';
	/** Whether or not the machine should halt */
	halt: boolean;
	/** Message if halt was due to error */
	error?: string;
}

/** Callback to retrieve an input value */
export type InputCallback = () =>
	| number
	| null
	| undefined
	| Promise<number | null | undefined>;

/** A MARIE instruction */
export interface Instruction {
	/** The name of the instruction */
	name: string;
	/** The opcode of the instruction */
	opcode: number;
	/** Whether the instruction accepts an operand */
	operand: boolean;
	/** A description of the instruction */
	description: string;
}

type MicroStep = (sim: MarieSim) => Action | null;

interface InstructionWithMicroSteps extends Instruction {
	microSteps: MicroStep[];
}

enum InputInterruptState {
	NotSet,
	NeedsValue,
	NeedsLoad,
}

/**
 * Th MARIE simulator.
 */
export class MarieSim {
	/**
	 * The memory
	 */
	readonly memory: Memory;

	/**
	 * Offset in memory where the program starts
	 */
	get origin() {
		return this._origin;
	}

	/**
	 * 16-bit registers (unsigned JS integers)
	 */
	readonly registers: Registers;

	/**
	 * Whether or not the machine is halted
	 */
	get halted() {
		return this._halted;
	}

	set halted(value: boolean) {
		if (value !== this._halted) {
			this._halted = value;
			this.addLog({ type: 'halt', halt: value });
		}
	}

	/**
	 * Replay log for the simulator
	 */
	get log(): readonly Action[] {
		return this._log;
	}

	/** Whether to produce an action log to allow stepping backwards */
	enableLog: boolean;

	private _origin: number;
	private _memory: number[];
	private _registers: { [r in Register]: number };
	private _halted: boolean;
	private _log: (Action & {
		microStepCounter: number;
		inputInterrupt: InputInterruptState;
	})[];
	private _inputInterrupt: InputInterruptState;
	private _microProgramCounter: number;
	private _decoded?: InstructionWithMicroSteps;
	private _comparisonResult: boolean;
	private _inputCallback: InputCallback;

	/**
	 * Creates a new MARIE simulator.
	 *
	 * @param inputCallback Callback used to provide input to the program
	 */
	constructor(inputCallback: InputCallback) {
		this._origin = 0;
		this._registers = {
			AC: 0,
			IN: 0,
			IR: 0,
			MAR: 0,
			MBR: 0,
			OUT: 0,
			PC: 0,
		};
		this._memory = new Array(0x1000).fill(0);
		this._halted = false;
		this._inputInterrupt = InputInterruptState.NotSet;
		this._log = [];
		this._microProgramCounter = 0;
		this._decoded = undefined;
		this._comparisonResult = false;
		this._inputCallback = inputCallback;
		this.enableLog = true;

		const sim = this;

		this.registers = new Proxy(this._registers, {
			set(rs, reg, v, r) {
				const value = Number(v);
				if (isNaN(value)) {
					throw new Error(`Cannot set register ${String(reg)} to ${v}`);
				}
				sim.addLog({
					type: 'regset',
					register: reg as Register,
					oldValue: rs[reg as Register],
					newValue: value,
				});
				return Reflect.set(
					rs,
					reg,
					reg === 'PC' || reg === 'MAR' ? value & 0xfff : value & 0xffff,
					r,
				);
			},
		});

		this.memory = new Proxy(this._memory, {
			set(m, i, v, r) {
				const address = Number(i);
				const value = Number(v);
				if (isNaN(address) || isNaN(value)) {
					throw new Error(`Cannot set memory[${String(i)}] = ${v}`);
				}
				const addr = address & 0xfff;
				const newValue = value & 0xffff;
				sim.addLog({
					type: 'memset',
					address,
					oldContents: m[addr],
					newContents: newValue,
				});
				return Reflect.set(m, addr, newValue, r);
			},
		});
	}

	/**
	 * Loads a program into memory and reset registers.
	 *
	 * @param assembled The assembled program to load into memory and run
	 */
	load(assembled: AssembledProgram) {
		if (assembled.origin + assembled.program.length > this._memory.length) {
			throw new Error('Failed to load program. Insufficient memory.');
		}

		this._origin = assembled.origin;

		for (let i = 0; i < assembled.origin; i++) {
			this._memory[i] = 0;
		}

		assembled.program.forEach((v, i) => {
			this._memory[assembled.origin + i] = v;
		});

		for (
			let i = assembled.origin + assembled.program.length;
			i < this._memory.length;
			i++
		) {
			this._memory[i] = 0;
		}

		this.resetRegisters();
	}

	/**
	 * Resets all registers to their initial values and clears the halt flag.
	 *
	 * Clears the replay log, so this cannot be stepped back.
	 *
	 * Does not clear memory.
	 */
	resetRegisters() {
		this._registers.AC = 0;
		this._registers.IN = 0;
		this._registers.IR = 0;
		this._registers.MAR = 0;
		this._registers.MBR = 0;
		this._registers.OUT = 0;
		this._registers.PC = this.origin;
		this._halted = false;
		this._inputInterrupt = InputInterruptState.NotSet;
		this._log = [];
		this._microProgramCounter = 0;
		this._decoded = undefined;
		this._comparisonResult = false;
	}

	/**
	 * Runs the simulator until it halts.
	 *
	 * @param interval Maximum amount of time to block for (zero blocks the whole time)
	 */
	async run(interval = 20) {
		if (interval <= 0) {
			while (!this.halted) {
				await this.step();
			}
			return;
		}
		while (!this.halted) {
			const start = Date.now();
			await this.step();
			while (!this.halted && Date.now() - start < interval) {
				await this.step();
			}
			if (this.halted) {
				return;
			}
			await new Promise((resolve) => setTimeout(() => resolve(null), 0));
		}
	}

	/**
	 * Executes the next instruction (or completes the current instruction).
	 *
	 * @returns Whether or not an instruction was executed.
	 */
	async step() {
		if ((await this.microStep()) === null) {
			return false;
		}
		while (true) {
			const result = await this.microStep();
			if (result === null || result.type === 'step-end') {
				return true;
			}
		}
	}

	/**
	 * Rewinds the simulator to the previous instruction
	 *
	 * @returns Whether or not there are further steps which can be undone
	 */
	stepBack() {
		while (
			this.microStepBack() &&
			this._log[this._log.length - 1].type !== 'step'
		);
		return this.microStepBack();
	}

	/**
	 * Executes the next micro step.
	 *
	 * @returns The action performed (if any)
	 */
	async microStep(): Promise<Action | null> {
		if (this._halted) {
			return null;
		}

		if (this._inputInterrupt == InputInterruptState.NeedsValue) {
			const callbackValue = await this._inputCallback();
			if (
				callbackValue === null ||
				callbackValue === undefined ||
				isNaN(callbackValue)
			) {
				return null;
			}
			const value = callbackValue & 0xffff;
			const oldInput = this._registers.IN;
			this._registers.IN = value;
			const action: InputAction = {
				type: 'input',
				oldInput,
				newInput: value,
			};
			this.addLog(action);
			this._inputInterrupt = InputInterruptState.NeedsLoad;
			return action;
		}

		if (this._inputInterrupt === InputInterruptState.NeedsLoad) {
			const action = this.registerTransfer('AC', 'IN');
			this.addLog(action);
			this._inputInterrupt = InputInterruptState.NotSet;
			return action;
		}

		if (this._microProgramCounter < MarieSim.fetchDecode.length) {
			// In the fetch/decode portion
			const action = MarieSim.fetchDecode[this._microProgramCounter](this);
			if (action) {
				this.addLog(action);
			}
			this._microProgramCounter++;
			return action;
		}

		// In the execute portion
		if (this._decoded === undefined) {
			return null;
		}

		const pos = this._microProgramCounter - MarieSim.fetchDecode.length;
		if (pos < this._decoded.microSteps.length) {
			const action = this._decoded.microSteps[pos](this);
			if (action) {
				this.addLog(action);
			}
			this._microProgramCounter++;
			return action;
		}

		// Finished cycle
		const action: StepEndAction = {
			type: 'step-end',
		};
		this.addLog(action);
		this._microProgramCounter = 0;
		return action;
	}

	/**
	 * Rewind the simulator the previous microstep
	 *
	 * @returns The action which was undone, if any
	 * */
	microStepBack(): Action | null {
		let last = this._log.pop();
		if (!last) {
			return null;
		}
		switch (last.type) {
			case 'arithmetic':
				this._registers.AC = last.oldAC;
				break;
			case 'halt':
				this._halted = !last.halt;
				break;
			case 'incpc':
				this._registers.PC = (this._registers.PC - 1) & 0xfff;
				break;
			case 'input':
				this._inputInterrupt = InputInterruptState.NeedsLoad;
				this._registers.IN = last.oldInput;
				break;
			case 'memread':
				this._registers.MBR = last.oldMBR;
				break;
			case 'memwrite':
				this._memory[last.address] = last.oldContents;
				break;
			case 'memset':
				this._memory[last.address] = last.oldContents;
				break;
			case 'regtransfer':
				this._registers[last.target] = last.oldTargetValue;
				break;
			case 'regset':
				this._registers[last.register] = last.oldValue;
				break;
			case 'decode':
				this._decoded = last.oldOpcode
					? MarieSim.opDecoder[last.oldOpcode]
					: undefined;
				break;
			case 'comparison':
				this._comparisonResult = last.oldResult;
				break;
			default:
				break;
		}
		this._microProgramCounter = last.microStepCounter;
		this._inputInterrupt = last.inputInterrupt;
		return last;
	}

	/**
	 * Get a copy of the simulator's current state
	 */
	state(): State {
		return {
			memory: [...this._memory],
			registers: Object.assign({}, this._registers),
			halted: this._halted,
		};
	}

	/**
	 * Increment the program counter
	 */
	private incrementPC(): Action {
		const oldPC = this._registers.PC;
		this._registers.PC = (this._registers.PC + 1) & 0xfff;
		return {
			type: 'incpc',
			oldPC,
		};
	}

	/**
	 * Read the contents of M[MAR] into the MBR register
	 */
	private readMemory(): Action {
		const oldTargetValue = this._registers.MBR;
		this._registers.MBR = this.memory[this._registers.MAR];
		this._registers.PC &= 0xfff;
		this._registers.MAR &= 0xfff;
		return {
			type: 'memread',
			address: this._registers.MAR,
			oldMBR: oldTargetValue,
		};
	}

	/**
	 * Write the contents of the MBR register into M[MAR]
	 */
	private writeMemory(): Action {
		const oldContents = this.memory[this._registers.MAR];
		this._memory[this._registers.MAR] = this._registers.MBR;
		return {
			type: 'memwrite',
			address: this._registers.MAR,
			oldContents,
		};
	}

	/**
	 * Performs a RTL operation that sets the target the value
	 * of the source.
	 */
	private registerTransfer(target: Register, source: Register): Action {
		const oldValue = this._registers[target];
		this._registers[target] = this._registers[source];
		this._registers.PC &= 0xfff;
		this._registers.MAR &= 0xfff;
		return {
			type: 'regtransfer',
			target,
			oldTargetValue: oldValue,
			source,
		};
	}

	/**
	 * Perform an arithmetic operation using the ALU.
	 *
	 * The two inputs are the AC and the MBR registers, and the result is stored in the AC register
	 */
	private arithmeticOperation(op: ArithmeticOperation): Action {
		const oldAC = this._registers.AC;
		switch (op) {
			case 'ADD':
				this._registers.AC =
					(this._registers.AC + this._registers.MBR) & 0xffff;
				break;
			case 'SUB':
				this._registers.AC =
					(this._registers.AC - this._registers.MBR) & 0xffff;
				break;
			case 'LOAD_IMMI':
				this._registers.AC = this._registers.IR & 0xfff;
				break;
		}
		return {
			type: 'arithmetic',
			operation: op,
			oldAC,
		};
	}

	/**
	 * Perform a comparison operation using the ALU.
	 */
	private comparisonOperation(op: ComparisonOperation): ComparisonAction {
		let result = false;
		switch (op) {
			case 'AC_NEG':
				result = this._registers.AC >> 15 === 1;
				break;
			case 'AC_ZERO':
				result = this._registers.AC === 0;
				break;
			case 'AC_POS':
				result = this._registers.AC !== 0 && this._registers.AC >> 15 === 0;
				break;
			case 'AC_NON_ZERO':
				result = this._registers.AC !== 0;
				break;
		}
		const oldResult = this._comparisonResult;
		this._comparisonResult = result;
		return {
			type: 'comparison',
			operation: op,
			oldResult,
			result,
		};
	}

	/**
	 * Performs the fetch and decode parts of the fetch-decode-execute cycle.
	 */
	private static fetchDecode: MicroStep[] = [
		(sim) => ({ type: 'step', pc: sim.registers.PC }),
		(sim) => sim.registerTransfer('MAR', 'PC'),
		(sim) => sim.readMemory(),
		(sim) => sim.registerTransfer('IR', 'MBR'),
		(sim) => sim.incrementPC(),
		(sim) => {
			const opcode = sim._registers.IR >> 12;
			const oldOpcode = sim._decoded?.opcode;
			sim._decoded = MarieSim.opDecoder[opcode];

			if (sim._decoded === undefined) {
				sim._halted = true;
				return {
					type: 'halt',
					halt: true,
					error: `Unsupported opcode 0x${opcode.toString(16).toUpperCase()}`,
				};
			}
			return {
				type: 'decode',
				oldOpcode,
				opcode,
				name: sim._decoded.name,
			};
		},
	];

	/**
	 * Add to the replay log
	 */
	private addLog(action: Action) {
		if (this.enableLog) {
			this._log.push({
				...action,
				microStepCounter: this._microProgramCounter,
				inputInterrupt: this._inputInterrupt,
			});
		}
	}

	/** The MARIE instruction set */
	private static instructionSet: InstructionWithMicroSteps[] = [
		{
			name: 'Add',
			opcode: 0x3,
			operand: true,
			microSteps: [
				(sim) => sim.registerTransfer('MAR', 'IR'),
				(sim) => sim.readMemory(),
				(sim) => sim.arithmeticOperation('ADD'),
			],
			description: 'Add value at address X to the AC.\n\nAC ← AC + M[X]',
		},
		{
			name: 'Subt',
			opcode: 0x4,
			operand: true,
			microSteps: [
				(sim) => sim.registerTransfer('MAR', 'IR'),
				(sim) => sim.readMemory(),
				(sim) => sim.arithmeticOperation('SUB'),
			],
			description:
				'Subtract value at address X from the AC.\n\n AC ← AC - M[X]',
		},
		{
			name: 'AddI',
			opcode: 0xb,
			operand: true,
			microSteps: [
				(sim) => sim.registerTransfer('MAR', 'IR'),
				(sim) => sim.readMemory(),
				(sim) => sim.registerTransfer('MAR', 'MBR'),
				(sim) => sim.readMemory(),
				(sim) => sim.arithmeticOperation('ADD'),
			],
			description:
				'Use the contents at address X as the address of the value to add to the AC.\n\nAC ← AC + M[M[X]]',
		},
		{
			name: 'LoadImmi',
			opcode: 0xa,
			operand: true,
			microSteps: [(sim) => sim.arithmeticOperation('LOAD_IMMI')],
			description:
				'Set the AC to the given 12-bit unsigned immediate value X.\n\nAC ← X',
		},
		{
			name: 'Load',
			opcode: 0x1,
			operand: true,
			microSteps: [
				(sim) => sim.registerTransfer('MAR', 'IR'),
				(sim) => sim.readMemory(),
				(sim) => sim.registerTransfer('AC', 'MBR'),
			],
			description: 'Load the value at the address X into the AC.\n\nAC ← M[X]',
		},
		{
			name: 'LoadI',
			opcode: 0xd,
			operand: true,
			microSteps: [
				(sim) => sim.registerTransfer('MAR', 'IR'),
				(sim) => sim.readMemory(),
				(sim) => sim.registerTransfer('MAR', 'MBR'),
				(sim) => sim.readMemory(),
				(sim) => sim.registerTransfer('AC', 'MBR'),
			],
			description:
				'Use the contents at address X as the address of the value to load into the AC.\n\nAC ← M[M[X]]',
		},
		{
			name: 'Store',
			opcode: 0x2,
			operand: true,
			microSteps: [
				(sim) => sim.registerTransfer('MAR', 'IR'),
				(sim) => sim.registerTransfer('MBR', 'AC'),
				(sim) => sim.writeMemory(),
			],
			description:
				'Store the value of the AC into memory at address X.\n\nM[X] ← AC',
		},
		{
			name: 'StoreI',
			opcode: 0xe,
			operand: true,
			microSteps: [
				(sim) => sim.registerTransfer('MAR', 'IR'),
				(sim) => sim.readMemory(),
				(sim) => sim.registerTransfer('MAR', 'MBR'),
				(sim) => sim.registerTransfer('MBR', 'AC'),
				(sim) => sim.writeMemory(),
			],
			description:
				'Use the contents at address X as the memory address at which to store the value of the AC.\n\nM[M[X]] ← AC',
		},
		{
			name: 'Input',
			opcode: 0x5,
			operand: false,
			microSteps: [
				(sim) => {
					sim._inputInterrupt = InputInterruptState.NeedsValue;
					return null;
				},
			],
			description: 'Read the next value from user input.\n\nAC ← IN',
		},
		{
			name: 'Output',
			opcode: 0x6,
			operand: false,
			microSteps: [
				(sim) => sim.registerTransfer('OUT', 'AC'),
				(sim) => ({ type: 'output', value: sim.registers.OUT }),
			],
			description: 'Output the value in the AC.\n\nOUT ← AC',
		},
		{
			name: 'Jump',
			opcode: 0x9,
			operand: true,
			microSteps: [(sim) => sim.registerTransfer('PC', 'IR')],
			description: 'Jump to address X.\n\nPC ← X',
		},
		{
			name: 'SkipCond',
			opcode: 0x8,
			operand: true,
			microSteps: [
				(sim) => {
					switch (sim._registers.IR & 0xc00) {
						case 0x000:
							return sim.comparisonOperation('AC_NEG');
						case 0x400:
							return sim.comparisonOperation('AC_ZERO');
						case 0x800:
							return sim.comparisonOperation('AC_POS');
						case 0xc00:
							return sim.comparisonOperation('AC_NON_ZERO');

						default:
							sim._halted = true;
							return {
								type: 'halt',
								halt: true,
								error: `Unsupported skipcond operand 0x${(
									sim._registers.IR & 0xfff
								)
									.toString(16)
									.toUpperCase()}.`,
							};
					}
				},
				(sim) => (sim._comparisonResult ? sim.incrementPC() : null),
			],
			description:
				'Skip the next instruction if the condition indicated by X holds:\n- 000: Skip if AC < 0\n- 400: Skip if AC = 0\n- 800: Skip if AC > 0\n- 0C00: Skip if AC ≠ 0',
		},
		{
			name: 'JnS',
			opcode: 0x0,
			operand: true,
			microSteps: [
				(sim) => sim.registerTransfer('MAR', 'IR'),
				(sim) => sim.registerTransfer('MBR', 'PC'),
				(sim) => sim.writeMemory(),
				(sim) => sim.registerTransfer('PC', 'MAR'),
				(sim) => sim.incrementPC(),
			],
			description:
				'Store the address of the next instruction into memory at address X, then jump to X + 1.\n\nM[X] ← PC\nPC ← X + 1',
		},
		{
			name: 'JumpI',
			opcode: 0xc,
			operand: true,
			microSteps: [
				(sim) => sim.registerTransfer('MAR', 'IR'),
				(sim) => sim.readMemory(),
				(sim) => sim.registerTransfer('PC', 'MBR'),
			],
			description:
				'Use the contents at address X as the memory address to jump to.\n\nPC ← M[X]',
		},
		{
			name: 'Halt',
			opcode: 0x7,
			operand: false,
			microSteps: [
				(sim) => {
					sim._halted = true;
					return {
						type: 'halt',
						halt: true,
					};
				},
			],
			description: 'Stop execution of the program.',
		},
	];

	/** A list of the supported instructions. */
	static instructions: Instruction[] = MarieSim.instructionSet.map(
		(instruction) => ({
			name: instruction.name,
			opcode: instruction.opcode,
			operand: instruction.operand,
			description: instruction.description,
		}),
	);

	/** Maps operation name to opcode and whether it needs an operand. */
	static instructionMap: {
		[op: string]: { opcode: number; operand: boolean } | undefined;
	} = MarieSim.instructionSet.reduce(
		(acc, instruction) => ({
			...acc,
			[instruction.name.toLowerCase()]: {
				opcode: instruction.opcode,
				operand: instruction.operand,
			},
		}),
		{},
	);

	/** Maps opcode to instruction */
	private static opDecoder: {
		[op: number]: InstructionWithMicroSteps | undefined;
	} = MarieSim.instructionSet.reduce(
		(acc, instruction) => ({
			...acc,
			[instruction.opcode]: instruction,
		}),
		{},
	);
}

interface ParsedInstruction {
	label?: string;
	operator: string;
	operand?: string;
	line: number;
}

/**
 * An error during assembly
 */
export interface AssemblyError {
	/**
	 * Type of error
	 */
	type: string;
	/**
	 * Line number (1-based)
	 */
	line: number;
	/**
	 * Error message
	 */
	message: string;
}

/**
 * Result of assembling a program
 */
export type AssemblyResult =
	| {
			success: true;
			assembled: AssembledProgram;
	  }
	| {
			success: false;
			errors: AssemblyError[];
	  };

/**
 * Assembles the given program
 * @param code MARIE assembler code
 * @returns The assembled program
 */
export function assemble(code: string): AssemblyResult {
	const errors: AssemblyError[] = [];
	const parsed: ParsedInstruction[] = [];
	let origin: number | null = null;
	const symbols: { [label: string]: number } = {};
	const sourceMap: { [address: number]: number } = {};

	code.split('\n').every((line, i) => {
		if (/^\s*(?:\/.*)?$/.test(line)) {
			// sim line is empty, whitespace or a comment
			return true;
		}

		const originationDirective = line.match(
			/^\s*org\s+(?<origin>[0-9a-f]{3})\s*(?:\/.*)?$/i,
		);

		if (originationDirective) {
			if (parsed.length !== 0 || origin !== null) {
				errors.push({
					type: 'Syntax error',
					line: i + 1,
					message: 'Unexpected origination directive.',
				});
			} else {
				origin = parseInt(originationDirective.groups!.origin, 16);
			}
			return true;
		}

		// Try to match it with the correct syntax
		const matches = line.match(
			/^\s*(?:(?<label>[^,\/]+),)?\s*(?<operator>[^\s,]+?)(?:\s+(?<operand>[^\s,]+?))?\s*(?:\/.*)?$/,
		);

		if (!matches) {
			errors.push({
				type: 'Syntax error',
				line: i + 1,
				message: 'Line has incorrect form',
			});
			return true;
		}

		const label = matches.groups!.label;
		const operator = matches.groups!.operator.toLowerCase();
		const operand = matches.groups!.operand;

		// Record in symbol map
		if (label) {
			if (label.match(/^\d.*$/)) {
				errors.push({
					type: 'Syntax error',
					line: i + 1,
					message: 'Labels cannot start with a number.',
				});
				return true;
			}
			if (label.match(/\s/)) {
				errors.push({
					type: 'Syntax error',
					line: i + 1,
					message: 'Labels cannot contain whitespace.',
				});
				return true;
			}
			if (label in symbols) {
				const instruction = parsed.find((p) => p.label === label);
				errors.push({
					type: 'Label error',
					line: i + 1,
					message: `Labels must be unique. The label '${label}' was already defined on line ${
						instruction!.line
					}.`,
				});
				return true;
			}
			symbols[label] = parsed.length + (origin ?? 0);
		}

		// Record in source map
		sourceMap[parsed.length + (origin ?? 0)] = i + 1;

		// Special END keyword
		if (operator == 'end') {
			return false;
		}

		parsed.push({
			label,
			operator,
			operand,
			line: i + 1,
		});

		return true;
	});

	const program = parsed.map((instruction) => {
		// Check for assembler directives
		let directiveBase: number | null = null;
		switch (instruction.operator) {
			case 'dec':
				directiveBase = 10;
				break;
			case 'oct':
				directiveBase = 8;
				break;
			case 'hex':
				directiveBase = 16;
				break;
			case 'adr':
				instruction.operator = 'jns';
				break;
			case 'clear':
				instruction.operator = 'loadimmi';
				instruction.operand = '0';
				break;
		}

		if (directiveBase !== null) {
			if (instruction.operand === undefined) {
				errors.push({
					type: 'Syntax error',
					line: instruction.line,
					message: 'Expected operand.',
				});
				return 0;
			}
			let constant = parseIntLit(instruction.operand, directiveBase);
			if (constant === null) {
				errors.push({
					type: 'Syntax error',
					line: instruction.line,
					message: 'Failed to parse operand.',
				});
				return 0;
			}

			if (directiveBase === 10) {
				// Decimal accepts unsigned or signed integers
				if (constant > 0xffff || constant < -0x8000) {
					errors.push({
						type: 'Value error',
						line: instruction.line,
						message: 'Literal out of bounds.',
					});
					return 0;
				}
				constant &= 0xffff;
			}

			if (constant > 0xffff) {
				errors.push({
					type: 'Value error',
					line: instruction.line,
					message: 'Literal out of bounds.',
				});
				return 0;
			}
			return constant;
		}

		const operator = MarieSim.instructionMap[instruction.operator];
		const operand = instruction.operand;

		if (!operator) {
			errors.push({
				type: 'Syntax error',
				line: instruction.line,
				message: `Unknown operator '${instruction.operator}.`,
			});
			return 0;
		}

		const needsOperand = operator.operand;
		if (needsOperand && operand === undefined) {
			errors.push({
				type: 'Syntax error',
				line: instruction.line,
				message: `Expected operand for ${instruction.operator}.`,
			});
			return 0;
		}

		let binOperand = 0;
		if (operand) {
			if (!needsOperand) {
				errors.push({
					type: 'Syntax error',
					line: instruction.line,
					message: `Unexpected operand '${instruction.operand}' for '${instruction.operator}'.`,
				});
				return 0;
			}

			if (/^\d[0-9a-fA-F]*$/.test(operand)) {
				// sim is a literal address
				binOperand = parseIntLit(operand, 16)!;

				if (binOperand > 0x0fff) {
					errors.push({
						type: 'Syntax error',
						line: instruction.line,
						message: `Address 0x${instruction.operand} is out of bounds.`,
					});
					return 0;
				}
			} else {
				// sim must be a label
				if (!(operand in symbols)) {
					errors.push({
						type: 'Syntax error',
						line: instruction.line,
						message: `Unknown label '${instruction.operand}'.`,
					});
					return 0;
				}

				binOperand = symbols[operand];
			}
		}

		return (operator.opcode << 12) | binOperand;
	});

	if (errors.length > 0) {
		return {
			success: false,
			errors,
		};
	}

	return {
		success: true,
		assembled: {
			origin: origin ?? 0,
			program,
			symbols,
			sourceMap,
		},
	};
}

/**
 * Parses a string into a number or returns null if it's invalid
 *
 * @param s The literal to parse
 * @param radix The radix to parse as
 */
export function parseIntLit(s: string, radix: number) {
	switch (radix) {
		case 2:
			if (!/^[0-1]+$/.test(s)) {
				return null;
			}
			break;
		case 8:
			if (!/^[0-7]+$/.test(s)) {
				return null;
			}
			break;
		case 10:
			if (!/^-?\d+$/.test(s)) {
				return null;
			}
			break;
		case 16:
			if (!/^[0-9a-fA-F]+$/.test(s)) {
				return null;
			}
			break;
	}
	const parsed = parseInt(s, radix);
	if (isNaN(parsed)) {
		return null;
	}
	return parsed;
}
