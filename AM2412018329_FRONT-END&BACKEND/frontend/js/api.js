/**
 * NOVATIX API HTTP WRAPPER
 * Interacts directly with http://localhost/NovaTix/api.php
 */

const API = {
    async request(endpoint, method = 'GET', body = null, requiresAuth = false, customHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...customHeaders
        };

        if (requiresAuth) {
            const token = Auth.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        const options = { method, headers };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/${endpoint}`, options);
            const data = await response.json();

            if (response.status === 401 && requiresAuth) {
                Auth.handleUnauthorized();
            }

            return {
                status: response.status,
                ok: response.ok,
                data
            };
        } catch (error) {
            console.error('[NovaTix API Error]', error);
            UI.showToast(`Network Error: ${error.message}`, 'error');
            return {
                status: 500,
                ok: false,
                data: { success: false, message: 'Failed to communicate with the server.' }
            };
        }
    },

    // Endpoint Quick Wrappers
    getHealth() {
        return this.request('health');
    },

    getSystemStatus() {
        return this.request('system/status', 'GET', null, false, { 'X-API-Key': CONFIG.API_KEY });
    },

    login(credentials) {
        return this.request('login', 'POST', credentials);
    },

    register(userData) {
        return this.request('users', 'POST', userData);
    },

    getEvents(page = 1, limit = 9) {
        return this.request(`events?page=${page}&limit=${limit}`);
    },

    getEventById(id) {
        return this.request(`events/${id}`);
    },

    createEvent(eventData) {
        return this.request('events', 'POST', eventData, true);
    },

    updateEvent(id, eventData) {
        return this.request(`events/${id}`, 'PUT', eventData, true);
    },

    deleteEvent(id) {
        return this.request(`events/${id}`, 'DELETE', null, true);
    },

    getVenues(page = 1, limit = 9) {
        return this.request(`venues?page=${page}&limit=${limit}`);
    },

    getVenueById(id) {
        return this.request(`venues/${id}`);
    },

    createVenue(venueData) {
        return this.request('venues', 'POST', venueData, true);
    },

    updateVenue(id, venueData) {
        return this.request(`venues/${id}`, 'PUT', venueData, true);
    },

    deleteVenue(id) {
        return this.request(`venues/${id}`, 'DELETE', null, true);
    },

    getBookings(page = 1, limit = 10) {
        return this.request(`bookings?page=${page}&limit=${limit}`, 'GET', null, true);
    },

    createBooking(bookingData) {
        return this.request('bookings', 'POST', bookingData, true);
    },

    updateBookingQuantity(id, quantity) {
        return this.request(`bookings/${id}`, 'PATCH', { ticket_quantity: quantity }, true);
    },

    cancelBooking(id) {
        return this.request(`bookings/${id}`, 'DELETE', null, true);
    },

    getUsers() {
        return this.request('users', 'GET', null, true);
    },

    updateUser(id, userData) {
        return this.request(`users/${id}`, 'PUT', userData, true);
    },

    deleteUser(id) {
        return this.request(`users/${id}`, 'DELETE', null, true);
    }
};