/* =========================================
   NOVATIX STAFF DASHBOARD
   Existing API only. No database changes.
   ========================================= */

const API_BASE = "../api.php";
const $ = selector => document.querySelector(selector);

const eventsTab = $("#eventsTab");
const venuesTab = $("#venuesTab");
const eventsPanel = $("#eventsPanel");
const venuesPanel = $("#venuesPanel");

const eventForm = $("#eventForm");
const venueForm = $("#venueForm");
const eventsTableBody = $("#eventsTableBody");
const venuesTableBody = $("#venuesTableBody");
const eventVenueSelect = $("#eventVenue");
const staffMessage = $("#staffMessage");
const toastContainer = $("#toastContainer");

let events = [];
let venues = [];

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem("novatix_user"));
    } catch {
        return null;
    }
}

function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = isError ? "toast error" : "toast";
    toast.setAttribute("role", "status");
    toast.textContent = message;

    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
}

function showPageMessage(message) {
    staffMessage.hidden = false;
    staffMessage.textContent = message;
}

function hidePageMessage() {
    staffMessage.hidden = true;
    staffMessage.textContent = "";
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function getToken() {
    return localStorage.getItem("novatix_token");
}

/* =========================================
   AUTHENTICATION AND ROLE CHECK
   ========================================= */

function checkStaffAccess() {
    const user = getUser();
    const token = getToken();

    if (!token || !user) {
        window.location.href = "auth.html?mode=login";
        return false;
    }

    if (!["Staff", "Administrator"].includes(user.role)) {
        document.querySelector("main").innerHTML = `
            <section class="container section">
                <div class="panel" style="padding:32px">
                    <h1>Access restricted</h1>
                    <p class="text-muted">
                        This dashboard is available to Staff and Administrator accounts.
                    </p>
                    <a class="btn btn-primary" href="index.html">
                        Return to Homepage
                    </a>
                </div>
            </section>
        `;

        return false;
    }

    $("#staffUserLabel").textContent =
        user.full_name || user.name || user.role;

    return true;
}

$("#staffLogout").addEventListener("click", () => {
    localStorage.removeItem("novatix_token");
    localStorage.removeItem("novatix_user");
    localStorage.removeItem("novatix_pending_event");

    window.location.href = "index.html";
});

$("#staffMobileMenu").addEventListener("click", () => {
    const nav = $("#staffNav");
    const button = $("#staffMobileMenu");
    const opened = nav.classList.toggle("open");

    button.setAttribute("aria-expanded", String(opened));
    button.textContent = opened ? "×" : "☰";
});

/* =========================================
   API REQUEST HELPER
   ========================================= */

async function apiRequest(path, method = "GET", body = null) {
    const token = getToken();

    const options = {
        method,
        headers: {
            Accept: "application/json",
            ...(token ? {
                Authorization: `Bearer ${token}`
            } : {})
        }
    };

    if (body !== null) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${path}`, options);

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The server returned an invalid JSON response.");
    }

    if (!response.ok || result.success !== true) {
        const error = new Error(
            result.message || `Request failed (${response.status}).`
        );

        error.status = response.status;

        if (response.status === 401) {
            localStorage.removeItem("novatix_token");
            localStorage.removeItem("novatix_user");
        }

        throw error;
    }

    return result;
}

async function runAction(action) {
    hidePageMessage();

    try {
        const result = await action();
        if (result?.message) {
            showToast(result.message);
        }
        return true;
    } catch (error) {
        showToast(error.message, true);

        if (error.status === 401) {
            setTimeout(() => {
                window.location.href = "auth.html?mode=login";
            }, 900);
        }

        return false;
    }
}

/* =========================================
   LOAD DATA
   ========================================= */

async function loadDashboardData() {
    eventsTableBody.innerHTML =
        `<tr><td colspan="6">Loading events...</td></tr>`;

    venuesTableBody.innerHTML =
        `<tr><td colspan="5">Loading venues...</td></tr>`;

    try {
        const [eventResult, venueResult] = await Promise.all([
            apiRequest("/events?page=1&limit=50"),
            apiRequest("/venues?page=1&limit=50")
        ]);

        events = Array.isArray(eventResult.data) ? eventResult.data : [];
        venues = Array.isArray(venueResult.data) ? venueResult.data : [];

        renderEvents();
        renderVenues();
        updateStatistics();
        populateVenueOptions();
    } catch (error) {
        showPageMessage(error.message);

        eventsTableBody.innerHTML =
            `<tr><td colspan="6">Unable to load events.</td></tr>`;

        venuesTableBody.innerHTML =
            `<tr><td colspan="5">Unable to load venues.</td></tr>`;

        if (error.status === 401) {
            setTimeout(() => {
                window.location.href = "auth.html?mode=login";
            }, 900);
        }
    }
}

function updateStatistics() {
    $("#statEvents").textContent = events.length;

    $("#statUpcoming").textContent =
        events.filter(event => event.status === "Upcoming").length;

    $("#statVenues").textContent = venues.length;
}

function populateVenueOptions(selectedId = "") {
    const oldValue = selectedId || eventVenueSelect.value;

    eventVenueSelect.innerHTML = `
        <option value="">Select a venue</option>
        ${venues.map(venue => `
            <option value="${Number(venue.venue_id)}">
                ${escapeHTML(venue.venue_name)}
            </option>
        `).join("")}
    `;

    if (oldValue) {
        eventVenueSelect.value = String(oldValue);
    }
}

/* =========================================
   RENDER EVENTS
   ========================================= */

function renderEvents() {
    if (!events.length) {
        eventsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="staff-empty">
                    No events found. Add your first event.
                </td>
            </tr>
        `;
        return;
    }

    eventsTableBody.innerHTML = events.map(event => `
        <tr>
            <td>
                ${escapeHTML(event.event_name)}
                <div class="text-muted">
                    ID: ${Number(event.event_id)}
                </div>
            </td>

            <td>${formatDate(event.event_date)}</td>
            <td>${escapeHTML(event.venue_name || "—")}</td>

            <td>
                <span class="status-badge">
                    ${escapeHTML(event.status)}
                </span>
            </td>

            <td>
                ${Number(event.available_tickets)} /
                ${Number(event.total_tickets)}
            </td>

            <td>
                <div class="staff-row-actions">
                    <button
                        class="btn btn-secondary btn-sm"
                        type="button"
                        data-edit-event="${Number(event.event_id)}"
                    >Edit</button>

                    <button
                        class="btn btn-ghost btn-sm"
                        type="button"
                        data-delete-event="${Number(event.event_id)}"
                    >Delete</button>
                </div>
            </td>
        </tr>
    `).join("");
}

/* =========================================
   RENDER VENUES
   ========================================= */

function renderVenues() {
    if (!venues.length) {
        venuesTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="staff-empty">
                    No venues found. Add your first venue.
                </td>
            </tr>
        `;
        return;
    }

    venuesTableBody.innerHTML = venues.map(venue => `
        <tr>
            <td>
                ${escapeHTML(venue.venue_name)}
                <div class="text-muted">
                    ID: ${Number(venue.venue_id)}
                </div>
            </td>

            <td>${escapeHTML(venue.address)}</td>
            <td>${Number(venue.capacity).toLocaleString("en-MY")}</td>

            <td>${escapeHTML(venue.description || "—")}</td>

            <td>
                <div class="staff-row-actions">
                    <button
                        class="btn btn-secondary btn-sm"
                        type="button"
                        data-edit-venue="${Number(venue.venue_id)}"
                    >Edit</button>

                    <button
                        class="btn btn-ghost btn-sm"
                        type="button"
                        data-delete-venue="${Number(venue.venue_id)}"
                    >Delete</button>
                </div>
            </td>
        </tr>
    `).join("");
}

/* =========================================
   MANAGEMENT TABS
   ========================================= */

function showTab(which) {
    const showEvents = which === "events";

    eventsPanel.classList.toggle("staff-hidden", !showEvents);
    venuesPanel.classList.toggle("staff-hidden", showEvents);

    eventsTab.classList.toggle("active", showEvents);
    venuesTab.classList.toggle("active", !showEvents);

    eventsTab.setAttribute("aria-selected", String(showEvents));
    venuesTab.setAttribute("aria-selected", String(!showEvents));
}

eventsTab.addEventListener("click", () => showTab("events"));
venuesTab.addEventListener("click", () => showTab("venues"));

/* =========================================
   EVENT FORM
   ========================================= */

function resetEventForm() {
    eventForm.reset();
    $("#eventId").value = "";
    $("#eventFormTitle").textContent = "Create Event";
    $("#saveEventButton").textContent = "Save Event";
    eventForm.classList.add("staff-hidden");
}

function openNewEventForm() {
    if (!venues.length) {
        showToast("Add a venue before creating an event.", true);
        showTab("venues");
        return;
    }

    eventForm.reset();
    $("#eventId").value = "";
    $("#eventStatus").value = "Upcoming";
    $("#eventFormTitle").textContent = "Create Event";
    $("#saveEventButton").textContent = "Save Event";

    populateVenueOptions();
    eventForm.classList.remove("staff-hidden");
    eventForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openEditEventForm(id) {
    const event = events.find(
        item => Number(item.event_id) === id
    );

    if (!event) {
        showToast("Event not found.", true);
        return;
    }

    eventForm.reset();

    $("#eventId").value = event.event_id;
    $("#eventName").value = event.event_name || "";
    $("#eventDate").value = String(event.event_date || "").slice(0, 10);
    $("#eventTime").value = String(event.event_time || "").slice(0, 5);
    $("#eventTotalTickets").value = event.total_tickets;
    $("#eventDescription").value = event.description || "";
    $("#eventStatus").value = event.status || "Upcoming";

    populateVenueOptions(event.venue_id);

    $("#eventFormTitle").textContent = "Edit Event";
    $("#saveEventButton").textContent = "Update Event";

    eventForm.classList.remove("staff-hidden");
    eventForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#newEventButton").addEventListener("click", openNewEventForm);
$("#cancelEventEdit").addEventListener("click", resetEventForm);

eventForm.addEventListener("submit", async event => {
    event.preventDefault();

    const id = $("#eventId").value;

    const body = {
        venue_id: Number($("#eventVenue").value),
        event_name: $("#eventName").value.trim(),
        description: $("#eventDescription").value.trim(),
        event_date: $("#eventDate").value,
        event_time: $("#eventTime").value,
        total_tickets: Number($("#eventTotalTickets").value),
        status: $("#eventStatus").value
    };

    if (
        !body.venue_id ||
        !body.event_name ||
        !body.event_date ||
        !body.event_time ||
        !Number.isInteger(body.total_tickets) ||
        body.total_tickets < 1
    ) {
        showToast("Please complete all required event fields.", true);
        return;
    }

    $("#saveEventButton").disabled = true;

    const success = await runAction(async () => {
        const path = id ? `/events/${Number(id)}` : "/events";
        const method = id ? "PUT" : "POST";

        const result = await apiRequest(path, method, body);

        resetEventForm();
        await loadDashboardData();

        return {
            message: result.message ||
                (id ? "Event updated successfully." : "Event created successfully.")
        };
    });

    $("#saveEventButton").disabled = false;

    if (!success) {
        showPageMessage(
            "The event could not be saved. Check the message displayed and try again."
        );
    }
});

/* =========================================
   EVENT ACTIONS
   ========================================= */

eventsTableBody.addEventListener("click", async event => {
    const editButton = event.target.closest("[data-edit-event]");
    const deleteButton = event.target.closest("[data-delete-event]");

    if (editButton) {
        openEditEventForm(Number(editButton.dataset.editEvent));
        return;
    }

    if (!deleteButton) return;

    const id = Number(deleteButton.dataset.deleteEvent);
    const selected = events.find(item => Number(item.event_id) === id);

    if (!selected) return;

    const confirmed = window.confirm(
        `Delete "${selected.event_name}"?\n\nEvents with associated bookings cannot be deleted.`
    );

    if (!confirmed) return;

    await runAction(async () => {
        const result = await apiRequest(`/events/${id}`, "DELETE");
        await loadDashboardData();

        return {
            message: result.message || "Event deleted successfully."
        };
    });
});

/* =========================================
   VENUE FORM
   ========================================= */

function resetVenueForm() {
    venueForm.reset();
    $("#venueId").value = "";
    $("#venueFormTitle").textContent = "Create Venue";
    $("#saveVenueButton").textContent = "Save Venue";
    venueForm.classList.add("staff-hidden");
}

function openNewVenueForm() {
    venueForm.reset();
    $("#venueId").value = "";
    $("#venueFormTitle").textContent = "Create Venue";
    $("#saveVenueButton").textContent = "Save Venue";

    venueForm.classList.remove("staff-hidden");
    venueForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openEditVenueForm(id) {
    const venue = venues.find(
        item => Number(item.venue_id) === id
    );

    if (!venue) {
        showToast("Venue not found.", true);
        return;
    }

    venueForm.reset();

    $("#venueId").value = venue.venue_id;
    $("#venueName").value = venue.venue_name || "";
    $("#venueAddress").value = venue.address || "";
    $("#venueCapacity").value = venue.capacity;
    $("#venueDescription").value = venue.description || "";

    $("#venueFormTitle").textContent = "Edit Venue";
    $("#saveVenueButton").textContent = "Update Venue";

    venueForm.classList.remove("staff-hidden");
    venueForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#newVenueButton").addEventListener("click", openNewVenueForm);
$("#cancelVenueEdit").addEventListener("click", resetVenueForm);

venueForm.addEventListener("submit", async event => {
    event.preventDefault();

    const id = $("#venueId").value;

    const body = {
        venue_name: $("#venueName").value.trim(),
        address: $("#venueAddress").value.trim(),
        capacity: Number($("#venueCapacity").value),
        description: $("#venueDescription").value.trim()
    };

    if (
        !body.venue_name ||
        !body.address ||
        !Number.isInteger(body.capacity) ||
        body.capacity < 1
    ) {
        showToast("Please complete all required venue fields.", true);
        return;
    }

    $("#saveVenueButton").disabled = true;

    const success = await runAction(async () => {
        const path = id ? `/venues/${Number(id)}` : "/venues";
        const method = id ? "PUT" : "POST";

        const result = await apiRequest(path, method, body);

        resetVenueForm();
        await loadDashboardData();

        return {
            message: result.message ||
                (id ? "Venue updated successfully." : "Venue created successfully.")
        };
    });

    $("#saveVenueButton").disabled = false;

    if (!success) {
        showPageMessage(
            "The venue could not be saved. Check the message displayed and try again."
        );
    }
});

/* =========================================
   VENUE ACTIONS
   ========================================= */

venuesTableBody.addEventListener("click", async event => {
    const editButton = event.target.closest("[data-edit-venue]");
    const deleteButton = event.target.closest("[data-delete-venue]");

    if (editButton) {
        openEditVenueForm(Number(editButton.dataset.editVenue));
        return;
    }

    if (!deleteButton) return;

    const id = Number(deleteButton.dataset.deleteVenue);
    const selected = venues.find(item => Number(item.venue_id) === id);

    if (!selected) return;

    const confirmed = window.confirm(
        `Delete "${selected.venue_name}"?\n\nVenues associated with events may not be deleted.`
    );

    if (!confirmed) return;

    await runAction(async () => {
        const result = await apiRequest(`/venues/${id}`, "DELETE");
        await loadDashboardData();

        return {
            message: result.message || "Venue deleted successfully."
        };
    });
});

/* =========================================
   INITIALISE
   ========================================= */

$("#currentYear").textContent = new Date().getFullYear();

if (checkStaffAccess()) {
    loadDashboardData();
}