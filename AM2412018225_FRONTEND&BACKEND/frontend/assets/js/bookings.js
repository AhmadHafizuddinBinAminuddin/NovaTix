/* =========================================
   NOVATIX — CUSTOMER BOOKINGS
   Uses the existing PHP REST API.
   ========================================= */

const API_BASE = "../api.php";
const $ = selector => document.querySelector(selector);

const bookingsGrid = $("#bookingsGrid");
const bookingsNotice = $("#bookingsNotice");
const bookingSummary = $("#bookingSummary");
const ticketModalRoot = $("#ticketModalRoot");
const toastContainer = $("#toastContainer");

const loginNavLink = $("#loginNavLink");
const registerNavLink = $("#registerNavLink");
const navUserLabel = $("#navUserLabel");
const myBookingsNavLink = $("#myBookingsNavLink");
const logoutButton = $("#logoutButton");
const mobileMenuButton = $("#mobileMenuButton");
const bookingsNav = $("#bookingsNav");

let bookings = [];

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

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem("novatix_user"));
    } catch {
        return null;
    }
}

function getToken() {
    return localStorage.getItem("novatix_token");
}

function showToast(message, type = "") {
    if (!toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", "status");
    toast.textContent = message;

    toastContainer.appendChild(toast);

    window.setTimeout(() => toast.remove(), 4000);
}

function setVisible(element, visible) {
    if (!element) return;

    element.hidden = !visible;
    element.classList.toggle("hidden", !visible);
}

function getStatusClass(status) {
    const classes = {
        Upcoming: "status-upcoming",
        Ongoing: "status-ongoing",
        Completed: "status-completed",
        Cancelled: "status-cancelled",
        Confirmed: "status-confirmed",
        Pending: "status-pending"
    };

    return classes[String(status)] || "status-upcoming";
}

function formatDate(value) {
    if (!value) return "Date unavailable";

    const datePart = String(value).slice(0, 10);
    const date = new Date(`${datePart}T00:00:00`);

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
    const minutes = Number(parts[1] ?? "0");

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

function formatBookingDate(value) {
    if (!value) return "Date unavailable";

    const normalised = String(value).replace(" ", "T");
    const date = new Date(normalised);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return new Intl.DateTimeFormat("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

/* Accept only the expected HTTPS QR-code service URL. */

function getSafeQrUrl(booking) {
    const value = booking.qr_code || booking.qr_code_url;

    if (typeof value !== "string" || !value.trim()) {
        return "";
    }

    try {
        const url = new URL(value);

        if (
            url.protocol === "https:" &&
            url.hostname === "quickchart.io" &&
            url.pathname === "/qr"
        ) {
            return url.href;
        }
    } catch {
        return "";
    }

    return "";
}

/* =========================================
   HEADER AND LOGOUT
   ========================================= */

function syncHeader() {
    const token = getToken();
    const user = getStoredUser();

    const loggedIn = Boolean(token && user && user.role);
    const isCustomer = loggedIn && user.role === "Customer";

    setVisible(loginNavLink, !loggedIn);
    setVisible(registerNavLink, !loggedIn);
    setVisible(logoutButton, loggedIn);
    setVisible(navUserLabel, loggedIn);
    setVisible(myBookingsNavLink, isCustomer);

    if (loggedIn && navUserLabel) {
        const name = String(
            user.full_name || user.name || ""
        ).trim();

        navUserLabel.textContent = name
            ? `Hi, ${name.split(/\s+/)[0]}`
            : "My Account";
    }
}

logoutButton?.addEventListener("click", () => {
    localStorage.removeItem("novatix_token");
    localStorage.removeItem("novatix_user");
    localStorage.removeItem("novatix_pending_event");

    window.location.href = "index.html";
});

mobileMenuButton?.addEventListener("click", () => {
    const isOpen = bookingsNav.classList.toggle("open");

    mobileMenuButton.setAttribute(
        "aria-expanded",
        String(isOpen)
    );

    mobileMenuButton.textContent = isOpen ? "×" : "☰";
});

bookingsNav?.addEventListener("click", event => {
    if (!event.target.closest("a")) return;

    bookingsNav.classList.remove("open");
    mobileMenuButton?.setAttribute("aria-expanded", "false");

    if (mobileMenuButton) {
        mobileMenuButton.textContent = "☰";
    }
});

window.addEventListener("storage", event => {
    if (
        event.key === "novatix_token" ||
        event.key === "novatix_user" ||
        event.key === null
    ) {
        syncHeader();
    }
});

/* =========================================
   PAGE MESSAGES
   ========================================= */

function showNotice(title, message, actionHTML = "") {
    bookingsNotice.hidden = false;

    bookingsNotice.innerHTML = `
        <h2>${escapeHTML(title)}</h2>
        <p>${escapeHTML(message)}</p>
        ${actionHTML}
    `;

    bookingsGrid.innerHTML = "";
    bookingSummary.textContent = "";
}

function showLoading() {
    bookingsNotice.hidden = true;

    bookingsGrid.innerHTML = `
        <div class="loading-state">
            <span class="spinner"></span>
            Loading your bookings...
        </div>
    `;

    bookingSummary.textContent = "Retrieving your reservations...";
}

/* =========================================
   API REQUEST
   ========================================= */

async function apiRequest(path, options = {}) {
    const token = getToken();

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.headers || {}),
            ...(token ? {
                Authorization: `Bearer ${token}`
            } : {})
        }
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || result.success !== true) {
        const error = new Error(
            result.message || `Request failed (${response.status}).`
        );

        error.status = response.status;
        throw error;
    }

    return result;
}

/* =========================================
   LOAD CUSTOMER BOOKINGS
   ========================================= */

async function loadBookings() {
    const token = getToken();
    const user = getStoredUser();

    if (!token || !user) {
        showNotice(
            "Please sign in",
            "Sign in to view your bookings and digital tickets.",
            `
                <a
                    class="btn btn-primary"
                    href="auth.html?mode=login"
                >Login to Your Account →</a>
            `
        );

        return;
    }

    if (user.role !== "Customer") {
        showNotice(
            "Customer access only",
            "My Bookings is available to Customer accounts. Please return to the homepage to continue.",
            `
                <a class="btn btn-primary" href="index.html">
                    Back to Homepage →
                </a>
            `
        );

        return;
    }

    showLoading();

    try {
        const result = await apiRequest("/bookings?page=1&limit=50");

        if (!Array.isArray(result.data)) {
            throw new Error(
                "The API returned an unexpected bookings response."
            );
        }

        bookings = result.data;
        renderBookings();
    } catch (error) {
        if (error.status === 401) {
            localStorage.removeItem("novatix_token");
            localStorage.removeItem("novatix_user");

            syncHeader();

            showNotice(
                "Your session has expired",
                "Please sign in again to access your booking records.",
                `
                    <a
                        class="btn btn-primary"
                        href="auth.html?mode=login"
                    >Login Again →</a>
                `
            );

            return;
        }

        showNotice(
            "Unable to load your bookings",
            error.message,
            `
                <button
                    type="button"
                    class="btn btn-primary"
                    id="retryBookingsButton"
                >Try Again</button>
            `
        );

        $("#retryBookingsButton")?.addEventListener(
            "click",
            loadBookings
        );
    }
}

/* =========================================
   RENDER BOOKINGS
   ========================================= */

function renderBookings() {
    bookingsNotice.hidden = true;

    const total = bookings.length;

    bookingSummary.textContent =
        `${total} ${total === 1 ? "booking" : "bookings"} found`;

    if (total === 0) {
        showNotice(
            "No bookings yet",
            "You have not booked an event yet. Explore our events and find your next experience.",
            `
                <a
                    class="btn btn-primary"
                    href="index.html#events"
                >Explore Events →</a>
            `
        );

        bookingSummary.textContent = "0 bookings";
        return;
    }

    bookingsGrid.innerHTML = bookings.map(booking => {
        const bookingId = Number(booking.booking_id);
        const quantity = Number(booking.ticket_quantity);
        const status = String(booking.booking_status || "Unknown");

        const isCancelled =
            status.trim().toLowerCase() === "cancelled";

        return `
            <article class="booking-card">
                <div class="booking-card-top">
                    <div>
                        <span class="booking-reference">
                            Booking #${bookingId}
                        </span>

                        <h2 class="booking-event-name">
                            ${escapeHTML(booking.event_name)}
                        </h2>
                    </div>

                    <span class="status-badge ${getStatusClass(status)}">
                        ${escapeHTML(status)}
                    </span>
                </div>

                <div class="booking-card-body">
                    <div class="booking-info">
                        <div class="booking-info-item">
                            <span class="booking-info-label">
                                Event Date
                            </span>

                            <strong class="booking-info-value">
                                ${formatDate(booking.event_date)}
                            </strong>
                        </div>

                        <div class="booking-info-item">
                            <span class="booking-info-label">
                                Event Time
                            </span>

                            <strong class="booking-info-value">
                                ${formatTime(booking.event_time)}
                            </strong>
                        </div>

                        <div class="booking-info-item">
                            <span class="booking-info-label">
                                Venue
                            </span>

                            <strong class="booking-info-value">
                                ${escapeHTML(
                                    booking.venue_name || "Venue unavailable"
                                )}
                            </strong>
                        </div>

                        <div class="booking-info-item">
                            <span class="booking-info-label">
                                Ticket Quantity
                            </span>

                            <strong class="booking-info-value">
                                ${Number.isFinite(quantity) ? quantity : "—"}
                            </strong>
                        </div>

                        <div class="booking-info-item">
                            <span class="booking-info-label">
                                Booking Date
                            </span>

                            <strong class="booking-info-value">
                                ${formatBookingDate(booking.booking_date)}
                            </strong>
                        </div>
                    </div>

                    <div class="booking-actions">
                        <button
                            type="button"
                            class="btn btn-primary"
                            data-view-ticket="${bookingId}"
                        >
                            View QR Ticket →
                        </button>

                        ${
                            !isCancelled
                                ? `
                                    <button
                                        type="button"
                                        class="btn btn-danger"
                                        data-cancel-booking="${bookingId}"
                                    >
                                        Cancel Booking
                                    </button>
                                `
                                : `
                                    <span class="form-help">
                                        This booking has been cancelled.
                                    </span>
                                `
                        }
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

/* =========================================
   CANCEL CUSTOMER BOOKING
   ========================================= */

async function cancelBooking(bookingId, button) {
    const booking = bookings.find(
        item => Number(item.booking_id) === Number(bookingId)
    );

    if (!booking) {
        showToast("Booking not found.", "error");
        return;
    }

    const status = String(booking.booking_status || "");

    if (status.trim().toLowerCase() === "cancelled") {
        showToast("This booking has already been cancelled.");
        return;
    }

    const confirmed = window.confirm(
        `Are you sure you want to cancel booking #${bookingId} for "${booking.event_name}"?\n\nThis action cannot be undone from this page.`
    );

    if (!confirmed) return;

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Cancelling...";

    try {
        const result = await apiRequest(
            `/bookings/${encodeURIComponent(bookingId)}`,
            {
                method: "DELETE"
            }
        );

        showToast(
            result.message || `Booking #${bookingId} cancelled successfully.`,
            "success"
        );

        await loadBookings();
    } catch (error) {
        showToast(
            error.message || "Unable to cancel this booking.",
            "error"
        );

        if (button.isConnected) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}

/* =========================================
   VIEW QR TICKET
   ========================================= */

function openTicket(bookingId) {
    const booking = bookings.find(
        item => Number(item.booking_id) === bookingId
    );

    if (!booking) {
        showToast("Booking not found.", "error");
        return;
    }

    const qrUrl = getSafeQrUrl(booking);
    const status = String(booking.booking_status || "Unknown");

    ticketModalRoot.innerHTML = `
        <div class="modal-backdrop" data-ticket-backdrop>
            <section
                class="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ticketModalTitle"
            >
                <div class="modal-header">
                    <h2 id="ticketModalTitle">Your Digital Ticket</h2>

                    <button
                        class="modal-close"
                        type="button"
                        data-close-ticket
                        aria-label="Close ticket"
                    >×</button>
                </div>

                <div class="modal-body ticket-modal-content">
                    <div class="ticket-card">
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

                        <div style="padding:20px">
                            <span class="booking-reference">
                                BOOKING #${Number(booking.booking_id)}
                            </span>

                            <h2 class="ticket-event-title">
                                ${escapeHTML(booking.event_name)}
                            </h2>

                            <div class="ticket-details">
                                <p>
                                    <strong>Date:</strong>
                                    ${formatDate(booking.event_date)}
                                </p>

                                <p>
                                    <strong>Time:</strong>
                                    ${formatTime(booking.event_time)}
                                </p>

                                <p>
                                    <strong>Venue:</strong>
                                    ${escapeHTML(
                                        booking.venue_name || "Venue unavailable"
                                    )}
                                </p>

                                <p>
                                    <strong>Ticket quantity:</strong>
                                    ${Number(booking.ticket_quantity)}
                                </p>

                                <p>
                                    <strong>Booking status:</strong>
                                    <span class="status-badge ${getStatusClass(status)}">
                                        ${escapeHTML(status)}
                                    </span>
                                </p>
                            </div>

                            ${
                                qrUrl
                                    ? `
                                        <img
                                            src="${escapeHTML(qrUrl)}"
                                            class="qr-ticket-image"
                                            alt="QR code for booking ${Number(booking.booking_id)}"
                                            id="ticketQrImage"
                                        >

                                        <p class="form-help">
                                            Keep this QR code available for
                                            your event. Its display does not
                                            itself verify entry.
                                        </p>
                                    `
                                    : `
                                        <div class="alert alert-warning">
                                            A QR code is not available for
                                            this booking.
                                        </div>
                                    `
                            }
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button
                            class="btn btn-primary"
                            type="button"
                            data-print-ticket="${Number(booking.booking_id)}"
                        >
                            Print / Save as PDF
                        </button>

                        <button
                            class="btn btn-secondary"
                            type="button"
                            data-close-ticket
                        >
                            Close
                        </button>
                    </div>
                </div>
            </section>
        </div>
    `;

    const qrImage = $("#ticketQrImage");

    qrImage?.addEventListener("error", () => {
        qrImage.replaceWith(
            Object.assign(document.createElement("p"), {
                className: "alert alert-warning",
                textContent: "The QR image could not be loaded. Please try again later."
            })
        );
    }, { once: true });
}

/* =========================================
   PRINT / SAVE QR TICKET AS PDF
   ========================================= */

function printTicket(bookingId) {
    const booking = bookings.find(
        item => Number(item.booking_id) === Number(bookingId)
    );

    if (!booking) {
        showToast("Booking not found.", "error");
        return;
    }

    const qrUrl = getSafeQrUrl(booking);

    const printWindow = window.open(
        "",
        "_blank",
        "width=800,height=900"
    );

    if (!printWindow) {
        showToast(
            "The print window was blocked. Allow pop-ups and try again.",
            "error"
        );
        return;
    }

    const eventName = escapeHTML(
        booking.event_name || "Event unavailable"
    );

    const venueName = escapeHTML(
        booking.venue_name || "Venue unavailable"
    );

    const bookingStatus = escapeHTML(
        booking.booking_status || "Unknown"
    );

    const bookingIdText = escapeHTML(
        String(booking.booking_id)
    );

    const ticketQuantity = escapeHTML(
        String(booking.ticket_quantity ?? "—")
    );

    const eventDate = formatDate(booking.event_date);
    const eventTime = formatTime(booking.event_time);
    const bookingDate = formatBookingDate(booking.booking_date);

    const qrContent = qrUrl
        ? `
            <div class="qr-section">
                <img
                    id="printQrImage"
                    src="${escapeHTML(qrUrl)}"
                    alt="QR code for booking ${bookingIdText}"
                >
                <p>Keep this QR code available for your event.</p>
            </div>
        `
        : `
            <p class="warning">
                A QR code is not available for this booking.
            </p>
        `;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            >
            <title>NovaTix Ticket - Booking #${bookingIdText}</title>

            <style>
                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    padding: 30px;
                    background: #f4f1ff;
                    color: #252044;
                    font-family: Arial, sans-serif;
                }

                .ticket {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 30px;
                    background: #fff;
                    border: 1px solid #ded7f5;
                    border-radius: 16px;
                }

                .brand {
                    margin-bottom: 8px;
                    color: #7950d9;
                    font-size: 28px;
                    font-weight: bold;
                }

                .subtitle {
                    margin: 0 0 24px;
                    color: #6d6880;
                    font-size: 14px;
                }

                .reference {
                    color: #7950d9;
                    font-size: 13px;
                    font-weight: bold;
                    letter-spacing: 1px;
                }

                h1 {
                    margin: 12px 0 24px;
                    overflow-wrap: anywhere;
                    font-size: 25px;
                }

                .details {
                    padding: 18px;
                    background: #f8f6ff;
                    border-radius: 10px;
                }

                .detail {
                    margin: 0 0 15px;
                    line-height: 1.5;
                    overflow-wrap: anywhere;
                }

                .detail:last-child {
                    margin-bottom: 0;
                }

                .label {
                    display: block;
                    margin-bottom: 4px;
                    color: #6d6880;
                    font-size: 12px;
                }

                .value {
                    font-size: 15px;
                    font-weight: bold;
                }

                .status {
                    display: inline-block;
                    padding: 5px 10px;
                    border-radius: 20px;
                    background: #e5f7ed;
                    color: #17683d;
                    font-size: 13px;
                }

                .qr-section {
                    margin-top: 25px;
                    text-align: center;
                }

                .qr-section img {
                    display: block;
                    width: 220px;
                    height: 220px;
                    max-width: 100%;
                    margin: 0 auto 12px;
                    object-fit: contain;
                }

                .qr-section p {
                    color: #6d6880;
                    font-size: 12px;
                }

                .warning {
                    margin-top: 24px;
                    padding: 12px;
                    background: #fff2d8;
                    color: #815400;
                    text-align: center;
                }

                .footer {
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1px dashed #ded7f5;
                    color: #6d6880;
                    font-size: 11px;
                    line-height: 1.5;
                    text-align: center;
                }

                .print-button {
                    display: block;
                    margin: 20px auto 0;
                    padding: 12px 22px;
                    border: none;
                    border-radius: 8px;
                    background: #7950d9;
                    color: #fff;
                    cursor: pointer;
                    font-size: 14px;
                }

                @media print {
                    @page {
                        size: A4;
                        margin: 15mm;
                    }

                    body {
                        padding: 0;
                        background: #fff;
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }

                    .ticket {
                        max-width: 100%;
                        border: 1px solid #ded7f5;
                        border-radius: 10px;
                    }

                    .print-button {
                        display: none;
                    }
                }
            </style>
        </head>

        <body>
            <main class="ticket">
                <div class="brand">✦ NovaTix</div>

                <p class="subtitle">
                    Event Ticket and Booking Confirmation
                </p>

                <div class="reference">
                    BOOKING #${bookingIdText}
                </div>

                <h1>${eventName}</h1>

                <section class="details">
                    <p class="detail">
                        <span class="label">Event Date</span>
                        <span class="value">${eventDate}</span>
                    </p>

                    <p class="detail">
                        <span class="label">Event Time</span>
                        <span class="value">${eventTime}</span>
                    </p>

                    <p class="detail">
                        <span class="label">Venue</span>
                        <span class="value">${venueName}</span>
                    </p>

                    <p class="detail">
                        <span class="label">Ticket Quantity</span>
                        <span class="value">${ticketQuantity}</span>
                    </p>

                    <p class="detail">
                        <span class="label">Booking Date</span>
                        <span class="value">${bookingDate}</span>
                    </p>

                    <p class="detail">
                        <span class="label">Booking Status</span>
                        <span class="status">${bookingStatus}</span>
                    </p>
                </section>

                ${qrContent}

                <div class="footer">
                    NovaTix Event Ticketing and Venue Booking System.<br>
                    Displaying this QR code does not itself verify entry.
                </div>

                <button
                    class="print-button"
                    onclick="window.print()"
                >
                    Print / Save as PDF
                </button>
            </main>

            <script>
                let printStarted = false;

                function startPrinting() {
                    if (printStarted) return;

                    printStarted = true;

                    window.setTimeout(() => window.print(), 300);
                }

                const qrImage = document.getElementById("printQrImage");

                if (qrImage) {
                    if (qrImage.complete && qrImage.naturalWidth > 0) {
                        startPrinting();
                    } else {
                        qrImage.addEventListener(
                            "load",
                            startPrinting,
                            { once: true }
                        );

                        qrImage.addEventListener(
                            "error",
                            startPrinting,
                            { once: true }
                        );

                        window.setTimeout(startPrinting, 3000);
                    }
                } else {
                    startPrinting();
                }
            <\/script>
        </body>
        </html>
    `);

    printWindow.document.close();
}

/* =========================================
   EVENT LISTENERS
   ========================================= */

bookingsGrid?.addEventListener("click", async event => {
    const cancelButton = event.target.closest("[data-cancel-booking]");

    if (cancelButton) {
        await cancelBooking(
            Number(cancelButton.dataset.cancelBooking),
            cancelButton
        );

        return;
    }

    const viewButton = event.target.closest("[data-view-ticket]");

    if (viewButton) {
        openTicket(Number(viewButton.dataset.viewTicket));
    }
});

ticketModalRoot?.addEventListener("click", event => {
    const printButton = event.target.closest("[data-print-ticket]");

    if (printButton) {
        printTicket(Number(printButton.dataset.printTicket));
        return;
    }

    if (
        event.target.closest("[data-close-ticket]") ||
        event.target.hasAttribute("data-ticket-backdrop")
    ) {
        ticketModalRoot.innerHTML = "";
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        ticketModalRoot.innerHTML = "";
    }
});

/* =========================================
   INITIALISE PAGE
   ========================================= */

$("#currentYear").textContent = new Date().getFullYear();

syncHeader();
loadBookings();