const API_URL = 'http://localhost/NovaTix/api.php';

const token = localStorage.getItem('jwt_token');
const userRole = localStorage.getItem('user_role');
if (!token) window.location.href = 'login.html';

document.getElementById('user-name-display').innerText = localStorage.getItem('user_name') || 'UNKNOWN';
document.getElementById('user-role-display').innerText = userRole || 'GUEST';

if (userRole !== 'Administrator') {
    const registryLink = document.querySelector('a[href="registry.html"]');
    if (registryLink) {
        registryLink.style.display = 'none';
    }
}

if (userRole === 'Administrator' || userRole === 'Staff') {
    document.getElementById('btn-add-event').classList.remove('hidden');
}

let currentPage = 1;
let totalPages = 1;
let venuesList = []; 

function getEventImage(eventName) {
    const name = eventName.toUpperCase();
    if (name.includes('TECHNOLOGY EXPO')) return 'Tech Expo.jpg';
    if (name.includes('DIGITAL INNOVATION')) return 'Digital Inovation Forum.jpg';
    if (name.includes('CYBERSECURITY')) return 'Cyber Security Conference.jpg';
    if (name.includes('CREATIVE BUSINESS')) return 'Creative Business Workshop.jpg';
    if (name.includes('MUSIC FESTIVAL')) return 'New year music festival.jpg';
    return 'novatix-bg.jpg';
}

async function loadEvents(page = 1) {
    const container = document.getElementById('events-container');

    try {
        const response = await fetch(`${API_URL}/events?page=${page}&limit=9`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            container.innerHTML = ''; 
            const events = result.data;
            
            currentPage = result.pagination.current_page;
            totalPages = result.pagination.total_pages;
            updatePaginationUI();

            events.forEach(event => {
                const card = document.createElement('div');
                card.className = 'bg-panel/60 backdrop-blur-md border border-zinc-800 hover:border-neongold/80 hover:shadow-[0_0_20px_rgba(255,215,0,0.15)] transition duration-500 rounded-2xl overflow-hidden flex flex-col relative group';
                
                const isSoldOut = event.available_tickets < 1;
                const ticketPercentage = (event.available_tickets / event.total_tickets) * 100;
                const barColor = isSoldOut ? 'bg-red-900' : 'bg-neongold shadow-[0_0_8px_rgba(255,215,0,0.8)]';
                const eventImage = getEventImage(event.event_name);

                let actionArea = '';
                if (userRole === 'Customer') {
                    const btnClass = isSoldOut ? 'bg-black/50 text-zinc-500 border border-zinc-800 cursor-not-allowed' : 'bg-black/50 text-neongold border border-neongold hover:bg-neongold hover:text-black hover:shadow-[0_0_15px_rgba(255,215,0,0.6)] transition duration-300';
                    const clickAction = isSoldOut ? '' : `onclick="bookTicket(${event.event_id}, '${event.event_name}')"`;
                    actionArea = `<button ${clickAction} class="w-full py-3.5 rounded-lg font-display text-xs font-bold tracking-[0.2em] uppercase relative z-10 ${btnClass}">${isSoldOut ? 'CAPACITY REACHED' : 'INITIALIZE BOOKING'}</button>`;
                } else {
                    actionArea = `
                    <div class="flex gap-2 relative z-10">
                        <button onclick='openEventModal(${JSON.stringify(event).replace(/'/g, "\\'")})' class="flex-1 py-3 bg-black/50 border border-zinc-700 text-zinc-400 hover:border-neongold hover:text-neongold rounded-lg font-display text-[10px] tracking-widest uppercase transition">Edit Data</button>
                        <button onclick="deleteEvent(${event.event_id})" class="flex-1 py-3 bg-black/50 border border-red-900/50 text-red-500 hover:bg-red-900/20 rounded-lg font-display text-[10px] tracking-widest uppercase transition">Delete</button>
                    </div>`;
                }

                card.innerHTML = `
                    <div class="relative w-full aspect-video flex-shrink-0 overflow-hidden border-b border-zinc-800 bg-black">
                        <img src="${eventImage}" alt="${event.event_name}" class="absolute inset-0 w-full h-full object-contain group-hover:scale-105 transition duration-500 opacity-90">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
                        <span class="absolute bottom-3 right-3 text-[9px] font-bold border border-zinc-600 text-zinc-300 bg-black/80 px-2.5 py-1 rounded uppercase tracking-widest backdrop-blur-md z-10">${event.status}</span>
                    </div>
                    <div class="p-6 flex flex-col flex-1">
                        <div class="mb-4 relative z-10">
                            <h3 class="text-white font-display font-bold text-xl uppercase tracking-wider leading-tight group-hover:text-neongold transition duration-300 drop-shadow-md">${event.event_name}</h3>
                        </div>
                        <p class="text-sm text-zinc-300 font-medium mb-4 flex items-center relative z-10 drop-shadow-md">
                            <i class="fas fa-location-crosshairs text-neongold/90 mr-3 w-4 text-center drop-shadow-md"></i> ${event.venue_name}
                        </p>
                        <p class="text-sm text-zinc-400 mb-6 flex-1 leading-relaxed relative z-10 drop-shadow-md">${event.description || 'No description provided.'}</p>
                        <div class="bg-black/50 border border-zinc-800/80 rounded-xl p-4 mb-6 relative z-10 backdrop-blur-sm">
                            <div class="flex justify-between items-center mb-3">
                                <p class="text-xs text-zinc-200 flex items-center font-display tracking-widest uppercase">
                                    <i class="far fa-clock text-neongold mr-2"></i> ${event.event_date} // ${event.event_time}
                                </p>
                            </div>
                            <div>
                                <div class="flex justify-between text-xs font-display tracking-widest text-zinc-400 mb-2 uppercase">
                                    <span>Network Capacity</span>
                                    <span class="${isSoldOut ? 'text-red-400' : 'text-neongold'} drop-shadow-md">${event.available_tickets} / ${event.total_tickets}</span>
                                </div>
                                <div class="w-full bg-zinc-900/80 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                                    <div class="h-full ${barColor}" style="width: ${ticketPercentage}%"></div>
                                </div>
                            </div>
                        </div>
                        ${actionArea}
                    </div>
                `;
                container.appendChild(card);
            });
        }
    } catch (error) {
        showMessage('Connection Error fetching Events.', 'error');
    }
}

async function bookTicket(eventId, eventName) {
    if(!confirm(`Initialize booking for 1 ticket to ${eventName}?`)) return;
    try {
        const response = await fetch(`${API_URL}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ event_id: eventId, ticket_quantity: 1 })
        });
        const result = await response.json();
        if (result.success) {
            showMessage(`Booking Confirmed! Reference ID: #${result.data.booking_id}`, 'success');
            loadEvents(currentPage); 
        } else showMessage(`Booking Failed: ${result.message}`, 'error');
    } catch (error) { showMessage("Server connection failed.", 'error'); }
}

async function fetchVenuesForDropdown() {
    try {
        const response = await fetch(`${API_URL}/venues?limit=50`, { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await response.json();
        if (result.success) {
            const select = document.getElementById('event-venue');
            select.innerHTML = '<option value="">-- SELECT VENUE LOCATION --</option>';
            result.data.forEach(v => {
                select.innerHTML += `<option value="${v.venue_id}">${v.venue_name}</option>`;
            });
        }
    } catch (e) { console.error("Failed to load venues"); }
}

function openEventModal(eventObj = null) {
    fetchVenuesForDropdown();
    document.getElementById('event-modal').classList.remove('hidden');
    
    if (eventObj) {
        document.getElementById('modal-title').innerText = 'Modify Event Data';
        document.getElementById('event-id').value = eventObj.event_id;
        document.getElementById('event-name').value = eventObj.event_name;
        document.getElementById('event-date').value = eventObj.event_date;
        document.getElementById('event-time').value = eventObj.event_time;
        document.getElementById('event-tickets').value = eventObj.total_tickets;
        document.getElementById('event-status').value = eventObj.status;
        document.getElementById('event-desc').value = eventObj.description || '';
        setTimeout(() => document.getElementById('event-venue').value = eventObj.venue_id, 300);
    } else {
        document.getElementById('modal-title').innerText = 'Register Event';
        document.getElementById('event-form').reset();
        document.getElementById('event-id').value = '';
    }
}

function closeEventModal() { document.getElementById('event-modal').classList.add('hidden'); }

document.getElementById('event-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const eventId = document.getElementById('event-id').value;
    const method = eventId ? 'PUT' : 'POST';
    const endpoint = eventId ? `/events/${eventId}` : `/events`;

    const payload = {
        event_name: document.getElementById('event-name').value,
        venue_id: parseInt(document.getElementById('event-venue').value),
        event_date: document.getElementById('event-date').value,
        event_time: document.getElementById('event-time').value,
        total_tickets: parseInt(document.getElementById('event-tickets').value),
        status: document.getElementById('event-status').value,
        description: document.getElementById('event-desc').value
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (result.success) {
            closeEventModal();
            showMessage(result.message, 'success');
            loadEvents(currentPage);
        } else showMessage(`Error: ${result.message}`, 'error');
    } catch (error) { showMessage('Server connection failed.', 'error'); }
});

async function deleteEvent(eventId) {
    if (!confirm('WARNING: Are you sure you want to completely erase this event?')) return;
    try {
        const response = await fetch(`${API_URL}/events/${eventId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success) {
            showMessage(result.message, 'success');
            loadEvents(currentPage);
        } else showMessage(`Deletion Failed: ${result.message}`, 'error');
    } catch (error) { showMessage('Server connection failed.', 'error'); }
}

function updatePaginationUI() {
    const pagination = document.getElementById('pagination-controls');
    const indicator = document.getElementById('page-indicator');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (totalPages > 1) {
        pagination.classList.remove('hidden');
        indicator.innerText = `PAGE ${currentPage} OF ${totalPages}`;
        btnPrev.disabled = currentPage === 1;
        btnNext.disabled = currentPage === totalPages;
        
        btnPrev.className = currentPage === 1 ? 'px-6 py-3 bg-black/20 border border-zinc-800 text-zinc-600 rounded-lg font-display text-xs tracking-widest uppercase cursor-not-allowed' : 'px-6 py-3 bg-black/50 border border-zinc-700 hover:border-neongold text-zinc-400 hover:text-neongold rounded-lg font-display text-xs tracking-widest uppercase transition';
        btnNext.className = currentPage === totalPages ? 'px-6 py-3 bg-black/20 border border-zinc-800 text-zinc-600 rounded-lg font-display text-xs tracking-widest uppercase cursor-not-allowed' : 'px-6 py-3 bg-black/50 border border-zinc-700 hover:border-neongold text-zinc-400 hover:text-neongold rounded-lg font-display text-xs tracking-widest uppercase transition';
    } else pagination.classList.add('hidden');
}

function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) loadEvents(newPage);
}

function showMessage(msg, type) {
    const msgBox = document.getElementById('system-message');
    msgBox.classList.remove('hidden');
    msgBox.innerHTML = msg;
    msgBox.className = type === 'success' 
        ? 'mb-6 p-4 rounded-lg font-display tracking-widest text-sm uppercase border bg-green-900/20 border-green-500/50 text-green-400 backdrop-blur-sm'
        : 'mb-6 p-4 rounded-lg font-display tracking-widest text-sm uppercase border bg-red-900/20 border-red-500/50 text-red-400 backdrop-blur-sm';
    setTimeout(() => msgBox.classList.add('hidden'), 5000);
}

function disconnect() { localStorage.clear(); window.location.href = 'login.html'; }

loadEvents();