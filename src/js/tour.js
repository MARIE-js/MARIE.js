$(document).ready( function(){
    var tour = new Tour({
        steps: [
        {
            element: "#program-container",
            title: "Coding Area",
            content: "Type in your code here"
        },
        {
            element: "#register-container",
            title: "Registers",
            content: "This shows you the register values"
        },
        {
            element: "#tab-container",
            title: "Values and Outputs",
            content: "This shows you the output in Register Log, Output Values and how the data is being transferred in RTL"
        },
        {
            element: "#status-info",
            title: "Status",
            content: "Shows you current status: also shows error messages"
        },
        {
            element: "#bottom-menu",
            title: "Control Bar",
            content: "This is the bar used for stepping through the code, and building it"
        },
        {
            element: "#assemble",
            title: "Assembling the Code",
            content: "Build the code here"
        },
        {
            element: "#step",
            title: "Step",
            content: "Step Through the Code using this button"
        },
        {
            element: "#microstep",
            title: "Microstep",
            content: "Step thorugh the code by each individual command here"
        },
        {
            element: "#step-back",
            title: "Stepping Backwards through the Code",
            content: "This is an awesome debugging feature where you can step back through each individual line to see where you've gone wrong"
        },
        {
            element: "#run",
            title: "Run",
            content: "Run the code, what else?"
        },
        {
            element: "#restart",
            title: "Restart",
            content: "Have you tried turning it on and off again? This does exactly that."
        },
        {
            element: "#delay-slider",
            title: "Delay Slider",
            content: "This slider sets the timing of the execution of each step"
        },
        {
            element: "#output-select",
            title: "Select the output type here",
            content: "This by default is set to HEX"
        }
        ]});
    // Initialize the tour
    tour.init();

    // Start the tour
    tour.start(); 
});

