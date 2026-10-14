/**
 * NOVATIX USER INTERFACE & RENDERING CONTROLLER
 */

const UI = {
    currentView: 'events',

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fa-solid fa-magic"></i> ${message}`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },

    switchView(viewName) {
        this.currentView = viewName;
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

        const activeSec = document.getElementById(`view-${viewName}`);
        if (activeSec) activeSec.classList.add('active');

        const activeLink = document.querySelector(`.nav-link[data-view="${viewName}"]`);
        if (activeLink) activeLink.classList.add('active');

        if (viewName === 'events') this.loadEvents();
        if (viewName === 'venues') this.loadVenues();
        if (viewName === 'bookings') this.loadBookings();
        if (viewName === 'users') this.loadUsers();
        if (viewName === 'system') this.runDiagnostics();
    },

    updateAuthUI() {
        const user = Auth.getUser();
        const userWelcome = document.getElementById('user-welcome');
        const roleTag = document.getElementById('role-tag');
        const authBtnText = document.getElementById('auth-btn-text');
        const authBtn = document.getElementById('auth-btn');

        const navBookings = document.getElementById('nav-item-bookings');
        const navUsers = document.getElementById('nav-item-users');
        const btnCreateEvent = document.getElementById('btn-create-event');
        const btnCreateVenue = document.getElementById('btn-create-venue');

        if (user && Auth.isAuthenticated()) {
            userWelcome.textContent = `Wizard ${user.full_name}`;
            roleTag.textContent = user.role;
            roleTag.className = `role-badge ${user.role.toLowerCase()}`;
            authBtnText.textContent = 'Depart (Logout)';
            authBtn.onclick = () => Auth.logout();

            navBookings.classList.remove('hidden');

            if (Auth.hasRole('Staff', 'Administrator')) {
                btnCreateEvent.classList.remove('hidden');
                btnCreateVenue.classList.remove('hidden');
            } else {
                btnCreateEvent.classList.add('hidden');
                btnCreateVenue.classList.add('hidden');
            }

            if (Auth.hasRole('Administrator')) {
                navUsers.classList.remove('hidden');
            } else {
                navUsers.classList.add('hidden');
            }
        } else {
            userWelcome.textContent = 'Welcome, Wandering Wizard';
            roleTag.textContent = 'Guest';
            roleTag.className = 'role-badge guest';
            authBtnText.textContent = 'Cast Login';
            authBtn.onclick = () => this.openAuthModal();

            navBookings.classList.add('hidden');
            navUsers.classList.add('hidden');
            btnCreateEvent.classList.add('hidden');
            btnCreateVenue.classList.add('hidden');
        }
    },

    // Modal Helpers
    openAuthModal() { document.getElementById('modal-auth').classList.remove('hidden'); },
    closeAuthModal() { document.getElementById('modal-auth').classList.add('hidden'); },

    switchAuthTab(tab) {
        document.getElementById('tab-login').classList.toggle('active', tab === 'login');
        document.getElementById('tab-register').classList.toggle('active', tab === 'register');
        document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
        document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
    },

    openEventModal() {
        document.getElementById('form-event').reset();
        document.getElementById('event-id').value = '';
        document.getElementById('event-modal-title').textContent = 'Enchant an Event';
        this.populateVenueSelect();
        document.getElementById('modal-event').classList.remove('hidden');
    },
    closeEventModal() { document.getElementById('modal-event').classList.add('hidden'); },

    openVenueModal() {
        document.getElementById('form-venue').reset();
        document.getElementById('venue-id').value = '';
        document.getElementById('venue-modal-title').textContent = 'Register Hall';
        document.getElementById('modal-venue').classList.remove('hidden');
    },
    closeVenueModal() { document.getElementById('modal-venue').classList.add('hidden'); },

    openBookingModal(eventId, eventName) {
        if (!Auth.isAuthenticated()) {
            this.openAuthModal();
            return;
        }
        document.getElementById('booking-event-id').value = eventId;
        document.getElementById('booking-event-details').innerHTML = `<strong>${eventName}</strong>`;
        document.getElementById('modal-booking').classList.remove('hidden');
    },
    closeBookingModal() { document.getElementById('modal-booking').classList.add('hidden'); },

    openUserModal(id, name, email, role) {
        document.getElementById('user-edit-id').value = id;
        document.getElementById('user-edit-name').value = name;
        document.getElementById('user-edit-email').value = email;
        document.getElementById('user-edit-role').value = role;
        document.getElementById('modal-user').classList.remove('hidden');
    },
    closeUserModal() { document.getElementById('modal-user').classList.add('hidden'); },

    openQrModal(qrUrl, bookingId) {
        document.getElementById('qr-modal-title').textContent = `Passage Seal #${bookingId}`;
        document.getElementById('qr-modal-content').innerHTML = `
            <img src="${qrUrl}" alt="QR Seal" style="max-width: 220px; border: 2px solid #D3A625; padding: 10px; background: #fff;">
        `;
        document.getElementById('modal-qr').classList.remove('hidden');
    },
    closeQrModal() { document.getElementById('modal-qr').classList.add('hidden'); },

    // Render Data
    async loadEvents(page = 1) {
        const loader = document.getElementById('events-loader');
        const grid = document.getElementById('events-grid');
        loader.classList.remove('hidden');
        grid.innerHTML = '';

        const res = await API.getEvents(page, 9);
        loader.classList.add('hidden');

        if (res.data.success && Array.isArray(res.data.data)) {
            const events = res.data.data;
            document.getElementById('stat-events-count').textContent = res.data.pagination?.total_records || events.length;

            if (events.length === 0) {
                grid.innerHTML = '<p class="text-center span-2">No magical events scheduled currently.</p>';
                return;
            }

            events.forEach((ev, idx) => {
                const imgUrl = CONFIG.EVENT_IMAGES[idx % CONFIG.EVENT_IMAGES.length];
                const isStaffOrAdmin = Auth.hasRole('Staff', 'Administrator');
                const isCustomer = Auth.hasRole('Customer');

                const card = document.createElement('div');
                card.className = 'parchment-card';
                card.innerHTML = `
                    <div class="card-img-wrap">
                        <img src="${imgUrl}" alt="${ev.event_name}">
                        <span class="card-tag">${ev.status}</span>
                    </div>
                    <div class="card-body">
                        <h4 class="card-title">${ev.event_name}</h4>
                        <div class="card-meta">
                            <span><i class="fa-solid fa-calendar-day"></i> ${ev.event_date} at ${ev.event_time}</span>
                            <span><i class="fa-solid fa-castle"></i> ${ev.venue_name || 'Hogwarts Realm'}</span>
                            <span><i class="fa-solid fa-ticket"></i> Available: ${ev.available_tickets} / ${ev.total_tickets}</span>
                        </div>
                        <p class="card-desc">${ev.description || 'An enchanted wizarding gathering.'}</p>
                        <div class="card-footer">
                            ${ev.status === 'Upcoming' && ev.available_tickets > 0 
                                ? `<button class="btn-gold" onclick="UI.openBookingModal(${ev.event_id}, '${this.escapeHtml(ev.event_name)}')">Book Passage</button>` 
                                : `<span class="text-muted">\${ev.available_tickets === 0 ? 'Sold Out' : 'View Only'}</span>`}
                            
                            ${isStaffOrAdmin ? `
                                <div>
                                    <button class="btn-magic-sm" onclick="App.editEvent(${ev.event_id})"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn-danger-sm" onclick="App.deleteEvent(${ev.event_id})"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        }
    },

    async loadVenues(page = 1) {
        const loader = document.getElementById('venues-loader');
        const grid = document.getElementById('venues-grid');
        loader.classList.remove('hidden');
        grid.innerHTML = '';

        const res = await API.getVenues(page, 9);
        loader.classList.add('hidden');

        if (res.data.success && Array.isArray(res.data.data)) {
            const venues = res.data.data;
            document.getElementById('stat-venues-count').textContent = res.data.pagination?.total_records || venues.length;

            if (venues.length === 0) {
                grid.innerHTML = '<p class="text-center span-2">No wizarding venues registered.</p>';
                return;
            }

            venues.forEach((v, idx) => {
                const imgUrl = CONFIG.VENUE_IMAGES[idx % CONFIG.VENUE_IMAGES.length];
                const isStaffOrAdmin = Auth.hasRole('Staff', 'Administrator');

                const card = document.createElement('div');
                card.className = 'parchment-card';
                card.innerHTML = `
                    <div class="card-img-wrap">
                        <img src="${imgUrl}" alt="${v.venue_name}">
                        <span class="card-tag">Capacity: ${v.capacity}</span>
                    </div>
                    <div class="card-body">
                        <h4 class="card-title">${v.venue_name}</h4>
                        <div class="card-meta">
                            <span><i class="fa-solid fa-location-dot"></i> ${v.address}</span>
                        </div>
                        <p class="card-desc">${v.description || 'Enchanted venue hall with protective spells.'}</p>
                        ${isStaffOrAdmin ? `
                            <div class="card-footer">
                                <button class="btn-magic-sm" onclick="App.editVenue(${v.venue_id})">Edit</button>
                                <button class="btn-danger-sm" onclick="App.deleteVenue(${v.venue_id})">Delete</button>
                            </div>
                        ` : ''}
                    </div>
                `;
                grid.appendChild(card);
            });
        }
    },

    async loadBookings(page = 1) {
        if (!Auth.isAuthenticated()) return;

        const loader = document.getElementById('bookings-loader');
        const tbody = document.getElementById('bookings-table-body');
        loader.classList.remove('hidden');
        tbody.innerHTML = '';

        const res = await API.getBookings(page, 10);
        loader.classList.add('hidden');

        if (res.data.success && Array.isArray(res.data.data)) {
            const bookings = res.data.data;

            if (bookings.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" class="text-center">No passages found in the archives.</td></tr>';
                return;
            }

            bookings.forEach(b => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>#${b.booking_id}</td>
                    <td>${b.full_name}</td>
                    <td><strong>${b.event_name}</strong></td>
                    <td>${b.event_date} ${b.event_time}</td>
                    <td>${b.venue_name}</td>
                    <td>${b.ticket_quantity}</td>
                    <td><span class="role-badge ${b.booking_status === 'Confirmed' ? 'staff' : 'guest'}">${b.booking_status}</span></td>
                    <td>
                        ${b.qr_code ? `<button class="btn-magic-sm" onclick="UI.openQrModal('${b.qr_code}',${b.booking_id})"><i class="fa-solid fa-qrcode"></i> View Seal</button>` : 'N/A'}
                    </td>
                    <td>
                        ${b.booking_status === 'Confirmed' ? `
                            <button class="btn-magic-sm" onclick="App.updateBookingQuantity(${b.booking_id},${b.ticket_quantity})">Adjust</button>
                            <button class="btn-danger-sm" onclick="App.cancelBooking(${b.booking_id})">Cancel</button>
                        ` : 'None'}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    },

    async loadUsers() {
        if (!Auth.hasRole('Administrator')) return;

        const loader = document.getElementById('users-loader');
        const tbody = document.getElementById('users-table-body');
        loader.classList.remove('hidden');
        tbody.innerHTML = '';

        const res = await API.getUsers();
        loader.classList.add('hidden');

        if (res.data.success && Array.isArray(res.data.data)) {
            const loggedInUser = Auth.getUser();

            res.data.data.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>#${u.user_id}</td>
                    <td>${u.full_name}</td>
                    <td>${u.email}</td>
                    <td><span class="role-badge ${u.role.toLowerCase()}">${u.role}</span></td>
                    <td>${u.created_at || 'Registered'}</td>
                    <td>
                        <button class="btn-magic-sm" onclick="UI.openUserModal(${u.user_id}, '${this.escapeHtml(u.full_name)}', '${this.escapeHtml(u.email)}', '${u.role}')">Edit</button>
                        ${u.user_id !== loggedInUser?.user_id ? `<button class="btn-danger-sm" onclick="App.deleteUser(\${u.user_id})">Delete</button>` : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    },

    async populateVenueSelect(selectedVenueId = null) {
        const select = document.getElementById('event-venue-id');
        select.innerHTML = '<option value="">Select Venue...</option>';

        const res = await API.getVenues(1, 50);
        if (res.data.success && Array.isArray(res.data.data)) {
            res.data.data.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.venue_id;
                opt.textContent = `${v.venue_name} (Capacity: ${v.capacity})`;
                if (selectedVenueId && v.venue_id == selectedVenueId) opt.selected = true;
                select.appendChild(opt);
            });
        }
    },

    async runDiagnostics() {
        const healthPre = document.getElementById('diag-health');
        const systemPre = document.getElementById('diag-system');

        healthPre.textContent = 'Testing public signal...';
        systemPre.textContent = 'Testing system status...';

        const healthRes = await API.getHealth();
        healthPre.textContent = JSON.stringify(healthRes.data, null, 2);

        const sysRes = await API.getSystemStatus();
        systemPre.textContent = JSON.stringify(sysRes.data, null, 2);
    },

    escapeHtml(str) {
        return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }
};