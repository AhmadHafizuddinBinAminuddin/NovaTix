const API_URL = 'http://localhost/NovaTix/api.php';

// Authentication & Role Enforcement
const token = localStorage.getItem('jwt_token');
const userRole = localStorage.getItem('user_role');

if (!token) window.location.href = 'login.html';

// STRICT ADMIN CHECK
if (userRole !== 'Administrator') {
    document.body.innerHTML = `
        <div class="h-screen w-full flex flex-col items-center justify-center bg-black/90">
            <i class="fas fa-shield-alt text-red-500 text-6xl mb-4"></i>
            <h1 class="text-white font-display text-3xl font-bold tracking-widest uppercase mb-2">ACCESS DENIED</h1>
            <p class="text-zinc-400 font-sans mb-6">Your current security clearance (${userRole || 'UNKNOWN'}) does not permit access to the Citizen Registry.</p>
            <button onclick="window.location.href='index.html'" class="px-8 py-3 border border-neongold text-neongold hover:bg-neongold hover:text-black rounded-full font-display text-xs font-bold tracking-widest uppercase transition">Return to Directory</button>
        </div>
    `;
    throw new Error("Unauthorized Access Attempt");
}

document.getElementById('user-name-display').innerText = localStorage.getItem('user_name') || 'UNKNOWN';
document.getElementById('user-role-display').innerText = userRole;

async function loadUsers() {
    const container = document.getElementById('users-container');

    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            container.innerHTML = ''; 
            const users = result.data;

            if (users.length === 0) {
                container.innerHTML = `<p class="text-zinc-500 font-display tracking-widest text-sm uppercase col-span-full">No users found.</p>`;
                return;
            }

            users.forEach(user => {
                const card = document.createElement('div');
                card.className = 'bg-panel/60 backdrop-blur-md border border-zinc-800 hover:border-neongold/50 rounded-2xl p-6 flex flex-col relative shadow-lg transition duration-300';
                
                // Color code the roles
                let roleColor = 'text-zinc-300 border-zinc-600 bg-black/40';
                if (user.role === 'Administrator') roleColor = 'text-neongold border-neongold bg-neongold/10 shadow-[0_0_8px_rgba(255,215,0,0.4)]';
                if (user.role === 'Staff') roleColor = 'text-blue-400 border-blue-600 bg-blue-900/20';

                // Prevent Admin from deleting themselves
                const myId = parseInt(JSON.parse(atob(token.split('.')[1])).sub);
                const isMe = myId === user.user_id;
                
                const deleteBtn = isMe 
                    ? `<button disabled class="flex-1 py-2 border border-zinc-800 text-zinc-600 rounded-lg font-display text-[10px] tracking-widest uppercase cursor-not-allowed">Cannot Delete Self</button>`
                    : `<button onclick="deleteUser(${user.user_id})" class="flex-1 py-2 border border-red-900/50 text-red-500 hover:bg-red-900/20 rounded-lg font-display text-[10px] tracking-widest uppercase transition">Erase</button>`;

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
                                <i class="fas fa-user"></i>
                            </div>
                            <div>
                                <h3 class="text-white font-display font-bold uppercase tracking-wider leading-tight">${user.full_name}</h3>
                                <span class="text-[9px] font-bold border px-2 py-0.5 rounded uppercase tracking-widest mt-1 inline-block ${roleColor}">${user.role}</span>
                            </div>
                        </div>
                    </div>
                    <p class="text-sm text-zinc-300 mb-2 flex items-center"><i class="fas fa-envelope text-neongold/70 mr-3 w-4 text-center"></i> ${user.email}</p>
                    <p class="text-xs text-zinc-500 mb-4 flex-1 flex items-center"><i class="fas fa-fingerprint text-neongold/70 mr-3 w-4 text-center"></i> UID #${user.user_id} // Registered ${user.created_at.split(' ')[0]}</p>
                    <div class="flex gap-2 mt-4 pt-4 border-t border-zinc-800">
                        <button onclick='openUserModal(${JSON.stringify(user).replace(/'/g, "\\'")})' class="flex-1 py-2 border border-zinc-700 text-zinc-400 hover:border-neongold hover:text-neongold rounded-lg font-display text-[10px] tracking-widest uppercase transition">Modify</button>
                        ${deleteBtn}
                    </div>
                `;
                container.appendChild(card);
            });
        } else {
            showMessage(`Access Error: ${result.message}`, 'error');
        }
    } catch (error) {
        showMessage('Critical System Failure fetching users.', 'error');
    }
}

// Modal Logic
function openUserModal(userObj) {
    document.getElementById('user-modal').classList.remove('hidden');
    document.getElementById('user-id').value = userObj.user_id;
    document.getElementById('user-fullname').value = userObj.full_name;
    document.getElementById('user-email').value = userObj.email;
    document.getElementById('user-role').value = userObj.role;
    document.getElementById('user-password').value = ''; 
}

function closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
}

// Submit Edits
document.getElementById('user-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const userId = document.getElementById('user-id').value;
    const payload = {
        full_name: document.getElementById('user-fullname').value,
        email: document.getElementById('user-email').value,
        role: document.getElementById('user-role').value
    };

    // Only attach password if they typed something
    const newPassword = document.getElementById('user-password').value;
    if (newPassword.trim() !== '') {
        payload.password = newPassword;
    }

    try {
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if (result.success) {
            closeUserModal();
            showMessage('Personnel profile updated successfully.', 'success');
            loadUsers();
            
            // If the admin updated their own name/role, reflect it in the sidebar
            const myId = parseInt(JSON.parse(atob(token.split('.')[1])).sub);
            if (myId === parseInt(userId)) {
                localStorage.setItem('user_name', payload.full_name);
                localStorage.setItem('user_role', payload.role);
                document.getElementById('user-name-display').innerText = payload.full_name;
                document.getElementById('user-role-display').innerText = payload.role;
            }
        } else {
            showMessage(`Error: ${result.message}`, 'error');
        }
    } catch (error) {
        showMessage('Server connection failed.', 'error');
    }
});

// Delete User
async function deleteUser(userId) {
    if (!confirm('WARNING: Are you sure you want to permanently erase this user from the registry?')) return;

    try {
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            showMessage('Personnel erased successfully.', 'success');
            loadUsers();
        } else {
            showMessage(`Deletion Failed: ${result.message}`, 'error');
        }
    } catch (error) {
        showMessage('Server connection failed.', 'error');
    }
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

loadUsers();