/**
 * NOVATIX APPLICATION ENTRY POINT
 * Binds form submissions, event handlers, and boots application logic
 */

const App = {
    init() {
       // Auth.clearSessionIfInvalid(); // Optional sanity check
        UI.updateAuthUI();
        UI.switchView('events');
        UI.runDiagnostics();
    },

    // Event Actions
    async editEvent(eventId) {
        const res = await API.getEventById(eventId);
        if (res.data.success) {
            const ev = res.data.data;
            document.getElementById('event-id').value = ev.event_id;
            document.getElementById('event-name').value = ev.event_name;
            document.getElementById('event-date').value = ev.event_date;
            document.getElementById('event-time').value = ev.event_time;
            document.getElementById('event-total-tickets').value = ev.total_tickets;
            document.getElementById('event-status').value = ev.status;
            document.getElementById('event-description').value = ev.description || '';
            await UI.populateVenueSelect(ev.venue_id);

            document.getElementById('event-modal-title').textContent = 'Edit Magical Event';
            document.getElementById('modal-event').classList.remove('hidden');
        }
    },

    async handleSaveEvent(e) {
        e.preventDefault();
        const id = document.getElementById('event-id').value;
        const body = {
            venue_id: parseInt(document.getElementById('event-venue-id').value),
            event_name: document.getElementById('event-name').value,
            event_date: document.getElementById('event-date').value,
            event_time: document.getElementById('event-time').value,
            total_tickets: parseInt(document.getElementById('event-total-tickets').value),
            status: document.getElementById('event-status').value,
            description: document.getElementById('event-description').value
        };

        const res = id ? await API.updateEvent(id, body) : await API.createEvent(body);

        if (res.data.success) {
            UI.showToast('Event saved successfully!', 'success');
            UI.closeEventModal();
            UI.loadEvents();
        } else {
            UI.showToast(res.data.message || 'Event save failed', 'error');
        }
    },

    async deleteEvent(eventId) {
        if (!confirm('Are you sure you wish to banish this event?')) return;
        const res = await API.deleteEvent(eventId);
        if (res.data.success) {
            UI.showToast('Event deleted.', 'info');
            UI.loadEvents();
        } else {
            UI.showToast(res.data.message || 'Delete failed', 'error');
        }
    },

    // Venue Actions
    async editVenue(venueId) {
        const res = await API.getVenueById(venueId);
        if (res.data.success) {
            const v = res.data.data;
            document.getElementById('venue-id').value = v.venue_id;
            document.getElementById('venue-name').value = v.venue_name;
            document.getElementById('venue-address').value = v.address;
            document.getElementById('venue-capacity').value = v.capacity;
            document.getElementById('venue-description').value = v.description || '';

            document.getElementById('venue-modal-title').textContent = 'Edit Venue Details';
            document.getElementById('modal-venue').classList.remove('hidden');
        }
    },

    async handleSaveVenue(e) {
        e.preventDefault();
        const id = document.getElementById('venue-id').value;
        const body = {
            venue_name: document.getElementById('venue-name').value,
            address: document.getElementById('venue-address').value,
            capacity: parseInt(document.getElementById('venue-capacity').value),
            description: document.getElementById('venue-description').value
        };

        const res = id ? await API.updateVenue(id, body) : await API.createVenue(body);

        if (res.data.success) {
            UI.showToast('Venue saved successfully!', 'success');
            UI.closeVenueModal();
            UI.loadVenues();
        } else {
            UI.showToast(res.data.message || 'Venue save failed', 'error');
        }
    },

    async deleteVenue(venueId) {
        if (!confirm('Are you sure you wish to delete this venue?')) return;
        const res = await API.deleteVenue(venueId);
        if (res.data.success) {
            UI.showToast('Venue deleted.', 'info');
            UI.loadVenues();
        } else {
            UI.showToast(res.data.message || 'Delete failed', 'error');
        }
    },

    // Booking Actions
    async handleCreateBooking(e) {
        e.preventDefault();
        const eventId = document.getElementById('booking-event-id').value;
        const quantity = parseInt(document.getElementById('booking-quantity').value);

        const res = await API.createBooking({
            event_id: parseInt(eventId),
            ticket_quantity: quantity
        });

        if (res.data.success) {
            UI.showToast('Passage booked successfully!', 'success');
            UI.closeBookingModal();
            UI.switchView('bookings');
        } else {
            UI.showToast(res.data.message || 'Booking failed', 'error');
        }
    },

    async updateBookingQuantity(bookingId, currentQty) {
        const newQty = prompt('Enter new ticket quantity:', currentQty);
        if (!newQty || parseInt(newQty) === currentQty) return;

        const res = await API.updateBookingQuantity(bookingId, parseInt(newQty));
        if (res.data.success) {
            UI.showToast('Ticket quantity updated!', 'success');
            UI.loadBookings();
        } else {
            UI.showToast(res.data.message || 'Update failed', 'error');
        }
    },

    async cancelBooking(bookingId) {
        if (!confirm('Are you sure you wish to cancel this passage seal?')) return;
        const res = await API.cancelBooking(bookingId);
        if (res.data.success) {
            UI.showToast('Booking cancelled.', 'info');
            UI.loadBookings();
        } else {
            UI.showToast(res.data.message || 'Cancellation failed', 'error');
        }
    },

    // User Actions
    async handleSaveUser(e) {
        e.preventDefault();
        const userId = document.getElementById('user-edit-id').value;
        const body = {
            full_name: document.getElementById('user-edit-name').value,
            email: document.getElementById('user-edit-email').value,
            role: document.getElementById('user-edit-role').value
        };

        const pwd = document.getElementById('user-edit-password').value;
        if (pwd) body.password = pwd;

        const res = await API.updateUser(userId, body);
        if (res.data.success) {
            UI.showToast('Wizard profile updated!', 'success');
            UI.closeUserModal();
            UI.loadUsers();
        } else {
            UI.showToast(res.data.message || 'User update failed', 'error');
        }
    },

    async deleteUser(userId) {
        if (!confirm('Are you sure you wish to banish this user record?')) return;
        const res = await API.deleteUser(userId);
        if (res.data.success) {
            UI.showToast('User record deleted.', 'info');
            UI.loadUsers();
        } else {
            UI.showToast(res.data.message || 'Deletion failed', 'error');
        }
    }
};

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => App.init());