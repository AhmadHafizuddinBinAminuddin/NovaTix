const API_URL = 'http://localhost/NovaTix/api.php';

document.getElementById('register-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const fullName = document.getElementById('fullname').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageBox = document.getElementById('message-box');

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
        messageBox.classList.remove('hidden');

        if (result.success) {
            messageBox.className = 'text-xs font-display tracking-widest uppercase p-4 rounded-xl text-center border border-green-500/50 bg-green-900/20 text-green-400 mb-4';
            messageBox.innerHTML = 'Profile Initialized. Redirecting to login...';
            
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        } else {
            messageBox.className = 'text-xs font-display tracking-widest uppercase p-4 rounded-xl text-center border border-red-500/50 bg-red-900/20 text-red-400 mb-4';
            messageBox.innerHTML = `Error: ${result.message}`;
        }
    } catch (error) {
        messageBox.classList.remove('hidden');
        messageBox.className = 'text-xs font-display tracking-widest uppercase p-4 rounded-xl text-center border border-red-500/50 bg-red-900/20 text-red-400 mb-4';
        messageBox.innerHTML = 'Critical Connection Failure.';
    }
});