/* ==========================================================================
   CH Aluminios ERP -- JS Module: 16-auth.js
   Creative Glassmorphic 3D Login, User Session Management & Logout
   ========================================================================== */
'use strict';

  function isUserAuthenticated() {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('chapp_auth_token')) {
        return true;
      }
      if (typeof localStorage !== 'undefined' && localStorage.getItem('chapp_remember_token')) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function getStoredUser() {
    try {
      const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('chapp_user')) ||
                     (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('chapp_user'));
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return null;
  }

  function openLogin() {
    const loginView = document.getElementById('loginView');
    const mainNavbar = document.getElementById('mainNavbar');
    const homeView = document.getElementById('homeMenuView');
    const workspace = document.getElementById('moduleWorkspace');
    const webclient = document.getElementById('webclient');

    if (webclient) webclient.classList.remove('o_home_menu_background');
    if (mainNavbar) mainNavbar.style.display = 'none';
    if (homeView) homeView.style.display = 'none';
    if (workspace) workspace.style.display = 'none';
    if (loginView) {
      loginView.style.display = 'flex';
      renderLoginView();
    }
  }

  function renderLoginView() {
    const loginView = document.getElementById('loginView');
    if (!loginView) return;

    const users = (state.data?.settings?.users && state.data.settings.users.length > 0)
      ? state.data.settings.users
      : [
          { id: 1, name: 'Administrador CHapp', email: 'chappdevm@gmail.com', role: 'Administrador General' },
          { id: 2, name: 'Laura Gómez', email: 'laura.gomez@chapperp.co', role: 'Ejecutiva Comercial' }
        ];

    const activeUser = state.data?.settings?.active_user || users[0];
    const defaultEmail = activeUser.email || 'chappdevm@gmail.com';

    loginView.innerHTML = `
      <!-- Glowing Background Light Orbs -->
      <div class="o_login_glow_orb o_login_orb_1" aria-hidden="true"></div>
      <div class="o_login_glow_orb o_login_orb_2" aria-hidden="true"></div>

      <!-- 3D Abstract Floating Elements Stage (Based on reference design) -->
      <div class="o_login_3d_stage" aria-hidden="true">
        <!-- 1. Glossy 3D Torus / Ring (Top Center-Left) -->
        <svg class="o_login_shape o_shape_torus" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="torusGrad1" x1="20" y1="20" x2="140" y2="140" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#41F2F2" />
              <stop offset="45%" stop-color="#14B5D9" />
              <stop offset="85%" stop-color="#074073" />
              <stop offset="100%" stop-color="#021a30" />
            </linearGradient>
            <radialGradient id="torusShine" cx="45%" cy="30%" r="55%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.7" />
              <stop offset="35%" stop-color="#41F2F2" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#074073" stop-opacity="0" />
            </radialGradient>
            <filter id="torusGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#021426" flood-opacity="0.6" />
            </filter>
          </defs>
          <path d="M 80 15 A 65 65 0 1 0 80 145 A 65 65 0 1 0 80 15 M 80 45 A 35 35 0 1 1 80 115 A 35 35 0 1 1 80 45" fill="url(#torusGrad1)" filter="url(#torusGlow)" />
          <path d="M 80 15 A 65 65 0 1 0 80 145 A 65 65 0 1 0 80 15 M 80 45 A 35 35 0 1 1 80 115 A 35 35 0 1 1 80 45" fill="url(#torusShine)" />
        </svg>

        <!-- 2. Zigzag Bent 3D Noodle (Middle Left) -->
        <svg class="o_login_shape o_shape_zigzag" viewBox="0 0 180 190" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="zigGrad" x1="10" y1="10" x2="160" y2="170" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#5ffbfb" />
              <stop offset="30%" stop-color="#14B5D9" />
              <stop offset="70%" stop-color="#0b5e9e" />
              <stop offset="100%" stop-color="#042747" />
            </linearGradient>
            <filter id="zigGlow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="-4" dy="14" stdDeviation="12" flood-color="#010f1c" flood-opacity="0.65" />
            </filter>
          </defs>
          <!-- Smooth curved capsule body -->
          <path d="M 45 40 Q 95 10 135 45 Q 165 75 140 105 L 60 155 Q 30 175 18 150 Q 8 125 35 110 L 105 65 Q 120 50 100 38 Q 80 28 65 48 Z" fill="url(#zigGrad)" filter="url(#zigGlow)" />
          <!-- Extra 3D Pill detail -->
          <circle cx="50" cy="45" r="16" fill="#8bf8f8" opacity="0.65" />
          <circle cx="140" cy="85" r="14" fill="#14B5D9" opacity="0.5" />
        </svg>

        <!-- 3. Curved 3D Horseshoe / Torus Slice (Bottom Left) -->
        <svg class="o_login_shape o_shape_horseshoe" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="horseGrad" x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#41F2F2" />
              <stop offset="50%" stop-color="#14B5D9" />
              <stop offset="100%" stop-color="#063259" />
            </linearGradient>
          </defs>
          <path d="M 40 160 C 20 120 20 60 65 30 C 115 -5 170 10 185 60 C 190 78 175 90 155 85 C 135 80 135 60 115 50 C 95 40 65 55 55 90 C 45 125 70 155 105 165 C 125 170 130 190 110 195 C 75 200 50 185 40 160 Z" fill="url(#horseGrad)" filter="url(#zigGlow)" />
        </svg>

        <!-- 4. Spiral 3D Ribbon / Coil (Right Background) -->
        <svg class="o_login_shape o_shape_spiral" viewBox="0 0 300 420" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="spiralGrad" x1="50" y1="20" x2="250" y2="400" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#14B5D9" />
              <stop offset="25%" stop-color="#0a4d87" />
              <stop offset="50%" stop-color="#41F2F2" />
              <stop offset="75%" stop-color="#07355e" />
              <stop offset="100%" stop-color="#031626" />
            </linearGradient>
            <filter id="spiralShadow">
              <feDropShadow dx="8" dy="16" stdDeviation="15" flood-color="#010c17" flood-opacity="0.75" />
            </filter>
          </defs>
          <path d="M 120 30 C 220 15 280 85 240 150 C 195 210 80 180 70 240 C 60 300 180 320 230 360 C 270 390 240 430 190 415 C 130 400 40 340 50 260 C 60 180 200 200 215 145 C 230 90 160 50 105 60 C 75 65 70 35 120 30 Z" fill="url(#spiralGrad)" filter="url(#spiralShadow)" />
        </svg>

        <!-- 5. Undulating 3D Wave Tube (Bottom Right) -->
        <svg class="o_login_shape o_shape_wave" viewBox="0 0 380 240" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="waveGrad" x1="20" y1="120" x2="360" y2="120" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#052847" />
              <stop offset="35%" stop-color="#0b5e9e" />
              <stop offset="70%" stop-color="#14B5D9" />
              <stop offset="100%" stop-color="#5bfbfb" />
            </linearGradient>
          </defs>
          <path d="M 30 180 C 80 120 130 190 190 150 C 250 110 300 180 360 130 C 375 118 395 135 375 155 C 315 215 255 140 200 180 C 140 220 85 160 40 210 C 20 230 -2 210 30 180 Z" fill="url(#waveGrad)" filter="url(#spiralShadow)" />
        </svg>

        <!-- 6. Small Ripple Curves (Bottom Center-Right) -->
        <svg class="o_login_shape o_shape_ripples" viewBox="0 0 130 90" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 15 35 Q 35 15 55 35 Q 75 55 95 35 Q 110 20 120 30 Q 125 40 110 48 Q 90 60 70 42 Q 50 25 30 45 Z" fill="#14B5D9" opacity="0.8" />
          <path d="M 25 65 Q 45 48 65 65 Q 85 82 105 65 Q 115 55 122 62 Q 125 70 112 78 Q 92 88 75 72 Q 55 58 35 75 Z" fill="#41F2F2" opacity="0.65" />
        </svg>
      </div>

      <!-- Centered Glassmorphic Card -->
      <div class="o_login_card_wrap">
        <div class="o_login_card">
          <!-- Brand Logo & Official Corporate Banner -->
          <div class="o_login_brand">
            <div class="o_login_logo_badge">
              <img src="/assets/icons/logo.png" alt="CH Aluminios Logo" />
            </div>
            <img src="/assets/icons/nombreyslogan.png?v=2.24" alt="CH Aluminios - Innovación y Calidad" class="o_login_brand_banner" />
          </div>

          <div class="o_login_header">
            <h2 class="o_login_title">Iniciar Sesión</h2>
            <p class="o_login_subtitle">Acceso seguro a la plataforma empresarial ERP</p>
          </div>

          <!-- Login Form -->
          <form id="loginForm" class="o_login_form" autocomplete="on">
            <div class="o_login_field">
              <label for="loginEmail">Usuario o Correo Electrónico</label>
              <div class="o_login_input_wrap">
                <span class="o_login_input_icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <input
                  type="text"
                  id="loginEmail"
                  name="email"
                  class="o_login_input"
                  placeholder="ej. chappdevm@gmail.com"
                  value="${esc(defaultEmail)}"
                  required
                  autocomplete="username"
                  aria-label="Usuario o correo electrónico"
                />
              </div>
            </div>

            <div class="o_login_field">
              <label for="loginPassword">Contraseña</label>
              <div class="o_login_input_wrap">
                <span class="o_login_input_icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input
                  type="password"
                  id="loginPassword"
                  name="password"
                  class="o_login_input"
                  placeholder="••••••••••••"
                  value="123456"
                  required
                  autocomplete="current-password"
                  aria-label="Contraseña"
                />
                <button
                  type="button"
                  id="btnLoginTogglePassword"
                  class="o_login_eye_btn"
                  title="Mostrar u ocultar contraseña"
                  aria-label="Mostrar u ocultar contraseña"
                >
                  <svg id="loginEyeIcon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>

            <div class="o_login_aux_row">
              <label class="o_login_remember">
                <input type="checkbox" id="loginRememberMe" checked />
                <span>Recordar sesión</span>
              </label>
              <a href="#" id="btnLoginForgotPass" class="o_login_forgot_link">¿Olvidaste tu contraseña?</a>
            </div>

            <button type="submit" id="btnLoginSubmit" class="o_login_submit_btn">
              <span>Ingresar al ERP</span>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </form>

          <!-- Quick Access Divider -->
          <div class="o_login_divider">o ingresar como</div>

          <!-- Quick Access User Chips -->
          <div class="o_login_quick_users">
            ${users
              .slice(0, 2)
              .map(
                (u) => `
                <button
                  type="button"
                  class="o_login_quick_btn"
                  data-user-id="${u.id}"
                  data-user-email="${esc(u.email)}"
                  title="Acceder como ${esc(u.name)}"
                >
                  <span class="o_login_user_dot"></span>
                  <span>${esc(u.name.split(' ')[0])}</span>
                </button>
              `
              )
              .join('')}
          </div>

          <!-- Footer Status -->
          <div class="o_login_footer_status">
            <span class="o_login_status_pulse"></span>
            <span>CH Aluminios • Conexión Segura Supabase</span>
          </div>
        </div>
      </div>
    `;

    // Attach listeners
    attachLoginListeners();
  }

  function attachLoginListeners() {
    const form = document.getElementById('loginForm');
    const eyeBtn = document.getElementById('btnLoginTogglePassword');
    const passInput = document.getElementById('loginPassword');
    const eyeIcon = document.getElementById('loginEyeIcon');
    const forgotBtn = document.getElementById('btnLoginForgotPass');
    const quickBtns = document.querySelectorAll('.o_login_quick_btn');

    // Toggle password reveal
    if (eyeBtn && passInput) {
      eyeBtn.addEventListener('click', () => {
        const isPass = passInput.getAttribute('type') === 'password';
        passInput.setAttribute('type', isPass ? 'text' : 'password');
        if (eyeIcon) {
          eyeIcon.innerHTML = isPass
            ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`
            : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
        }
      });
    }

    // Forgot password info
    if (forgotBtn) {
      forgotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showToast('Para restablecer sus credenciales contacte al Administrador del Sistema.');
      });
    }

    // Quick user selection
    quickBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const userId = Number(btn.getAttribute('data-user-id'));
        const userEmail = btn.getAttribute('data-user-email');
        const emailInput = document.getElementById('loginEmail');
        if (emailInput && userEmail) emailInput.value = userEmail;
        performLogin({ user_id: userId, email: userEmail });
      });
    });

    // Form submit
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('loginEmail');
        const passInputEl = document.getElementById('loginPassword');
        const rememberInput = document.getElementById('loginRememberMe');
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passInputEl ? passInputEl.value : '';
        const remember = rememberInput ? rememberInput.checked : true;

        performLogin({ email, password, remember });
      });
    }
  }

  async function performLogin(credentials) {
    const submitBtn = document.getElementById('btnLoginSubmit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Verificando...</span>`;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Credenciales no válidas.');
      }

      // Store session
      const user = data.user || { name: 'Administrador CHapp' };
      const token = data.token || ('chapp_auth_' + Date.now());

      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('chapp_auth_token', token);
          sessionStorage.setItem('chapp_user', JSON.stringify(user));
        }
        if (credentials.remember && typeof localStorage !== 'undefined') {
          localStorage.setItem('chapp_remember_token', token);
          localStorage.setItem('chapp_user', JSON.stringify(user));
        }
      } catch (_) {}

      // Synchronize in-memory settings
      if (data.state) {
        state.data = data.state;
      }
      if (state.data) {
        if (!state.data.settings) state.data.settings = {};
        state.data.settings.active_user = user;
      }

      if (typeof updateSystray === 'function') {
        updateSystray();
      }

      // Smooth transition to Home Menu
      const loginView = document.getElementById('loginView');
      const mainNavbar = document.getElementById('mainNavbar');
      if (loginView) loginView.style.display = 'none';
      if (mainNavbar) mainNavbar.style.display = 'flex';

      if (typeof openHomeMenu === 'function') {
        openHomeMenu();
      }
      showToast(`¡Bienvenido, ${user.name.split(' ')[0]}!`);
    } catch (err) {
      showToast(err.message || 'Error al iniciar sesión', true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <span>Ingresar al ERP</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        `;
      }
    }
  }

  function handleLogout() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('chapp_auth_token');
        sessionStorage.removeItem('chapp_user');
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('chapp_remember_token');
        localStorage.removeItem('chapp_user');
      }
    } catch (_) {}

    openLogin();
    showToast('Sesión cerrada correctamente.');
  }
