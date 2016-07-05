var MarieSim,
    MarieSimError,
    MarieAsm,
    MarieAsmError;

(function() {

"use strict";

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

MarieSim = function(assembled, inputFunc, outputFunc) {
    this.memory = [];
    this.program = assembled.program;
    this.origin = assembled.origin;

    this.restart();

    this.inputCallback = inputFunc || function(output) {
        output(uintToInt(parseInt(window.prompt("Input hexadecimal value.", 0), 16) & 0xFFFF));
    };

    this.outputCallback = outputFunc || function(value) {
        window.alert((value >>> 0).toString(16));
    };

    this.halted = false;

    while (this.memory.length < assembled.origin) {
        this.memory.push({
            contents: 0x0000
        });
    }

    Array.prototype.push.apply(this.memory, assembled.program);

    if (this.memory.length > 0xFFF) {
        throw new MarieSimError("Insufficent memory error", "Failed to load program. Insufficent memory.");
    }

    while (this.memory.length <= 0xFFF) {
        this.memory.push({
            contents: 0x0000
        });
    }
};

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

MarieSim.prototype.current = function() {
    return this.memory[this.pc - 1];
};

MarieSim.prototype.regSet = function(target, source, mask) {
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
        this[target] = uintToInt(this.memory[this.mar].contents);

        if (this.onMemRead) {
            this.onMemRead.call(this, {
                address: this.mar
            });
        }

        if (this.onRegWrite) {
            this.onRegWrite.call(this, {
                register: target,
                oldValue: oldValue,
                newValue: this[target],
                type: "set"
            });
        }
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
                value: this[source],
                type: "set"
            });
        }

        if (this.onMemWrite) {
            this.onMemWrite.call(this, {
                address: this.mar,
                oldCell: oldCell,
                newCell: this.memory[this.mar]
            });
        }
    }
    else {
        if (this.onRegLog) {
            if (mask === undefined) {
                this.onRegLog([
                    target.toString().toUpperCase(),
                    "←",
                    source.toString(16).toUpperCase()
                ].join(" "));
            }
            else {
                this.onRegLog([
                    target.toString().toUpperCase(),
                    "←",
                    source.toString(16).toUpperCase(),
                    "&",
                    mask.toString(16).toUpperCase()
                ].join(" "));
            }
        }

        var src = typeof source == "string" ? this[source] : source;
        var msk = mask !== undefined ? mask : 0xFFFF;

        oldValue = this[target];

        this[target] = uintToInt(src & msk);

        if (typeof source == "string" && this.onRegRead) {
            this.onRegRead.call(this, {
                register: source,
                value: this[source],
                type: "set"
            });
        }

        if (this.onRegWrite) {
            this.onRegWrite.call(this, {
                register: target,
                oldValue: oldValue,
                newValue: this[target],
                type: "set"
            });
        }
    }
};

MarieSim.prototype.regAdd = function(target, source, subtract) {
    var oldValue = this[target];

    if (subtract) {
        if (this.onRegLog) {
            this.onRegLog([
                target.toString().toUpperCase(),
                "←",
                target.toString().toUpperCase(),
                "-",
                source.toString(16).toUpperCase()
            ].join(" "));
        }

        this[target] -= typeof source == "string" ? this[source] : source;
    }
    else {
        if (this.onRegLog) {
            this.onRegLog([
                target.toString().toUpperCase(),
                "←",
                target.toString().toUpperCase(),
                "+",
                source.toString(16).toUpperCase()
            ].join(" "));
        }

        this[target] += typeof source == "string" ? this[source] : source;
    }

    if (this.onRegRead) {
        if(typeof source == "string") {
            this.onRegRead.call(this, {
                register: source,
                value: this[source],
                type: subtract ? "subtract" : "add"
            });
        } else {
            // source is the target
            this.onRegRead.call(this, {
                register: target,
                value: this[target],
                type: subtract ? "subtract" : "add"
            });
        }
    }

    if (this.onRegWrite) {
        this.onRegWrite.call(this, {
            register: target,
            oldValue: oldValue,
            newValue: this[target],
            type: subtract ? "subtract" : "add"
        });
    }
};

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
};

// This method blocks until machine execution completes.
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

MarieSim.prototype.step = function() {
    var microstep;
    while (!this.halted && microstep != "paused" && microstep != "step") {
        microstep = this.microStep();
    }
};

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
                yield "step";
                yield* myself.execute();
            }
        }());
    }

    if (this.paused)
        return "paused";
     else
        return this.microStepper.next().value;
};

MarieSim.prototype.fetch = function*() {
    yield this.regSet("mar", "pc");
    yield this.regSet("ir", "m");
    yield this.regAdd("pc", 1);
};

MarieSim.prototype.decode = function() {
    var opcode = intToUint(this.ir) >> 12;

    for (var op in MarieSim.prototype.operators) {
        if (MarieSim.prototype.operators[op].opcode == opcode) {
            if (this.onRegLog) {
                this.onRegLog(["Decoded opcode", opcode.toString(16).toUpperCase(), "as", op].join(" "));
            }

            if (this.onDecode) {
                this.onDecode.call(this, this.opcode, op);
            }

            this.opcode = op;

            return;
        }
    }

    throw new MarieSimError("Illegal instruction", this.ir);
};

MarieSim.prototype.execute = function*() {
    yield* MarieSim.prototype.operators[this.opcode].fn.call(this);
};

MarieSim.prototype.operators = {
    add: {
        opcode: 0x3,
        operand: true,
        fn: function*() {
            yield this.regSet("mar", "ir", 0xFFF);
            yield this.regSet("mbr", "m");
            yield this.regAdd("ac", "mbr");
        }
    },
    subt: {
        opcode: 0x4,
        operand: true,
        fn: function*() {
            yield this.regSet("mar","ir", 0xFFF);
            yield this.regSet("mbr", "m");
            yield this.regAdd("ac", "mbr", true);
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
            yield this.regAdd("ac", "mbr");
        }
    },
    clear: {
        opcode: 0xA,
        operand: false,
        fn: function*() {
            yield this.regSet("ac", 0);
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
                value = uintToInt(value);
            }

            if (value < -0x8000 && value >= -0xFFFF) {
                value = intToUint(value);
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
                        this.onRegLog("Is AC < 0?");
                    if (this.ac < 0)
                        this.regAdd("pc", 1);
                    break;
                case 0x400:
                    if (this.onRegLog)
                        this.onRegLog("Is AC = 0?");
                    if (this.ac === 0)
                        this.regAdd("pc", 1);
                    break;
                case 0x800:
                    if (this.onRegLog)
                        this.onRegLog("Is AC > 0?");
                    if (this.ac > 0)
                        this.regAdd("pc", 1);
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
            yield this.regSet("mbr", "pc");
            yield this.regSet("mar", "ir", 0xFFF);
            yield this.regSet("m", "mbr");
            yield this.regSet("mbr", "ir", 0xFFF);
            yield this.regSet("ac", 1);
            yield this.regAdd("ac", "mbr");
            yield this.regSet("pc", "ac");
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
                this.onRegLog("");
                this.onRegLog("");
            }

            yield null;
        }
    }
};

MarieAsmError = function(name, lineNumber, message) {
    this.name = name || "MarieAsmError";
    this.message = message;
    this.stack = (new Error()).stack;

    this.lineNumber = lineNumber;
    this.toString = function() {
        return [name, " on line ", lineNumber, ". ", message].join("");
    };
};

MarieAsmError.prototype = Object.create(Error.prototype);
MarieAsmError.constructor = MarieAsmError;

MarieAsm = function(assembly) {
    this.assembly = assembly;
};

MarieAsm.prototype.addressNumberFormatter = function(line) {
    var n = 3;

    var str = line.toString();
    // http://stackoverflow.com/a/10073788/824294
    // pads leading zeros if str is shorter than 3 characters.
    return str.length >= n ? str : new Array(n - str.length + 1).join("0") + str;
};

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
                    "Syntax error",
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
            // Syntax error
            throw new MarieAsmError(
                "Syntax error",
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
                    "Syntax error",
                    (i + 1),
                    "Labels cannot start with a number."
                );
            if (label in symbols) {
                var entry = parsed.filter(checkLabel.bind(null, label));

                throw new MarieAsmError(
                    "Label error",
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
        }

        if (directiveBase) {
            if (instruction.operand === undefined) {
                throw new MarieAsmError(
                    "Syntax error",
                    instruction.line,
                    "Expected operand."
                );
            }
            var constant = parseInt(instruction.operand, directiveBase);
            if (isNaN(constant)) {
                throw new MarieAsmError(
                    "Syntax error",
                    instruction.line,
                    "Failed to parse operand."
                );
            }

            // For some reason the simulator deals with these numbers in this way

            if (constant > 0x8000 && constant <= 0xFFFF) {
                constant = uintToInt(constant);
            }

            if (constant < -0x8000 && constant >= -0xFFFF) {
                constant = intToUint(constant);
            }

            if (constant > 0x8000 || constant < -0x8000) {
                throw new MarieAsmError(
                    "Syntax error",
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
                "Syntax error",
                instruction.line,
                ["Unknown operator ", instruction.operator, "."].join("")
            );
        }

        var needsOperand = operator.operand;
        if (needsOperand && !operand) {
            throw new MarieAsmError(
                "Syntax error",
                instruction.line,
                "Expected operand."
            );
        }

        if (operand) {
            if (!needsOperand) {
                throw new MarieAsmError(
                    "Syntax error",
                    instruction.line,
                    ["Unexpected operand ", instruction.operand, "."].join("")
                );
            }

            if (operand.match(/^\d[0-9a-fA-F]*$/)) {
                // This is a literal address
                operand = parseInt(operand, 16);

                if (operand > 0x0FFF) {
                    throw new MarieAsmError(
                        "Syntax error",
                        instruction.line,
                        ["Address ", instruction.operand, " out of bounds."].join("")
                    );
                }
            }
            else {
                // This must be a label
                if (!(operand in symbols)) {
                    throw new MarieAsmError(
                        "Syntax error",
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


function uintToInt(uint, nbit) {
    nbit = +nbit || 16;
    if (nbit > 32) throw new RangeError('uintToInt only supports ints up to 32 bits');
    uint <<= 32 - nbit;
    uint >>= 32 - nbit;
    return uint;
}

function intToUint(int, nbit) {
    var u = new Uint32Array(1);
    nbit = +nbit || 16;
    if (nbit > 32) throw new RangeError('intToUint only supports ints up to 32 bits');
    u[0] = int;
    if (nbit < 32) { // don't accidentally sign again
        int = Math.pow(2, nbit) - 1;
        return u[0] & int;
    } else {
        return u[0];
    }
}

}());
