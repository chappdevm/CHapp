/* ==========================================================================
   CH Aluminios ERP -- JS Module: 02-theme-camera.js
   Theme Switcher, Systray, Home Menu Navigation & AI Receipt Camera Scanner
   ========================================================================== */
'use strict';

  // ==================== THEME & SYSTRAY ====================
  function applyTheme(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    const icon = document.getElementById('themeIcon');
    const lbl = document.getElementById('themeIconLabel');
    if (icon) {
      icon.innerHTML =
        t === 'dark'
          ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>'
          : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    }
    if (lbl) lbl.textContent = t === 'dark' ? 'Oscuro' : 'Claro';
  }

  function updateSystray() {
    if (!state.data) return;
    const settings = state.data.settings || {};
    applyTheme(settings.theme || 'dark');

    const compContainer = document.getElementById('systrayCompany');
    if (compContainer) {
      compContainer.title = 'Compañía activa • Base de datos Supabase conectada (Nube)';
    }

    const compEl = document.getElementById('systrayCompanyName');
    const compName = (!settings.company_name || settings.company_name === 'GH Aluminios') ? 'CH Aluminios' : settings.company_name;
    if (compEl) compEl.textContent = compName;

    const user = settings.active_user || { name: 'Administrador CHapp' };
    const userEl = document.getElementById('systrayUserName');
    const avatarEl = document.getElementById('systrayUserAvatar');
    if (userEl) userEl.textContent = user.name.split(' ')[0];
    if (avatarEl) avatarEl.textContent = initials(user.name);

    const kpis = state.data.kpis || {};
    const pendingCount =
      (state.data.expenses || []).filter((e) => e.state === 'submitted' || e.state === 'draft').length +
      (kpis.to_invoice_count || 0);
    const badgeEl = document.getElementById('systrayActivityCount');
    if (badgeEl) badgeEl.textContent = String(pendingCount);

    console.log('[CHapp] Base de datos Supabase conectada (Nube)');
  }

  // ==================== NAVIGATION & HOME MENU ====================
  function openHomeMenu() {
    state.currentApp = null;
    state.activeRecordId = null;
    state.partnerContextFilter = null;
    const webclient = document.getElementById('webclient');
    const homeView = document.getElementById('homeMenuView');
    const workspace = document.getElementById('moduleWorkspace');
    const brand = document.getElementById('navbarBrand');
    const submenus = document.getElementById('navbarSubmenus');

    webclient.classList.add('o_home_menu_background');
    homeView.style.display = 'flex';
    workspace.style.display = 'none';
    brand.style.display = 'none';
    submenus.innerHTML = '';

    renderHomeMenuApps();
  }

  function renderHomeMenuApps() {
    const grid = document.getElementById('homeAppsGrid');
    const searchWrapper = document.getElementById('homeSearchBarWrapper');
    if (!grid) return;

    const q = state.homeSearchQuery.trim().toLowerCase();
    if (q) {
      searchWrapper.classList.add('is-visible');
    } else {
      searchWrapper.classList.remove('is-visible');
    }

    const filtered = APPS.filter((a) => a.name.toLowerCase().includes(q));
    if (state.homeFocusedIndex >= filtered.length) {
      state.homeFocusedIndex = 0;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--o-text-muted); padding: 2rem;">No se encontraron módulos para "${esc(state.homeSearchQuery)}"</div>`;
      return;
    }

    grid.innerHTML = filtered
      .map(
        (app, idx) => `
        <a
          href="#${esc(app.id)}"
          role="option"
          aria-selected="${idx === state.homeFocusedIndex ? 'true' : 'false'}"
          class="o_app o_menuitem ${q && idx === state.homeFocusedIndex ? 'o_focused' : ''}"
          data-app-id="${esc(app.id)}"
          data-menu-xmlid="${esc(app.xmlid)}"
        >
          <div class="o_app_icon">
            <img src="${esc(app.icon)}" alt="${esc(app.name)}" />
          </div>
          <div class="o_caption">${esc(app.name)}</div>
        </a>
      `
      )
      .join('');

    grid.querySelectorAll('.o_app').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const appId = el.getAttribute('data-app-id');
        openApp(appId);
      });
    });
  }

  function openApp(appId, opts = {}) {
    const app = APPS.find((a) => a.id === appId);
    if (!app) return openHomeMenu();

    if (opts.returnTo) {
      state.navStack = state.navStack || [];
      state.navStack.push(opts.returnTo);
    } else if (opts.isDirectNav) {
      state.navStack = [];
    }

    state.currentApp = app.id;
    state.submenu = opts.submenu || app.defaultSubmenu;
    state.viewType = opts.viewType || app.defaultView;
    state.activeRecordId = opts.recordId !== undefined ? opts.recordId : null;
    state.searchQuery = opts.searchQuery || '';
    state.statusFilter = opts.statusFilter || 'all';
    state.partnerContextFilter = opts.partnerFilter || null;
    state.homeSearchQuery = '';

    const homeInput = document.getElementById('homeSearchInput');
    if (homeInput) homeInput.value = '';

    const cpSearchInput = document.getElementById('cpSearchInput');
    if (cpSearchInput) cpSearchInput.value = state.searchQuery;

    const webclient = document.getElementById('webclient');
    const homeView = document.getElementById('homeMenuView');
    const workspace = document.getElementById('moduleWorkspace');
    const brand = document.getElementById('navbarBrand');
    const brandIcon = document.getElementById('navbarBrandIcon');
    const brandText = document.getElementById('navbarBrandText');

    webclient.classList.remove('o_home_menu_background');
    homeView.style.display = 'none';
    workspace.style.display = 'flex';
    brand.style.display = 'inline-flex';
    brandIcon.src = app.icon;
    brandText.textContent = app.name;

    renderSubmenus(app);
    renderModuleWorkspace();
  }

  function renderSubmenus(app) {
    const nav = document.getElementById('navbarSubmenus');
    if (!nav) return;
    if (app.id === 'settings' || !app.submenus || !app.submenus.length) {
      nav.innerHTML = '';
      return;
    }
    nav.innerHTML = app.submenus
      .map(
        (sub) => `
        <button
          type="button"
          class="o_nav_entry ${state.submenu === sub.id ? 'is-active' : ''}"
          data-submenu="${esc(sub.id)}"
        >
          ${esc(sub.label)}
        </button>
      `
      )
      .join('');

    nav.querySelectorAll('.o_nav_entry').forEach((btn) => {
      btn.addEventListener('click', () => {
        const subId = btn.getAttribute('data-submenu');
        state.submenu = subId;
        state.activeRecordId = null;
        state.statusFilter = 'all';
        state.partnerContextFilter = null;
        if (app.id === 'accounting') {
          state.viewType = subId === 'dashboard' ? 'kanban' : 'list';
        } else if (app.id === 'settings') {
          state.viewType = 'form';
        } else if (state.viewType === 'form') {
          state.viewType = app.defaultView;
        }
        renderSubmenus(app);
        renderModuleWorkspace();
      });
    });
  }

  // ==================== CONTROL PANEL & MODULE ROUTER ====================
  function renderModuleWorkspace() {
    if (!state.data || !state.currentApp) return;

    const cp = document.getElementById('controlPanel');
    if (state.currentApp === 'settings') {
      cp.style.display = 'none';
      renderSettingsModule();
      return;
    }
    cp.style.display = 'flex';

    renderControlPanel();

    if (state.currentApp === 'contacts') renderContactsModule();
    else if (state.currentApp === 'expenses') renderExpensesModule();
    else if (state.currentApp === 'sales') renderSalesModule();
    else if (state.currentApp === 'accounting') renderAccountingModule();
    else if (state.currentApp === 'inventory') renderInventoryModule();
  }

  
  // ==================== EXPENSE AI CAMERA & OCR SCANNER ====================
  let activeCameraStream = null;

  function stopCameraStream() {
    if (activeCameraStream) {
      activeCameraStream.getTracks().forEach((t) => t.stop());
      activeCameraStream = null;
    }
    const video = document.getElementById('cameraVideo');
    if (video) {
      video.srcObject = null;
      video.style.display = 'none';
    }
    const placeholder = document.getElementById('cameraPlaceholder');
    if (placeholder) placeholder.style.display = 'block';
    const btnCapture = document.getElementById('btnCapturePhoto');
    if (btnCapture) btnCapture.style.display = 'none';
    const btnStart = document.getElementById('btnStartCamera');
    if (btnStart) btnStart.textContent = 'Activar Cámara';
  }

  function openExpenseCameraDialog(targetCallback) {
    const dialog = document.getElementById('expenseAiCameraDialog');
    if (!dialog) return;

    const video = document.getElementById('cameraVideo');
    const capturedImg = document.getElementById('cameraCapturedImg');
    const placeholder = document.getElementById('cameraPlaceholder');
    const aiLoading = document.getElementById('cameraAiLoading');
    const btnStart = document.getElementById('btnStartCamera');
    const btnCapture = document.getElementById('btnCapturePhoto');
    const fileInput = document.getElementById('cameraFileInput');
    const btnClose = document.getElementById('btnCloseExpenseAiCamera');

    capturedImg.style.display = 'none';
    capturedImg.src = '';
    aiLoading.style.display = 'none';
    placeholder.style.display = 'block';
    video.style.display = 'none';
    btnCapture.style.display = 'none';
    fileInput.value = '';

    const executeAiScan = async (base64Data, mimeType) => {
      stopCameraStream();
      capturedImg.src = base64Data;
      capturedImg.style.display = 'block';
      placeholder.style.display = 'none';
      aiLoading.style.display = 'flex';

      try {
        const res = await apiCall('/api/expenses/ai-scan', 'POST', {
          image: base64Data,
          mime_type: mimeType || 'image/jpeg'
        });

        dialog.close();
        aiLoading.style.display = 'none';

        const matched = res.matched_partner;
        if (matched) {
          showToast(`IA: Factura leída. Proveedor reconocido: ${matched.name}`);
        } else if (res.data.supplier_name) {
          showToast(`IA: Factura leída. Proveedor: "${res.data.supplier_name}" (se creará automáticamente si es nuevo)`);
        } else {
          showToast('IA: Factura analizada exitosamente');
        }

        if (targetCallback) {
          targetCallback(res.data, base64Data, matched);
        } else {
          state.currentApp = 'expenses';
          state.viewType = 'form';
          state.activeRecordId = 'new';
          state.formDraft = {
            name: res.data.name || 'Gasto proveedor',
            partner_id: matched ? matched.id : '',
            partner_name: matched ? matched.name : (res.data.supplier_name || ''),
            supplier_vat: res.data.supplier_vat || (matched ? matched.vat : ''),
            receipt_ref: res.data.reference || '',
            date: res.data.date || new Date().toISOString().slice(0, 10),
            total_amount: Number(res.data.total_amount || 0),
            price_unit: Number(res.data.total_amount || 0),
            quantity: 1,
            notes: res.data.notes || '',
            receipt_image: base64Data,
            literal_totals: res.data.total_amount
              ? {
                  untaxed: Number(res.data.subtotal_amount || 0) || (Number(res.data.total_amount) - Number(res.data.tax_amount || 0)),
                  tax: Number(res.data.tax_amount || 0),
                  total: Number(res.data.total_amount)
                }
              : null,
            items: Array.isArray(res.data.items) && res.data.items.length > 0 ? res.data.items : [
              { description: res.data.name || 'Gasto proveedor', quantity: 1, price_unit: Number(res.data.subtotal_amount || res.data.total_amount || 0), tax_rate: 0, tax_amount: Number(res.data.tax_amount || 0), subtotal: Number(res.data.subtotal_amount || res.data.total_amount || 0), total: Number(res.data.total_amount || 0) }
            ]
          };
          renderModuleWorkspace();
        }
      } catch (err) {
        aiLoading.style.display = 'none';
        showToast('Error analizando factura con IA: ' + err.message, true);
      }
    };

    btnStart.onclick = async () => {
      if (activeCameraStream) {
        stopCameraStream();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        activeCameraStream = stream;
        video.srcObject = stream;
        video.style.display = 'block';
        placeholder.style.display = 'none';
        capturedImg.style.display = 'none';
        btnCapture.style.display = 'inline-flex';
        btnStart.textContent = 'Detener Cámara';
        await video.play();
      } catch (err) {
        showToast('No se pudo acceder a la cámara: ' + err.message + '. Puedes usar el botón "Subir Foto"', true);
      }
    };

    btnCapture.onclick = () => {
      const canvas = document.getElementById('cameraCanvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      executeAiScan(dataUrl, 'image/jpeg');
    };

    fileInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        executeAiScan(ev.target.result, file.type || 'image/jpeg');
      };
      reader.readAsDataURL(file);
    };

    btnClose.onclick = () => {
      stopCameraStream();
      dialog.close();
    };

    dialog.showModal();
  }

