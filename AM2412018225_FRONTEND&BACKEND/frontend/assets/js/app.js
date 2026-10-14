/* =========================================
   NOVATIX — HOMEPAGE, API AND BOOKINGS
   ========================================= */

const API_BASE = "../api.php";

const state = {
    events: [],
    venues: [],
    query: "",
    status: "all",
    page: 1,
    pageSize: 6
};

const $ = (selector) => document.querySelector(selector);

const eventGrid = $("#eventGrid");
const venueGrid = $("#venueGrid");
const eventPagination = $("#eventPagination");
const modalRoot = $("#modalRoot");
const toastContainer = $("#toastContainer");
const eventFilters = $("#eventFilters");
const heroSearchForm = $("#heroSearchForm");
const heroSearchInput = $("#heroSearchInput");
const mobileMenuButton = $("#mobileMenuButton");
const primaryNav = $("#primaryNav");

const loginNavLink = $("#loginNavLink");
const registerNavLink = $("#registerNavLink");
const navUserLabel = $("#navUserLabel");
const myBookingsButton = $("#myBookingsButton");
const logoutButton = $("#logoutButton");
const managementButton = $("#managementButton");

/* =========================================
   EVENT AND VENUE PHOTOGRAPHY

   Representative images, not actual venue photos.
   ========================================= */

const eventImages = {
    technology: [
        "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=90",
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=90",
        "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=90",
        "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=90"
    ],
    conference: [
        "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=90",
        "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=90",
        "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=90"
    ],
    workshop: [
        "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=90",
        "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=90",
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=90"
    ],
    music: [
        "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=90",
        "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=90",
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=90"
    ],
    default: [
        "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=90",
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=90",
        "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=90"
    ]
};

const venueImages = [
    "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1000&q=85",
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85",
    "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1000&q=85",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1000&q=85",
    "https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=1000&q=85"
];

/* =========================================
   SHARED HELPERS
   ========================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function placeholderImage(label = "NovaTix") {
    const safeLabel = escapeHTML(label);

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg"
             width="900" height="500" viewBox="0 0 900 500">
            <defs>
                <linearGradient id="background">
                    <stop stop-color="#17142e"/>
                    <stop offset="1" stop-color="#6d28d9"/>
                </linearGradient>
            </defs>

            <rect width="900" height="500" fill="url(#background)"/>

            <path
                d="M450 150l26 74 74 26-74 26-26 74-26-74-74-26 74-26z"
                fill="#c4b5fd"
                opacity=".8"
            />

            <text x="450" y="410" font-family="Arial"
                  font-size="32" text-anchor="middle" fill="white">
                ${safeLabel}
            </text>
        </svg>
    `;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function imageMarkup(url, alt, label) {
    return `
        <img
            src="${escapeHTML(url)}"
            alt="${escapeHTML(alt)}"
            data-fallback-label="${escapeHTML(label)}"
            loading="lazy"
        >
    `;
}

/* Use a safe SVG when an external image fails. */

document.addEventListener("error", event => {
    const image = event.target;

    if (
        image instanceof HTMLImageElement &&
        image.dataset.fallbackLabel &&
        !image.dataset.fallbackApplied
    ) {
        image.dataset.fallbackApplied = "true";
        image.src = placeholderImage(image.dataset.fallbackLabel);
    }
}, true);

function eventImage(event, position = 0) {
    const name = String(event.event_name ?? "").toLowerCase();
    let pool = eventImages.default;

    if (/music|concert|festival|live|dj|band/.test(name)) {
        pool = eventImages.music;
    } else if (/workshop|creative|business|design|entrepreneur/.test(name)) {
        pool = eventImages.workshop;
    } else if (/conference|forum|summit|convention|expo|technology|tech|digital|innovation|cyber|computer|security/.test(name)) {
        pool = eventImages.technology;
    }

    // Use the event's stable database ID/name plus its visible list position
    // so neighbouring events in the same category do not repeat one photo.
    const index = Math.max(0, Number(position) || 0) % pool.length;

    return pool[index];
}

function venueImage(venue) {
    const id = Number(venue.venue_id) || 1;
    return venueImages[(id - 1) % venueImages.length];
}

function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return new Intl.DateTimeFormat("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

function formatTime(value) {
    if (!value) return "Time unavailable";

    const parts = String(value).split(":");
    const hours = Number(parts[0]);
    const minutes = Number(parts[1] ?? "00");

    if (
        !Number.isInteger(hours) ||
        hours < 0 ||
        hours > 23 ||
        !Number.isInteger(minutes) ||
        minutes < 0 ||
        minutes > 59
    ) {
        return escapeHTML(value);
    }

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString("en-MY", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

function statusClass(status) {
    const classes = {
        Upcoming: "status-upcoming",
        Ongoing: "status-ongoing",
        Completed: "status-completed",
        Cancelled: "status-cancelled",
        Confirmed: "status-confirmed",
        Pending: "status-pending"
    };

    return classes[status] ?? "status-upcoming";
}

function showToast(message, type = "") {
    if (!toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", "status");
    toast.textContent = message;

    toastContainer.appendChild(toast);

    window.setTimeout(() => toast.remove(), 4200);
}

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem("novatix_user"));
    } catch {
        return null;
    }
}

/* =========================================
   LOGIN STATE AND NAVIGATION
   ========================================= */

function setNavVisibility(element, visible) {
    if (!element) return;

    element.hidden = !visible;
    element.classList.toggle("hidden", !visible);
}

function syncAuthNavigation() {
    const token = localStorage.getItem("novatix_token");
    const user = getStoredUser();

    const isLoggedIn = Boolean(token && user && user.role);
    const isCustomer = isLoggedIn && user.role === "Customer";

    const canManage = isLoggedIn &&
        ["Staff", "Administrator"].includes(user.role);

    // Login and registration appear only when logged out.
    setNavVisibility(loginNavLink, !isLoggedIn);
    setNavVisibility(registerNavLink, !isLoggedIn);

    // Greeting and Logout appear when logged in.
    setNavVisibility(navUserLabel, isLoggedIn);
    setNavVisibility(logoutButton, isLoggedIn);

    // My Bookings is for Customer accounts.
    setNavVisibility(myBookingsButton, isCustomer);

    // Management tools are available to Staff and Administrator roles.
    setNavVisibility(managementButton, canManage);

    if (canManage && managementButton) {
    if (user.role === "Administrator") {
        managementButton.href = "admin.html";
        managementButton.textContent = "Admin Dashboard";
    } else {
        managementButton.href = "staff.html";
        managementButton.textContent = "Staff Dashboard";
    }
}

    if (isLoggedIn && navUserLabel) {
        const fullName = String(
            user.full_name || user.name || ""
        ).trim();

        const firstName = fullName.split(/\s+/)[0];

        navUserLabel.textContent = firstName
            ? `Hi, ${firstName}`
            : "My Account";
    } else if (navUserLabel) {
        navUserLabel.textContent = "";
    }
}

function closeModal() {
    modalRoot.innerHTML = "";
}

/* =========================================
   API COMMUNICATION
   ========================================= */

async function apiGet(path) {
    const response = await fetch(`${API_BASE}${path}`, {
        method: "GET",
        headers: {
            Accept: "application/json"
        }
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The API returned an invalid JSON response.");
    }

    if (!response.ok || result.success === false) {
        throw new Error(
            result.message || `Request failed with HTTP ${response.status}.`
        );
    }

    return result;
}

/* =========================================
   LOAD EVENTS
   ========================================= */

async function loadEvents() {
    eventGrid.innerHTML = `
        <div class="loading-state">
            <span class="spinner"></span>
            Loading events...
        </div>
    `;

    try {
        const result = await apiGet("/events?page=1&limit=50");

        if (!Array.isArray(result.data)) {
            throw new Error("The Events API response has an unexpected format.");
        }

        state.events = result.data;
        state.page = 1;

        renderEvents();
    } catch (error) {
        eventGrid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <div class="empty-state-icon">!</div>
                <h3>Unable to load events</h3>
                <p>${escapeHTML(error.message)}</p>

                <button class="btn btn-primary"
                        type="button" data-retry="events">
                    Try Again
                </button>
            </div>
        `;

        eventPagination.innerHTML = "";
    }
}

function getFilteredEvents() {
    return state.events.filter(event => {
        const matchesStatus =
            state.status === "all" || event.status === state.status;

        const searchable = [
            event.event_name,
            event.description,
            event.venue_name,
            event.venue_address
        ].join(" ").toLowerCase();

        const matchesQuery =
            !state.query || searchable.includes(state.query.toLowerCase());

        return matchesStatus && matchesQuery;
    });
}

function renderEvents() {
    const filtered = getFilteredEvents();

    const totalPages = Math.max(
        1,
        Math.ceil(filtered.length / state.pageSize)
    );

    if (state.page > totalPages) {
        state.page = totalPages;
    }

    const start = (state.page - 1) * state.pageSize;
    const visible = filtered.slice(start, start + state.pageSize);

    if (visible.length === 0) {
        eventGrid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <div class="empty-state-icon">⌕</div>
                <h3>No matching events</h3>
                <p>Try another keyword or choose a different status filter.</p>

                <button class="btn btn-secondary"
                        type="button" data-clear-search>
                    Clear Filters
                </button>
            </div>
        `;

        eventPagination.innerHTML = "";
        return;
    }

    eventGrid.innerHTML = visible.map(event => {
        const id = Number(event.event_id);
        const available = Number(event.available_tickets);
        const availabilityClass = available <= 10 ? "low" : "";
        const status = String(event.status ?? "Upcoming");

        return `
            <article class="event-card">
                <div class="card-image">
                    ${imageMarkup(
                        eventImage(event),
                        event.event_name,
                        event.event_name
                    )}

                    <span class="status-badge ${statusClass(status)}">
                        ${escapeHTML(status)}
                    </span>
                </div>

                <div class="card-body">
                    <span class="card-category">NOVATIX EVENT</span>

                    <h3 class="card-title">
                        ${escapeHTML(event.event_name)}
                    </h3>

                    <div class="card-meta">
                        <div class="meta-item">
                            <span class="meta-icon">▣</span>
                            <span>${formatDate(event.event_date)}</span>
                        </div>

                        <div class="meta-item">
                            <span class="meta-icon">◷</span>
                            <span>${formatTime(event.event_time)}</span>
                        </div>

                        <div class="meta-item">
                            <span class="meta-icon">⌖</span>
                            <span>${escapeHTML(
                                event.venue_name ?? "Venue unavailable"
                            )}</span>
                        </div>
                    </div>

                    <div class="card-footer">
                        <span class="ticket-availability ${availabilityClass}">
                            ${Number.isFinite(available) ? available : "—"}
                            tickets left
                        </span>

                        <button
                            class="btn btn-primary btn-sm"
                            type="button"
                            data-event-details="${id}">
                            View Details →
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join("");

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    if (totalPages <= 1) {
        eventPagination.innerHTML = "";
        return;
    }

    let html = `
        <button
            class="page-button"
            type="button"
            data-page="${state.page - 1}"
            ${state.page === 1 ? "disabled" : ""}>
            ←
        </button>
    `;

    for (let page = 1; page <= totalPages; page++) {
        html += `
            <button
                class="page-button ${page === state.page ? "active" : ""}"
                type="button"
                data-page="${page}"
                aria-current="${page === state.page ? "page" : "false"}">
                ${page}
            </button>
        `;
    }

    html += `
        <button
            class="page-button"
            type="button"
            data-page="${state.page + 1}"
            ${state.page === totalPages ? "disabled" : ""}>
            →
        </button>
    `;

    eventPagination.innerHTML = html;
}

/* =========================================
   LOAD VENUES
   ========================================= */

async function loadVenues() {
    venueGrid.innerHTML = `
        <div class="loading-state">
            <span class="spinner"></span>
            Loading venues...
        </div>
    `;

    try {
        const result = await apiGet("/venues?page=1&limit=50");

        if (!Array.isArray(result.data)) {
            throw new Error("The Venues API response has an unexpected format.");
        }

        state.venues = result.data;

        renderVenues();
    } catch (error) {
        venueGrid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <div class="empty-state-icon">⌖</div>
                <h3>Unable to load venues</h3>
                <p>${escapeHTML(error.message)}</p>

                <button class="btn btn-primary"
                        type="button" data-retry="venues">
                    Try Again
                </button>
            </div>
        `;
    }
}

function renderVenues() {
    const query = state.query.toLowerCase();

    const filtered = state.venues.filter(venue => {
        const searchable = [
            venue.venue_name,
            venue.address,
            venue.description
        ].join(" ").toLowerCase();

        return !query || searchable.includes(query);
    });

    if (filtered.length === 0) {
        venueGrid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <div class="empty-state-icon">⌖</div>
                <h3>No matching venues</h3>
                <p>Try searching by venue name or location.</p>
            </div>
        `;

        return;
    }

    venueGrid.innerHTML = filtered.map(venue => {
        const id = Number(venue.venue_id);

        return `
            <article class="venue-card">
                <div class="card-image">
                    ${imageMarkup(
                        venueImage(venue),
                        venue.venue_name,
                        venue.venue_name
                    )}
                </div>

                <div class="card-body">
                    <span class="card-category">EVENT DESTINATION</span>

                    <h3 class="card-title">
                        ${escapeHTML(venue.venue_name)}
                    </h3>

                    <div class="card-meta">
                        <div class="meta-item">
                            <span class="meta-icon">⌖</span>
                            <span>${escapeHTML(venue.address)}</span>
                        </div>

                        <div class="meta-item">
                            <span class="meta-icon">♧</span>
                            <span>
                                Capacity:
                                ${Number(venue.capacity).toLocaleString("en-MY")}
                            </span>
                        </div>
                    </div>

                    <button
                        class="btn btn-secondary btn-block btn-sm"
                        type="button"
                        data-venue-details="${id}">
                        Venue Details →
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

/* =========================================
   EVENT DETAILS
   ========================================= */

function openEventDetails(id) {
    const event = state.events.find(
        item => Number(item.event_id) === id
    );

    if (!event) {
        showToast("The selected event could not be found.", "error");
        return;
    }

    const available = Number(event.available_tickets);
    const canBook = event.status === "Upcoming" && available > 0;

    modalRoot.innerHTML = `
        <div class="modal-backdrop">
            <section class="modal"
                     role="dialog"
                     aria-modal="true"
                     aria-labelledby="eventModalTitle">
                <div class="modal-header">
                    <h2 id="eventModalTitle">Event Details</h2>

                    <button class="modal-close"
                            type="button"
                            data-close-modal
                            aria-label="Close dialog">×</button>
                </div>

                <div class="modal-body">
                    ${imageMarkup(
                        eventImage(event),
                        event.event_name,
                        event.event_name
                    )}

                    <div class="mt-4">
                        <span class="status-badge ${statusClass(event.status)}">
                            ${escapeHTML(event.status)}
                        </span>

                        <h2 style="font-size:26px;margin:14px 0 8px">
                            ${escapeHTML(event.event_name)}
                        </h2>

                        <p class="text-muted">
                            ${escapeHTML(
                                event.description ||
                                "No event description is available."
                            )}
                        </p>

                        <div class="card-meta">
                            <div class="meta-item">
                                <span class="meta-icon">▣</span>
                                ${formatDate(event.event_date)}
                            </div>

                            <div class="meta-item">
                                <span class="meta-icon">◷</span>
                                ${formatTime(event.event_time)}
                            </div>

                            <div class="meta-item">
                                <span class="meta-icon">⌖</span>
                                ${escapeHTML(
                                    event.venue_name ?? "Venue unavailable"
                                )}
                            </div>

                            <div class="meta-item">
                                <span class="meta-icon">◇</span>
                                ${Number.isFinite(available) ? available : 0}
                                tickets available
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-secondary"
                            type="button" data-close-modal>
                        Close
                    </button>

                    <button
                        class="btn btn-primary"
                        type="button"
                        data-prepare-booking="${id}"
                        ${canBook ? "" : "disabled"}>
                        ${canBook ? "Continue to Booking →" : "Booking Unavailable"}
                    </button>
                </div>
            </section>
        </div>
    `;

    const image = modalRoot.querySelector("img");

    if (image) {
        image.style.width = "100%";
        image.style.maxHeight = "260px";
        image.style.objectFit = "cover";
        image.style.borderRadius = "13px";
    }
}

/* =========================================
   VENUE DETAILS
   ========================================= */

function openVenueDetails(id) {
    const venue = state.venues.find(
        item => Number(item.venue_id) === id
    );

    if (!venue) {
        showToast("The selected venue could not be found.", "error");
        return;
    }

    modalRoot.innerHTML = `
        <div class="modal-backdrop">
            <section class="modal"
                     role="dialog"
                     aria-modal="true"
                     aria-labelledby="venueModalTitle">
                <div class="modal-header">
                    <h2 id="venueModalTitle">Venue Details</h2>

                    <button class="modal-close"
                            type="button"
                            data-close-modal
                            aria-label="Close dialog">×</button>
                </div>

                <div class="modal-body">
                    ${imageMarkup(
                        venueImage(venue),
                        venue.venue_name,
                        venue.venue_name
                    )}

                    <h2 style="font-size:26px;margin:18px 0 8px">
                        ${escapeHTML(venue.venue_name)}
                    </h2>

                    <div class="card-meta">
                        <div class="meta-item">
                            <span class="meta-icon">⌖</span>
                            ${escapeHTML(venue.address)}
                        </div>

                        <div class="meta-item">
                            <span class="meta-icon">♧</span>
                            Capacity:
                            ${Number(venue.capacity).toLocaleString("en-MY")}
                        </div>
                    </div>

                    <p class="text-muted">
                        ${escapeHTML(
                            venue.description ||
                            "No additional venue description is available."
                        )}
                    </p>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-primary"
                            type="button" data-close-modal>
                        Done
                    </button>
                </div>
            </section>
        </div>
    `;

    const image = modalRoot.querySelector("img");

    if (image) {
        image.style.width = "100%";
        image.style.maxHeight = "260px";
        image.style.objectFit = "cover";
        image.style.borderRadius = "13px";
    }
}

/* =========================================
   CUSTOMER BOOKING FORM
   ========================================= */

function openBookingForm(eventId) {
    const selectedEvent = state.events.find(
        item => Number(item.event_id) === Number(eventId)
    );

    if (!selectedEvent) {
        showToast("Event not found. Please refresh the page.", "error");
        return;
    }

    const available = Number(selectedEvent.available_tickets);

    if (selectedEvent.status !== "Upcoming") {
        showToast("Bookings are available only for upcoming events.", "error");
        return;
    }

    if (!Number.isInteger(available) || available < 1) {
        showToast("There are no tickets available for this event.", "error");
        return;
    }

    modalRoot.innerHTML = `
        <div class="modal-backdrop">
            <section class="modal"
                     role="dialog"
                     aria-modal="true"
                     aria-labelledby="bookingModalTitle">
                <div class="modal-header">
                    <h2 id="bookingModalTitle">Book Your Tickets</h2>

                    <button class="modal-close"
                            type="button"
                            data-close-modal
                            aria-label="Close">×</button>
                </div>

                <div class="modal-body">
                    <span class="eyebrow">NOVATIX BOOKING</span>

                    <h2 style="margin:12px 0">
                        ${escapeHTML(selectedEvent.event_name)}
                    </h2>

                    <div class="card-meta">
                        <div class="meta-item">
                            <span class="meta-icon">▣</span>
                            ${formatDate(selectedEvent.event_date)}
                        </div>

                        <div class="meta-item">
                            <span class="meta-icon">◷</span>
                            ${formatTime(selectedEvent.event_time)}
                        </div>

                        <div class="meta-item">
                            <span class="meta-icon">⌖</span>
                            ${escapeHTML(
                                selectedEvent.venue_name ?? "Venue unavailable"
                            )}
                        </div>
                    </div>

                    <div id="bookingMessage"
                         class="alert hidden"
                         role="alert"
                         aria-live="polite"></div>

                    <form id="bookingForm"
                          data-event-id="${Number(selectedEvent.event_id)}">
                        <div class="form-group">
                            <label for="ticketQuantity">
                                Number of tickets
                            </label>

                            <input
                                class="form-control"
                                type="number"
                                id="ticketQuantity"
                                name="ticket_quantity"
                                min="1"
                                max="${available}"
                                value="1"
                                required
                            >

                            <span class="form-help">
                                ${available} tickets currently available.
                            </span>
                        </div>

                        <div class="alert alert-warning">
                            Confirm the selected event and ticket quantity
                            before submitting your booking.
                        </div>

                        <button
                            class="btn btn-primary btn-block"
                            id="confirmBookingButton"
                            type="submit">
                            Confirm Booking →
                        </button>
                    </form>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-secondary"
                            type="button" data-close-modal>
                        Cancel
                    </button>
                </div>
            </section>
        </div>
    `;

    $("#ticketQuantity")?.focus();
}

/* =========================================
   CREATE BOOKING AND SHOW QR CONFIRMATION
   ========================================= */

async function submitBooking(event) {
    event.preventDefault();

    const form = event.target;

    if (form.id !== "bookingForm") return;

    const eventId = Number(form.dataset.eventId);
    const quantityInput = $("#ticketQuantity");
    const quantity = Number(quantityInput.value);
    const button = $("#confirmBookingButton");
    const message = $("#bookingMessage");

    const token = localStorage.getItem("novatix_token");
    const user = getStoredUser();

    if (!token || !user) {
        localStorage.setItem("novatix_pending_event", String(eventId));
        window.location.href = "auth.html?mode=login&return=booking";
        return;
    }

    if (user.role !== "Customer") {
        message.textContent =
            "Only Customer accounts can create bookings.";
        message.className = "alert alert-error";
        return;
    }

    if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > Number(quantityInput.max)
    ) {
        message.textContent = "Please enter a valid ticket quantity.";
        message.className = "alert alert-error";
        return;
    }

    button.disabled = true;
    button.textContent = "Processing Booking...";

    try {
        const response = await fetch(`${API_BASE}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                event_id: eventId,
                ticket_quantity: quantity
            })
        });

        let result;

        try {
            result = await response.json();
        } catch {
            throw new Error("The server returned an invalid response.");
        }

        if (!response.ok || result.success !== true) {
            if (response.status === 401) {
                localStorage.removeItem("novatix_token");
                localStorage.removeItem("novatix_user");
                syncAuthNavigation();
            }

            throw new Error(
                result.message || `Booking failed (${response.status}).`
            );
        }

        const booking = result.data;

        if (!booking || !booking.booking_id) {
            throw new Error("The booking was created but its details were missing.");
        }

        // Refresh ticket availability after a successful booking.
        await loadEvents();

        const qrUrl = booking.qr_code_url;
        let safeQrUrl = "";

        if (typeof qrUrl === "string") {
            try {
                const parsedUrl = new URL(qrUrl);

                if (
                    parsedUrl.protocol === "https:" &&
                    parsedUrl.hostname === "quickchart.io" &&
                    parsedUrl.pathname === "/qr"
                ) {
                    safeQrUrl = parsedUrl.href;
                }
            } catch {
                safeQrUrl = "";
            }
        }

        modalRoot.innerHTML = `
            <div class="modal-backdrop">
                <section class="modal"
                         role="dialog"
                         aria-modal="true"
                         aria-labelledby="bookingSuccessTitle">
                    <div class="modal-body text-center"
                         style="padding:30px">
                        <div class="empty-state-icon"
                             style="margin-inline:auto">✓</div>

                        <span class="eyebrow">BOOKING SUCCESSFUL</span>

                        <h2 id="bookingSuccessTitle"
                            style="margin:12px 0">
                            You're booked!
                        </h2>

                        <p class="text-muted">
                            ${escapeHTML(booking.event_name)}
                        </p>

                        <div class="ticket-card"
                             style="text-align:left;margin-top:24px">
                            <div class="ticket-header">
                                <div class="brand">
                                    <span class="brand-mark">✦</span>
                                    <span class="brand-name">
                                        Nova<span>Tix</span>
                                    </span>
                                </div>

                                <p class="text-muted">
                                    Booking confirmation
                                </p>
                            </div>

                            <div class="ticket-body">
                                <div>
                                    <div class="ticket-field">
                                        <label>Booking ID</label>
                                        <strong>
                                            #${Number(booking.booking_id)}
                                        </strong>
                                    </div>

                                    <div class="ticket-field">
                                        <label>Event</label>
                                        <strong>
                                            ${escapeHTML(booking.event_name)}
                                        </strong>
                                    </div>

                                    <div class="ticket-field">
                                        <label>Ticket quantity</label>
                                        <strong>
                                            ${Number(booking.ticket_quantity)}
                                        </strong>
                                    </div>

                                    <div class="ticket-field">
                                        <label>Status</label>
                                        <span class="status-badge status-confirmed">
                                            ${escapeHTML(booking.booking_status)}
                                        </span>
                                    </div>
                                </div>

                                <div class="ticket-qr">
                                    ${
                                        safeQrUrl
                                            ? `<img
                                                   src="${escapeHTML(safeQrUrl)}"
                                                   alt="QR code for booking ${Number(booking.booking_id)}"
                                               >`
                                            : `<p class="ticket-qr-placeholder">
                                                   QR code is currently unavailable.
                                               </p>`
                                    }
                                </div>
                            </div>
                        </div>

                        <p class="form-help" style="margin-top:15px">
                            Keep your booking ID for reference.
                            QR-code generation does not itself verify entry.
                        </p>

                        <button class="btn btn-primary btn-block"
                                type="button" data-close-modal>
                            Done
                        </button>
                    </div>
                </section>
            </div>
        `;

        showToast("Your booking was created successfully.", "success");
    } catch (error) {
        const currentMessage = $("#bookingMessage");

        if (currentMessage) {
            currentMessage.textContent = error.message;
            currentMessage.className = "alert alert-error";
        } else {
            showToast(error.message, "error");
        }
    } finally {
        const currentButton = $("#confirmBookingButton");

        if (currentButton) {
            currentButton.disabled = false;
            currentButton.textContent = "Confirm Booking →";
        }
    }
}

/* =========================================
   SEARCH
   ========================================= */

heroSearchForm?.addEventListener("submit", event => {
    event.preventDefault();

    state.query = heroSearchInput.value.trim();
    state.page = 1;

    renderEvents();
    renderVenues();

    $("#events")?.scrollIntoView({ behavior: "smooth" });
});

heroSearchInput?.addEventListener("search", () => {
    if (heroSearchInput.value.trim() === "") {
        state.query = "";
        state.page = 1;

        renderEvents();
        renderVenues();
    }
});

/* =========================================
   EVENT FILTERS AND PAGINATION
   ========================================= */

eventFilters?.addEventListener("click", event => {
    const button = event.target.closest("[data-event-filter]");

    if (!button) return;

    state.status = button.dataset.eventFilter;
    state.page = 1;

    eventFilters.querySelectorAll("[data-event-filter]").forEach(chip => {
        chip.classList.toggle("active", chip === button);
    });

    renderEvents();
});

eventPagination?.addEventListener("click", event => {
    const button = event.target.closest("[data-page]");

    if (!button || button.disabled) return;

    const nextPage = Number(button.dataset.page);

    const totalPages = Math.max(
        1,
        Math.ceil(getFilteredEvents().length / state.pageSize)
    );

    if (nextPage < 1 || nextPage > totalPages) return;

    state.page = nextPage;
    renderEvents();

    $("#events")?.scrollIntoView({ behavior: "smooth" });
});

/* =========================================
   EVENT AND VENUE CARD INTERACTIONS
   ========================================= */

eventGrid?.addEventListener("click", event => {
    const retry = event.target.closest('[data-retry="events"]');

    if (retry) {
        loadEvents();
        return;
    }

    if (event.target.closest("[data-clear-search]")) {
        state.query = "";
        state.status = "all";
        state.page = 1;

        if (heroSearchInput) {
            heroSearchInput.value = "";
        }

        eventFilters?.querySelectorAll("[data-event-filter]").forEach(chip => {
            chip.classList.toggle(
                "active",
                chip.dataset.eventFilter === "all"
            );
        });

        renderEvents();
        renderVenues();
        return;
    }

    const detailsButton = event.target.closest("[data-event-details]");

    if (detailsButton) {
        openEventDetails(Number(detailsButton.dataset.eventDetails));
    }
});

venueGrid?.addEventListener("click", event => {
    const retry = event.target.closest('[data-retry="venues"]');

    if (retry) {
        loadVenues();
        return;
    }

    const button = event.target.closest("[data-venue-details]");

    if (button) {
        openVenueDetails(Number(button.dataset.venueDetails));
    }
});

/* =========================================
   MODAL INTERACTIONS

   Registered once to prevent duplicate listeners.
   ========================================= */

modalRoot.addEventListener("click", event => {
    // Close only when the close button or backdrop itself is clicked.
    if (
        event.target.closest("button[data-close-modal]") ||
        event.target.classList.contains("modal-backdrop")
    ) {
        closeModal();
        return;
    }

    const bookingButton = event.target.closest("[data-prepare-booking]");

    if (!bookingButton) return;

    const eventId = Number(bookingButton.dataset.prepareBooking);
    const token = localStorage.getItem("novatix_token");
    const user = getStoredUser();

    // Remember the event while the customer signs in.
    if (!token || !user) {
        localStorage.setItem("novatix_pending_event", String(eventId));

        window.location.href =
            "auth.html?mode=login&return=booking";

        return;
    }

    if (user.role !== "Customer") {
        showToast(
            "Please use a Customer account to book an event.",
            "error"
        );
        return;
    }

    closeModal();
    openBookingForm(eventId);
});

modalRoot.addEventListener("submit", submitBooking);

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeModal();
    }
});

/* =========================================
   VIEW ALL LINKS
   ========================================= */

$("#viewAllEvents")?.addEventListener("click", () => {
    state.query = "";
    state.status = "all";
    state.page = 1;

    if (heroSearchInput) {
        heroSearchInput.value = "";
    }

    eventFilters?.querySelectorAll("[data-event-filter]").forEach(chip => {
        chip.classList.toggle(
            "active",
            chip.dataset.eventFilter === "all"
        );
    });

    renderEvents();
    renderVenues();
});

$("#viewAllVenues")?.addEventListener("click", () => {
    state.query = "";

    if (heroSearchInput) {
        heroSearchInput.value = "";
    }

    renderEvents();
    renderVenues();
});

/* =========================================
   MOBILE NAVIGATION
   ========================================= */

mobileMenuButton?.addEventListener("click", () => {
    const open = primaryNav.classList.toggle("open");

    mobileMenuButton.setAttribute("aria-expanded", String(open));
    mobileMenuButton.textContent = open ? "×" : "☰";
});

primaryNav?.addEventListener("click", event => {
    if (event.target.closest("a")) {
        primaryNav.classList.remove("open");

        mobileMenuButton?.setAttribute("aria-expanded", "false");

        if (mobileMenuButton) {
            mobileMenuButton.textContent = "☰";
        }
    }
});

/* =========================================
   LOGOUT AND ACCOUNT ACTIONS
   ========================================= */

logoutButton?.addEventListener("click", () => {
    localStorage.removeItem("novatix_token");
    localStorage.removeItem("novatix_user");
    localStorage.removeItem("novatix_pending_event");

    closeModal();
    syncAuthNavigation();

    // Remove query parameters such as login=success.
    window.history.replaceState(
        {},
        "",
        window.location.pathname
    );

    showToast("You have been logged out.");
});

myBookingsButton?.addEventListener("click", () => {
    window.location.href = "bookings.html";
});

// Update the header if login state changes in another tab.
window.addEventListener("storage", event => {
    if (
        event.key === "novatix_token" ||
        event.key === "novatix_user" ||
        event.key === null
    ) {
        syncAuthNavigation();
    }
});

/* =========================================
   INITIALISE HOMEPAGE
   ========================================= */

$("#currentYear").textContent = new Date().getFullYear();

// Update the header as soon as the homepage loads.
syncAuthNavigation();

async function initialiseHomepage() {
    await Promise.all([
        loadEvents(),
        loadVenues()
    ]);

    const params = new URLSearchParams(window.location.search);

    const pendingEventId =
        localStorage.getItem("novatix_pending_event");

    const token = localStorage.getItem("novatix_token");
    const user = getStoredUser();

    if (
        params.get("continueBooking") === "1" &&
        pendingEventId &&
        token &&
        user?.role === "Customer"
    ) {
        localStorage.removeItem("novatix_pending_event");

        window.history.replaceState(
            {},
            "",
            window.location.pathname
        );

        openBookingForm(Number(pendingEventId));
    }
}

initialiseHomepage();