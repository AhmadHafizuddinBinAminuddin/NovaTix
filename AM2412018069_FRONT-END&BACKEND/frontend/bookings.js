const API_URL = 'http://localhost/NovaTix/api.php';

const token = localStorage.getItem('jwt_token');
const userRole = localStorage.getItem('user_role');
if (!token) {
    window.location.href = 'login.html';
}

document.getElementById('user-name-display').innerText = localStorage.getItem('user_name') || 'UNKNOWN';
document.getElementById('user-role-display').innerText = userRole || 'GUEST';

if (userRole !== 'Administrator') {
    const registryLink = document.querySelector('a[href="registry.html"]');
    if (registryLink) {
        registryLink.style.display = 'none';
    }
}

let currentPage = 1;
let totalPages = 1;

async function loadBookings(page = 1) {
    const container = document.getElementById('bookings-container');
    const pagination = document.getElementById('pagination-controls');

    try {
        const response = await fetch(`${API_URL}/bookings?page=${page}&limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await response.json();

        if (result.success) {
            container.innerHTML = ''; 
            const bookings = result.data;
            
            currentPage = result.pagination.current_page;
            totalPages = result.pagination.total_pages;
            updatePaginationUI();

            if (bookings.length === 0) {
                container.innerHTML = `<p class="text-zinc-500 font-display tracking-widest text-sm uppercase col-span-full">No records found in the ledger.</p>`;
                return;
            }

            bookings.forEach(booking => {
                const card = document.createElement('div');
                card.id = `ticket-${booking.booking_id}`;
                card.className = 'bg-panel/60 backdrop-blur-md border border-zinc-800 hover:border-neongold/30 rounded-2xl p-6 flex flex-col relative overflow-hidden shadow-lg transition duration-300';
                
                let statusColor = 'text-zinc-400 border-zinc-600';
                if (booking.booking_status === 'Confirmed') statusColor = 'text-green-400 border-green-600 bg-green-900/20';
                if (booking.booking_status === 'Cancelled') statusColor = 'text-red-400 border-red-600 bg-red-900/20';

                const liveQrCodeUrl = booking.qr_code || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=NOVATIX-ID-${booking.booking_id}`;
                
                const qrImage = booking.booking_status === 'Cancelled'
                    ? `<div class="w-32 h-32 flex items-center justify-center border border-red-900/40 bg-black/50 rounded-xl text-red-900/40 shadow-inner"><i class="fas fa-qrcode text-4xl"></i></div>`
                    : `<img src="${liveQrCodeUrl}" alt="QR" class="w-32 h-32 object-contain rounded-xl border border-neongold/50 p-2 bg-white shadow-[0_0_15px_rgba(255,215,0,0.1)]">`;

                const canCancel = booking.booking_status === 'Confirmed' && userRole === 'Customer';
                const cancelButton = canCancel 
                    ? `<button onclick="cancelBooking(${booking.booking_id})" class="w-full py-3.5 border border-red-900/60 text-red-500 hover:bg-red-900/30 transition rounded-xl font-display text-[10px] font-bold tracking-widest uppercase">Cancel Transmission</button>`
                    : ``;

                const pdfButton = booking.booking_status === 'Confirmed'
                    ? `<button onclick="downloadPDF('${booking.booking_id}', '${booking.event_name}')" class="w-full py-3.5 border border-neongold text-neongold hover:bg-neongold hover:text-black transition rounded-xl font-display text-[10px] font-bold tracking-widest uppercase mb-2">Download PDF Ticket</button>`
                    : ``;

                const bookerInfo = userRole !== 'Customer' 
                    ? `<p class="text-[10px] text-neongold font-display tracking-widest uppercase mb-3 text-center"><i class="fas fa-user mr-1"></i> ${booking.full_name}</p>` 
                    : '';

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-6">
                        <span class="text-xs font-display tracking-widest text-zinc-500">ID: #${booking.booking_id}</span>
                        <span class="text-[9px] font-bold border px-2 py-1 rounded w-max uppercase tracking-widest ${statusColor}">${booking.booking_status}</span>
                    </div>
                    
                    <div class="flex flex-col items-center mb-6">
                        ${qrImage}
                    </div>
                    
                    <div class="flex-1 flex flex-col items-center text-center">
                        ${bookerInfo}
                        <h3 class="text-white font-display font-bold text-xl uppercase tracking-wider leading-tight mb-3">${booking.event_name}</h3>
                        <p class="text-sm text-zinc-300 mb-1"><i class="fas fa-location-crosshairs text-neongold/70 mr-2"></i> ${booking.venue_name}</p>
                        <p class="text-sm text-zinc-400 mb-5"><i class="far fa-clock text-neongold/70 mr-2"></i> ${booking.event_date} // ${booking.event_time}</p>
                        
                        <div class="inline-flex items-center bg-black/50 border border-zinc-800 rounded-lg px-4 py-2 w-max mb-2">
                            <i class="fas fa-ticket-alt text-neongold mr-2"></i>
                            <span class="text-xs font-display tracking-widest uppercase text-zinc-300">Tokens: <strong class="text-white ml-1">${booking.ticket_quantity}</strong></span>
                        </div>
                    </div>
                    
                    <div class="mt-auto w-full pt-4 border-t border-zinc-800/60" data-html2canvas-ignore>
                        ${pdfButton}
                        ${cancelButton}
                    </div>
                `;
                container.appendChild(card);
            });
        } else {
            showMessage(`Error: ${result.message}`, 'error');
        }
    } catch (error) {
        showMessage('Critical System Failure.', 'error');
    }
}

function downloadPDF(bookingId, eventName) {
    const element = document.getElementById(`ticket-${bookingId}`);
    const cleanEventName = eventName.replace(/[^a-zA-Z0-9]/g, '_');
    
    const opt = {
        margin: 0.5,
        filename: `NovaTix_Ticket_${cleanEventName}_ID${bookingId}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0A0A0A' },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
}

async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you wish to terminate this transmission and cancel your ticket?')) return;

    try {
        const response = await fetch(`${API_URL}/bookings/${bookingId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            showMessage('Booking terminated successfully. Tokens restored.', 'success');
            loadBookings(currentPage);
        } else {
            showMessage(`Cancellation Failed: ${result.message}`, 'error');
        }
    } catch (error) {
        showMessage('System Failure.', 'error');
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
    if (newPage >= 1 && newPage <= totalPages) {
        loadBookings(newPage);
    }
}

function showMessage(msg, type) {
    const msgBox = document.getElementById('system-message');
    msgBox.classList.remove('hidden');
    msgBox.innerHTML = msg;
    if (type === 'success') msgBox.className = 'mb-6 p-4 rounded-lg font-display tracking-widest text-sm uppercase border bg-green-900/20 border-green-500/50 text-green-400 backdrop-blur-sm';
    if (type === 'error') msgBox.className = 'mb-6 p-4 rounded-lg font-display tracking-widest text-sm uppercase border bg-red-900/20 border-red-500/50 text-red-400 backdrop-blur-sm';
    setTimeout(() => msgBox.classList.add('hidden'), 5000);
}

function disconnect() {
    localStorage.clear();
    window.location.href = 'login.html';
}

loadBookings();