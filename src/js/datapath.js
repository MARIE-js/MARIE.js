/* globals Utility */

var DataPath;

(function() {
    "use strict";


    /**
     * Manipulates the datapath SVG object.
     * @class DataPath
     *
     * @param {DOMElement} element - the object SVG datapath element.
     * @param {DOMElement} displayInstruction - element to display instructions
     * and micro-instructions.
     */
    DataPath = function(element, displayInstruction) {
        this.datapath = element;
        this.displayInstruction = displayInstruction;

        /* Fixes loading svg contentDocument bug by dropping function calls
        if the svg document hasn't been loaded yet by the time the DOM
        document has been loaded
        */
        this.loaded = false;

        var self = this;
        this.datapath.addEventListener("load", function() {
            if(!self.loaded) {
                self.loaded = true;
                console.log("DataPath SVG object loaded");

                if(this.onLoad) {
                    this.onLoad();
                }
            }
        });

        if(this.datapath.contentDocument && !this.loaded) {
            this.loaded = true;
            console.log("DataPath SVG object loaded");

            if(this.onLoad) {
                this.onLoad();
            }
        }

        this.populateInstructions();
        this.populateMicroInstructions();

        this.isMemoryRead = false;
        this.isMemoryWrite = false;

        this.timeSeqCounter = 0;

        this.registers = ["mar", "pc", "mbr", "ac", "in", "out", "ir"];
    };


    /**
     * Populates instructions in display instruction element.
     * @memberof DataPath
     */
    DataPath.prototype.populateInstructions = function() {
        this.instructionsElement = document.createElement("div");
        this.instructionsElement.id = "instructions";
        this.displayInstruction.appendChild(this.instructionsElement);

        this.previousInstruction = document.createElement("div");
        this.previousInstruction.id = "previous-instruction";
        this.instructionsElement.appendChild(this.previousInstruction);
        this.currentInstruction = document.createElement("div");
        this.currentInstruction.id = "current-instruction";
        this.instructionsElement.appendChild(this.currentInstruction);
        this.nextInstruction = document.createElement("div");
        this.nextInstruction.id = "next-instruction";
        this.instructionsElement.appendChild(this.nextInstruction);
    };


    /**
     * Populates micro-instructions in display instruction element.
     * @memberof DataPath
     */
    DataPath.prototype.populateMicroInstructions = function() {
        this.microInstructionsElement = document.createElement("table");
        this.microInstructionsElement.id = "micro-instructions";
        this.displayInstruction.appendChild(this.microInstructionsElement);
    };


    /**
     * Resets the datapath SVG object.
     * @memberof DataPath
     */
    DataPath.prototype.restart = function() {
        this.setDataBus(false, false);
        this.setALUBus(null);
        this.setControlBus(null, "read");
        this.setControlBus(null, "write");
        this.setTimeSequence(true);

        /*
        this.savedPreviousInstruction = null;
        this.savedCurrentInstruction = null;
        */

        this.previousInstruction.textContent = "";
        this.currentInstruction.textContent = "";
        this.nextInstruction.textContent = "";
        this.showInstruction();
        this.incrementedPC = false;
    };


    /**
     * Show whether the data bus or the address bus is activate or not.
     * @memberof DataPath
     *
     * @param {boolean} isOn - If true, data bus is displayed as activated.
     * @param {boolean} isMemoryInvolved - If memory is involved, indicate that
     * the address bus has been activated.
     */
    DataPath.prototype.setDataBus = function(isOn, isMemoryInvolved) {
        if(!this.loaded) {
            console.warn("DataPath SVG object has not loaded yet.");
            return;
        }

        var data_bus = this.datapath.contentDocument.getElementById("data_bus");

        if(isOn) {
            data_bus.style.stroke = "lime";
        } else {
            data_bus.style.stroke = "green";
        }

        var memToMARWire = this.datapath.contentDocument.getElementById("memory_to_mar_wire");

        if(isMemoryInvolved) {
            memToMARWire.style.stroke = "lime";
        } else if(isMemoryInvolved === false) {
            memToMARWire.style.stroke = "green";
        }
    };


    /**
     * Briefly shows data bus (and address bus) being activated before turning
     * off again.
     * @memberof DataPath
     *
     * @param {boolean} isMemoryAccess - If true, address bus will also be
     * activated for a short period.
     * @param {integer} delay - How much time to keep the buses activated
     * before turning them off again.
     */
    DataPath.prototype.showDataBusAccess = function(isMemoryAccess, delay) {
        this.setDataBus(true, isMemoryAccess || this.isMemoryRead || this.isMemoryWrite);

        if(this.timeoutToTurnDataBusOff) {
            clearTimeout(this.timeoutToTurnDataBusOff);
        }

        var self = this;
        this.timeoutToTurnDataBusOff = setTimeout(function() {
            self.setDataBus(false, false);
        }, delay);
    };


    /**
     * Shows which source is being read from, and which target is
     * being writen to by indicating control signals to the user.
     * @memberof DataPath
     *
     * @param {string} register - which register is being involved. If
     * register === "memory", then memory is being involved.
     * @param {string} type - There are two options: "read" if it is the
     * source that is being read, or "write" if it is the target that is being
     * written to.
     */
    DataPath.prototype.setControlBus = function(register, type) {
        if(!this.loaded) {
            console.warn("DataPath SVG object has not loaded yet.");
            return;
        }

        var dpDocument = this.datapath.contentDocument;
        var registerIndex = this.registers.indexOf(register);

        var mainMemory = dpDocument.getElementById("main_memory");
        var memoryReadWire = dpDocument.getElementById("memory_read_wire");
        var memoryWriteWire = dpDocument.getElementById("memory_write_wire");

        if(type === "read") {
            this.readRegisterIndex = registerIndex;
        } else if(type === "write") {
            this.writeRegisterIndex = registerIndex;
        }
        var control_bus = [dpDocument.getElementById("control_" + type + "_bus_3"), dpDocument.getElementById("control_" + type + "_bus_2"), dpDocument.getElementById("control_" + type + "_bus_1")];

        var registerElements = this.registers.map(function(ele) {
            return dpDocument.getElementById(ele + "_register");
        });

        var i;
        for(var j = 0; j < 3; j++) {
           for(i = 0; i < control_bus[j].childNodes.length; i++) {
                if(control_bus[j].childNodes[i].tagName === "path") {
                    if(register !== null && (registerIndex + 1) & (1 << j)) {
                        if(type === "read") {
                            control_bus[j].childNodes[i].style.stroke = "blue";
                        } else if(type == "write") {
                            control_bus[j].childNodes[i].style.stroke = "red";
                        }
                    } else {
                        control_bus[j].childNodes[i].style.stroke = "black";
                    }
                }
            }
        }

        if(this.isMemoryRead && type === "read") {
            this.isMemoryRead = false;
            memoryReadWire.style.stroke = "black";
            mainMemory.style.stroke = "black";
        } else if (this.isMemoryWrite && type === "write") {
            this.isMemoryWrite = false;
            memoryWriteWire.style.stroke = "black";
            mainMemory.style.stroke = "black";
        } else if(type === "clear") {
            this.isMemoryRead = false;
            this.isMemoryWrite = false;
            memoryReadWire.style.stroke = "black";
            mainMemory.style.stroke = "black";
        }

        if(register === "memory") {
            if(type === "read") {
                mainMemory.style.stroke = "blue";
                memoryReadWire.style.stroke = "blue";
                this.isMemoryRead = true;
            } else if(type === "write") {
                if(this.readRegisterIndex === -1) {
                    mainMemory.style.stroke = "magenta";
                } else {
                    mainMemory.style.stroke = "red";
                }
                memoryWriteWire.style.stroke = "red";
                this.isMemoryWrite = true;
            }
        } else {
            for(i = 0; i < this.registers.length; i++) {
                if(i === this.readRegisterIndex && i === this.writeRegisterIndex && type === "write") {
                    registerElements[i].style.stroke = "magenta";
                } else if(i === this.readRegisterIndex && type === "read") {
                    registerElements[i].style.stroke = "blue";
                } else if(i === this.writeRegisterIndex && type === "write") {
                    registerElements[i].style.stroke = "red";
                }
                else if(i !== this.readRegisterIndex && i !== this.writeRegisterIndex) {
                    registerElements[i].style.stroke = "black";
                }
            }
        }
    };


    /**
     * Sets ALU bus control wires, depending on the ALU operation.
     * @memberof DataPath
     *
     * @param {string} type - Which ALU operation is being performed. These
     * operations are associated with the following opcodes: 000 is "set",
     * 001 is "add", 010 is "subtract", 011 is "clear", 100 is "is_negative",
     * 101 is "is_zero", 110 is "is_positive", and 111 is "incr_pc".
     */
    DataPath.prototype.setALUBus = function(type) {
        if(!this.loaded) {
            console.warn("DataPath SVG object has not loaded yet.");
            return;
        }

        var dpDocument = this.datapath.contentDocument;

        var alu_opcodes = ["set", "add", "subtract", "clear", "is_negative", "is_zero", "is_positive", "incr_pc"];
        var alu_op_int = alu_opcodes.indexOf(type);

        if(alu_op_int === -1) {
            alu_op_int = 0;
        }

        var alu_op = Utility.uintToBinArray(alu_op_int);
        alu_op.reverse();

        var acToAluWire = dpDocument.getElementById("ac_to_alu_wire");
        var mbrToAluWire = dpDocument.getElementById("mbr_to_alu_wire");

        [0, 1, 2].map(function(element) {
            dpDocument.getElementById("alu_wire_" + element).style.stroke = alu_op[element] ? "lime" : "rgb(0, 51, 0)";
        });

        if(type === "add") {
            acToAluWire.style.stroke = "lime";
            mbrToAluWire.style.stroke = "lime";
        } else if(type === "subtract") {
            acToAluWire.style.stroke = "lime";
            mbrToAluWire.style.stroke = "lime";
        } else if(type === "clear") {
            acToAluWire.style.stroke = "lime";
            mbrToAluWire.style.stroke = "black";
        } else { // if type === "set" or anything else
            acToAluWire.style.stroke = "black";
            mbrToAluWire.style.stroke = "black";
        }
    };


    /**
     * Sets all registers to specific values all at once.
     * @memberof DataPath
     *
     * @param {array} registers - The values of all registers in order of
     * their control opcode (i.e. [mar, pc, mbr, ac, in, out, ir] where
     * each element is replaced by the corresponding register value).
     */
    DataPath.prototype.setAllRegisters = function(registers) {
        if(!this.loaded) {
            console.warn("DataPath SVG object has not loaded yet.");
            return;
        }

        var self = this;
        this.registers.map(function(ele, index) {
            self.datapath.contentDocument.getElementById(ele + "_register_text")
                .childNodes[0].childNodes[0].textContent = registers[index];
        });
    };


    /**
     * Set a particular register to a certain value.
     * @memberof DataPath
     *
     * @param {string} register - The specified register to set value to.
     * @param {string} value - The value to set the register to.
     */
    DataPath.prototype.setRegister = function(register, value) {
        if(!this.loaded) {
            console.warn("DataPath SVG object has not loaded yet.");
            return;
        }

        this.datapath.contentDocument.getElementById(register + "_register_text").childNodes[0].childNodes[0].textContent = value;

        /*
        if(register.toLowerCase() === "pc") {
            if(this.incrementedPC) {
                this.swapNextInstruction();
            } else {
                this.incrementedPC = true;
            }
        }
        */
    };


    /**
     * Attach the MARIE simulator instance to this datapath instance.
     * @memberof DataPath
     *
     * @see MarieSim
     * @param {MarieSim} sim - the simulator to attach the datapath instance
     * to.
     */
    DataPath.prototype.attachSimulator = function(sim) {
            this.simulator = sim;
            this.displayInstruction.style.visibility = "visible";
            this.restart();
    };


    /**
     * Only used if the simulator reads a memory cell that is out of bounds
     * of where the program instructions have been allocated to in memory.
     * @memberof DataPath
     *
     * @summary Decodes the instruction.
     * @param {integer} pc - which instruction should be decoded.
     * @returns {object} which line is it in, what operator it is, and what
     * operand it has if the instruction requires an operand.
     */
    DataPath.prototype.decodeInstruction = function(pc) {
        if(typeof this.simulator.memory[pc] == "undefined") {
            return undefined;
        }

        var instruction = Utility.intToUint(this.simulator.memory[pc].contents).toString(16);

        var nonOperandOperators = ["clear", "input", "output", "halt"];

        for(var op in this.simulator.operators) {
            if(this.simulator.operators[op].opcode === parseInt(instruction[0], 16)) {
                return {
                    operator: op,
                    operand: nonOperandOperators.indexOf(op.toLowerCase()) < 0 ? instruction.slice(1, 4) : undefined
                };
            }
        }
    };


    /**
     * Shows the instruction to the user in the instruction display.
     * @memberof DataPath
     */
    DataPath.prototype.showInstruction = function(/*preventSave*/) {
        this.incrementedPC = false;
        var pc = this.simulator.pc || 0;
        this.timeSeqCounter = 0;

        var previousInstruction = /*this.savedPreviousInstruction ||*/ this.simulator.program[pc - 1];
        var currentInstruction = /*this.savedCurrentInstruction ||*/ this.simulator.program[pc];
        var nextInstruction = this.simulator.program[pc + 1];

        if(typeof previousInstruction == "undefined") {
            previousInstruction = this.decodeInstruction(pc - 1);
            this.previousInstruction.style.fontStyle = "italic";
        } else {
            this.previousInstruction.style.fontStyle = "normal";
        }

        if(typeof currentInstruction == "undefined") {
            currentInstruction = this.decodeInstruction(pc);
            this.currentInstruction.style.fontStyle = "italic";
        } else {
            this.currentInstruction.style.fontStyle = "normal";
        }

        if(typeof nextInstruction == "undefined") {
            nextInstruction = this.decodeInstruction(pc + 1);
            this.nextInstruction.style.fontStyle = "italic";
        } else {
            this.nextInstruction.style.fontStyle = "normal";
        }

        var instructions = [previousInstruction, currentInstruction, nextInstruction];

        /*
        if(preventSave !== false) {
            this.savedPreviousInstruction = currentInstruction;
            this.savedCurrentInstruction = nextInstruction;
        }
        */

        var instructionsContents = instructions.map(function(instruction, index) {
            if(typeof instruction === "undefined") {
                return undefined;
            }

            return [
                Utility.hex(pc + index - 1, 3) + ":",
                typeof instruction.label !== "undefined" ? instruction.label + "," : undefined,
                instruction.operator.toUpperCase(),
                instruction.operand
            ].filter(function(element) {
                return typeof element !== "undefined";
            }).map(function(element) {
                var str = element.toString();
                return str.length > 10 ? str.substr(0, 7) + "..." : str;
            }).join(" ");
        });

        this.previousInstruction.textContent = instructionsContents[0];
        this.currentInstruction.textContent = instructionsContents[1];
        this.nextInstruction.textContent = instructionsContents[2];

        this.nextInstruction.style.color = "#888";

        while(this.microInstructionsElement.firstChild) {
            this.microInstructionsElement.removeChild(this.microInstructionsElement.firstChild);
        }
    };


    /*
    DataPath.prototype.swapNextInstruction = function() {
        var pc = this.simulator.pc || 0;
        var nextInstruction = this.simulator.program[pc];

        if(typeof nextInstruction == "undefined") {
            nextInstruction = this.decodeInstruction(pc);
        }

        if(typeof nextInstruction == "undefined") {
            return;
        }

        this.nextInstruction.style.color = "rgb(128, 0, 0)";

        this.savedCurrentInstruction = nextInstruction;

        this.nextInstruction.textContent = [
            addressNumberFormatter(nextInstruction.line) + ":",
            typeof nextInstruction.label !== "undefined" ? nextInstruction.label + "," : undefined,
            nextInstruction.operator.toUpperCase(),
            nextInstruction.operand
        ].filter(function(element) {
            return typeof element !== "undefined";
        }).map(function(element) {
            var str = element.toString();
            return str.length > 10 ? str.substr(0, 7) + "..." : str;
        }).join(" ");
    };
    */


    /**
     * Appends a micro-instruction to the micro-instruction display.
     * @memberof DataPath
     *
     * @param {string} microInstruction - The contents of the micro-instruction.
     */
    DataPath.prototype.appendMicroInstruction = function(microInstruction) {
        var tr = document.createElement("tr");
        this.microInstructionsElement.appendChild(tr);
        var td = document.createElement("td");
        td.textContent = microInstruction;
        tr.appendChild(td);

        this.microInstructionsElement.scrollTop = this.microInstructionsElement.scrollHeight;

        this.highlightMicroInstruction();
    };

    DataPath.prototype.highlightMicroInstruction = function() {
        var nodes = this.microInstructionsElement.getElementsByTagName("td");
        if(nodes.length <= this.timeSeqCounter) {
            console.warn("Something went wrong with populating the RTL microinstructions");
            return;
        }

        nodes[nodes.length - 1].style.background = "lime";
        if(nodes.length > 1) {
            nodes[nodes.length - 2].style.background = "transparent";
        }

        if(nodes[nodes.length - 1].textContent.indexOf("Decoded") === -1) {
            this.setTimeSequence();
            this.timeSeqCounter++;
        }
    };


    /**
     * Sets the current time sequence signal to the user.
     * @memberof DataPath
     *
     * @param {boolean} clear - (optional) If true, clears all the time
     * sequence signals. Useful for restarting the datapath SVG object.
     */
    DataPath.prototype.setTimeSequence = function(clear) {
        if(!this.loaded) {
            console.warn("DataPath SVG object has not loaded yet.");
            return;
        }

        for(var i = 0; i < 8; i++) {
            var ele = this.datapath.contentDocument.getElementById("timing_signal_" + i.toString());

            if(!clear && i === this.timeSeqCounter) {
                ele.style.fill = "orange";
            } else {
                ele.style.fill = "black";
            }
        }
    };
}());
