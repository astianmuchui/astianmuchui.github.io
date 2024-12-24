var toggle, menu, close_btn;

toggle = document.getElementById("toggle")
menu = document.getElementById("menu")
close_btn = document.getElementById("close")

// Check if the menu was clicked
toggle.addEventListener("click", function()
{
    // Open the menu
    menu.style.display = "block";
})

// Check if the close button was clicked
close_btn.addEventListener("click",function()
{
    // Close the menu
    menu.style.display="none"
})