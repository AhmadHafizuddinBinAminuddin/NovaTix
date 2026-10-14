/**
 * NovaTix Single Page Application Controller
 * Handles application lifecycle, DOM events, and API data binding
 */

const app = {
  state: {
    currentPage: 'home',
    events: [],
    venues: [],
    bookings: [],
    users: [],
    activeStaffTab: 'manage-events'
  },

  init() {
    ui.renderNav();
    app.bindEvents();
    app.navigate('home');
  },

  bindEvents() {
    // Navigation link clicks
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.getAttribute('data-page');
        app.navigate(page);
      });
    });
  },

  navigate(pageId) {
    // Security check for role protected views
    if (pageId === 'my-bookings' && !auth.isLoggedIn()) {
      ui.showToast('Please log in to view your tickets.', 'error');
      ui.openModal('modal-auth');
      return;
    }

    if ((pageId === 'staff-panel' || pageId === 'admin-users') && !auth.hasRole(['Staff', 'Administrator'])) {
      ui.showToast('Access restricted to privileged accounts.', 'error');
      return;
    }

    app.state.currentPage = pageId;

    // Toggle active view DOM
    document.querySelectorAll('.view-page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));

    const targetPage = document.getElementById(`page-${pageId}`);
    const targetNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);

    if (targetPage) targetPage.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    // Load dynamic page data
    if (pageId === 'home') app.loadEvents();
    if (pageId === 'venues') app.loadVenues();
    if (pageId === 'my-bookings') app.loadCustomerBookings();
    if (pageId === 'staff-panel') app.loadStaffConsole();
    if (pageId === 'admin-users') app.loadAdminUsers();
  },

  // ------------------------------------------------------------------
  // 1. PUBLIC EVENTS & CATALOG
  // ------------------------------------------------------------------
  async loadEvents(page = 1) {
    const grid = document.getElementById('events-grid');
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--neon-cyan);">FETCHING LIVE EVENT STREAM...</div>`;

    try {
      const response = await api.getEvents(page, 12);
      app.state.events = response.data || [];
      app.renderEventsGrid(app.state.events);
    } catch (err) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--neon-pink);">Failed to connect to event node: ${err.message}</div>`;
    }
  },

  renderEventsGrid(events) {
    const grid = document.getElementById('events-grid');
    if (events.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px;">No events matching current parameters.</div>`;
      return;
    }

    grid.innerHTML = events.map((evt, idx) => {
      const imgUrl = CONFIG.DEFAULT_EVENT_IMAGES[idx % CONFIG.DEFAULT_EVENT_IMAGES.length];
      const isAvailable = parseInt(evt.available_tickets) > 0 && evt.status === 'Upcoming';

      return `
        <div class="cyber-card">
          <div class="card-banner-wrapper">
            <img src="${imgUrl}" alt="${ui.escape(evt.event_name)}" class="card-banner-img">
            <span class="card-badge ${evt.status.toLowerCase()}">${evt.status}</span>
          </div>
          <div class="card-body">
            <h3 class="card-title">${ui.escape(evt.event_name)}</h3>
            <div class="card-info">📍 ${ui.escape(evt.venue_name)}</div>
            <div class="card-info">📅 ${evt.event_date} @ ${evt.event_time}</div>
            <div class="card-info" style="color:${isAvailable ? 'var(--neon-cyan)' : 'var(--neon-pink)'}; font-weight:bold;">
              🎟️ Available Tickets: ${evt.available_tickets} / ${evt.total_tickets}
            </div>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-top:10px;">${ui.escape(evt.description || 'No detailed specifications provided.')}</p>
            
            <div class="card-footer">
              ${isAvailable ? `
                <button class="cyber-button glow-cyan full-width" onclick="app.openBookingModal(${evt.event_id})">
                  BOOK PASSES
                </button>
              ` : `
                <button class="cyber-button full-width" style="border-color:#555; color:#777; cursor:not-allowed;" disabled>
                  UNAVAILABLE
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  filterEvents() {
    const search = document.getElementById('event-search').value.toLowerCase();
    const status = document.getElementById('event-status-filter').value;

    const filtered = app.state.events.filter(evt => {
      const matchesSearch = evt.event_name.toLowerCase().includes(search) || 
                            (evt.venue_name && evt.venue_name.toLowerCase().includes(search));
      const matchesStatus = status === 'ALL' || evt.status === status;
      return matchesSearch && matchesStatus;
    });

    app.renderEventsGrid(filtered);
  },

  // ------------------------------------------------------------------
  // 2. VENUES PAGE
  // ------------------------------------------------------------------
  async loadVenues() {
    const grid = document.getElementById('venues-grid');
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--neon-pink);">LOADING VENUE DATA...</div>`;

    try {
      const response = await api.getVenues(1, 12);
      app.state.venues = response.data || [];
      
      grid.innerHTML = app.state.venues.map((venue, idx) => {
        const imgUrl = CONFIG.DEFAULT_VENUE_IMAGES[idx % CONFIG.DEFAULT_VENUE_IMAGES.length];
        return `
          <div class="cyber-card">
            <div class="card-banner-wrapper">
              <img src="${imgUrl}" alt="${ui.escape(venue.venue_name)}" class="card-banner-img">
            </div>
            <div class="card-body">
              <h3 class="card-title">${ui.escape(venue.venue_name)}</h3>
              <div class="card-info">📍 ${ui.escape(venue.address)}</div>
              <div class="card-info">⚡ Max Capacity: ${venue.capacity} attendees</div>
              <p style="font-size:0.85rem; color:var(--text-muted); margin-top:10px;">${ui.escape(venue.description || 'Modern event space.')}</p>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--neon-pink);">${err.message}</div>`;
    }
  },

  // ------------------------------------------------------------------
  // 3. AUTHENTICATION HANDLERS
  // ------------------------------------------------------------------
  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await api.login(email, password);
      auth.setSession(res.access_token, res.data);
      ui.closeModal('modal-auth');
      ui.renderNav();
      ui.showToast(`Authentication successful. Welcome, ${res.data.full_name}!`);
      
      if (res.data.role === 'Customer') app.navigate('home');
      else app.navigate('staff-panel');
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const full_name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
      await api.register(full_name, email, password);
      ui.showToast('Account registered successfully! Logging you in...');
      
      // Auto-login after registration
      const loginRes = await api.login(email, password);
      auth.setSession(loginRes.access_token, loginRes.data);
      ui.closeModal('modal-auth');
      ui.renderNav();
      app.navigate('home');
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  },

  // ------------------------------------------------------------------
  // 4. CUSTOMER BOOKINGS & QR CODES
  // ------------------------------------------------------------------
  openBookingModal(eventId) {
    if (!auth.isLoggedIn()) {
      ui.showToast('Please authenticate before reserving tickets.', 'error');
      ui.openModal('modal-auth');
      return;
    }

    const evt = app.state.events.find(e => e.event_id === eventId);
    if (!evt) return;

    document.getElementById('booking-event-id').value = evt.event_id;
    document.getElementById('booking-ticket-qty').max = evt.available_tickets;
    document.getElementById('booking-ticket-qty').value = 1;
    document.getElementById('booking-event-details').innerHTML = `
      <h4 style="color:var(--neon-cyan);">${ui.escape(evt.event_name)}</h4>
      <p style="font-size:0.9rem; color:var(--text-muted);">Venue: ${ui.escape(evt.venue_name)}</p>
      <p style="font-size:0.9rem; color:var(--text-muted);">Date: ${evt.event_date} @ ${evt.event_time}</p>
    `;

    ui.openModal('modal-booking');
  },

  async handleCreateBooking(e) {
    e.preventDefault();
    const eventId = document.getElementById('booking-event-id').value;
    const qty = document.getElementById('booking-ticket-qty').value;

    try {
      const res = await api.createBooking(eventId, qty);
      ui.closeModal('modal-booking');
      ui.showToast('Passes booked successfully!');

      if (res.data && res.data.qr_code_url) {
        app.showQrModal(res.data.qr_code_url, `Booking #${res.data.booking_id} — ${res.data.event_name}`);
      }
      app.loadEvents();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  },

  showQrModal(qrUrl, description) {
    document.getElementById('qr-booking-desc').textContent = description;
    const imgEl = document.getElementById('qr-code-img');
    const fallbackEl = document.getElementById('qr-fallback');

    if (qrUrl) {
      imgEl.src = qrUrl;
      imgEl.classList.remove('hidden');
      fallbackEl.classList.add('hidden');
    } else {
      imgEl.classList.add('hidden');
      fallbackEl.classList.remove('hidden');
    }

    ui.openModal('modal-qr');
  },

  async loadCustomerBookings() {
    const container = document.getElementById('customer-bookings-container');
    container.innerHTML = `<div style="padding:30px; text-align:center; color:var(--neon-cyan);">FETCHING TICKETS...</div>`;

    try {
      const res = await api.getBookings();
      app.state.bookings = res.data || [];

      if (app.state.bookings.length === 0) {
        container.innerHTML = `<div style="padding:40px; text-align:center;">You have no active or historical bookings.</div>`;
        return;
      }

      container.innerHTML = `
        <table class="cyber-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>EVENT</th>
              <th>VENUE</th>
              <th>DATE & TIME</th>
              <th>QTY</th>
              <th>STATUS</th>
              <th>DIGITAL TOKEN</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            ${app.state.bookings.map(b => `
              <tr>
                <td>#${b.booking_id}</td>
                <td style="color:#fff; font-weight:600;">${ui.escape(b.event_name)}</td>
                <td>${ui.escape(b.venue_name)}</td>
                <td>${b.event_date}${b.event_time}</td>
                <td>${b.ticket_quantity}</td>
                <td><span class="card-badge ${b.booking_status.toLowerCase()}">${b.booking_status}</span></td>
                <td>
                  ${b.qr_code ? `
                    <button class="cyber-button glow-cyan" style="padding:3px 8px; font-size:0.75rem;" onclick="app.showQrModal('${b.qr_code}', 'Booking #${b.booking_id}')">VIEW QR</button>
                  ` : 'N/A'}
                </td>
                <td>
                  ${b.booking_status === 'Confirmed' ? `
                    <button class="cyber-button glow-pink" style="padding:3px 8px; font-size:0.75rem;" onclick="app.promptUpdateBooking(${b.booking_id}, ${b.ticket_quantity})">EDIT QTY</button>
                    <button class="cyber-button glow-red" style="padding:3px 8px; font-size:0.75rem;" onclick="app.handleCancelBooking(${b.booking_id})">CANCEL</button>
                  ` : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.innerHTML = `<div style="padding:30px; color:var(--neon-pink);">${err.message}</div>`;
    }
  },

  async promptUpdateBooking(bookingId, currentQty) {
    const newQtyStr = prompt('Enter updated ticket quantity:', currentQty);
    if (!newQtyStr) return;
    const newQty = parseInt(newQtyStr, 10);

    if (isNaN(newQty) || newQty < 1) {
      ui.showToast('Quantity must be a positive integer.', 'error');
      return;
    }

    try {
      await api.updateBookingTickets(bookingId, newQty);
      ui.showToast('Booking tickets updated successfully.');
      app.loadCustomerBookings();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  },

  async handleCancelBooking(bookingId) {
    if (!confirm(`Are you sure you want to cancel booking #${bookingId}?`)) return;

    try {
      await api.cancelBooking(bookingId);
      ui.showToast('Booking cancelled and ticket pool restored.');
      app.loadCustomerBookings();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  },

  // ------------------------------------------------------------------
  // 5. STAFF & ADMIN CONSOLE
  // ------------------------------------------------------------------
  async loadStaffConsole() {
    app.switchStaffTab(app.state.activeStaffTab);
  },

  switchStaffTab(tabName) {
    app.state.activeStaffTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const activeBtn = document.querySelector(`.tab-btn[onclick*="${tabName}"]`);
    const activeTab = document.getElementById(`tab-${tabName}`);

    if (activeBtn) activeBtn.classList.add('active');
    if (activeTab) activeTab.classList.add('active');

    if (tabName === 'manage-events') app.renderStaffEvents();
    if (tabName === 'manage-venues') app.renderStaffVenues();
    if (tabName === 'manage-bookings') app.renderStaffBookings();
  },

  async renderStaffEvents() {
    const container = document.getElementById('staff-events-list');
    container.innerHTML = `<div style="padding:20px; color:var(--neon-cyan);">SYNCING EVENTS...</div>`;

    try {
      const res = await api.getEvents(1, 50);
      const events = res.data || [];

      container.innerHTML = `
        <table class="cyber-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>NAME</th>
              <th>VENUE</th>
              <th>DATE / TIME</th>
              <th>TICKETS (AVAIL/TOTAL)</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            ${events.map(e => `
              <tr>
                <td>#${e.event_id}</td>
                <td style="color:#fff;">${ui.escape(e.event_name)}</td>
                <td>${ui.escape(e.venue_name)}</td>
                <td>${e.event_date}${e.event_time}</td>
                <td>${e.available_tickets} /${e.total_tickets}</td>
                <td><span class="card-badge ${e.status.toLowerCase()}">${e.status}</span></td>
                <td>
                  <button class="cyber-button glow-cyan" style="padding:2px 6px; font-size:0.7rem;" onclick="app.openEventModal(${e.event_id})">EDIT</button>
                  <button class="cyber-button glow-red" style="padding:2px 6px; font-size:0.7rem;" onclick="app.handleDeleteEvent(${e.event_id})">DEL</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.innerHTML = `<div style="padding:20px; color:var(--neon-pink);">${err.message}</div>`;
    }
  },

  async openEventModal(eventId = null) {
    // Pre-populate venue options
    const venueRes = await api.getVenues(1, 50);
    const venueSelect = document.getElementById('event-venue-id');
    venueSelect.innerHTML = (venueRes.data || []).map(v => `
      <option value="${v.venue_id}">${ui.escape(v.venue_name)}</option>
    `).join('');

    if (eventId) {
      document.getElementById('modal-event-title').textContent = 'EDIT EVENT';
      const eventData = await api.getEventById(eventId);
      const evt = eventData.data;

      document.getElementById('event-id').value = evt.event_id;
      document.getElementById('event-name').value = evt.event_name;
      document.getElementById('event-venue-id').value = evt.venue_id;
      document.getElementById('event-date').value = evt.event_date;
      document.getElementById('event-time').value = evt.event_time;
      document.getElementById('event-tickets').value = evt.total_tickets;
      document.getElementById('event-status').value = evt.status;
      document.getElementById('event-description').value = evt.description || '';
    } else {
      document.getElementById('modal-event-title').textContent = 'CREATE EVENT';
      document.getElementById('form-event').reset();
      document.getElementById('event-id').value = '';
    }

    ui.openModal('modal-event-form');
  },

  async handleSaveEvent(e) {
    e.preventDefault();
    const id = document.getElementById('event-id').value;
    const eventData = {
      venue_id: parseInt(document.getElementById('event-venue-id').value, 10),
      event_name: document.getElementById('event-name').value,
      event_date: document.getElementById('event-date').value,
      event_time: document.getElementById('event-time').value,
      total_tickets: parseInt(document.getElementById('event-tickets').value, 10),
      status: document.getElementById('event-status').value,
      description: document.getElementById('event-description').value
    };

    try {
      if (id) {
        await api.updateEvent(id, eventData);
        ui.showToast('Event specs updated.');
      } else {
        await api.createEvent(eventData);
        ui.showToast('New event deployed successfully.');
      }
      ui.closeModal('modal-event-form');
      app.renderStaffEvents();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  },

  async handleDeleteEvent(id) {
    if (!confirm(`Confirm deletion of event #${id}?`)) return;
    try {
      await api.deleteEvent(id);
      ui.showToast('Event removed.');
      app.renderStaffEvents();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  },

  async renderStaffVenues() {
    const container = document.getElementById('staff-venues-list');
    container.innerHTML = `<div style="padding:20px; color:var(--neon-pink);">LOADING VENUES...</div>`;

    try {
      const res = await api.getVenues(1, 50);
      const venues = res.data || [];

      container.innerHTML = `
        <table class="cyber-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>NAME</th>
              <th>ADDRESS</th>
              <th>CAPACITY</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            ${venues.map(v => `
              <tr>
                <td>#${v.venue_id}</td>
                <td style="color:#fff;">${ui.escape(v.venue_name)}</td>
                <td>${ui.escape(v.address)}</td>
                <td>${v.capacity}</td>
                <td>
                  <button class="cyber-button glow-cyan" style="padding:2px 6px; font-size:0.7rem;" onclick="app.openVenueModal(${v.venue_id})">EDIT</button>
                  <button class="cyber-button glow-red" style="padding:2px 6px; font-size:0.7rem;" onclick="app.handleDeleteVenue(${v.venue_id})">DEL</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.innerHTML = `<div style="padding:20px; color:var(--neon-pink);">${err.message}</div>`;
    }
  },

  async openVenueModal(venueId = null) {
    if (venueId) {
      document.getElementById('modal-venue-title').textContent = 'EDIT VENUE';
      const venueRes = await api.getVenueById(venueId);
      const v = venueRes.data;

      document.getElementById('venue-id').value = v.venue_id;
      document.getElementById('venue-name').value = v.venue_name;
      document.getElementById('venue-address').value = v.address;
      document.getElementById('venue-capacity').value = v.capacity;
      document.getElementById('venue-description').value = v.description || '';
    } else {
      document.getElementById('modal-venue-title').textContent = 'CREATE VENUE';
      document.getElementById('form-venue').reset();
      document.getElementById('venue-id').value = '';
    }

    ui.openModal('modal-venue-form');
  },

  async handleSaveVenue(e) {
    e.preventDefault();
    const id = document.getElementById('venue-id').value;
    const venueData = {
      venue_name: document.getElementById('venue-name').value,
      address: document.getElementById('venue-address').value,
      capacity: parseInt(document.getElementById('venue-capacity').value, 10),
      description: document.getElementById('venue-description').value
    };

    try {
      if (id) {
        await api.updateVenue(id, venueData);
        ui.showToast('Venue updated.');
      } else {
        await api.createVenue(venueData);
        ui.showToast('Venue added to database.');
      }
      ui.closeModal('modal-venue-form');
      app.renderStaffVenues();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  },

  async handleDeleteVenue(id) {
    if (!confirm(`Delete venue #${id}?`)) return;
    try {
      await api.deleteVenue(id);
      ui.showToast('Venue deleted.');
      app.renderStaffVenues();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  },

  async renderStaffBookings() {
    const container = document.getElementById('staff-bookings-list');
    container.innerHTML = `<div style="padding:20px; color:var(--neon-cyan);">FETCHING GLOBAL LEDGER...</div>`;

    try {
      const res = await api.getBookings(1, 50);
      const bookings = res.data || [];

      container.innerHTML = `
        <table class="cyber-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>CUSTOMER</th>
              <th>EVENT</th>
              <th>QTY</th>
              <th>DATE BOOKED</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            ${bookings.map(b => `
              <tr>
                <td>#${b.booking_id}</td>
                <td style="color:#fff;">${ui.escape(b.full_name)} (ID #${b.user_id})</td>
                <td>${ui.escape(b.event_name)}</td>
                <td>${b.ticket_quantity}</td>
                <td>${b.booking_date}</td>
                <td><span class="card-badge ${b.booking_status.toLowerCase()}">${b.booking_status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.innerHTML = `<div style="padding:20px; color:var(--neon-pink);">${err.message}</div>`;
    }
  },

  // ------------------------------------------------------------------
  // 6. ADMIN USER CONTROL
  // ------------------------------------------------------------------
  async loadAdminUsers() {
    const container = document.getElementById('admin-users-list');
    container.innerHTML = `<div style="padding:30px; color:var(--neon-cyan);">LOADING USERS DIRECTORY...</div>`;

    try {
      const res = await api.getUsers();
      app.state.users = res.data || [];

      container.innerHTML = `
        <table class="cyber-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>FULL NAME</th>
              <th>EMAIL</th>
              <th>CLEARANCE ROLE</th>
              <th>REGISTERED DATE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            ${app.state.users.map(u => `
              <tr>
                <td>#${u.user_id}</td>
                <td style="color:#fff; font-weight:600;">${ui.escape(u.full_name)}</td>
                <td>${ui.escape(u.email)}</td>
                <td><span class="user-role-tag">${u.role}</span></td>
                <td>${u.created_at}</td>
                <td>
                  <button class="cyber-button glow-cyan" style="padding:3px 8px; font-size:0.75rem;" onclick="app.openEditUserModal(${u.user_id})">EDIT CLEARANCE</button>
                  <button class="cyber-button glow-red" style="padding:3px 8px; font-size:0.75rem;" onclick="app.handleDeleteUser(${u.user_id})">DELETE</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.innerHTML = `<div style="padding:30px; color:var(--neon-pink);">${err.message}</div>`;
    }
  },

  openEditUserModal(userId) {
    const user = app.state.users.find(u => u.user_id === userId);
    if (!user) return;

    document.getElementById('user-edit-id').value = user.user_id;
    document.getElementById('user-edit-name').value = user.full_name;
    document.getElementById('user-edit-email').value = user.email;
    document.getElementById('user-edit-role').value = user.role;
    document.getElementById('user-edit-password').value = '';

    ui.openModal('modal-user-form');
  },

  async handleSaveUser(e) {
    e.preventDefault();
    const userId = document.getElementById('user-edit-id').value;
    const userData = {
      full_name: document.getElementById('user-edit-name').value,
      email: document.getElementById('user-edit-email').value,
      role: document.getElementById('user-edit-role').value
    };

    const password = document.getElementById('user-edit-password').value;
    if (password.trim() !== '') {
      userData.password = password;
    }

    try {
      await api.updateUser(userId, userData);
      ui.showToast('User account updated.');
      ui.closeModal('modal-user-form');
      app.loadAdminUsers();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  },

  async handleDeleteUser(userId) {
    if (!confirm(`Delete user account #${userId}?`)) return;

    try {
      await api.deleteUser(userId);
      ui.showToast('User account removed.');
      app.loadAdminUsers();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  }
};

// Initialize Application when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});