var DataPath;

(function() {
    "use strict";

    DataPath = function(element, displayInstruction) {
        this.datapath = element;
        this.displayInstruction = displayInstruction;

        this.populateInstructions();
        this.populateMicroInstructions();

        this.isMemoryRead = false;
        this.isMemoryWrite = false;

        this.timeSeqCounter = 0;

        this.registers = ["mar", "pc", "mbr", "ac", "in", "out", "ir"];
    };

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

    DataPath.prototype.populateMicroInstructions = function() {
        this.microInstructionsElement = document.createElement("table");
        this.microInstructionsElement.id = "micro-instructions";
        this.displayInstruction.appendChild(this.microInstructionsElement);
    };

    DataPath.prototype.restart = function() {
        this.setDataBus(false, false);
        this.setALUBus(null);
        this.setControlBus(null, "read");
        this.setControlBus(null, "write");
        this.setTimeSequence(true);
    };

    DataPath.prototype.setDataBus = function(isOn, isMemoryInvolved) {
        var data_bus = this.datapath.contentDocument.getElementById("data_bus");

        for(var i = 0; i < data_bus.childNodes.length; i++) {
            if(data_bus.childNodes[i].tagName == "path") {
                if(isOn) {
                    data_bus.childNodes[i].style.stroke = "lime";
                } else {
                    data_bus.childNodes[i].style.stroke = "green";
                }
            }
        }

        var memToMARWire = this.datapath.contentDocument.getElementById("memory_to_mar_wire");

        if(isMemoryInvolved) {
            memToMARWire.style.stroke = "lime";
        } else if(isMemoryInvolved === false) {
            memToMARWire.style.stroke = "green";
        }
    };

    DataPath.prototype.setControlBus = function(register, type) {
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

    DataPath.prototype.setALUBus = function(type) {
        var alu0 = this.datapath.contentDocument.getElementById("alu_wire_0");
        var alu1 = this.datapath.contentDocument.getElementById("alu_wire_1");
        if(type === "add") {
            alu0.style.stroke = "lime";
            alu1.style.stroke = "black";
        } else if(type === "subtract") {
            alu0.style.stroke = "black";
            alu1.style.stroke = "lime";
        } else if(type === "clear") {
            alu0.style.stroke = "lime";
            alu1.style.stroke = "lime";
        } else { // if type === "set" or anything else
            alu0.style.stroke = "black";
            alu1.style.stroke = "black";
        }
    };

    DataPath.prototype.setAllDatapathRegisters = function(registers) {
        var self = this;
        this.registers.map(function(ele, index) {
            self.datapath.contentDocument.getElementById(ele + "_register_text")
                .childNodes[0].childNodes[0].textContent = registers[index];
        });
    };

    DataPath.prototype.setDatapathRegister = function(register, value) {
        this.datapath.contentDocument.getElementById(register + "_register_text").childNodes[0].childNodes[0].textContent = value;
    };

    DataPath.prototype.attachSimulator = function(sim) {
            this.simulator = sim;
            this.displayInstruction.style.visibility = "visible";
            this.restart();

            this.showInstruction();
    };

    DataPath.prototype.showInstruction = function() {
        var pc = this.simulator.pc || 0;
        this.timeSeqCounter = 0;

        var previousInstruction = this.simulator.program[pc - 1];
        var currentInstruction = this.simulator.program[pc];
        var nextInstruction = this.simulator.program[pc + 1];
        var instructions = [previousInstruction, currentInstruction, nextInstruction];

        var instructionsContents = instructions.map(function(instruction) {
            if(typeof instruction === "undefined") {
                return undefined;
            }

            return [
                instruction.line.toString() + ".",
                instruction.operator.toUpperCase(),
                instruction.operand,
                instruction.label
            ].filter(function(element) {
                return typeof element !== "undefined";
            }).join(" ");
        });

        this.previousInstruction.textContent = instructionsContents[0];
        this.currentInstruction.textContent = instructionsContents[1];
        this.nextInstruction.textContent = instructionsContents[2];

        while(this.microInstructionsElement.firstChild) {
            this.microInstructionsElement.removeChild(this.microInstructionsElement.firstChild);
        }

        /*
        // populate micro-instructions
        this.simulator.debug = true;
        this.simulator.run();
        this.simulator.debug = false;
        */
    };

    DataPath.prototype.appendMicroInstruction = function(microInstruction) {
        var tr = document.createElement("tr");
        this.microInstructionsElement.appendChild(tr);
        var td = document.createElement("td");
        td.textContent = microInstruction;
        tr.appendChild(td);

        this.highlightMicroInstruction(microInstruction);
    };

    DataPath.prototype.highlightMicroInstruction = function(microInstruction) {
        var nodes = this.microInstructionsElement.getElementsByTagName("td");

        nodes[this.timeSeqCounter].style.background = "lime";
        if(this.timeSeqCounter) {
            nodes[this.timeSeqCounter - 1].style.background = "transparent";
        }

        this.setTimeSequence();
        this.timeSeqCounter++;
    }

    DataPath.prototype.setTimeSequence = function(clear) {
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
