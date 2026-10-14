/**
 * NovaTix Client-Side Auth State Management
 * Token persistence and role permission validation
 */

const auth = {
  getToken() {
    return localStorage.getItem(CONFIG.STORAGE_KEY_TOKEN);
  },

  getUser() {
    const userStr = localStorage.getItem(CONFIG.STORAGE_KEY_USER);
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  setSession(token, user) {
    localStorage.setItem(CONFIG.STORAGE_KEY_TOKEN, token);
    localStorage.setItem(CONFIG.STORAGE_KEY_USER, JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem(CONFIG.STORAGE_KEY_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEY_USER);
    ui.renderNav();
    app.navigate('home');
    ui.showToast('Logged out successfully.');
  },

  isLoggedIn() {
    return !!auth.getToken();
  },

  hasRole(allowedRoles = []) {
    const user = auth.getUser();
    if (!user) return false;
    return allowedRoles.includes(user.role);
  }
};