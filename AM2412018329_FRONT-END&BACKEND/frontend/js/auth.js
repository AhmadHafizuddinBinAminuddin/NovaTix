/**
 * NOVATIX AUTHENTICATION & ROLE MANAGEMENT
 */

const Auth = {
    getUser() {
        try {
            return JSON.parse(localStorage.getItem(CONFIG.USER_KEY)) || null;
        } catch {
            return null;
        }
    },

    getToken() {
        return localStorage.getItem(CONFIG.TOKEN_KEY) || null;
    },

    setSession(token, user) {
        localStorage.setItem(CONFIG.TOKEN_KEY, token);
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
        UI.updateAuthUI();
    },

    clearSession() {
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
        UI.updateAuthUI();
    },

    isAuthenticated() {
        return !!this.getToken() && !!this.getUser();
    },

    hasRole(...roles) {
        const user = this.getUser();
        return user && roles.includes(user.role);
    },

    async login(email, password) {
        const res = await API.login({ email, password });
        if (res.data.success) {
            this.setSession(res.data.access_token, res.data.data);
            UI.showToast('Authentication spell successful!', 'success');
            UI.closeAuthModal();
            UI.switchView('events');
        } else {
            UI.showToast(res.data.message || 'Invalid credentials.', 'error');
        }
    },

    async register(fullName, email, password) {
        const res = await API.register({ full_name: fullName, email, password });
        if (res.data.success) {
            UI.showToast('Wizard account created successfully! Please log in.', 'success');
            UI.switchAuthTab('login');
        } else {
            UI.showToast(res.data.message || 'Registration failed.', 'error');
        }
    },

    logout() {
        this.clearSession();
        UI.showToast('You have departed NovaTix.', 'info');
        UI.switchView('events');
    },

    handleUnauthorized() {
        if (this.getToken()) {
            UI.showToast('Your session has expired. Please log in again.', 'error');
            this.clearSession();
            UI.switchView('events');
        }
    }
};