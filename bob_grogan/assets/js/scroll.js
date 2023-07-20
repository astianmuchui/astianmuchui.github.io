// Use id's incase there is need to distinguish from md screen header

const header = document.querySelector('#header'); /* Desktop header element */
const nav = document.querySelector('#nav'); /* Refers to drop down nav */
menu = document.getElementById("menu")


/**
 * handleScroll - Create interactive menu that changes background depending on the y offset
 * @params none
 * @return none
*/

function handleScroll()
{
        if ( window.pageYOffset > 0)  /* Check where the user is */
        {
                header.style.backgroundColor = '#181842';
                nav.style.backgroundColor = '#181842'; /* Change the dropdown list background as well */
                header.classList.add("shadowed");
                menu.style.zIndex = "999";
        }
        
        else
        {
                header.style.backgroundColor = 'transparent';
                header.classList.remove("shadowed");
                nav.style.backgroundColor = 'rgba(9,65,103,0.8)'; /* Dont change this: */

        }
}

window.addEventListener('load', handleScroll); /* In case the user reloads the page while at y != 0 */
window.addEventListener('scroll', handleScroll); /* Case where the user reloads the page while at y = 0 */
