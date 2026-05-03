/* ============================================================
   auth.js – Shared authentication guard for all pages
   Include BEFORE page-specific scripts
   ============================================================ */

const Auth = {
  // Which page requires which role: null = any logged-in user
  pageRules: {
    'dashboard.html': 'admin',
    'chat.html':      null,
    'index.html':     null,
  },

  async check() {
    const page = window.location.pathname.split('/').pop() || 'index.html';

    let data;
    try {
      const res = await fetch('api/check_auth.php', { credentials: 'include' });
      data = await res.json();
    } catch (e) {
      // Can't reach API (probably running as file://) — skip guard in dev
      console.warn('[Auth] API unreachable – running in file:// mode, skipping auth guard');
      Auth.renderNavPublic();
      return;
    }

    if (!data.loggedIn) {
      // Not logged in
      if (page !== 'login.html' && page !== 'register.html') {
        window.location.href = 'login.html';
      }
      return;
    }

    // Logged in — check role restriction
    const requiredRole = Auth.pageRules[page];
    if (requiredRole && data.role !== requiredRole) {
      // Not authorized for this page
      Auth.showAccessDenied();
      setTimeout(() => { window.location.href = 'index.html'; }, 2500);
      return;
    }

    // Render the user info in the navbar
    Auth.renderNavUser(data);

    // Expose globally for other scripts
    window.currentUser = data;

    // Dispatch event so other scripts (like chat.js) know the user is ready
    window.dispatchEvent(new CustomEvent('userAuthenticated', { detail: data }));

    // Update context panel in chat.html if present
    Auth.updateChatContext(data);
  },

  renderNavUser(data) {
    const nameEl = document.getElementById('navUserName');
    const ctaEl  = document.getElementById('hero-cta-nav');
    const logoutEl = document.getElementById('navLogoutBtn');
    const loginLi  = document.getElementById('navLoginItem');

    if (nameEl)   nameEl.textContent = data.first_name + ' ' + data.last_name;
    if (ctaEl)    ctaEl.style.display = 'none';
    if (logoutEl) logoutEl.style.display = 'inline-flex';
    if (loginLi)  loginLi.style.display = 'none';

    // Hide dashboard links if not admin
    const dashLink = document.getElementById('navDashLink');
    const heroDash = document.getElementById('hero-cta-dash');
    if (data.role !== 'admin') {
      if (dashLink) dashLink.parentElement.style.display = 'none';
      if (heroDash) heroDash.style.display = 'none';
    }
  },

  renderNavPublic() {
    // Show login link, hide logout
    const logoutEl = document.getElementById('navLogoutBtn');
    if (logoutEl) logoutEl.style.display = 'none';

    // Hide dashboard links for non-logged-in users
    const dashLink = document.getElementById('navDashLink');
    const heroDash = document.getElementById('hero-cta-dash');
    if (dashLink) dashLink.parentElement.style.display = 'none';
    if (heroDash) heroDash.style.display = 'none';
  },

  updateChatContext(data) {
    // Fill dynamic profile if on chat page
    const nameEl    = document.getElementById('profileName');
    const initialEl = document.getElementById('profileInitial');
    
    // Only show the initial letter of the last name
    const lastInitial = data.last_name ? data.last_name.charAt(0).toUpperCase() + '.' : '';
    const displayName = data.first_name + ' ' + lastInitial;

    if (nameEl)    nameEl.textContent    = displayName;
    if (initialEl) initialEl.textContent = data.first_name[0].toUpperCase();

    // Fetch full profile for balances and card
    if (document.getElementById('messagesInner')) {
      fetch('api/get_user.php', { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (!d.success) return;
          const u = d.user;
          
          // Store full profile globally for chat logic
          window.currentUser = { ...window.currentUser, ...u };

          const ccEl = document.getElementById('ctx-cc-val');
          const epEl = document.getElementById('ctx-ep-val');
          const ctypeEl = document.getElementById('ctx-card-type');
          const cexpEl  = document.getElementById('ctx-card-expiry');

          if (ccEl) ccEl.textContent = parseFloat(u.compte_courant).toLocaleString('fr-TN', {minimumFractionDigits:3}) + ' DT';
          if (epEl) epEl.textContent = parseFloat(u.compte_epargne).toLocaleString('fr-TN', {minimumFractionDigits:3}) + ' DT';
          if (ctypeEl) ctypeEl.textContent = u.card_type || 'Carte Bancaire';
          if (cexpEl)  cexpEl.textContent  = u.card_expiry || '--/--';
        })
        .catch(() => {});
    }
  },

  async logout() {
    try {
      await fetch('api/logout.php', { credentials: 'include' });
    } catch (e) {}
    window.location.href = 'login.html';
  },

  showAccessDenied() {
    const div = document.createElement('div');
    div.style.cssText = `
      position:fixed;inset:0;background:rgba(255,255,255,0.95);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      z-index:9999;font-family:Inter,sans-serif;
    `;
    div.innerHTML = `
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <h2 style="font-size:20px;font-weight:800;color:#1A1B1E;margin-bottom:8px">Accès refusé</h2>
      <p style="color:#6B6C78;font-size:14px">Cette page est réservée aux administrateurs.</p>
      <p style="color:#F7941D;font-size:13px;margin-top:6px">Redirection en cours…</p>
    `;
    document.body.appendChild(div);
  }
};

// Auto-run on page load
document.addEventListener('DOMContentLoaded', () => Auth.check());

// Wire logout buttons
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
  });
});
