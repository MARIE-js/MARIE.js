$(document).ready( function(){
    var tour = new Tour({
        steps: [
        {
            smartPlacement: true,
            element: "#brand",
            title: "Welcome to MARIE.js",
            content: "This tour introduces the features and how to use MARIE.js"
        },
        {
            smartPlacement: true,
            backdrop: true,
            element: "#program-container",
            title: "Coding Area",
            content: "This is where you type your code here"
        },
        {
            smartPlacement: true,
            backdrop: true,
            element: "#register-container",
            title: "Registers",
            content: "This shows you the register values"
        },
        {
            smartPlacement: true,
            backdrop: true,
            element: "#tab-container",
            title: "Values and Outputs",
            content: "This shows you the output in Register Log, Output Values and how the data is being transferred in RTL"
        },
        {
            smartPlacement: true,
            backdrop: true,
            element: "#status-info",
            title: "Status",
            content: "Shows you current status: also shows error messages"
        },
        {
            smartPlacement: true,
            element: "#bottom-menu",
            title: "Control Bar",
            content: "This is the bar used for stepping through the code, and building it"
        },
        {
            smartPlacement: true,
            element: "#assemble",
            title: "Assembling the Code",
            content: "Build the code here"
        },
        {
            smartPlacement: true,
            element: "#step",
            title: "Step",
            content: "Step Through the Code using this button"
        },
        {
            smartPlacement: true,
            element: "#microstep",
            title: "Microstep",
            content: "Step thorugh the code by each individual command here"
        },
        {
            smartPlacement: true,
            element: "#step-back",
            title: "Stepping Backwards through the Code",
            content: "This is an awesome debugging feature where you can step back through each individual line to see where you've gone wrong"
        },
        {
            smartPlacement: true,
            element: "#run",
            title: "Run",
            content: "Run the code, what else? This button can also pause the current execution during code execution"
        },
        {
            smartPlacement: true,
            element: "#restart",
            title: "Restart",
            content: "Have you tried turning it on and off again? This does exactly that. But this also preserves memory contents"
        },
        {
            smartPlacement: true,
            element: "#delay-slider",
            title: "Delay Slider",
            content: "This slider sets the timing of the execution of each step"
        },
        {
            smartPlacement: true,
            element: "#output-select",
            title: "Select Output Type",
            content: "Change the output type here with the options (HEX - Base 8, DEC - Base 10, ASCII - Base 16) . This by default is set to HEX. ",
        },
        {
            autoscroll: false
            onshow: function (tour) {this.location.hash = '#datapath'},smartPlacement: true,
            element: "#datapath-diagram",
            title: "Datapath Diagram",
            content: "Change the output type here with the options (HEX - Base 8, DEC - Base 10, ASCII - Base 16) . This by default is set to HEX. "       
        }
        ]});
    // Initialize the tour
    tour.init();

    // Start the tour
    tour.start(); 

    //Crude way of rerunning tour 
    // Clears localStorage variable, then reloads page
    $( "#starttour" ).click(function() {
        window.localStorage.removeItem('tour_current_step'); //remove tour current step var
        window.localStorage.removeItem('tour_end'); //removes tour variable
        location.reload(); //reload page
    });
});

