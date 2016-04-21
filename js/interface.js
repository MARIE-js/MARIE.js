"use strict";

var assembleButton = document.getElementById("assemble"),
    stepButton = document.getElementById("step"),
    microStepButton = document.getElementById("microstep"),
    runButton = document.getElementById("run"),
    rangeDelay = document.getElementById("range-delay"),
    displayDelayMs = document.getElementById("display-delay-ms"),
    restartButton = document.getElementById("restart"),
    textArea = document.getElementById("program"),
    memoryContainer = document.getElementById("memory-container"),
    memoryHeaders = document.getElementById("memory-headers"),
    memory = document.getElementById("memory"),
    statusInfo = document.getElementById("status-info"),
    registerLabel = document.getElementById("register-label"),
    outputSelect = document.getElementById("output-select"),
    outputLog = document.getElementById("output-log"),
    outputLogOuter = document.getElementById("output-log-outer"),
    outputLogContainer = document.getElementById("tab-content1"),
    registerLog = document.getElementById("register-log"),
    registerLogOuter = document.getElementById("register-log-outer"),
    registerLogContainer = document.getElementById("tab-content2"),
    watchList = document.getElementById("watch-list");

const HEX = 0, DEC = 1, ASCII = 2;

var asm = null,
    sim = null,
    interval = null,
    lastErrorLine = null,
    lastCurrentLine = null,
    lastBreakPointLine = null,
    breaking = false,
    delay = 1,
    microStepping = false,
    running = false,
    waiting = false,
    outputType = HEX,
    outputList = [];
    
textArea.value = localStorage.getItem("marie-program") || "";
    
var programCodeMirror = CodeMirror.fromTextArea(textArea, {
    mode: "marie",
    lineNumbers: true,
    gutters: ["CodeMirror-linenumbers", "breakpoints"]
});

programCodeMirror.on("gutterClick", function(cm, n) {
    var info = cm.lineInfo(n);
    cm.setGutterMarker(n, "breakpoints", info.gutterMarkers ? null : makeMarker());
});

programCodeMirror.on("change", function(cm) {
    cm.showHint({
        hint: getCompletions,
        alignWithWord: false,
        completeSingle: false
    })
});

function makeMarker() {
    var marker = document.createElement("div");
    marker.style.color = "#07C";
    marker.innerHTML = "●";
    return marker;
}

var initialBreakpoints = localStorage.getItem("marie-breakpoints");
if (initialBreakpoints) {
    JSON.parse(initialBreakpoints).forEach(function(line) {
        var info = programCodeMirror.lineInfo(line);
        programCodeMirror.setGutterMarker(line, "breakpoints", info.gutterMarkers ? null : makeMarker());
    });
}

function hex(num, digits) {
    digits = digits || 4;
    var s = "0000" + (num >>> 0).toString(16).toUpperCase();
    return s.substr(s.length - digits);
}

function populateMemoryView(sim) {
    while (memory.firstChild) {
        memory.removeChild(memory.firstChild);
    }
    
    while (memoryHeaders.firstChild) {
        memoryHeaders.removeChild(memoryHeaders.firstChild);
    }
    
    // Populate headers
    var i, j, th, tr, cell, header;
    var headers = document.createElement("tr");
    th = document.createElement("th");
    headers.appendChild(th);
    for (i = 0; i < 16; i++) {
        th = document.createElement("th");
        th.appendChild(document.createTextNode("+" + hex(i, 1)));
        headers.appendChild(th);
    }
    
    memoryHeaders.appendChild(headers);
        
    // Populate memory cells
    for (i = 0; i < 4096; i += 16) {
        tr = document.createElement("tr");
        
        header = document.createElement("th");
        header.appendChild(document.createTextNode(hex(i, 3)));
        tr.appendChild(header);
                
        for (j = 0; j < 16; j++) {
            cell = document.createElement("td");
            cell.id = "cell" + (i + j);
            cell.className = "cell";
            cell.appendChild(document.createTextNode(hex(sim.memory[i + j].contents)));
            tr.appendChild(cell);
        }
        
        memory.appendChild(tr);
    }
    
    memoryContainer.style.display = "inline-block";
}

function populateWatchList(asm, sim) {
    while (watchList.firstChild) {
        watchList.removeChild(watchList.firstChild);
    }
    
    var symbolCells = {};
   
    for (var symbol in asm.symbols) {
        var address = asm.symbols[symbol];
        
        var tr = document.createElement("tr");
        var labelCell = document.createElement("td");
        labelCell.classList.add("watch-list-label");
        labelCell.appendChild(document.createTextNode(symbol));
        
        var addressCell = document.createElement("td");
        addressCell.classList.add("watch-list-address");
        addressCell.appendChild(document.createTextNode(hex(address, 3)));
        
        var valueCell = document.createElement("td");
        valueCell.classList.add("watch-list-value");
        valueCell.appendChild(document.createTextNode(hex(sim.memory[address].contents)));
        
        tr.appendChild(labelCell);
        tr.appendChild(addressCell);
        tr.appendChild(valueCell);
        
        watchList.appendChild(tr);
        
        symbolCells[address] = valueCell;
    }
    
    return symbolCells;
}

function convertOutput(value) {
    switch(outputType) {
        case HEX:
            return hex(value);
        case DEC:
            return value;
        case ASCII:
            return String.fromCharCode(value);
        default:
            return "Invalid output type.";
    }
}

function repopulateOutputLog() {
    while (outputLog.firstChild) {
        outputLog.removeChild(outputLog.firstChild);
    }

    for(var i = 0; i < outputList.length; i++) {
        outputLog.appendChild(document.createTextNode(convertOutput(outputList[i])));
        outputLog.appendChild(document.createElement("br"));
    }
}

function resetRegisters() {
    document.getElementById("ac").textContent = hex(sim.ac);
    document.getElementById("ir").textContent = hex(sim.ir);
    document.getElementById("mar").textContent = hex(sim.mar, 3);
    document.getElementById("mbr").textContent = hex(sim.mbr);
    document.getElementById("pc").textContent = hex(sim.pc, 3);
    document.getElementById("in").textContent = hex(sim.in);
    document.getElementById("out").textContent = hex(sim.out);
}

function initializeRegisterLog() {
    while (registerLog.firstChild) {
        registerLog.removeChild(registerLog.firstChild);
    }
}

function updateCurrentLine(clear) {
    if (lastCurrentLine != null) {
        programCodeMirror.removeLineClass(lastCurrentLine, "background", "current-line");
        lastCurrentLine = null;
    }

    if (lastBreakPointLine != null) {
        programCodeMirror.removeLineClass(lastBreakPointLine, "background", "active-break-point");
        lastBreakPointLine = null;
    }
    
    if (clear) {
        return;
    }
    
    var line = sim.current().line;
    if (line != null) {
        line--; // Compensate for zero-based lines
        programCodeMirror.addLineClass(line, "background", "current-line");
        lastCurrentLine = line;
        var info = programCodeMirror.lineInfo(line)
        if (info.gutterMarkers) {
            programCodeMirror.addLineClass(line, "background", "active-break-point");
            lastBreakPointLine = line;
            breaking = true;
        }
    }
}

function initializeOutputLog() {
    while (outputLog.firstChild) {
        outputLog.removeChild(outputLog.firstChild);
    }
    outputList = [];
}

$('#input-dialog').on('shown.bs.modal', function () {
    $('#input-value').focus();
});

$('#input-dialog').popoverX({
    show: false,
    keyboard: false,
    $target: $("#in"),
    placement: "left",
    closeOtherPopovers: false,
    useOffsetForPos: false
});

$('#input-value').keypress(function(e) {
    if(e.which == 13) {
        $('#input-dialog').popoverX('hide');
    }
});

function finishInput(output) {
    var type = $('#input-type').val(),
        value = $('#input-value').val();
    switch (type) {
        case ("hex"):
            value = parseInt(value, 16);
            break;
        case ("dec"):
            value = parseInt(value, 10);
            break;
        case ("oct"):
            value = parseInt(value, 8);
            break;
        case ("ascii"):
            value = value.charCodeAt(0);
            break;
    }
    
    if (!isNaN(value)) {
        $('#input-dialog').on('hidden.bs.modal', function () {
            output(value);
            runLoop(microStepping);
            stopWaiting();
        });
        $('#input-dialog').popoverX('hide');
    }
    else {
        $('#input-error').show({});
    }
}

function inputFunc(output) {
    startWaiting();
    
    $('#input-error').hide();

    $('#input-dialog').popoverX('show');
    
    $('#input-dialog').off('hidden.bs.modal');
    $('#input-button').off('click');
    $('#input-value').off('keypress');

    $('#input-value').on('keypress', function(e) {
        if(e.which == 13) {
            finishInput(output);
        }
    });

    $('#input-button').on('click', function(e) {
        finishInput(output);
    });
}

function outputFunc(value) {
    var shouldScrollToBottomOutputLog = outputLogOuter.clientHeight === (outputLogOuter.scrollHeight - outputLogOuter.scrollTop);

    outputList.push(value);
    
    outputLog.appendChild(document.createTextNode(convertOutput(value)));
    outputLog.appendChild(document.createElement("br"));
    
    if(shouldScrollToBottomOutputLog) {
        outputLogOuter.scrollTop = outputLogOuter.scrollHeight;
    }
}

function startWaiting() {
    if (interval) {
        window.clearInterval(interval);
        interval = null;
    }
    waiting = true;
    assembleButton.disabled = true;
    stepButton.disabled = true;
    microStepButton.disabled = true;
    restartButton.disabled = true;
}

function stopWaiting() {
    waiting = false;
    assembleButton.disabled = false;
    restartButton.disabled = false;
    stepButton.disabled = false;
    microStepButton.disabled = false;
    if (running) {
        run();
    }
}

function stop(pause) {
    if (waiting)
        return;
        
    if (interval) {
        window.clearInterval(interval);
        interval = null;
    }
    if (pause) {
        stepButton.disabled = false;
        microStepButton.disabled = false;
    }
    else {
        runButton.disabled = true;
        stepButton.disabled = true;
        microStepButton.disabled = true;
    }
}

function run() {
    if (waiting)
        return;
    
    if (interval)
        window.clearInterval(interval);
    interval = window.setInterval(runLoop, delay);
    runButton.textContent = "Pause";
    runButton.disabled = false;
    stepButton.disabled = true;
    microStepButton.disabled = true;
    statusInfo.textContent = "Running...";
}

function runLoop(micro) {    
    microStepping = micro;
    
    try {
        if (micro)
            sim.microStep();
        else
            sim.step();
    }
    catch (e) {
	    // prevents catastrophic failure if an error occurs (whether it is MARIE or some other JavaScript error)
        statusInfo.textContent = e.toString();
        statusInfo.className = "error";
        lastErrorLine = e.lineNumber;
        if (lastErrorLine) {
            lastErrorLine--;
            programCodeMirror.addLineClass(lastErrorLine, "background", "error-line");
        }
        
        stop();
        runButton.textContent = "Halted";
        throw e;
    }
    updateCurrentLine();
    if (sim.halted) {
        stop();
        runButton.textContent = "Halted";
        statusInfo.textContent = "Machine halted normally.";
    }
    else if (breaking) {
        stop(true);
        statusInfo.textContent = "Machine paused at break point.";
    }
}

assembleButton.addEventListener("click", function() {
    stop();
    running = false;
    
    if (lastErrorLine != null) {
        programCodeMirror.removeLineClass(lastErrorLine, "background", "error-line");
    }
    
    var assembler = new MarieAsm(programCodeMirror.getValue());
    
    try {
        asm = assembler.assemble();
    } catch (e) {
        statusInfo.textContent = e.toString();
        statusInfo.className = "error";
        lastErrorLine = e.lineNumber - 1;
        programCodeMirror.addLineClass(lastErrorLine, "background", "error-line");
        console.error(e);
        return;
    }
    
    try {
        sim = new MarieSim(asm, inputFunc, outputFunc);
    } catch (e) {
        statusInfo.textContent = e.message;
        statusInfo.className = "error";
        console.error(e);
        return;
    }
    
    statusInfo.textContent = "Assembled successfully";
    statusInfo.className = ""; 
    
    sim.setEventListener("regwrite", function(e) {
        document.getElementById(e.register).textContent = hex(e.newValue, e.register == "mar" || e.register == "pc" ? 3 : 4);
        
        if (e.register == "pc") {
            document.getElementById("cell" + e.oldValue).classList.remove("current-pc");
            document.getElementById("cell" + e.newValue).classList.add("current-pc");
        }
        
        if (e.register == "mar") {
            document.getElementById("cell" + e.oldValue).classList.remove("current-mar");
            document.getElementById("cell" + e.newValue).classList.add("current-mar");
        }
    })
   
    populateMemoryView(sim);
    var symbolCells = populateWatchList(asm, sim);
    initializeOutputLog();
    initializeRegisterLog();
    resetRegisters();
    
    sim.setEventListener("memwrite", function(e) {
        var cell = document.getElementById("cell" + e.address);
        cell.textContent = hex(e.newCell.contents, false);
        cell.style.color = 'red';
        
        for (var address in symbolCells) {
            if (address == e.address) {
                symbolCells[address].textContent = hex(e.newCell.contents);
            }
        }
    });
    
    sim.setEventListener("reglog", function(message) {
        var shouldScrollToBottomRegisterLog = registerLogOuter.clientHeight === (registerLogOuter.scrollHeight - registerLogOuter.scrollTop);
        
        registerLog.appendChild(document.createTextNode(message));
        registerLog.appendChild(document.createElement("br"));
        
        if(shouldScrollToBottomRegisterLog) {
            registerLogOuter.scrollTop = registerLogOuter.scrollHeight;
        }
    });
    
    stepButton.disabled = false;
    microStepButton.disabled = false;
    runButton.disabled = false;
    runButton.textContent = "Run";
    restartButton.disabled = false;
    
    updateCurrentLine(true);
});

stepButton.addEventListener("click", function() {
    runLoop();
});

microStepButton.addEventListener("click", function() {
    runLoop(true);
});

runButton.addEventListener("click", function() {
    if (running) {
        stop(true);
        statusInfo.textContent = "Halted at user request.";
        runButton.textContent = "Continue";
        running = false;
    }
    else {
        breaking = false;
        run();
        runButton.textContent = "Pause";
        running = true;
    }
});

rangeDelay.addEventListener("input", function() {
    displayDelayMs.textContent = this.value + " ms";
});

rangeDelay.addEventListener("change", function() {
    delay = parseInt(this.value);
    
    if (interval) {
        run();
    }
});

restartButton.addEventListener("click", function() {
    stop();
    running = false;
    sim.restart();
    resetRegisters();
    updateCurrentLine(true);
    runButton.textContent = "Run";
    runButton.disabled = false;
    stepButton.disabled = false;
    microStepButton.disabled = false;
    statusInfo.textContent = "Restarted simulator (memory contents are still preserved)";
});

outputSelect.addEventListener("change", function() {
    outputType = this.selectedIndex;
    repopulateOutputLog();
});

window.addEventListener("beforeunload", function() {
    window.localStorage.setItem("marie-program", programCodeMirror.getValue());
    
    var breakpoints = [];
    var count = programCodeMirror.lineCount(), i;
    for (var i = 0; i < count; i++) {
        var info = programCodeMirror.lineInfo(i)
        if (info.gutterMarkers) {
            breakpoints.push(i);
        }
    }
    window.localStorage.setItem("marie-breakpoints", JSON.stringify(breakpoints));
    return;
});

uploadButton.addEventListener("click", function() {
	fileInput.click();
})
