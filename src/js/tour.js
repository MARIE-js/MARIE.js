$(document).ready( function(){
    //check if LocalStorage Object exists, if not create new localStorage obj
    if (localStorage.getItem("tourComplete") === null) {
        localStorage.setItem("tourComplete", false);
    }

    $("#starttour").click( function() {
    //if localStorage item is equal to false excute tour code
        if (localStorage.getItem("tourComplete") == false) {
            // Instance the tour
            var tour = new Tour();
            
            tour.addsteps([
                {
                    element: "#program-container",
                    title: "Coding Area",
                    content: "Type in your code here"
                },
                {
                    element: "#register container",
                    title: "Registers",
                    content: "This shows you the register values"
                }
                ]);

            // Initialize the tour
            tour.init();

            // Start the tour
            tour.start();
        }

    });
});

