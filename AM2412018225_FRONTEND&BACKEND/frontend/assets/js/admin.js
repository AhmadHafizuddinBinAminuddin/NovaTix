/* =========================================
   NOVATIX ADMIN DASHBOARD
   Users, bookings, QR tickets and analytics.
   Uses existing API endpoints only.
   ========================================= */

const API_BASE = "../api.php";
const $ = selector => document.querySelector(selector);

const userForm = $("#userForm");
const usersTableBody = $("#usersTableBody");
const bookingsTableBody = $("#bookingsTableBody");
const userSearch = $("#userSearch");
const roleFilter = $("#roleFilter");
const bookingSearch = $("#bookingSearch");
const bookingStatusFilter = $("#bookingStatusFilter");
const adminMessage = $("#adminMessage");
const toastContainer = $("#toastContainer");
const adminModalRoot = $("#adminModalRoot");

let users = [];
let allEvents = null;
let allVenues = null;
let allBookings = null;
let currentAdmin = null;
let bookingPage = 1;

const BOOKING_PAGE_SIZE = 10;

/* =========================================
   HELPERS
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

function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = isError ? "toast error" : "toast";
    toast.setAttribute("role", "status");
    toast.textContent = message;

    toastContainer.appendChild(toast);
    window.setTimeout(() => toast.remove(), 4500);
}

function showAdminMessage(message) {
    adminMessage.hidden = false;
    adminMessage.textContent = message;
}

function hideAdminMessage() {
    adminMessage.hidden = true;
    adminMessage.textContent = "";
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return date.toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function formatDateTime(value) {
    if (!value) return "—";

    const date = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return date.toLocaleString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatTime(value) {
    if (!value) return "—";

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

function getStatusClass(status) {
    const classes = {
        Confirmed: "status-confirmed",
        Pending: "status-pending",
        Cancelled: "status-cancelled",
        Upcoming: "status-upcoming",
        Ongoing: "status-ongoing",
        Completed: "status-completed"
    };

    return classes[String(status)] || "";
}

function closeAdminModal() {
    adminModalRoot.innerHTML = "";
}

/* =========================================
   ACCESS CONTROL
   ========================================= */

function checkAdminAccess() {
    const token = getToken();
    const user = getStoredUser();

    if (!token || !user) {
        window.location.href = "auth.html?mode=login";
        return false;
    }

    if (user.role !== "Administrator") {
        document.querySelector("main").innerHTML = `
            <section class="container section">
                <div class="panel" style="padding:32px">
                    <h1>Access Restricted</h1>
                    <p class="text-muted">
                        Only Administrator accounts can access this dashboard.
                    </p>
                    <a href="index.html" class="btn btn-primary">
                        Return to Homepage →
                    </a>
                </div>
            </section>
        `;

        return false;
    }

    currentAdmin = user;

    $("#adminUserLabel").textContent =
        user.full_name || user.name || "Administrator";

    return true;
}

/* =========================================
   LOGOUT AND MOBILE MENU
   ========================================= */

$("#adminLogout").addEventListener("click", () => {
    localStorage.removeItem("novatix_token");
    localStorage.removeItem("novatix_user");
    localStorage.removeItem("novatix_pending_event");

    window.location.href = "index.html";
});

$("#adminMobileMenu").addEventListener("click", () => {
    const nav = $("#adminNav");
    const button = $("#adminMobileMenu");
    const opened = nav.classList.toggle("open");

    button.setAttribute("aria-expanded", String(opened));
    button.textContent = opened ? "×" : "☰";
});

/* =========================================
   API REQUESTS
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

async function handleApiError(error) {
    showToast(error.message, true);

    if (error.status === 401) {
        window.setTimeout(() => {
            window.location.href = "auth.html?mode=login";
        }, 900);
    }
}

/* Retrieve all pages from an existing paginated endpoint. */

async function fetchAllPages(path) {
    const first = await apiRequest(`${path}?page=1&limit=50`);

    if (!Array.isArray(first.data)) {
        throw new Error(`Unexpected response from ${path}.`);
    }

    const totalPages = Math.max(
        1,
        Number(first.pagination?.total_pages) || 1
    );

    const remainingRequests = [];

    for (let page = 2; page <= totalPages; page++) {
        remainingRequests.push(
            apiRequest(`${path}?page=${page}&limit=50`)
        );
    }

    const remaining = await Promise.all(remainingRequests);

    return [
        ...first.data,
        ...remaining.flatMap(result =>
            Array.isArray(result.data) ? result.data : []
        )
    ];
}

/* =========================================
   DASHBOARD DATA AND STATISTICS
   ========================================= */

async function loadDashboard() {
    hideAdminMessage();

    $("#totalUsers").textContent = "…";
    $("#totalEvents").textContent = "…";
    $("#totalVenues").textContent = "…";
    $("#totalBookings").textContent = "…";

    usersTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="admin-table-empty">
                Loading user accounts...
            </td>
        </tr>
    `;

    bookingsTableBody.innerHTML = `
        <tr>
            <td colspan="7" class="admin-table-empty">
                Loading bookings...
            </td>
        </tr>
    `;

    /*
     * Load users separately so a problem with booking analytics
     * cannot prevent the main user-management table from working.
     */
    try {
        const result = await apiRequest("/users");

        if (!Array.isArray(result.data)) {
            throw new Error("The Users API returned an unexpected response.");
        }

        users = result.data;
        renderUsers();
        updateUserCount();
    } catch (error) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="admin-table-empty">
                    Unable to load user accounts.
                </td>
            </tr>
        `;

        showAdminMessage(error.message);
        await handleApiError(error);

        return;
    }

    const requests = await Promise.allSettled([
        fetchAllPages("/events"),
        fetchAllPages("/venues"),
        fetchAllPages("/bookings")
    ]);

    allEvents = requests[0].status === "fulfilled"
        ? requests[0].value : null;

    allVenues = requests[1].status === "fulfilled"
        ? requests[1].value : null;

    allBookings = requests[2].status === "fulfilled"
        ? requests[2].value : null;

    $("#totalEvents").textContent =
        allEvents === null ? "—" : allEvents.length;

    $("#totalVenues").textContent =
        allVenues === null ? "—" : allVenues.length;

    $("#totalBookings").textContent =
        allBookings === null ? "—" : allBookings.length;

    if (allBookings !== null) {
        bookingPage = 1;
        renderBookings();
    } else {
        bookingsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="admin-table-empty">
                    Unable to load bookings. Refresh to try again.
                </td>
            </tr>
        `;

        $("#bookingResults").textContent = "";
        $("#bookingPageInfo").textContent = "Booking data unavailable";
    }

    renderAnalytics();

    const failedSections = [];

    if (requests[0].status === "rejected") failedSections.push("events");
    if (requests[1].status === "rejected") failedSections.push("venues");
    if (requests[2].status === "rejected") failedSections.push("bookings");

    if (failedSections.length) {
        showAdminMessage(
            `Some information could not be loaded: ${failedSections.join(", ")}. ` +
            "User management remains available."
        );
    }

    const authError = requests.some(item =>
        item.status === "rejected" && item.reason?.status === 401
    );

    if (authError) {
        window.setTimeout(() => {
            window.location.href = "auth.html?mode=login";
        }, 900);
    }
}

function updateUserCount() {
    $("#totalUsers").textContent = users.length;
}

/* =========================================
   NAVIGATION TABS
   ========================================= */

const tabDefinitions = {
    users: {
        button: $("#usersTab"),
        section: $("#usersSection")
    },
    bookings: {
        button: $("#bookingsTab"),
        section: $("#bookingsSection")
    },
    analytics: {
        button: $("#analyticsTab"),
        section: $("#analyticsSection")
    }
};

function showTab(name) {
    for (const [key, tab] of Object.entries(tabDefinitions)) {
        const active = key === name;

        tab.section.hidden = !active;
        tab.button.classList.toggle("active", active);
        tab.button.setAttribute("aria-selected", String(active));
    }
}

for (const [key, tab] of Object.entries(tabDefinitions)) {
    tab.button.addEventListener("click", () => showTab(key));
}

/* =========================================
   USER MANAGEMENT
   ========================================= */

function getFilteredUsers() {
    const query = userSearch.value.trim().toLowerCase();
    const selectedRole = roleFilter.value;

    return users.filter(user => {
        const searchable = [
            user.user_id,
            user.full_name,
            user.email
        ].join(" ").toLowerCase();

        return (
            (!query || searchable.includes(query)) &&
            (selectedRole === "all" || user.role === selectedRole)
        );
    });
}

function renderUsers() {
    const filtered = getFilteredUsers();

    $("#userResults").textContent =
        `${filtered.length} of ${users.length} user accounts`;

    if (!filtered.length) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="admin-table-empty">
                    No matching user accounts found.
                </td>
            </tr>
        `;

        return;
    }

    usersTableBody.innerHTML = filtered.map(user => {
        const id = Number(user.user_id);
        const isSelf = Number(currentAdmin?.user_id) === id;

        return `
            <tr>
                <td>${id}</td>
                <td>
                    ${escapeHTML(user.full_name)}
                    ${isSelf ? '<div class="admin-muted">Your account</div>' : ""}
                </td>
                <td>${escapeHTML(user.email)}</td>
                <td>
                    <span class="role-badge">
                        ${escapeHTML(user.role)}
                    </span>
                </td>
                <td>${formatDate(user.created_at)}</td>
                <td>
                    <div class="admin-actions">
                        <button
                            class="btn btn-secondary btn-sm"
                            type="button"
                            data-edit-user="${id}"
                        >Edit</button>

                        <button
                            class="btn btn-ghost btn-sm"
                            type="button"
                            data-delete-user="${id}"
                            ${isSelf ? "disabled" : ""}
                        >Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

userSearch.addEventListener("input", renderUsers);
roleFilter.addEventListener("change", renderUsers);

$("#refreshUsers").addEventListener("click", loadDashboard);
$("#refreshBookings").addEventListener("click", loadDashboard);
$("#refreshAnalytics").addEventListener("click", loadDashboard);

function openUserForm(id) {
    const user = users.find(item => Number(item.user_id) === id);

    if (!user) {
        showToast("User account not found.", true);
        return;
    }

    userForm.reset();

    $("#editUserId").value = user.user_id;
    $("#editFullName").value = user.full_name || "";
    $("#editEmail").value = user.email || "";
    $("#editRole").value = user.role || "Customer";

    const isSelf = Number(currentAdmin?.user_id) === id;
    $("#editRole").disabled = isSelf;

    $("#userFormTitle").textContent = `Edit User #${id}`;
    userForm.hidden = false;

    userForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function resetUserForm() {
    userForm.reset();
    $("#editUserId").value = "";
    $("#editRole").disabled = false;
    userForm.hidden = true;
}

$("#cancelUserEdit").addEventListener("click", resetUserForm);

usersTableBody.addEventListener("click", async event => {
    const editButton = event.target.closest("[data-edit-user]");
    const deleteButton = event.target.closest("[data-delete-user]");

    if (editButton) {
        openUserForm(Number(editButton.dataset.editUser));
        return;
    }

    if (!deleteButton || deleteButton.disabled) return;

    const id = Number(deleteButton.dataset.deleteUser);
    const user = users.find(item => Number(item.user_id) === id);

    if (!user) return;

    if (!window.confirm(
        `Delete the account for ${user.full_name} (${user.email})?\n\n` +
        "Accounts connected to bookings may not be deletable."
    )) {
        return;
    }

    deleteButton.disabled = true;

    try {
        const result = await apiRequest(`/users/${id}`, "DELETE");
        resetUserForm();
        await loadDashboard();
        showToast(result.message || "User deleted successfully.");
    } catch (error) {
        await handleApiError(error);
    } finally {
        if (deleteButton.isConnected) deleteButton.disabled = false;
    }
});

userForm.addEventListener("submit", async event => {
    event.preventDefault();

    const id = Number($("#editUserId").value);

    const body = {
        full_name: $("#editFullName").value.trim(),
        email: $("#editEmail").value.trim(),
        role: $("#editRole").value
    };

    if (!id || !body.full_name || !body.email) {
        showToast("Please enter a name and valid email address.", true);
        return;
    }

    const saveButton = $("#saveUserButton");
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        const result = await apiRequest(`/users/${id}`, "PUT", body);

        if (result.data) {
            users = users.map(user =>
                Number(user.user_id) === id ? result.data : user
            );

            if (Number(currentAdmin?.user_id) === id) {
                currentAdmin = {
                    ...currentAdmin,
                    full_name: result.data.full_name,
                    email: result.data.email,
                    role: result.data.role
                };

                localStorage.setItem(
                    "novatix_user",
                    JSON.stringify(currentAdmin)
                );

                $("#adminUserLabel").textContent = currentAdmin.full_name;
            }
        }

        resetUserForm();
        renderUsers();
        updateUserCount();
        renderAnalytics();

        showToast(result.message || "User updated successfully.");
    } catch (error) {
        await handleApiError(error);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
});

/* =========================================
   BOOKING SEARCH, FILTERS AND PAGINATION
   ========================================= */

function getFilteredBookings() {
    if (!Array.isArray(allBookings)) return [];

    const query = bookingSearch.value.trim().toLowerCase();
    const status = bookingStatusFilter.value;

    return allBookings.filter(booking => {
        const searchable = [
            booking.booking_id,
            booking.full_name,
            booking.event_name,
            booking.venue_name,
            booking.user_id,
            booking.event_id
        ].join(" ").toLowerCase();

        return (
            (!query || searchable.includes(query)) &&
            (status === "all" || booking.booking_status === status)
        );
    });
}

function renderBookings() {
    if (!Array.isArray(allBookings)) return;

    const filtered = getFilteredBookings();
    const totalPages = Math.max(
        1,
        Math.ceil(filtered.length / BOOKING_PAGE_SIZE)
    );

    if (bookingPage > totalPages) bookingPage = totalPages;
    if (bookingPage < 1) bookingPage = 1;

    const start = (bookingPage - 1) * BOOKING_PAGE_SIZE;
    const visible = filtered.slice(start, start + BOOKING_PAGE_SIZE);

    $("#bookingResults").textContent =
        `${filtered.length} matching bookings`;

    $("#bookingPageInfo").textContent =
        `Page ${bookingPage} of ${totalPages}`;

    $("#previousBookings").disabled = bookingPage <= 1;
    $("#nextBookings").disabled = bookingPage >= totalPages;

    if (!visible.length) {
        bookingsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="admin-table-empty">
                    No matching bookings found.
                </td>
            </tr>
        `;
        return;
    }

    bookingsTableBody.innerHTML = visible.map(booking => {
        const id = Number(booking.booking_id);
        const status = String(booking.booking_status || "Unknown");
        const canManage = status === "Confirmed";

        return `
            <tr>
                <td>#${id}</td>

                <td>
                    ${escapeHTML(booking.full_name || "Unknown")}
                    <div class="admin-muted">
                        User ID: ${Number(booking.user_id) || "—"}
                    </div>
                </td>

                <td>${escapeHTML(booking.event_name || "Unknown event")}</td>

                <td>${formatDate(booking.event_date)}</td>

                <td>${Number(booking.ticket_quantity) || 0}</td>

                <td>
                    <span class="booking-status-badge ${getStatusClass(status)}">
                        ${escapeHTML(status)}
                    </span>
                </td>

                <td>
                    <div class="admin-actions">
                        <button
                            class="btn btn-primary btn-sm"
                            type="button"
                            data-view-booking="${id}"
                        >View QR</button>

                        ${
                            canManage
                                ? `
                                    <button
                                        class="btn btn-secondary btn-sm"
                                        type="button"
                                        data-edit-quantity="${id}"
                                    >Quantity</button>

                                    <button
                                        class="btn btn-ghost btn-sm"
                                        type="button"
                                        data-cancel-booking="${id}"
                                    >Cancel</button>
                                `
                                : ""
                        }
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

bookingSearch.addEventListener("input", () => {
    bookingPage = 1;
    renderBookings();
});

bookingStatusFilter.addEventListener("change", () => {
    bookingPage = 1;
    renderBookings();
});

$("#previousBookings").addEventListener("click", () => {
    bookingPage--;
    renderBookings();
});

$("#nextBookings").addEventListener("click", () => {
    bookingPage++;
    renderBookings();
});

/* =========================================
   BOOKING DETAILS AND QR TICKET VIEWER
   ========================================= */

function getSafeQrUrl(booking) {
    const value = booking.qr_code_url || booking.qr_code;

    if (typeof value !== "string" || !value.trim()) return "";

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

async function openBookingTicket(id) {
    try {
        const result = await apiRequest(`/bookings/${id}`);
        const booking = result.data;

        if (!booking) {
            throw new Error("The booking details were not returned.");
        }

        const qrUrl = getSafeQrUrl(booking);
        const status = String(booking.booking_status || "Unknown");

        adminModalRoot.innerHTML = `
            <div class="modal-backdrop" data-close-admin-modal>
                <section
                    class="modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="ticketModalTitle"
                >
                    <div class="modal-header">
                        <h2 id="ticketModalTitle">Customer QR Ticket</h2>

                        <button
                            class="modal-close"
                            type="button"
                            data-close-admin-modal
                            aria-label="Close"
                        >×</button>
                    </div>

                    <div class="modal-body ticket-view">
                        <div class="ticket-card">
                            <div class="ticket-header">
                                <div class="brand">
                                    <span class="brand-mark">✦</span>
                                    <span class="brand-name">
                                        Nova<span>Tix</span>
                                    </span>
                                </div>

                                <p class="text-muted">Booking details</p>
                            </div>

                            <div style="padding:20px">
                                <p class="admin-muted">
                                    Booking #${Number(booking.booking_id)}
                                </p>

                                <h2 style="margin:10px 0 18px">
                                    ${escapeHTML(booking.event_name)}
                                </h2>

                                <div class="ticket-detail-lines">
                                    <div>
                                        <strong>Customer:</strong>
                                        ${escapeHTML(booking.full_name)}
                                    </div>

                                    <div>
                                        <strong>User ID:</strong>
                                        ${Number(booking.user_id)}
                                    </div>

                                    <div>
                                        <strong>Event date:</strong>
                                        ${formatDate(booking.event_date)}
                                    </div>

                                    <div>
                                        <strong>Event time:</strong>
                                        ${formatTime(booking.event_time)}
                                    </div>

                                    <div>
                                        <strong>Venue:</strong>
                                        ${escapeHTML(booking.venue_name || "—")}
                                    </div>

                                    <div>
                                        <strong>Address:</strong>
                                        ${escapeHTML(booking.venue_address || "—")}
                                    </div>

                                    <div>
                                        <strong>Ticket quantity:</strong>
                                        ${Number(booking.ticket_quantity)}
                                    </div>

                                    <div>
                                        <strong>Booking date:</strong>
                                        ${formatDateTime(booking.booking_date)}
                                    </div>

                                    <div>
                                        <strong>Status:</strong>
                                        <span class="booking-status-badge ${getStatusClass(status)}">
                                            ${escapeHTML(status)}
                                        </span>
                                    </div>
                                </div>

                                ${
                                    qrUrl
                                        ? `
                                            <img
                                                src="${escapeHTML(qrUrl)}"
                                                alt="QR code for booking ${Number(booking.booking_id)}"
                                                class="qr-image"
                                                id="adminQrImage"
                                            >
                                            <p class="form-help">
                                                This displays the stored booking QR code.
                                                It does not validate event entry.
                                            </p>
                                        `
                                        : `
                                            <div class="alert alert-warning">
                                                A QR code is unavailable for this booking.
                                            </div>
                                        `
                                }
                            </div>
                        </div>

                        <div class="modal-footer">
                            <button
                                class="btn btn-secondary"
                                type="button"
                                data-close-admin-modal
                            >Close</button>
                        </div>
                    </div>
                </section>
            </div>
        `;

        const image = $("#adminQrImage");

        image?.addEventListener("error", () => {
            const warning = document.createElement("p");
            warning.className = "alert alert-warning";
            warning.textContent = "The QR image could not be loaded.";

            image.replaceWith(warning);
        }, { once: true });

    } catch (error) {
        await handleApiError(error);
    }
}

/* =========================================
   UPDATE BOOKING QUANTITY
   ========================================= */

function openQuantityForm(id) {
    const booking = allBookings?.find(
        item => Number(item.booking_id) === id
    );

    if (!booking || booking.booking_status !== "Confirmed") {
        showToast("Only confirmed bookings can be edited.", true);
        return;
    }

    adminModalRoot.innerHTML = `
        <div class="modal-backdrop" data-close-admin-modal>
            <section
                class="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="quantityModalTitle"
            >
                <div class="modal-header">
                    <h2 id="quantityModalTitle">Update Ticket Quantity</h2>

                    <button
                        class="modal-close"
                        type="button"
                        data-close-admin-modal
                        aria-label="Close"
                    >×</button>
                </div>

                <div class="modal-body">
                    <p>
                        <strong>${escapeHTML(booking.event_name)}</strong>
                    </p>

                    <p class="admin-muted">
                        Booking #${id} · ${escapeHTML(booking.full_name)}
                    </p>

                    <form id="quantityEditForm" data-booking-id="${id}">
                        <div class="form-group">
                            <label for="newTicketQuantity">
                                New ticket quantity
                            </label>

                            <input
                                class="form-control"
                                type="number"
                                id="newTicketQuantity"
                                name="ticket_quantity"
                                min="1"
                                step="1"
                                value="${Number(booking.ticket_quantity)}"
                                required
                            >

                            <p class="form-help">
                                The API checks availability and only permits
                                valid changes to confirmed bookings.
                            </p>
                        </div>

                        <div class="modal-footer">
                            <button class="btn btn-secondary"
                                    type="button" data-close-admin-modal>
                                Close
                            </button>

                            <button class="btn btn-primary"
                                    id="saveQuantityButton" type="submit">
                                Save Quantity
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        </div>
    `;

    $("#newTicketQuantity")?.focus();
}

adminModalRoot.addEventListener("submit", async event => {
    if (event.target.id !== "quantityEditForm") return;

    event.preventDefault();

    const form = event.target;
    const id = Number(form.dataset.bookingId);
    const input = $("#newTicketQuantity");
    const quantity = Number(input.value);
    const button = $("#saveQuantityButton");

    if (!Number.isInteger(quantity) || quantity < 1) {
        showToast("Enter a positive whole number of tickets.", true);
        return;
    }

    button.disabled = true;
    button.textContent = "Saving...";

    try {
        const result = await apiRequest(
            `/bookings/${id}`,
            "PATCH",
            { ticket_quantity: quantity }
        );

        closeAdminModal();
        showToast(result.message || "Booking quantity updated.");

        await loadDashboard();
        showTab("bookings");
    } catch (error) {
        await handleApiError(error);
    } finally {
        const currentButton = $("#saveQuantityButton");

        if (currentButton) {
            currentButton.disabled = false;
            currentButton.textContent = "Save Quantity";
        }
    }
});

/* =========================================
   CANCEL BOOKING
   ========================================= */

async function cancelBooking(id) {
    const booking = allBookings?.find(
        item => Number(item.booking_id) === id
    );

    if (!booking || booking.booking_status !== "Confirmed") {
        showToast("Only confirmed bookings can be cancelled.", true);
        return;
    }

    const confirmed = window.confirm(
        `Cancel booking #${id} for ${booking.full_name}?\n\n` +
        "The API will decide whether this booking is eligible for cancellation."
    );

    if (!confirmed) return;

    try {
        const result = await apiRequest(`/bookings/${id}`, "DELETE");

        showToast(result.message || "Booking cancelled.");
        await loadDashboard();
        showTab("bookings");
    } catch (error) {
        await handleApiError(error);
    }
}

bookingsTableBody.addEventListener("click", event => {
    const viewButton = event.target.closest("[data-view-booking]");
    const editButton = event.target.closest("[data-edit-quantity]");
    const cancelButton = event.target.closest("[data-cancel-booking]");

    if (viewButton) {
        openBookingTicket(Number(viewButton.dataset.viewBooking));
        return;
    }

    if (editButton) {
        openQuantityForm(Number(editButton.dataset.editQuantity));
        return;
    }

    if (cancelButton) {
        cancelBooking(Number(cancelButton.dataset.cancelBooking));
    }
});

adminModalRoot.addEventListener("click", event => {
    if (
        event.target.closest("[data-close-admin-modal]") ||
        event.target.classList.contains("modal-backdrop")
    ) {
        closeAdminModal();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeAdminModal();
});

/* =========================================
   ANALYTICS CHARTS
   ========================================= */

function renderBarChart(container, items, emptyMessage) {
    if (!container) return;

    if (!items) {
        container.innerHTML = `
            <p class="admin-muted">Data unavailable from the API.</p>
        `;
        return;
    }

    const total = items.reduce((sum, item) => sum + item.count, 0);

    if (total === 0) {
        container.innerHTML = `
            <p class="admin-muted">${escapeHTML(emptyMessage)}</p>
        `;
        return;
    }

    container.innerHTML = items.map(item => {
        const percentage = total > 0
            ? Math.max(0, Math.min(100, item.count / total * 100))
            : 0;

        return `
            <div class="analytics-row">
                <div class="analytics-label-row">
                    <span>${escapeHTML(item.label)}</span>
                    <strong>${item.count}</strong>
                </div>

                <div class="analytics-track">
                    <div
                        class="analytics-bar ${item.color || ""}"
                        style="width:${percentage}%"
                        role="img"
                        aria-label="${escapeHTML(item.label)}: ${item.count}"
                    ></div>
                </div>
            </div>
        `;
    }).join("");
}

function countBy(items, field, values) {
    if (!items) return null;

    return values.map((value, index) => ({
        label: value,
        count: items.filter(item => item[field] === value).length,
        color: ["", "green", "orange", "blue"][index % 4]
    }));
}

function renderAnalytics() {
    renderBarChart(
        $("#userRoleChart"),
        countBy(users, "role", [
            "Customer",
            "Staff",
            "Administrator"
        ]),
        "No user records available."
    );

    renderBarChart(
        $("#bookingStatusChart"),
        countBy(allBookings, "booking_status", [
            "Confirmed",
            "Pending",
            "Cancelled"
        ]),
        "No booking records available."
    );

    renderBarChart(
        $("#eventStatusChart"),
        countBy(allEvents, "status", [
            "Upcoming",
            "Ongoing",
            "Completed",
            "Cancelled"
        ]),
        "No event records available."
    );

    renderTicketInventory();
}

function renderTicketInventory() {
    const container = $("#ticketInventorySummary");

    if (!allEvents) {
        container.innerHTML = `
            <p class="admin-muted">Event data unavailable.</p>
        `;
        return;
    }

    const totalTickets = allEvents.reduce(
        (sum, event) => sum + Math.max(0, Number(event.total_tickets) || 0),
        0
    );

    const availableTickets = allEvents.reduce(
        (sum, event) => sum + Math.max(0, Number(event.available_tickets) || 0),
        0
    );

    const soldTickets = Math.max(0, totalTickets - availableTickets);

    const soldPercentage = totalTickets > 0
        ? Math.min(100, soldTickets / totalTickets * 100)
        : 0;

    container.innerHTML = `
        <div class="analytics-row">
            <div class="analytics-label-row">
                <span>Total Ticket Capacity</span>
                <strong>${totalTickets.toLocaleString("en-MY")}</strong>
            </div>
        </div>

        <div class="analytics-row">
            <div class="analytics-label-row">
                <span>Tickets Available</span>
                <strong>${availableTickets.toLocaleString("en-MY")}</strong>
            </div>
        </div>

        <div class="analytics-row">
            <div class="analytics-label-row">
                <span>Tickets Booked</span>
                <strong>${soldTickets.toLocaleString("en-MY")}</strong>
            </div>

            <div class="analytics-track">
                <div
                    class="analytics-bar green"
                    style="width:${soldPercentage}%"
                    role="img"
                    aria-label="${soldTickets} tickets booked out of ${totalTickets}"
                ></div>
            </div>
        </div>

        <p class="form-help">
            Booked tickets are estimated as total capacity minus
            available tickets.
        </p>
    `;
}

/* =========================================
   PAGE INITIALISATION
   ========================================= */

$("#currentYear").textContent = new Date().getFullYear();

bookingSearch.value = "";
bookingStatusFilter.value = "all";

if (checkAdminAccess()) {
    loadDashboard();
}