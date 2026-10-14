/**
 * NovaTix Centralized API Service
 * Handles HTTP requests, authentication headers, error catching, and response parsing
 */

const api = {
  /**
   * Universal Fetch Wrapper
   * @param {string} endpoint - API path (e.g., 'events', 'bookings/1')
   * @param {string} method - GET, POST, PUT, PATCH, DELETE
   * @param {object|null} body - JSON request body
   * @param {boolean} requiresAuth - Whether to attach JWT Bearer token
   */
  async request(endpoint, method = 'GET', body = null, requiresAuth = false) {
    const url = `${CONFIG.API_BASE_URL}/${endpoint.replace(/^\//, '')}`;
    
    const headers = {
      'Content-Type': 'application/json'
    };

    if (requiresAuth) {
      const token = auth.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const options = {
      method,
      headers
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        // Handle token expiration/authorization failures
        if (response.status === 401 && requiresAuth) {
          auth.logout();
          ui.showToast('Session expired. Please log in again.', 'error');
        }
        throw new Error(data.message || `API Error: Status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`[API Call Failed] ${method} ${url}:`, error);
      throw error;
    }
  },

  // Auth Endpoints
  login: (email, password) => api.request('login', 'POST', { email, password }),
  register: (full_name, email, password) => api.request('users', 'POST', { full_name, email, password }),
  getProfile: () => api.request('users/me', 'GET', null, true),

  // Events Endpoints
  getEvents: (page = 1, limit = 10) => api.request(`events?page=${page}&limit=${limit}`, 'GET'),
  getEventById: (id) => api.request(`events/${id}`, 'GET'),
  createEvent: (eventData) => api.request('events', 'POST', eventData, true),
  updateEvent: (id, eventData) => api.request(`events/${id}`, 'PUT', eventData, true),
  deleteEvent: (id) => api.request(`events/${id}`, 'DELETE', null, true),

  // Venues Endpoints
  getVenues: (page = 1, limit = 10) => api.request(`venues?page=${page}&limit=${limit}`, 'GET'),
  getVenueById: (id) => api.request(`venues/${id}`, 'GET'),
  createVenue: (venueData) => api.request('venues', 'POST', venueData, true),
  updateVenue: (id, venueData) => api.request(`venues/${id}`, 'PUT', venueData, true),
  deleteVenue: (id) => api.request(`venues/${id}`, 'DELETE', null, true),

  // Bookings Endpoints
  getBookings: (page = 1, limit = 10) => api.request(`bookings?page=${page}&limit=${limit}`, 'GET', null, true),
  getBookingById: (id) => api.request(`bookings/${id}`, 'GET', null, true),
  createBooking: (event_id, ticket_quantity) => api.request('bookings', 'POST', { event_id, ticket_quantity }, true),
  updateBookingTickets: (id, ticket_quantity) => api.request(`bookings/${id}`, 'PATCH', { ticket_quantity }, true),
  cancelBooking: (id) => api.request(`bookings/${id}`, 'DELETE', null, true),

  // Admin User Management Endpoints
  getUsers: () => api.request('users', 'GET', null, true),
  updateUser: (id, userData) => api.request(`users/${id}`, 'PATCH', userData, true),
  deleteUser: (id) => api.request(`users/${id}`, 'DELETE', null, true)
};