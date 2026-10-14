/**
 * NovaTix UI Component Renderer and View Controller
 */

const ui = {
  // Navigation & Page Switching
  renderNav() {
    const user = auth.getUser();
    const userActionArea = document.getElementById('user-actions');
    const authOnlyItems = document.querySelectorAll('.auth-only');
    const customerOnlyItems = document.querySelectorAll('.customer-only');
    const staffOnlyItems = document.querySelectorAll('.staff-only');
    const adminOnlyItems = document.querySelectorAll('.admin-only');

    // Default visibility hides restricted links
    authOnlyItems.forEach(el => el.classList.add('hidden'));
    customerOnlyItems.forEach(el => el.classList.add('hidden'));
    staffOnlyItems.forEach(el => el.classList.add('hidden'));
    adminOnlyItems.forEach(el => el.classList.add('hidden'));

    if (user) {
      authOnlyItems.forEach(el => el.classList.remove('hidden'));

      if (user.role === 'Customer') {
        customerOnlyItems.forEach(el => el.classList.remove('hidden'));
      } else if (user.role === 'Staff') {
        staffOnlyItems.forEach(el => el.classList.remove('hidden'));
      } else if (user.role === 'Administrator') {
        staffOnlyItems.forEach(el => el.classList.remove('hidden'));
        adminOnlyItems.forEach(el => el.classList.remove('hidden'));
      }

      userActionArea.innerHTML = `
        <div class="user-badge">
          <span class="user-role-tag">${user.role}</span>
          <span style="font-weight:600; color:#fff;">${ui.escape(user.full_name)}</span>
          <button class="cyber-button glow-pink" style="padding:4px 10px;" onclick="auth.logout()">LOGOUT</button>
        </div>
      `;
    } else {
      userActionArea.innerHTML = `
        <button class="cyber-button glow-cyan" onclick="ui.openModal('modal-auth')">LOGIN / REGISTER</button>
      `;
    }
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4000);
  },

  openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  },

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  },

  switchAuthMode(mode) {
    const loginForm = document.getElementById('form-login');
    const regForm = document.getElementById('form-register');
    const loginTab = document.getElementById('auth-tab-login');
    const regTab = document.getElementById('auth-tab-register');

    if (mode === 'login') {
      loginForm.classList.add('active');
      regForm.classList.remove('active');
      loginTab.classList.add('active');
      regTab.classList.remove('active');
    } else {
      regForm.classList.add('active');
      loginForm.classList.remove('active');
      regTab.classList.add('active');
      loginTab.classList.remove('active');
    }
  },

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};