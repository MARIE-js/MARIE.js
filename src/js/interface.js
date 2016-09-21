/* globals Utility, getCompletions, MarieAsm, MarieSim, DataPath, saveAs */

window.addEventListener("load", function() {
    "use strict";

    var assembleButton = document.getElementById("assemble"),
        stepButton = document.getElementById("step"),
        microStepButton = document.getElementById("microstep"),
        stepBackButton = document.getElementById("step-back"),
        runButton = document.getElementById("run"),
        rangeDelay = document.getElementById("range-delay"),
        displayDelayMs = document.getElementById("display-delay-ms"),
        restartButton = document.getElementById("restart"),
        textArea = document.getElementById("program"),
        memoryContainer = document.getElementById("memory-container"),
        memoryHeaders = document.getElementById("memory-headers"),
        memory = document.getElementById("memory"),
        statusInfo = document.getElementById("status-info"),
        outputSelect = document.getElementById("output-select"),
        outputLog = document.getElementById("output-log"),
        outputLogTab = document.querySelector("#tab-container a[href='#output-log-outer']"),
        registerLog = document.getElementById("register-log"),
        registerLogOuter = document.getElementById("register-log-outer"),
        registerLogTab = document.querySelector("#tab-container a[href='#register-log-outer']"),
        watchList = document.getElementById("watch-list"),
        uploadButton = document.getElementById("upload"),
        fileInput = document.getElementById("fileInput"),
        datapathEle = document.getElementById("datapath-diagram"),
        datapathInstructionElement = document.getElementById("datapath-display-instructions"),
        currentInstructionRegisterLog = null;

    const HEX = 0, DEC = 1, UNICODE = 2, BIN = 3;

    var defaultPrefs = {
        autocomplete: true,
        autosave: true,
        minDelay: 1,
        maxDelay: 3000,
        binaryStringGroupLength: 4,
        defaultInputMode: 'HEX',
        defaultOutputMode: 'HEX',
        defaultTheme: 'lighttheme',
        minDatapathDelay: 1000,
    };

    var prefs = $.extend(defaultPrefs);

    function newfile() {
        var clrtxt = "";
        programCodeMirror.setValue(clrtxt);
        programCodeMirror.clearHistory();
        saveFile();
        localStorage.setItem("marie-program",null);
        $("#saved-status").text("New file");
        location.reload(); //reloads
    }

    function getPrefs() {
        var autocomplete = localStorage.getItem("autocomplete"),
            autosave = localStorage.getItem("autosave"),
            minDelay = localStorage.getItem("min-delay"),
            maxDelay = localStorage.getItem("max-delay"),
            defaultInputMode = localStorage.getItem("defaultInputMode-value"),
            defaultOutputMode = localStorage.getItem("defaultOutputMode-value"),
            binaryStringGroupLength = localStorage.getItem("binaryStringGroup-Length"),
            defaultTheme = localStorage.getItem('theme'),
            minDatapathDelay = localStorage.getItem("min-datapath-delay");

        if(["false", "true"].indexOf(autocomplete) >= 0) {
            prefs.autocomplete = autocomplete === "true";
        }

        if(["false", "true"].indexOf(autosave) >= 0) {
            prefs.autosave = autosave === "true";
        }

        if(!isNaN(parseInt(minDelay))) {
            prefs.minDelay = parseInt(minDelay);
        }

        if(defaultInputMode !== null) {
            prefs.defaultInputMode = defaultInputMode;
        }

        if(defaultTheme !== null) {
            prefs.defaultTheme = defaultTheme;
        }

        if(defaultOutputMode !== null) {
            prefs.defaultOutputMode = defaultOutputMode;
        }

        if(!isNaN(parseInt(maxDelay))) {
            prefs.maxDelay = parseInt(maxDelay);
        }

        if(!isNaN(parseInt(binaryStringGroupLength))) {
            prefs.binaryStringGroupLength = parseInt(binaryStringGroupLength);
        }

        if(!isNaN(parseInt(minDatapathDelay))) {
            prefs.minDatapathDelay = parseInt(minDatapathDelay);
        }

        updatePrefs();
    }

    function setPrefs() {
        localStorage.setItem("autocomplete", prefs.autocomplete);
        localStorage.setItem("autosave", prefs.autosave);
        localStorage.setItem("min-delay", prefs.minDelay);
        localStorage.setItem("max-delay", prefs.maxDelay);
        localStorage.setItem("min-datapath-delay", prefs.minDatapathDelay);
        localStorage.setItem("binaryStringGroup-Length", prefs.binaryStringGroupLength);
        localStorage.setItem("defaultInputMode-value", prefs.defaultInputMode);
        localStorage.setItem("defaultOutputMode-value", prefs.defaultOutputMode);
        localStorage.setItem("theme",prefs.defaultTheme);
    }

    function updatePrefs() {
        rangeDelay.min = prefs.minDelay;
        rangeDelay.max = prefs.maxDelay;

        if(!prefs.autosave && saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        }

        updateRangeDelay();

        if(prefs.defaultOutputMode == "HEX") {
            outputType = HEX;
        }
        else if(prefs.defaultOutputMode == "DEC") {
            outputType = DEC;
        }
        else if(prefs.defaultOutputMode == "UNICODE") {
            outputType = UNICODE;
        }
        else if(prefs.defaultOutputMode == "BIN") {
            outputType = BIN;
        }

        if(prefs.defaultTheme == "lighttheme") {
            theme = 'light';
        } else if(prefs.defaultTheme == 'darktheme'){
            theme = 'dark';
        }

        datapath.setTheme(theme);

        if(changedInputMode) {
            $('#input-type').val(prefs.defaultInputMode);
            changedInputMode = false;
        }

        if(changedOutputMode) {
            $("#output-select").val(prefs.defaultOutputMode);
            changedOutputMode = false;
        }

        if(changedTheme) {
          $('#themeSelect').val(prefs.defaultTheme);
          changedTheme = false;
        }
    }

    var asm = null,
        sim = null,
        interval = null,
        lastErrorLine = null,
        lastCurrentLine = null,
        lastBreakPointLine = null,
        currentInstructionLine = null,
        breaking = false,
        delay = prefs.minDelay,
        microStepping = false,
        running = false,
        waiting = false,
        pausedOnInput = false,
        savedOutput = null,
        outputType = HEX,
        changedInputMode = true,
        changedOutputMode = true,
        theme = 'light',
        changedTheme = true,
        datapath = new DataPath(datapathEle, datapathInstructionElement),
        outputList = [],
        saveTimeout = null,
        modifiedFile = false,
        viewingInstruction = false,
        selectedMemoryCell = null,
        queryString = window.location.search.substring(1), // returns first query string
        symbolCells = null;

    getPrefs();

    textArea.value = localStorage.getItem("marie-program") || "";

    if(textArea.value !== "") {
        $("#saved-status").text("Restored file");
    } else {
        textArea.value = "";
        $("#saved-status").text("New file");
    }

    var programCodeMirror = CodeMirror.fromTextArea(textArea, {
        mode: "marie",
        lineNumbers: true,
        gutters: ["CodeMirror-linenumbers", "breakpoints"]
    });

    if(theme === "dark") {
        programCodeMirror.setOption('theme', 'dracula');
    }

    programCodeMirror.on("gutterClick", function(cm, n) {
        var info = cm.lineInfo(n);
        cm.setGutterMarker(n, "breakpoints", info.gutterMarkers ? null : makeMarker());
    });

    programCodeMirror.on("change", function(cm) {
        if(prefs.autocomplete) {
            cm.showHint({
                hint: getCompletions,
                alignWithWord: false,
                completeSingle: false
            });
        }

        if(saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        }

        $('#saved-status').text("Modified file");
        modifiedFile = true;

        if(prefs.autosave) {
            saveTimeout = setTimeout(function() {
                saveFile(true);
            }, 10*1000);
        }
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

    function clearGutters(){
        programCodeMirror.clearGutter("breakpoints");
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
            th.appendChild(document.createTextNode("+" + Utility.hex(i, 1)));
            headers.appendChild(th);
        }

        memoryHeaders.appendChild(headers);

        // Populate memory cells
        for (i = 0; i < 4096; i += 16) {
            tr = document.createElement("tr");

            header = document.createElement("th");
            header.appendChild(document.createTextNode(Utility.hex(i, 3)));
            tr.appendChild(header);

            for (j = 0; j < 16; j++) {
                cell = document.createElement("td");
                cell.id = "cell" + (i + j);
                cell.className = "cell";
                cell.appendChild(document.createTextNode(Utility.hex(sim.memory[i + j].contents)));
                tr.appendChild(cell);
            }

            memory.appendChild(tr);
        }

        memoryContainer.style.display = "inline-block";
    }

    function finishInputReplaceMemoryCell() {
        if(selectedMemoryCell === null) {
            return;
        }

        var cellString = "cell";

        var ele = document.getElementById(cellString + selectedMemoryCell.toString());
        var value = ele.firstChild.value;

        while(ele.firstChild) {
            ele.removeChild(ele.firstChild);
        }

        var parsedValue = parseInt(value, 16);

        var cell = parseInt(ele.id.substr(cellString.length - ele.id.length));

        if(!isNaN(parsedValue)/* && sim*/) {
            ele.textContent = Utility.hex(parsedValue);

            var oldValue = sim.memory[cell].contents;

            if(parsedValue === sim.memory[cell].contents) {
                selectedMemoryCell = null;
                return;
            }

            sim.memory[cell].contents = parsedValue;

            // Delete original instruction if it exists
            if(typeof sim.memory[cell].line != "undefined") {
                sim.memory[cell].line = undefined;
                sim.memory[cell].operator = undefined;
                sim.memory[cell].operand = undefined;
                sim.memory[cell].label = undefined;
                sim.program[cell] = undefined;
            }

            setStatus("Modified memory cell at address " + Utility.hex(cell, 3) + " from " +  Utility.hex(oldValue) + " to " + Utility.hex(parsedValue));
        } else {
            setStatus("Invalid value '" + value + "'; reverting back to original memory cell contents at address " + Utility.hex(cell, 3), true);
            ele.textContent = Utility.hex(sim.memory[cell].contents);
        }

        selectedMemoryCell = null;
    }

    memory.addEventListener("dblclick", function(e) {
        var cellString = "cell";

        if(e.target && e.target.classList.contains("cell")) {
            finishInputReplaceMemoryCell();
            selectedMemoryCell = parseInt(e.target.id.substr(cellString.length - e.target.id.length));

            var input = document.createElement("input");
            input.type = "text";
            input.value = e.target.textContent;
            input.size = 4;

            while (e.target.firstChild) {
                e.target.removeChild(e.target.firstChild);
            }

            e.target.appendChild(input);
            input.select();
        }
    });

    memory.addEventListener("keypress", function(e) {
        if(e.which === 13 && e.target && e.target.parentNode.classList.contains("cell")) {
            finishInputReplaceMemoryCell();
        }
    });

    document.addEventListener("click", function() {
        finishInputReplaceMemoryCell();
    });


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
            addressCell.appendChild(document.createTextNode(Utility.hex(address, 3)));

            var valueCell = document.createElement("td");
            valueCell.classList.add("watch-list-value");
            valueCell.appendChild(document.createTextNode(Utility.hex(sim.memory[address].contents)));

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
                return Utility.hex(value);
            case DEC:
                return value;
            case UNICODE:
                return String.fromCharCode(value);
            case BIN:
                return Utility.uintToBinGroup(value, 16, prefs.binaryStringGroupLength);
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
        document.getElementById("ac").textContent = Utility.hex(sim.ac);
        document.getElementById("ir").textContent = Utility.hex(sim.ir);
        document.getElementById("mar").textContent = Utility.hex(sim.mar, 3);
        document.getElementById("mbr").textContent = Utility.hex(sim.mbr);
        document.getElementById("pc").textContent = Utility.hex(sim.pc, 3);
        document.getElementById("in").textContent = Utility.hex(sim.in);
        document.getElementById("out").textContent = Utility.hex(sim.out);

        datapath.setAllRegisters([Utility.hex(sim.mar, 3), Utility.hex(sim.pc, 3), Utility.hex(sim.mbr), Utility.hex(sim.ac), Utility.hex(sim.in), Utility.hex(sim.out), Utility.hex(sim.ir)]);

        $(".current-pc").removeClass("current-pc");
        $(".current-mar").removeClass("current-mar");
        $(".memory-changed").removeClass("memory-changed");
    }

    function initializeRegisterLog() {
        while (registerLog.firstChild) {
            registerLog.removeChild(registerLog.firstChild);
        }
    }

    // Event delegation
    registerLog.addEventListener("mouseover", function(e) {
        if(e.target && e.target.classList.contains("instruction-register-log") && e.target.dataset.currentLine) {
            var line = parseInt(e.target.dataset.currentLine);

            if(!isNaN(line)) {
                if(currentInstructionLine !== undefined && currentInstructionLine !== null) {
                    programCodeMirror.removeLineClass(currentInstructionLine - 1, "background", "highlighted-line");
                }

                programCodeMirror.addLineClass(line, "background", "highlighted-line");

                viewingInstruction = true;
            }
        }
    }, false);

    registerLog.addEventListener("mouseout", function(e) {
        if(e.target && e.target.classList.contains("instruction-register-log") && e.target.dataset.currentLine) {
            var line = parseInt(e.target.dataset.currentLine);

            if(!isNaN(line)) {
                programCodeMirror.removeLineClass(line, "background", "highlighted-line");

                if(currentInstructionLine !== undefined && currentInstructionLine !== null) {
                    programCodeMirror.addLineClass(currentInstructionLine - 1, "background", "highlighted-line");
                }

                viewingInstruction = false;
            }
        }
    }, false);

    function updateBottomDataAttr(e) {
        var target = e.target;

        // check if at the bottom
        var atBottom = target.clientHeight > 0.99 * (target.scrollHeight - target.scrollTop);

        // set the data attr based on if scrolled to the bottom or not
        if (atBottom) {
            target.setAttribute("data-stick-to-bottom", "true");
        } else {
            target.setAttribute("data-stick-to-bottom", "false");
        }
    }

    // update if should stick to the bottom for Output log
    outputLog.addEventListener("scroll", updateBottomDataAttr);

    // update if should stick to the bottom for RTL log
    registerLogOuter.addEventListener("scroll", updateBottomDataAttr);

    function scrollToBottom(e) {
        // get the tab content (not the tab link)
        var tabContent = document.querySelector(e.target.getAttribute('href'));
        // get the stick to bottom attr
        var shouldScrollToBottomRegisterLog = tabContent.getAttribute('data-stick-to-bottom') == 'true';

        // scroll to the bottom if it should
        if(shouldScrollToBottomRegisterLog) {
            tabContent.scrollTop = tabContent.scrollHeight;
        }
    }

    // Stick to the bottom for Output Log
    $(outputLogTab).on('shown.bs.tab', scrollToBottom);
    // Stick to the bottom for Register Log
    $(registerLogTab).on('shown.bs.tab', scrollToBottom);

    function updateCurrentLine(clear) {
        if (lastCurrentLine !== null) {
            programCodeMirror.removeLineClass(lastCurrentLine, "background", "next-instruction");
            lastCurrentLine = null;
        }

        if (lastBreakPointLine !== null) {
            programCodeMirror.removeLineClass(lastBreakPointLine, "background", "active-break-point");
            lastBreakPointLine = null;
        }

        if (clear) {
            /* Remove background line classes from all lines to ensure that no
            line has any highlighting. Perhaps there is a better of doing this,
            but please note that the user may have changed some code, thus
            the last line variables may not point to the lines that still have
            highlighting. */

            var numOfLines = programCodeMirror.lineCount();

            for(var i = 1; i <= numOfLines; i++) {
                programCodeMirror.removeLineClass(i, "background", "active-break-point");
                programCodeMirror.removeLineClass(i, "background", "next-instruction");
                programCodeMirror.removeLineClass(i, "background", "highlighted-line");
            }

            return;
        }

        var current = sim.current();
        var line = current ? current.line : null;

        if (line !== undefined && line !== null) {
            line --; // compensate for zero based lines
            programCodeMirror.addLineClass(line, "background", "next-instruction");
            lastCurrentLine = line;
            var info = programCodeMirror.lineInfo(line);
            if (info.gutterMarkers) {
                programCodeMirror.addLineClass(line, "background", "active-break-point");
                lastBreakPointLine = line;
                breaking = true;
            }
        }
    }

    function updateCurrentInstructionLine() {
        if(!viewingInstruction && currentInstructionLine !== undefined && currentInstructionLine !== null) {
            programCodeMirror.removeLineClass(currentInstructionLine - 1, "background", "highlighted-line");
        }

        var current = sim.current();
        currentInstructionLine = current ? current.line : null;

        if(!viewingInstruction && currentInstructionLine !== undefined && currentInstructionLine !== null) {
            programCodeMirror.addLineClass(currentInstructionLine - 1, "background", "highlighted-line");
        }
    }

    function initializeOutputLog() {
        while (outputLog.firstChild) {
            outputLog.removeChild(outputLog.firstChild);
        }
        outputList = [];
    }

    $('#input-dialog').on('shown.bs.modal', function () {
        $('#input-value').val('').focus();
    });

    var placeInputDialog = document.createElement("div");
    placeInputDialog.id = "place-input-dialog";
    document.body.appendChild(placeInputDialog);

    $('#input-dialog').popoverX({
        show: false,
        keyboard: false,
        $target: $("#place-input-dialog"),
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
            value = $('#input-value').val().split(" ").join("");
        switch (type) {
            case ("HEX"):
                value = parseInt(value, 16);
                break;
            case ("DEC"):
                value = parseInt(value, 10);
                break;
            case ("UNICODE"):
                value = value.charCodeAt(0);
                break;
            case("BIN"):
                value = parseInt(value, 2);
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
            $('#input-error').show({
                step: function() {
                    $('#input-dialog').popoverX("refreshPosition");
                }
            });
        }
    }

    function inputFunc(output) {
        startWaiting();

        $('#input-error').hide();

        $('#input-dialog').popoverX('show');

        $('#input-dialog').off('hidden.bs.modal');
        $('#input-button').off('click');
        $('#input-button-pause').off('click');
        $('#input-value').off('keypress');

        $('#input-value').on('keypress', function(e) {
            if(e.which == 13) {
                finishInput(output);
            }
        });

        $('#input-button').on('click', function() {
            finishInput(output);
        });

        $('#input-pause-button').on('click', function() {
            stopWaiting();
            stop(true);
            setStatus("Halted at user request.");
            runButton.textContent = "Continue";
            running = false;
            $('#input-dialog').popoverX('hide');
            pausedOnInput = true;
            savedOutput = output;
        });
    }

    function outputFunc(value) {
        var shouldScrollToBottomOutputLog = outputLog.getAttribute("data-stick-to-bottom") == "true";

        outputList.push(value);

        outputLog.appendChild(document.createTextNode(convertOutput(value)));
        outputLog.appendChild(document.createElement("br"));

        if(shouldScrollToBottomOutputLog) {
            outputLog.scrollTop = outputLog.scrollHeight;
        }
    }

    function setStatus(message, error) {
        statusInfo.textContent = message;

        if(error) {
            statusInfo.className = "error";
            $("#datapath-status-bar").removeClass("alert-info alert-warning").addClass("alert-danger").text(message);
        } else {
            statusInfo.className = "";

            $("#datapath-status-bar").removeClass("alert-danger");

            if(!$('#datapath-status-bar').hasClass("alert-warning")) {
                $("#datapath-status-bar").addClass("alert-info");
            }

            if($("#datapath-status-bar").hasClass("alert-info")) {
                $("#datapath-status-bar").text(message);
            }
        }
    }

    function regLogFunc(message, alu_type, notAnRTL) {
        if(!running || delay >= prefs.minDatapathDelay) {
            datapath.appendMicroInstruction(message);
            datapath.setALUBus(alu_type);
        }

        var shouldScrollToBottomRegisterLog = registerLogOuter.getAttribute("data-stick-to-bottom") == "true";

        if(notAnRTL) {
            currentInstructionRegisterLog.classList.add("finished-instruction");
            registerLog.appendChild(document.createTextNode(message));
            registerLog.appendChild(document.createElement("br"));
        } else {
            currentInstructionRegisterLog.appendChild(document.createTextNode(message));
            currentInstructionRegisterLog.appendChild(document.createElement("br"));
        }

        if(shouldScrollToBottomRegisterLog) {
            registerLogOuter.scrollTop = registerLogOuter.scrollHeight;
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
        stepBackButton.disabled = true;
        microStepButton.disabled = true;
        restartButton.disabled = true;
    }

    function stopWaiting() {
        waiting = false;
        assembleButton.disabled = false;
        restartButton.disabled = false;
        stepButton.disabled = false;
        stepBackButton.disabled = false;
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

            // Don't pass in setInterval callback arguments into runLoop function.
            interval = window.setInterval(function() {
                runLoop();
            }, delay);

            runButton.textContent = "Pause";
            runButton.disabled = false;
            stepButton.disabled = true;
            stepBackButton.disabled = true;
            microStepButton.disabled = true;
            setStatus("Running...");
    }

    function runLoop(micro) {
        microStepping = micro;

        var step = true;

        try {
            if (micro) {
                step = sim.microStep() == "step";
            }
            else {
                sim.step();
            }
        }
        catch (e) {
            // prevents catastrophic failure if an error occurs (whether it is MARIE or some other JavaScript error)
            setStatus(e.toString(), true);

            stepBackButton.disabled = true;

            stop();
            runButton.textContent = "Halted";
            throw e;
        }

        updateCurrentLine();

        stepBackButton.disabled = false;

        if (sim.halted) {
            stop();
            runButton.textContent = "Halted";
            setStatus("Machine halted normally.");
        }
        else if (breaking) {
            stop(true);
            running = false;

            datapathWarning(false);

            runButton.textContent = "Continue";
            setStatus("Machine paused at break point.");
        } else {
            return step;
        }
    }

    function datapathWarning(showWarning) {
        if($('#datapath-status-bar').hasClass("alert-danger")) {
            return;
        }

        if(showWarning) {
            $('#datapath-status-bar').removeClass('alert-info').addClass('alert-warning').html("<strong>Note: </strong> Delay is set too low for datapath to update. Increase delay to at least " + prefs.minDatapathDelay.toString() + " ms, or set simulator to stepping mode.");
            $("#datapath-display-instructions").css({"opacity": 0.5});
            $("#datapath-diagram").css({"opacity": 0.5});
            datapath.restart();
        } else {
            $('#datapath-status-bar').removeClass('alert-warning').addClass('alert-info').text(statusInfo.textContent);
            $("#datapath-display-instructions").css({"opacity": 1});
            $("#datapath-diagram").css({"opacity": 1});
            if(sim) {
                datapath.setAllRegisters([Utility.hex(sim.mar, 3), Utility.hex(sim.pc, 3), Utility.hex(sim.mbr), Utility.hex(sim.ac), Utility.hex(sim.in), Utility.hex(sim.out), Utility.hex(sim.ir)]);
                datapath.showInstruction();
            }
        }
    }

    assembleButton.addEventListener("click", function() {
        assembleButton.textContent = "Assembling...";
        assembleButton.disabled = true;
        setStatus("Assembling...", false);

        setTimeout(function() {
            stop();
            running = false;

            datapathWarning(false);

            savedOutput = null;
            pausedOnInput = false;

            if (lastErrorLine !== null) {
                programCodeMirror.removeLineClass(lastErrorLine, "background", "error-line");
                lastErrorLine = null;
            }

            var assembler = new MarieAsm(programCodeMirror.getValue());

            try {
                asm = assembler.assemble();
            } catch (e) {
                setStatus(e.toString(), true);
                lastErrorLine = e.lineNumber - 1;
                programCodeMirror.addLineClass(lastErrorLine, "background", "error-line");
                assembleButton.innerHTML = "<span class='fa fa-th'></span> Assemble";
                assembleButton.disabled = false;
                throw e;
            }

            try {
                sim = new MarieSim(asm, inputFunc, outputFunc);
            } catch (e) {
                setStatus(e.message, true);
                assembleButton.innerHTML = "<span class='fa fa-th'></span> Assemble";
                assembleButton.disabled = false;
                throw e;
            }

            datapath.attachSimulator(sim);

            sim.setEventListener("regread", function(e) {
                if(!running || delay >= prefs.minDatapathDelay) {
                    datapath.setControlBus(e.register, "read");

                    datapath.showDataBusAccess(false, running ? delay/2 : 1000);
                }
            });

            sim.setEventListener("regwrite", function(e) {
                document.getElementById(e.register).textContent = Utility.hex(e.newValue, e.register == "mar" || e.register == "pc" ? 3 : 4);

                if(!running || delay >= prefs.minDatapathDelay) {
                    datapath.setRegister(e.register, Utility.hex(e.newValue, e.register == "mar" || e.register == "pc" ? 3 : 4));
                    datapath.setControlBus(e.register, "write");

                    datapath.showDataBusAccess(false, running ? delay/2 : 1000);
                }

                if (e.register == "pc") {
                    if(0 <= e.oldValue && e.oldValue <= 4095) {
                        document.getElementById("cell" + e.oldValue).classList.remove("current-pc");
                    } else {
                        console.warn("Address", e.oldValue, "for PC is out of bounds, and consequently it cannot update the memory view.");
                    }

                    if(0 <= e.newValue && e.newValue <= 4095) {
                        document.getElementById("cell" + e.newValue).classList.add("current-pc");
                    } else {
                        console.warn("Address", e.newValue, "for PC is out of bounds, and consequently it cannot update the memory view.");
                    }
                }

                if (e.register == "mar") {
                    if(0 <= e.oldValue && e.oldValue <= 4095) {
                        document.getElementById("cell" + e.oldValue).classList.remove("current-mar");
                    } else {
                        console.warn("Address", e.oldValue, "for MAR is out of bounds, and consequently it cannot update the memory view.");
                    }

                    if(0 <= e.newValue && e.newValue <= 4095) {
                        document.getElementById("cell" + e.newValue).classList.add("current-mar");
                    } else {
                        console.warn("Address", e.newValue, "for MAR is out of bounds, and consequently it cannot update the memory view.");
                    }
                }
            });

            populateMemoryView(sim);
            symbolCells = populateWatchList(asm, sim);
            initializeOutputLog();
            initializeRegisterLog();
            resetRegisters();

            sim.setEventListener("memread", function() {
                if(!running || delay >= prefs.minDatapathDelay) {
                    datapath.setControlBus("memory", "read");
                    datapath.showDataBusAccess(true, running ? delay/2 : 1000);
                }
            });

            sim.setEventListener("memwrite", function(e) {
                if(!running || delay >= prefs.minDatapathDelay) {
                    datapath.setControlBus("memory", "write");
                    datapath.showDataBusAccess(true, running ? delay/2 : 1000);
                }

                var cell = document.getElementById("cell" + e.address);
                cell.textContent = Utility.hex(e.newCell.contents, false);
                cell.classList.add("memory-changed");

                for (var address in symbolCells) {
                    if (address == e.address) {
                        symbolCells[address].textContent = Utility.hex(e.newCell.contents);
                    }
                }
            });

            sim.setEventListener("newinstruction", function() {
                if(!running || delay >= prefs.minDatapathDelay) {
                    datapath.showInstruction();
                }

                updateCurrentInstructionLine();

                if(currentInstructionRegisterLog) {
                    currentInstructionRegisterLog.classList.add("finished-instruction");
                }

                var currentInstruction = sim.memory[sim.pc];

                currentInstructionRegisterLog = document.createElement("div");
                currentInstructionRegisterLog.classList.add("instruction-register-log");

                if(currentInstruction && typeof currentInstruction.line !== "undefined") {
                    currentInstructionRegisterLog.dataset.currentLine = currentInstruction.line - 1;
                }

                registerLog.appendChild(currentInstructionRegisterLog);
            });

            sim.setEventListener("reglog", regLogFunc);
            sim.setEventListener("decode", function() {
                datapath.setALUBus("decode");
            });

            stepButton.disabled = false;
            microStepButton.disabled = false;
            stepBackButton.disabled = true;
            runButton.disabled = false;
            runButton.textContent = "Run";
            restartButton.disabled = false;

            setStatus("Assembled successfully", false);
            assembleButton.innerHTML = "<span class='fa fa-th'></span> Assemble";
            assembleButton.disabled = false;

            updateCurrentLine(true);
        }, 1);
    });

    stepButton.addEventListener("click", function() {
        runLoop();

        if(!sim.halted) {
            setStatus("Performed one step");
        }
    });

    stepBackButton.addEventListener("click", function() {
        if(pausedOnInput) {
            savedOutput = null;
            pausedOnInput = false;
        }

        var action = sim.stateHistory[sim.stateHistory.length - 1];
        if (action.type != "step")
            sim.step();
        sim.stateHistory.pop();
        action = sim.stateHistory.pop();

        if(sim.stateHistory.length > 0) {
            setStatus("Stepped backwards one step");
        }

        while (action.type != "step" && sim.stateHistory.length > 0) {
            switch (action.type) {
                case "regread":
                    datapath.setControlBus(action.register, "read");
                    datapath.showDataBusAccess(false, 1000);
                    datapath.setALUBus(action.alu_type);
                    break;
                case "regwrite":
                    var oldValue = sim[action.register],
                        newValue = action.value;
                    sim[action.register] = newValue;

                    datapath.showDataBusAccess(false, 1000);

                    datapath.setControlBus(action.register, "write");
                    datapath.setRegister(action.register, Utility.hex(newValue, action.register == "mar" || action.register == "pc" ? 3 : 4));

                    document.getElementById(action.register).textContent = Utility.hex(newValue, action.register == "mar" || action.register == "pc" ? 3 : 4);
                    if (action.register == "pc") {
                        document.getElementById("cell" + oldValue).classList.remove("current-pc");
                        document.getElementById("cell" + newValue).classList.add("current-pc");
                    }

                    if (action.register == "mar") {
                        document.getElementById("cell" + oldValue).classList.remove("current-mar");
                        document.getElementById("cell" + newValue).classList.add("current-mar");
                    }
                    break;
                case "memread":
                    datapath.showDataBusAccess(true, 1000);
                    break;
                case "memwrite":
                    datapath.showDataBusAccess(true, 1000);

                    sim.memory[action.address].contents = action.value;
                    var cell = document.getElementById("cell" + action.address);
                    cell.textContent = Utility.hex(action.value, false);
                    for (var address in symbolCells) {
                        if (address == action.address) {
                            symbolCells[address].textContent = Utility.hex(action.value);
                        }
                    }
                    break;
                case "output":
                    outputList.pop();
                    repopulateOutputLog();
                    break;
                case "decode":
                    if (action.opcode)
                        sim.opcode = action.opcode;
                    break;
                case "halt":
                    sim.halted = false;
                    running = false;
                    runButton.textContent = "Run";
                    runButton.disabled = false;
                    stepButton.disabled = false;
                    microStepButton.disabled = false;
                    break;
            }
            action = sim.stateHistory.pop();
        }

        if (sim.stateHistory.length === 0) {
            stepBackButton.disabled = true;
        }
        else {
            sim.stateHistory.push({type: "step"});
        }

        datapath.showInstruction();
        regLogFunc("----- stepped back -----", null, true);
        updateCurrentLine();
        updateCurrentInstructionLine();
    });

    microStepButton.addEventListener("click", function() {
        var step = runLoop(true);

        if(!sim.halted) {
            if(step) {
                setStatus("Completed instruction. Click Microstep to proceed to the next one.");
            } else {
                setStatus("Performed one micro-step");
            }
        }
    });

    runButton.addEventListener("click", function() {
        if (running) {
            stop(true);

            datapathWarning(false);

            setStatus("Halted at user request.");
            runButton.textContent = "Continue";
            running = false;
        }
        else {
            breaking = false;
            run();
            runButton.textContent = "Pause";
            running = true;

            if(pausedOnInput) {
                pausedOnInput = false;
                inputFunc(savedOutput);
            }

            if(delay < prefs.minDatapathDelay) {
                datapathWarning(true);
            }
        }
    });

    rangeDelay.addEventListener("input", function() {
        displayDelayMs.textContent = this.value + " ms";
    });

    function updateRangeDelay() {
        delay = parseInt(rangeDelay.value);
        displayDelayMs.textContent = delay + " ms";

        datapathWarning(running && delay < prefs.minDatapathDelay);

        if (interval) {
            run();
        }
    }
    getPrefs();
    rangeDelay.addEventListener("change", updateRangeDelay);

    restartButton.addEventListener("click", function() {
        stop();
        running = false;
        sim.restart();
        resetRegisters();
        updateCurrentLine(true);
        runButton.textContent = "Run";
        runButton.disabled = false;
        stepButton.disabled = false;
        stepBackButton.disabled = true;
        microStepButton.disabled = false;
        datapathWarning(false);
        datapath.restart();
        savedOutput = null;
        pausedOnInput = false;
        setStatus("Restarted simulator (memory contents are still preserved)");
    });

    outputSelect.addEventListener("change", function() {
        outputType = this.selectedIndex;
        repopulateOutputLog();
    });

    window.addEventListener("resize", function() {
        handleDatapathUI();
    }, false);

    function saveFile(autoSave) {
        window.localStorage.setItem("marie-program", programCodeMirror.getValue());

        var breakpoints = [];
        var count = programCodeMirror.lineCount(), i;
        for (i = 0; i < count; i++) {
            var info = programCodeMirror.lineInfo(i);
            if (info.gutterMarkers) {
                breakpoints.push(i);
            }
        }
        window.localStorage.setItem("marie-breakpoints", JSON.stringify(breakpoints));

        modifiedFile = false;

        if(saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        }
        if(autoSave) {
            $('#saved-status').text("Autosaved file");
            console.log("Autosaved file", (new Date()).toString());
        } else {
            $('#saved-status').text("Saved file");
            console.log("Saved file", (new Date()).toString());
        }
    }

    $(window).bind('keydown', function(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (String.fromCharCode(event.which).toLowerCase()) {
                case 's':
                    event.preventDefault();
                    saveFile();
                    break;
            }
        }
    });

    $("#save").on('click', function() {
        saveFile();
    });

    window.onbeforeunload = function() {
        if(prefs.autosave) {
            saveFile();
        }
        else if(modifiedFile) {
            return "You have unsaved changes and autosave is off. Do you want to leave MARIE.js?";
        }
        return;
    };

    uploadButton.addEventListener("click", function() {
        fileInput.click();
    });

    $("#undo").click( function(){
	    programCodeMirror.undo();
    });

    $("#redo").click( function(){
        programCodeMirror.redo();
    });

    $("#prefs").click(function() {
        changedInputMode = false;
        changedOutputMode = false;
        changedTheme = false;

        $("#save-changes").prop("disabled", true);
        $("#prefs-invalid-input-error").hide();
        $("#autocomplete").prop("checked", prefs.autocomplete);
        $("#autosave").prop("checked", prefs.autosave);

        $("#min-delay").val(prefs.minDelay);
        $("#max-delay").val(prefs.maxDelay);
        $("#min-datapath-delay").val(prefs.minDatapathDelay);
        $("#bstringLength").val(prefs.binaryStringGroupLength);
        $("#defaultInputModeSelect").val(prefs.defaultInputMode);
        $("#defaultOutputModeSelect").val(prefs.defaultOutputMode);
        $('#themeSelect').val(prefs.defaultTheme);
        $("#prefs-modal").modal("show");
    });

    $("#min-delay, #max-delay, #min-datapath-delay").off();

    $("#min-delay, #max-delay, #min-datapath-delay").on("input", function() {
        $("#save-changes").prop("disabled", false);
    });

    $("#autocomplete, #autosave").off();

    $("#autocomplete, #autosave").on("change", function() {
        $("#save-changes").prop("disabled", false);
    });

    $("#bstringLength, #defaultOutputModeSelect, #defaultInputModeSelect, #themeSelect").change(function(e) {
        $("#save-changes").prop("disabled", false);

        var target = $(e.target);

        if(target.is("#defaultInputModeSelect")) {
            changedInputMode = true;
        } else if(target.is("#defaultOutputModeSelect")) {
            changedOutputMode = true;
        }
    });

    $("#save-changes").click(function() {
        var autocomplete = $("#autocomplete").prop("checked"),
            autosave = $("#autosave").prop("checked");

        var minDelay = parseInt($("#min-delay").val());
        var maxDelay = parseInt($("#max-delay").val());
        var stringLength = parseInt($("#bstringLength").val());
        var defaultInputMode = $("#defaultInputModeSelect").val();
        var defaultOutputMode = $("#defaultOutputModeSelect").val();
        var defaultTheme = $('#themeSelect').val();
        if(isNaN(minDelay) || isNaN(maxDelay) || minDelay >= maxDelay || minDelay < 0 || maxDelay < 0) {
            $("#prefs-invalid-input-error").show();
            return;
        }

        var minDatapathDelay = parseInt($("#min-datapath-delay").val());

        if(isNaN(minDatapathDelay) || minDatapathDelay < 0) {
            $("#prefs-invalid-input-error").show();
            return;
        }

        prefs.autocomplete = autocomplete;
        prefs.autosave = autosave;
        prefs.minDelay = minDelay;
        prefs.maxDelay = maxDelay;
        prefs.minDatapathDelay = minDatapathDelay;
        prefs.binaryStringGroupLength = stringLength;
        prefs.defaultInputMode = defaultInputMode;
        prefs.defaultOutputMode = defaultOutputMode;
        prefs.defaultTheme = defaultTheme;
        setPrefs();

        $("#prefs-modal").modal("hide");
        location.reload();
    });

    $("#set-to-defaults").click(function() {
        prefs = $.extend(defaultPrefs);
        setPrefs();
    });

     $("#download").click( function(){
       $('#dFileModal').modal('show');
    });

    $('#downloadbtn').click( function(){
         var text = programCodeMirror.getValue();
         var filename = $("#name").val();
         var fileType = $('#downloadMode option:selected').val();

         var extension = "";

         if(filename === "" || filename === null){
           filename = "code";
           console.warn("No File Name detected reverting to code+extension");
         }
         if (fileType === "mas"){
           extension = ".mas";

         }
         else if (fileType === "txt"){
           extension = ".txt";
         }
         var fullFileName = filename + extension;
         console.log(fullFileName);

         var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
         saveAs(blob, fullFileName);
         $('#dFileModal').modal('hide');
    });

    $("#newfilebtn").click(function() {
        newfile();
    });

    $("#clear").click(function(){
         $('#newfoldermodal').modal('show');
    });

    $("#cnclnewfile").click( function(){
        $('#newfoldermodal').modal('hide');
    });

    $("#exportfile").click( function() {
      $('#dFileModal').modal('show');
    });

    $("#fileInput").change(function() {
        var file = fileInput.files[0];
        var reader = new FileReader();

        reader.onload = function() {
            programCodeMirror.setValue(reader.result);
        };
        reader.readAsText(file);
    });

    $("#dpath-menu").click(function() {
        if(window.location.hash === "#datapath") {
            window.location.hash = "";
        } else {
            window.location.hash = "#datapath";
        }
    });

    $("#close-datapath").click(function() {
        window.location.hash = "";
    });

    //readCode() does a GET request for the the file based on the URL
    function readCode(){
        var xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function() {
            if(xhr.readyState === 4){
                if(xhr.status == 200){
                    loadContents(xhr.responseText, xhr);
                    console.log('File Sucessfully Loaded');
                }
                else if(xhr.status == 404){
                    $('#warn-missing-file').show();
                }
            }
        };
        xhr.open('GET',fileAddress,true);
        xhr.send();
    }
    $('#warn-missing-file').hide();

    //loadContents() works in conjunction with readCode(), if the server responds with a Code 200
    function loadContents(responseText){
        programCodeMirror.setValue(responseText);
    }

    if(queryString !== ""){
        var fileAddress = "./code/"+queryString+".mas";
        console.log("Loading from" + fileAddress);
        programCodeMirror.setValue("");
        readCode();
    }

    $('#clearBreakPoints').click(function(){
        clearGutters();
    });

    function handleDatapathUI() {
        if(window.location.hash === "#datapath") {
            if(!datapath.loaded) {
                console.warn("DataPath SVG object has not loaded yet.");

                datapath.onLoad = function() {
                    handleDatapathUI();
                };
                return;
            }

            $("#datapath-tick").show();

            var dpBoundingRect = datapath.datapath.getBoundingClientRect();
            var boundingRect = datapath.datapath.contentDocument
                                                .getElementById("in_register")
                                                .getBoundingClientRect();
            $("#place-input-dialog").css({
                top: dpBoundingRect.top + boundingRect.top,
                left: dpBoundingRect.left + boundingRect.left,
                width: boundingRect.width,
                height: boundingRect.height
            });
        } else {
            var inBoundingRect = document.getElementById("in").getBoundingClientRect();

            $("#datapath-tick").hide();
            $("#place-input-dialog").css({
                top: inBoundingRect.top,
                left: inBoundingRect.left,
                width: inBoundingRect.width,
                height: inBoundingRect.height
            });
        }

        $("#input-dialog").popoverX("refreshPosition");


    }

    handleDatapathUI();

    $(window).on('hashchange', function() {
        handleDatapathUI();
    });

    $("body").removeClass("preload");



    $('#submitToU').click(function(){
        localStorage.setItem("tosAgreed",1);
        $('#tosModal').modal('hide');
    });
});

$(document).ready(function(){
    if(localStorage.getItem("tosAgreed") === null || localStorage.getItem("tosAgreed") === 0){
        $('#tosModal').modal('show');
    }
    $('#name').hide();
    $('[data-toggle="tooltip"]').tooltip();

    if(localStorage.getItem("tosAgreed") === null || localStorage.getItem("tosAgreed") === 0){
        $('#tosModal').modal('show');
    }

    $('#version').click(function(){
      $('#aboutV').modal('toggle');
    });
});
