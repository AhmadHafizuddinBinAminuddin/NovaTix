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
    document.getElementById('btn-add-venue').classList.remove('hidden');
}

let currentPage = 1;
let totalPages = 1;

function getVenueImage(venueName) {
    const name = venueName.toUpperCase();
    if (name.includes('NOVA HALL')) return 'Hall.jpg';
    if (name.includes('CITY CONVENTION')) return 'City Convention Centre.jpg';
    if (name.includes('HARMONY AUDITORIUM')) return 'Harmony Auditarium.jpg';
    if (name.includes('CREATIVE SPACE')) return 'Creative Space.jpg';
    if (name.includes('GRAND EVENT')) return 'Grand Event Gallery.jpg';
    return 'novatix-bg.jpg';
}

async function loadVenues(page = 1) {
    const container = document.getElementById('venues-container');
    try {
        const response = await fetch(`${API_URL}/venues?page=${page}&limit=9`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            container.innerHTML = ''; 
            const venues = result.data;
            
            currentPage = result.pagination.current_page;
            totalPages = result.pagination.total_pages;
            updatePaginationUI();

            if (venues.length === 0) {
                container.innerHTML = `<p class="text-zinc-500 font-display tracking-widest text-sm uppercase col-span-full">No venues found in the registry.</p>`;
                return;
            }

            venues.forEach(venue => {
                const card = document.createElement('div');
                card.className = 'bg-panel/60 backdrop-blur-md border border-zinc-800 hover:border-neongold/50 rounded-2xl overflow-hidden flex flex-col relative group shadow-lg transition duration-300';
                
                const venueImage = getVenueImage(venue.venue_name);

                const manageButtons = (userRole === 'Administrator' || userRole === 'Staff') ? `
                    <div class="flex gap-2 mt-4 pt-4 border-t border-zinc-800/60 relative z-10">
                        <button onclick='openModal(${JSON.stringify(venue).replace(/'/g, "\\'")})' class="flex-1 py-3 bg-black/50 border border-zinc-700 text-zinc-400 hover:border-neongold hover:text-neongold rounded-lg font-display text-[10px] tracking-widest uppercase transition">Edit</button>
                        <button onclick="deleteVenue(${venue.venue_id})" class="flex-1 py-3 bg-black/50 border border-red-900/50 text-red-500 hover:bg-red-900/20 rounded-lg font-display text-[10px] tracking-widest uppercase transition">Delete</button>
                    </div>
                ` : '';

                card.innerHTML = `
                    <div class="relative w-full aspect-video flex-shrink-0 overflow-hidden border-b border-zinc-800 bg-black">
                        <img src="${venueImage}" alt="${venue.venue_name}" class="absolute inset-0 w-full h-full object-contain group-hover:scale-105 transition duration-500 opacity-90">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
                        <span class="absolute bottom-3 right-3 text-[9px] font-bold border border-zinc-600 text-zinc-300 bg-black/80 px-2.5 py-1 rounded uppercase tracking-widest backdrop-blur-md z-10">ID #${venue.venue_id}</span>
                    </div>
                    <div class="p-6 flex flex-col flex-1">
                        <div class="mb-4 relative z-10">
                            <h3 class="text-white font-display font-bold text-xl uppercase tracking-wider leading-tight group-hover:text-neongold transition duration-300 drop-shadow-md">${venue.venue_name}</h3>
                        </div>
                        <p class="text-sm text-zinc-300 mb-2 flex items-start relative z-10 drop-shadow-md">
                            <i class="fas fa-map-marker-alt text-neongold/70 mr-3 mt-1"></i> ${venue.address}
                        </p>
                        <p class="text-sm text-zinc-400 mb-6 flex-1 line-clamp-2 relative z-10 drop-shadow-md">${venue.description || 'No additional parameters defined.'}</p>
                        <div class="inline-flex items-center bg-black/50 border border-zinc-800 rounded-lg px-4 py-2 w-max mb-2 relative z-10 backdrop-blur-sm">
                            <i class="fas fa-users text-neongold mr-2"></i>
                            <span class="text-xs font-display tracking-widest uppercase text-zinc-300">Max Capacity: <strong class="text-white ml-1">${venue.capacity}</strong></span>
                        </div>
                        ${manageButtons}
                    </div>
                `;
                container.appendChild(card);
            });
        }
    } catch (error) {
        showMessage('Critical System Failure fetching venues.', 'error');
    }
}

function openModal(venue = null) {
    document.getElementById('venue-modal').classList.remove('hidden');
    
    if (venue) {
        document.getElementById('modal-title').innerText = 'Modify Node';
        document.getElementById('venue-id').value = venue.venue_id;
        document.getElementById('venue-name').value = venue.venue_name;
        document.getElementById('venue-address').value = venue.address;
        document.getElementById('venue-capacity').value = venue.capacity;
        document.getElementById('venue-desc').value = venue.description || '';
    } else {
        document.getElementById('modal-title').innerText = 'Register Node';
        document.getElementById('venue-form').reset();
        document.getElementById('venue-id').value = '';
    }
}

function closeModal() {
    document.getElementById('venue-modal').classList.add('hidden');
}

document.getElementById('venue-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const venueId = document.getElementById('venue-id').value;
    const method = venueId ? 'PUT' : 'POST';
    const endpoint = venueId ? `/venues/${venueId}` : `/venues`;

    const payload = {
        venue_name: document.getElementById('venue-name').value,
        address: document.getElementById('venue-address').value,
        capacity: parseInt(document.getElementById('venue-capacity').value),
        description: document.getElementById('venue-desc').value
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if (result.success) {
            closeModal();
            showMessage(result.message, 'success');
            loadVenues(currentPage);
        } else {
            showMessage(`Error: ${result.message}`, 'error');
        }
    } catch (error) {
        showMessage('Server connection failed.', 'error');
    }
});

async function deleteVenue(venueId) {
    if (!confirm('WARNING: Are you sure you want to delete this venue?')) return;

    try {
        const response = await fetch(`${API_URL}/venues/${venueId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            showMessage(result.message, 'success');
            loadVenues(currentPage);
        } else {
            showMessage(`Deletion Failed: ${result.message}`, 'error');
        }
    } catch (error) {
        showMessage('Server connection failed.', 'error');
    }
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
    } else {
        pagination.classList.add('hidden');
    }
}

function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) loadVenues(newPage);
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

function disconnect() {
    localStorage.clear();
    window.location.href = 'login.html';
}

loadVenues();