// calendar.js

// Function to authenticate and get an access token
async function getAuthToken(interactive = false) {
    return new Promise((resolve, reject) => {
        // Try non-interactive first to see if we already have a token
        chrome.identity.getAuthToken({ interactive: interactive }, function (token) {
            if (chrome.runtime.lastError || !token) {
                if (!interactive) {
                    // Silent failed, that's expected if not signed in
                    reject(new Error("No cached token found"));
                } else {
                    console.error("Auth Error (Interactive):", chrome.runtime.lastError?.message || "No token returned");
                    reject(chrome.runtime.lastError);
                }
                return;
            }
            resolve(token);
        });
    });
}

// Function to fetch today's and upcoming events
async function fetchCalendarEvents(token) {
    const timeMin = new Date(); // Use the current moment to exclude past events
    
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 7); // Fetch events for the next 7 days

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&orderBy=startTime&singleEvents=true`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            console.error("Calendar API Error Response:", errorBody);
            
            if (response.status === 401) {
                chrome.identity.removeCachedAuthToken({ token: token }, () => {});
            }
            throw new Error(`Calendar API status: ${response.status} - ${errorBody.error?.message || "Unknown error"}`);
        }

        const data = await response.json();
        return data.items || [];
    } catch (error) {
        console.error("Error fetching events:", error);
        throw error;
    }
}

// Function to render events in the UI
function renderEvents(events) {
    const container = document.getElementById('calendarEventsList');
    if (!container) return;

    container.innerHTML = ''; // Clear loading or previous state

    if (!events || events.length === 0) {
        container.innerHTML = '<li class="no-events">No upcoming events</li>';
        return;
    }

    events.forEach(event => {
        const li = document.createElement('li');
        li.className = 'calendar-event';

        let timeString = '';
        if (event.start.dateTime) {
            const startDate = new Date(event.start.dateTime);
            timeString = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const today = new Date();
            if (startDate.toDateString() !== today.toDateString()) {
                timeString += ` - ${startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
            }
        } else if (event.start.date) {
            timeString = 'All Day';
        }

        li.innerHTML = `
            <div class="event-details">
                <span class="event-title">${event.summary || '(No title)'}</span>
                <span class="event-time">${timeString}</span>
            </div>
            ${event.htmlLink ? `<a href="${event.htmlLink}" target="_blank" class="event-link" title="Open in Google Calendar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M14 3v2h3.59l-9.83 9.83l1.41 1.41L19 6.41V10h2V3zM5 5c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7h-2v7H5V7h7V5z"/></svg></a>` : ''}
        `;
        container.appendChild(li);
    });
}

// Main initialization function
async function initCalendar(forceInteractive = false) {
    const calendarContainer = document.getElementById('calendarContainer');
    const checkbox = document.getElementById('googleCalendarCheckbox');
    const listContainer = document.getElementById('calendarEventsList');

    // Check if feature is enabled
    const isEnabled = localStorage.getItem('googleCalendarState') === 'checked';
    if (checkbox) checkbox.checked = isEnabled;

    if (!isEnabled) {
        if (calendarContainer) calendarContainer.classList.add('calendar-hidden');
        return;
    }

    if (calendarContainer) calendarContainer.classList.remove('calendar-hidden');
    if (listContainer) {
        listContainer.innerHTML = '<li class="loading-events">Loading events...</li>';
    }

    try {
        // Try to get token (silent first unless forced)
        const token = await getAuthToken(forceInteractive);
        const events = await fetchCalendarEvents(token);
        renderEvents(events);
    } catch (error) {
        console.error("Calendar init error:", error);
        if (listContainer) {
            listContainer.innerHTML = `
                <li class="error-events">
                    Sign in to view events.
                    <br>
                    <button id="retryAuthBtn">Sign In</button>
                </li>`;
            const retryBtn = document.getElementById('retryAuthBtn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => initCalendar(true));
            }
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const checkbox = document.getElementById('googleCalendarCheckbox');
    const authCalendarBtn = document.getElementById('authCalendarBtn');

    // Load initial state
    const savedState = localStorage.getItem('googleCalendarState');
    if (checkbox) {
        checkbox.checked = savedState === 'checked';
        checkbox.addEventListener('change', () => {
            localStorage.setItem('googleCalendarState', checkbox.checked ? 'checked' : 'unchecked');
            initCalendar();
        });
    }

    // Initial load
    initCalendar();

    // Listen for sign-in button if it exists in initial HTML
    if (authCalendarBtn) {
        authCalendarBtn.addEventListener('click', () => initCalendar(true));
    }

    // Expose for external calls
    window.myntCalendar = {
        init: initCalendar,
        refresh: () => initCalendar(false)
    };
});
