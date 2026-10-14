const API_URL = 'http://localhost/NovaTix/api.php';

// UI Toggle Function
function toggleForm(type) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnLogin = document.getElementById('btn-login-toggle');
    const btnRegister = document.getElementById('btn-register-toggle');
    const msgBox = document.getElementById('message-box');

    msgBox.classList.add('hidden'); // Clear messages on toggle

    if (type === 'login') {
        loginForm.classList.remove('hidden');
        loginForm.classList.add('block');
        registerForm.classList.add('hidden');
        registerForm.classList.remove('block');

        // Style Login button as active
        btnLogin.className = "flex-1 py-2.5 rounded-full bg-neongold text-black font-display text-xs font-bold tracking-widest uppercase transition-all duration-300 shadow-[0_0_10px_rgba(255,215,0,0.4)]";
        btnRegister.className = "flex-1 py-2.5 rounded-full text-zinc-400 hover:text-white font-display text-xs font-bold tracking-widest uppercase transition-all duration-300";
    } else {
        registerForm.classList.remove('hidden');
        registerForm.classList.add('block');
        loginForm.classList.add('hidden');
        loginForm.classList.remove('block');

        // Style Register button as active
        btnRegister.className = "flex-1 py-2.5 rounded-full bg-neongold text-black font-display text-xs font-bold tracking-widest uppercase transition-all duration-300 shadow-[0_0_10px_rgba(255,215,0,0.4)]";
        btnLogin.className = "flex-1 py-2.5 rounded-full text-zinc-400 hover:text-white font-display text-xs font-bold tracking-widest uppercase transition-all duration-300";
    }
}

function showMessage(msg, type) {
    const msgBox = document.getElementById('message-box');
    msgBox.classList.remove('hidden');
    msgBox.innerHTML = msg;
    if (type === 'success') msgBox.className = 'text-xs font-display tracking-widest uppercase p-4 rounded-xl text-center border border-green-500/50 bg-green-900/20 text-green-400 mb-4 relative z-10';
    if (type === 'error') msgBox.className = 'text-xs font-display tracking-widest uppercase p-4 rounded-xl text-center border border-red-500/50 bg-red-900/20 text-red-400 mb-4 relative z-10';
}

// Handle Login Submission
document.getElementById('login-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        });
        const result = await response.json();

        if (result.success) {
            localStorage.setItem('jwt_token', result.access_token);
            localStorage.setItem('user_name', result.data.full_name);
            localStorage.setItem('user_role', result.data.role);

            showMessage('Authentication Successful. Redirecting...', 'success');
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        } else {
            showMessage(`Access Denied: ${result.message}`, 'error');
        }
    } catch (error) {
        showMessage('Critical Connection Failure.', 'error');
    }
});

// Handle Register Submission
document.getElementById('register-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    const fullName = document.getElementById('reg-fullname').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: fullName,
                email: email,
                password: password
            })
        });
        const result = await response.json();

        if (result.success) {
            showMessage('Profile Initialized. You may now login.', 'success');
            setTimeout(() => { toggleForm('login'); }, 2000); // Switch back to login page
        } else {
            showMessage(`Registration Failed: ${result.message}`, 'error');
        }
    } catch (error) {
        showMessage('Critical Connection Failure.', 'error');
    }
});