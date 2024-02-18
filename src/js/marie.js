/* globals Utility */

var MarieSim,
    MarieSimError,
    MarieAsm,
    MarieAsmError;

(function() {
    "use strict";


    /**
     * JavaScript Error class for MarieSim.
     * @class MarieSimError
     *
     * @see MarieSim
     * @param  {string} name       The name of the error.
     * @param  {string} message    The error message.
     */
    MarieSimError = function(name, message) {
        this.name = name || "MarieSimError";
        this.message = message;
        this.stack = (new Error()).stack;
        this.toString = function() {
            return [name, ": ", message].join("");
        };
    };

    MarieSimError.prototype = Object.create(Error.prototype);
    MarieSimError.constructor = MarieSimError;


    /**
     * The MARIE simulator.
     * @class MarieSim
     *
     * @param {object} assembled - The assembled program produced by MarieAsm.
     * @param {function} [inputFunc] - Handle input function calls.
     * @param {function} [outputFunc] - Handle output function calls.
     * @throws MarieSimError
     */
    MarieSim = function(assembled, inputFunc, outputFunc) {
        this.memory = [];
        this.program = assembled.program;
        this.origin = assembled.origin;

        this.restart();

        this.inputCallback = inputFunc || function(output) {
            output(Utility.uintToInt(parseInt(window.prompt("Input hexadecimal value.", 0), 16) & 0xFFFF));
        };

        this.outputCallback = outputFunc || function(value) {
            window.alert((value >>> 0).toString(16));
        };

        while (this.memory.length < assembled.origin) {
            this.memory.push({
                contents: 0x0000
            });
        }

        Array.prototype.push.apply(this.memory, assembled.program);

        if (this.memory.length > 0x1000) {
            throw new MarieSimError("Insufficent memory error", "Failed to load program. Insufficent memory.");
        }

        while (this.memory.length <= 0x1000) {
            this.memory.push({
                contents: 0x0000
            });
        }
    };


    /**
     * Resets PC register to the origin of the assembled
     * program, and sets all other registers to zero. It
     * also resets halted and paused state to false, and
     * sets stepper to null and empties the stateHistory
     * array.
     * @summary Restarts the simulator.
     *
     * @function
     * @memberof MarieSim
     */
    MarieSim.prototype.restart = function() {
        this.pc = this.origin;
        this.ac = 0x0000;
        this.ir = 0x0000;
        this.mar = 0x000;
        this.mbr = 0x0000;
        this.in = 0x0000;
        this.out = 0x0000;
        this.halted = false;
        this.stepper = null;
        this.paused = false;
        this.microStepper = null;
        this.stateHistory = [];
    };


    /**
     * Serialises the current state of MARIE machine into a
     * JSON object.
     *
     * @function
     * @memberof MarieSim
     * @return {Object}  Serialised state of MARIE machine.
     */
    MarieSim.prototype.toJSON = function() {
        return JSON.stringify({
            memory: this.memory,
            halted: this.halted,
            pc: this.pc,
            ac: this.ac,
            ir: this.ir,
            mar: this.mar,
            mbr: this.mbr,
            in: this.in,
            out: this.out
        });
    };


    /**
     * Set the event listener to call function once
     * the event is fired.
     *
     * @function
     * @memberof MarieSim
     * @param  {string} event    Which event to set callback function to.
     * @param  {function} [callback] Function to call back once event fires.
     * If not specified (or is a falsy value), then the event firing will not
     * call any function.
     */
    MarieSim.prototype.setEventListener = function(event, callback) {
        switch (event) {
            case "memread":
                this.onMemRead = callback;
                break;
            case "memwrite":
                this.onMemWrite = callback;
                break;
            case "regread":
                this.onRegRead = callback;
                break;
            case "regwrite":
                this.onRegWrite = callback;
                break;
            case "reglog":
                this.onRegLog = callback;
                break;
            case "newinstruction":
                this.onNewInstruction = callback;
                break;
            case "decode":
                this.onDecode = callback;
                break;
            case "halt":
                this.onHalt = callback;
                break;
        }
    };


    /**
     * Returns the current instruction from memory, according to the value of
     * the PC register (not necessarily the current instruction the simulator
     * is processing).
     *
     * @function
     * @memberof MarieSim
     * @return {Object}  A memory location containing its contents (and the
     * corresponding program instruction if it exists).
     */
    MarieSim.prototype.current = function() {
        return this.memory[this.pc];
    };

    /**
     * Performs a RTL operation that sets the target the value
     * of the source.
     *
     * @function
     * @memberof MarieSim
     * @param  {String} target        - The final place to store value.
     * @param  {String|Number} source - Where to read value from?
     * @param  {Number} [mask]          - Bit masking that allows
     * certain bits to pass through value.
     * @param {String} [alu_type]       - Set ALU operation type.
     */
    MarieSim.prototype.regSet = function(target, source, mask, alu_type) {
        var oldValue;


        if (source == "m") {
            if (this.onRegLog) {
                this.onRegLog([
                    target.toUpperCase(),
                    "←",
                    "M[MAR]"
                ].join(" "));
            }


            oldValue = this[target];
            this[target] = Utility.uintToInt(this.memory[this.mar].contents);

            if (this.onMemRead) {
                this.onMemRead.call(this, {
                    address: this.mar
                });
            }

            this.stateHistory.push({
                type: "memread",
                address: this.mar
            });



            if (this.onRegWrite) {
                this.onRegWrite.call(this, {
                register: target,
                oldValue: oldValue,
                newValue: this[target]
              });
            }

            this.stateHistory.push({
                type: "regwrite",
                register: target,
                value: oldValue
            });
        }
        else if (target == "m") {
            if (this.onRegLog) {
                this.onRegLog([
                    "M[MAR]",
                    "←",
                    source.toUpperCase()
                ].join(" "));
            }

            var oldCell = this.memory[this.mar].contents;

            this.memory[this.mar] = {
                contents: this[source]
            };

            if (this.onRegRead) {
                this.onRegRead.call(this, {
                    register: source,
                    value: this[source]
                });
            }

            this.stateHistory.push({
                type: "regread",
                register: source,
                value: this[source],
                alu_type: alu_type
            });

            if (this.onMemWrite) {
                this.onMemWrite.call(this, {
                    address: this.mar,
                    oldCell: oldCell,
                    newCell: this.memory[this.mar]
                });
            }

            this.stateHistory.push({
                type: "memwrite",
                address: this.mar,
                value: oldCell
            });
        }
        else {
            if(target == "pc") {
                if(this[target] >= 4096 || this[target] < 0) {
                    throw new MarieSimError("RuntimeError","the address " + this[target].toString() + " is out of bounds");
                }
            }

            if (this.onRegLog) {
                if (mask === undefined) {
                    this.onRegLog([
                        target.toString().toUpperCase(),
                        "←",
                        source.toString(16).toUpperCase()
                    ].join(" "), alu_type);
                }
                else {
                    this.onRegLog([
                        target.toString().toUpperCase(),
                        "←",
                        source.toString(16).toUpperCase() + Utility.maskToBracketNotation(mask)
                    ].join(" "), alu_type);
                }
            }

            var src = typeof source == "string" ? this[source] : source;
            var msk = mask !== undefined ? mask : 0xFFFF;

            oldValue = this[target];



            this[target] = Utility.uintToInt(src & msk);

            if(target == "pc") {
                if(this[target] >= 4096 || this[target] < 0) {
                    throw new MarieSimError("RuntimeError","the address " + this[target].toString() + " is out of bounds");
                }
            }

            if (typeof source == "string") {
                if(this.onRegRead) {
                    this.onRegRead.call(this, {
                        register: source,
                        value: this[source]
                    });
                }

                this.stateHistory.push({
                    type: "regread",
                    register: source,
                    value: this[source],
                    alu_type: alu_type
                });
            }

            if (this.onRegWrite) {
                this.onRegWrite.call(this, {
                    register: target,
                    oldValue: oldValue,
                    newValue: this[target]
                });
            }

            this.stateHistory.push({
                type: "regwrite",
                register: target,
                value: oldValue
            });
        }
    };


    /**
     * Performs a RTL operation that adds/subtracts
     * the source to/from the target, and stores it in the target.
     *
     * @function
     * @memberof MarieSim
     * @param  {String} target        - final place to store computed value
     * @param  {String|Number} source - where to read value from
     * @param  {String} alu_type      - perform specified operation
     */
    MarieSim.prototype.regAdd = function(target, source, alu_type) {
        var oldValue = this[target];

        if (alu_type === "subtract") {
            if (this.onRegLog) {
                this.onRegLog([
                    target.toString().toUpperCase(),
                    "←",
                    target.toString().toUpperCase(),
                    "-",
                    source.toString(16).toUpperCase()
                ].join(" "), "subtract");
            }

            this[target] -= typeof source == "string" ? this[source] : source;
        }
        else if (["add", "incr_pc", "is_negative", "is_zero", "is_positive"].indexOf(alu_type) >= 0) {
            if (this.onRegLog) {
                this.onRegLog([
                    target.toString().toUpperCase(),
                    "←",
                    target.toString().toUpperCase(),
                    "+",
                    source.toString(16).toUpperCase()
                ].join(" "), alu_type);
            }

            this[target] += typeof source == "string" ? this[source] : source;

        }

        if(target == "pc") {
            if(this[target] >= 4096 || this[target] < 0) {
                throw new MarieSimError("RuntimeError","the address " + this[target].toString() + " is out of bounds");
            }
        }


        if(this[target] > 32767) {
            this[target] -= 65536;
        }
        else if(this[target] < -32768) {
            this[target] += 65536
        }


        if(typeof source == "string") {
            if (this.onRegRead) {
                this.onRegRead.call(this, {
                    register: source,
                    value: this[source]
                });
            }

            this.stateHistory.push({
                type: "regread",
                register: source,
                value: this[source],
                alu_type: alu_type
            });
        } else { // source is the target
            if (this.onRegRead) {
                this.onRegRead.call(this, {
                    register: target,
                    value: this[target]
                });
            }

            this.stateHistory.push({
                type: "regread",
                register: target,
                value: this[target],
                alu_type: alu_type
            });
        }

        if (this.onRegWrite) {
            this.onRegWrite.call(this, {
                register: target,
                oldValue: oldValue,
                newValue: this[target]
            });
        }

        this.stateHistory.push({
            type: "regwrite",
            register: target,
            value: oldValue
        });
    };


    /**
     * Runs the simulator machine.
     * Note: This method blocks until machine execution completes.
     *
     * @function
     * @memberof MarieSim
     */
    MarieSim.prototype.run = function() {
        while (!this.halted) {
            if(this.onNewInstruction) {
                this.onNewInstruction();
            }

            var _;
            for (_ of this.fetch());
            this.decode();
            for (_ of this.execute());
        }
    };


    /**
     * Fetches and decodes only one instruction per
     * step.
     *
     * @function
     * @memberof MarieSim
     */
    MarieSim.prototype.step = function() {
        try{
            var microstep;
            while (!this.halted && microstep != "paused" && microstep != "step") {
                microstep = this.microStep(true);
            }

            this.stateHistory.push({
                type: "step"
            });
        }
        catch(ex){
            throw new MarieSimError(ex);
        }
    };


    /**
     * Performs one RTL operation
     * (or decoding the instruction).
     *
     * @function
     * @memberof MarieSim
     */
    MarieSim.prototype.microStep = function() {
        var myself = this;

        if (!this.microStepper) {
            this.microStepper = (function*() {
                while (!myself.halted) {
                    if(myself.onNewInstruction) {
                        myself.onNewInstruction();
                    }
                    yield* myself.fetch();
                    myself.decode();
                    yield* myself.execute();
                    yield "step";
                }
            }());
        }

        if (this.paused)
            return "paused";
         else
            return this.microStepper.next().value;
    };


    /**
     * Performs the fetch part of the
     * fetch-decode-execute cycle.
     * Note: this is a generator function.
     *
     * @function
     * @memberof MarieSim
     */
    MarieSim.prototype.fetch = function*() {
        yield this.regSet("mar", "pc");
        yield this.regSet("mbr", "m");
        yield this.regSet("ir", "mbr");
        yield this.regAdd("pc", 1, "incr_pc");
    };


    /**
     * Performs the decode part of the
     * fetch-decode-execute cycle.
     *
     * @function
     * @memberof MarieSim
     * @throws MarieSimError
     */
    MarieSim.prototype.decode = function() {
        var opcode = Utility.intToUint(this.ir) >> 12;

        for (var op in MarieSim.prototype.operators) {
            if (MarieSim.prototype.operators[op].opcode == opcode) {
                if (this.onRegLog) {
                    this.onRegLog(["Decoded opcode", opcode.toString(16).toUpperCase(), "in IR[15-12] as", op].join(" "));
                }

                this.stateHistory.push({
                    type: "decode",
                    opcode: this.opcode
                });

                if (this.onDecode) {
                    this.onDecode.call(this, this.opcode, op);
                }

                this.opcode = op;

                return;
            }
        }

        throw new MarieSimError("Illegal instruction", this.ir);
    };


    /**
     * Performs the execute part of the
     * fetch-decode-execute cycle.
     * Note: this is a generator function.
     *
     * @function
     * @memberof MarieSim
     */
    MarieSim.prototype.execute = function*() {
        yield* MarieSim.prototype.operators[this.opcode].fn.call(this);
    };


    /**
     * A dictionary of operators which each
     * provides the opcode, whether an operand is needed or not, and the
     * generator function which each function call executes one
     * micro-instruction.
     *
     * @memberof MarieSim
     */
    MarieSim.prototype.operators = {
        add: {
            opcode: 0x3,
            operand: true,
            fn: function*() {
                yield this.regSet("mar", "ir", 0xFFF);
                yield this.regSet("mbr", "m");
                yield this.regAdd("ac", "mbr", "add");
            }
        },
        subt: {
            opcode: 0x4,
            operand: true,
            fn: function*() {
                yield this.regSet("mar","ir", 0xFFF);
                yield this.regSet("mbr", "m");
                yield this.regAdd("ac", "mbr", "subtract");
            }
        },
        addi: {
            opcode: 0xB,
            operand: true,
            fn: function*() {
                yield this.regSet("mar", "ir", 0xFFF);
                yield this.regSet("mbr", "m");
                yield this.regSet("mar", "mbr");
                yield this.regSet("mbr", "m");
                yield this.regAdd("ac", "mbr", "add");
            }
        },
        clear: {
            opcode: 0xA,
            operand: false,
            fn: function*() {
                yield this.regSet("ac", 0, undefined, "clear");
            }
        },
        load: {
            opcode: 0x1,
            operand: true,
            fn: function*() {
                yield this.regSet("mar", "ir", 0xFFF);
                yield this.regSet("mbr", "m");
                yield this.regSet("ac", "mbr");
            }
        },
        loadi: {
            opcode: 0xD,
            operand: true,
            fn: function*() {
                yield this.regSet("mar", "ir", 0xFFF);
                yield this.regSet("mbr", "m");
                yield this.regSet("mar", "mbr", 0xFFF);
                yield this.regSet("mbr", "m");
                yield this.regSet("ac", "mbr");
            }
        },
        store: {
            opcode: 0x2,
            operand: true,
            fn: function*() {
                yield this.regSet("mar", "ir", 0xFFF);
                yield this.regSet("mbr", "ac");
                yield this.regSet("m", "mbr");
            }
        },
        storei: {
            opcode: 0xE,
            operand: true,
            fn: function*() {
                yield this.regSet("mar", "ir", 0xFFF);
                yield this.regSet("mbr", "m");
                yield this.regSet("mar", "mbr", 0xFFF);
                yield this.regSet("mbr", "ac");
                yield this.regSet("m", "mbr");
            }
        },
        input: {
            opcode: 0x5,
            operand: false,
            fn: function*() {
                var myself = this,
                    value = null;

                this.paused = true;

                yield this.inputCallback.call(null, function(v) {
                    myself.paused = false;
                    value = v;
                });

                if (value === null)
                    yield null;

                // For some reason the simulator deals with these numbers in this way
                if (value > 0x8000 && value <= 0xFFFF) {
                    value = Utility.uintToInt(value);
                }

                if (value < -0x8000 && value >= -0xFFFF) {
                    value = Utility.intToUint(value);
                }

                if (value > 0x8000 || value < -0x8000) {
                    throw new MarieSimError(
                        "Input is out of bounds",
                        value
                    );
                }

                yield this.regSet("in", value);
                yield this.regSet("ac", "in");
            }
        },
        output: {
            opcode: 0x6,
            operand: false,
            fn: function*() {
                this.stateHistory.push({
                    type: "output"
                });

                yield this.regSet("out", "ac");
                yield this.outputCallback.call(null, this.out);
            }
        },
        jump: {
            opcode: 0x9,
            operand: true,
            fn: function*() {
                yield this.regSet("pc", "ir", 0xFFF);
            }
        },
        skipcond: {
            opcode: 0x8,
            operand: true,
            fn: function*() {
                switch (this.ir & 0xF00) {
                    case 0x000:
                        if (this.onRegLog)
                            this.onRegLog("Is AC < 0? " + (this.ac < 0 ? "Yes!" : "No!"), "is_negative");
                        if (this.ac < 0)
                            this.regAdd("pc", 1, "incr_pc");
                        break;
                    case 0x400:
                        if (this.onRegLog)
                            this.onRegLog("Is AC = 0? " + (this.ac === 0 ? "Yes!" : "No!"), "is_zero");
                        if (this.ac === 0)
                            this.regAdd("pc", 1, "incr_pc");
                        break;
                    case 0x800:
                        if (this.onRegLog)
                            this.onRegLog("Is AC > 0? " + (this.ac > 0 ? "Yes!" : "No!"), "is_positive");
                        if (this.ac > 0)
                            this.regAdd("pc", 1, "incr_pc");
                        break;
                    default:
                        throw new MarieSimError("Undefined skipcond operand.", this.ir);
                }
                yield null;
            }
        },
        jns: {
            opcode: 0x0,
            operand: true,
            fn: function*() {
                yield this.regSet("mar", "ir", 0xFFF);
                yield this.regSet("mbr", "pc");
                yield this.regSet("m", "mbr");
                yield this.regSet("pc", "mar");
                yield this.regAdd("pc", 1, "incr_pc");
            }
        },
        jumpi: {
            opcode: 0xC,
            operand: true,
            fn: function*() {
                yield this.regSet("mar", "ir", 0xFFF);
                yield this.regSet("mbr", "m");
                yield this.regSet("pc", "mbr");
            }
        },
        halt: {
            opcode: 0x7,
            operand: false,
            fn: function*() {
                this.halted = true;

                if (this.onHalt) {
                    this.onHalt.call(this);
                }

                if(this.onRegLog) {
                    this.onRegLog("----- halted -----");
                }

                this.stateHistory.push({type: "halt"});

                yield null;
            }
        }
    };


    /**
     * JavaScript Error class for MarieAsm.
     * @class MarieAsmError
     *
     * @see MarieAsm
     * @param  {string} name       The name of the error.
     * @param  {number} lineNumber Which line caused the error.
     * @param  {string} message    The error message.
     */
    MarieAsmError = function(name, lineNumber, message) {
        this.name = name || "MarieAsmError";
        this.message = message;
        this.stack = (new Error()).stack;

        this.lineNumber = lineNumber;
        this.toString = function() {
            return [name, ":L", lineNumber, " - ", message].join("");
        };
    };

    MarieAsmError.prototype = Object.create(Error.prototype);
    MarieAsmError.constructor = MarieAsmError;


    /**
     * Compiles MARIE assembly code to be used by MarieSim.
     * @class MarieAsm
     *
     * @see MarieSim
     * @param  {string} assembly The code to be assembled.
     */
    MarieAsm = function(assembly) {
        this.assembly = assembly;
    };


    /**
     * Assembles the program.
     *
     * @function
     * @memberof MarieAsm
     * @return {Object}  An object containing origin, program and symbols.
     * @throws MarieAsmError
     */
    MarieAsm.prototype.assemble = function() {
        var parsed = [],
            origin = 0,
            lines = this.assembly.split("\n"),
            symbols = {},
            operator,
            operand;

        function checkLabel(l, p) {
            return p.label == l;
        }

        var i;

        for (i = 0; i < lines.length; i++) {
            var line = lines[i];

            if (/^\s*(?:\/.*)?$/.test(line))
                continue; // This line is empty, whitespace or a comment

            // Check for origination directive

            var originationDirective = line.match(/^\s*org\s+([0-9a-f]{3})\s*(?:\/.*)?$/i);

            if (originationDirective) {
                if (parsed.length !== 0) {
                    throw new MarieAsmError(
                        "SyntaxError",
                        (i + 1),
                        "Unexpected origination directive."
                    );
                }

                origin = parseInt(originationDirective[1], 16);

                continue;
            }

            // Try to match it with the correct syntax
            var matches = line.match(/^(?:([^,\/]+),)?\s*([^\s,]+?)(?:\s+([^\s,]+?))?\s*(?:\/.*)?$/);

            if (!matches) {
                // SyntaxError
                throw new MarieAsmError(
                    "SyntaxError",
                    (i + 1),
                    "Incorrect form."
                );
            }

            var label = matches[1];
            operator = matches[2].toLowerCase();
            operand = matches[3];

            // Record the symbol map
            if (label) {
                if (label.match(/^\d.*$/))
                    throw new MarieAsmError(
                        "SyntaxError",
                        (i + 1),
                        "Labels cannot start with a number."
                    );
                if (label.match(/\s/))
                    throw new MarieAsmError(
                        "SyntaxError",
                        (i + 1),
                        "Labels cannot contain whitespace."
                    );
                if (label in symbols) {
                    var entry = parsed.filter(checkLabel.bind(null, label));

                    throw new MarieAsmError(
                        "LabelError",
                        (i + 1),
                        [
                            "Labels must be unique. The label '",
                            label,
                            "' was already defined on line ",
                            entry[0].line,
                            "."
                        ].join("")
                    );
                }
                symbols[label] = parsed.length + origin;
            }

            // Special END keyword
            if (operator == "end") {
                break;
            }

            parsed.push({
                label: label,
                operator: operator,
                operand: operand,
                line: (i + 1)
            });
        }

        for (i = 0; i < parsed.length; i++) {
            var instruction = parsed[i];

            // Check for assembler directives
            var directiveBase = false;
            switch (instruction.operator) {
                case "dec":
                    directiveBase = 10;
                    break;
                case "oct":
                    directiveBase = 8;
                    break;
                case "hex":
                    directiveBase = 16;
                    break;
                case "adr":
                   instruction.operator = "jns";
                   break;
            }

            if (directiveBase) {
                if (instruction.operand === undefined) {
                    throw new MarieAsmError(
                        "SyntaxError",
                        instruction.line,
                        "Expected operand."
                    );
                }
                var constant = parseInt(instruction.operand, directiveBase);
                if (isNaN(constant)) {
                    throw new MarieAsmError(
                        "SyntaxError",
                        instruction.line,
                        "Failed to parse operand."
                    );
                }

                // For some reason the simulator deals with these numbers in this way

                if (constant > 0x8000 && constant <= 0xFFFF) {
                    constant = Utility.uintToInt(constant);
                }

                if (constant < -0x8000 && constant >= -0xFFFF) {
                    constant = Utility.intToUint(constant);
                }

                if (constant > 0x8000 || constant < -0x8000) {
                    throw new MarieAsmError(
                        "SyntaxError",
                        instruction.line,
                        "Literal out of bounds."
                    );
                }
                instruction.contents = constant;
                continue;
            }

            operator = MarieSim.prototype.operators[instruction.operator];
            operand = instruction.operand;

            if (!operator) {
                throw new MarieAsmError(
                    "SyntaxError",
                    instruction.line,
                    ["Unknown operator ", instruction.operator, "."].join("")
                );
            }

            var needsOperand = operator.operand;
            if (needsOperand && !operand) {
                throw new MarieAsmError(
                    "SyntaxError",
                    instruction.line,
                    "Expected operand."
                );
            }

            if (operand) {
                if (!needsOperand) {
                    throw new MarieAsmError(
                        "SyntaxError",
                        instruction.line,
                        ["Unexpected operand ", instruction.operand, "."].join("")
                    );
                }

                if (operand.match(/^\d[0-9a-fA-F]*$/)) {
                    // This is a literal address
                    operand = parseInt(operand, 16);

                    if (operand > 0x0FFF) {
                        throw new MarieAsmError(
                            "SyntaxError",
                            instruction.line,
                            ["Address ", instruction.operand, " out of bounds."].join("")
                        );
                    }
                }
                else {
                    // This must be a label
                    if (!(operand in symbols)) {
                        throw new MarieAsmError(
                            "SyntaxError",
                            instruction.line,
                            ["Unknown label ", instruction.operand, "."].join("")
                        );
                    }

                    operand = symbols[operand];
                }
            }

            instruction.contents = (operator.opcode << 12) | operand;
        }

        return {
            origin: origin,
            program: parsed,
            symbols: symbols
        };
    };
}());
