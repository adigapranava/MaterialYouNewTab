/*
 * Material You New Tab
 * Copyright (c) 2024-2026 Prem, 2023-2025 XengShi
 * Licensed under the GNU General Public License v3.0 (GPL-3.0)
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <https://www.gnu.org/licenses/>.
 */

const searchbar = document.getElementById("searchbar");
const searchInput = document.getElementById("searchQ");

// Focus search bar on load
document.addEventListener("DOMContentLoaded", function () {
    searchInput.focus();
    searchbar.classList.add("active");
});



// Showing border or outline when you click on the searchbar
searchbar.addEventListener("click", function (event) {
    event.stopPropagation();
    searchbar.classList.add("active");

    searchInput.focus();
});

document.addEventListener("click", function (event) {
    // Check if the clicked element is not the searchbar
    if (!searchbar.contains(event.target)) {
        searchbar.classList.remove("active");
    }
});

// Search function


const enterBTN = document.getElementById("enterBtn");


// Function to perform search
function performSearch(query) {
    const searchTerm = query || searchInput.value;

    if (searchTerm !== "") {
        try {
            if (isFirefox) {
                browser.search.query({ text: searchTerm });
            } else {
                chrome.search.query({ text: searchTerm });
            }
        } catch (error) {
            // Fallback to Google if an error occurs
            var fallbackUrl = "https://www.google.com/search?q=" + encodeURIComponent(searchTerm);
            window.location.href = fallbackUrl;
        }
    }
}

// Event listeners
enterBTN.addEventListener("click", () => performSearch());
// Enter key handling is managed in the search suggestions keydown listener

document.addEventListener("keydown", function (event) {
    // Prevent shortcut if modal, menu, or bookmarks sidebar is open
    const modalContainer = document.getElementById("prompt-modal-container");
    if (
        modalContainer?.style.display === "flex" ||
        menuBar.style.display !== "none" ||
        bookmarkSidebar.classList.contains("open")
    ) {
        return;
    }

    if (event.key === "/" && event.target.tagName !== "INPUT" && event.target.tagName !== "TEXTAREA" && event.target.isContentEditable !== true) {
        event.preventDefault();
        searchInput.focus();
        searchbar.classList.add("active");
    }
});
