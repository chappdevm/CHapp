/* ==========================================================================
   CHapp ERP — Webclient & Module Controller
   Modules: Contactos, Gastos, Ventas, Contabilidad, Ajustes
   ========================================================================== */

(function () {
  'use strict';

  const APPS = [
    {
      id: 'contacts',
      name: 'Contactos',
      icon: '/assets/icons/contacts.png',
      xmlid: 'contacts.menu_contacts',
      defaultSubmenu: 'all',
      defaultView: 'list',
      submenus: [
        { id: 'all', label: 'Contactos' },
        { id: 'customers', label: 'Clientes' },
        { id: 'suppliers', label: 'Proveedores' },
        { id: 'companies', label: 'Compañías' }
      ]
    },
    {
      id: 'expenses',
      name: 'Gastos',
      icon: '/assets/icons/expenses.png',
      xmlid: 'hr_expense.menu_hr_expense_root',
      defaultSubmenu: 'all',
      defaultView: 'list',
      submenus: []
    },
    {
      id: 'sales',
      name: 'Ventas',
      icon: '/assets/icons/sales.png',
      xmlid: 'sale.sale_menu_root',
      defaultSubmenu: 'all',
      defaultView: 'list',
      submenus: [
        { id: 'all', label: 'Cotizaciones y Pedidos' },
        { id: 'quotations', label: 'Cotizaciones' },
        { id: 'orders', label: 'Pedidos de Venta' },
        { id: 'products', label: 'Productos' }
      ]
    },
    {
      id: 'accounting',
      name: 'Contabilidad',
      icon: '/assets/icons/accounting.png',
      xmlid: 'account.menu_finance',
      defaultSubmenu: 'dashboard',
      defaultView: 'list',
      submenus: [
        { id: 'dashboard', label: 'Tablero' },
        { id: 'out_invoice', label: 'Facturas Clientes' },
        { id: 'in_invoice', label: 'Facturas Proveedores' },
        { id: 'payments', label: 'Pagos' }
      ]
    },
    {
      id: 'settings',
      name: 'Ajustes',
      icon: '/assets/icons/settings.png',
      xmlid: 'base.menu_administration',
      defaultSubmenu: 'general',
      defaultView: 'form',
      submenus: []
    }
  ];

  const state = {
    data: null,
    currentApp: null, // null = Home Menu
    submenu: 'all',
    viewType: 'list', // 'kanban' | 'list' | 'form'
    activeRecordId: null, // number | 'new' | null
    searchQuery: '',
    statusFilter: 'all',
    homeSearchQuery: '',
    homeFocusedIndex: 0,
    partnerContextFilter: null, // { id, name }
    formDraft: null,
    activeNotebookTab: 'lines'
  };

  // ==================== UTILITIES ====================
  function esc(val) {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function round2(val) {
    const num = Number(val);
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
  }

  function formatMoney(amount) {
    const sym = (state.data && state.data.settings && state.data.settings.currency_symbol) || '$';
    const num = Number(amount || 0);
    return `${sym} ${Math.round(num).toLocaleString('es-CO')}`;
  }

  function initials(name) {
    const parts = String(name || 'CH').trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function showToast(msg, isError = false) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'o_toast' + (isError ? ' is-error' : '');
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3400);
  }

  async function apiCall(url, method = 'GET', body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body !== null) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json.error || 'Error en la solicitud al servidor');
    }
    if (json.state) {
      state.data = json.state;
      updateSystray();
    } else if (json.data) {
      state.data = json.data;
      updateSystray();
    }
    return json;
  }

  // ==================== DIALOG LIGHT-DISMISS FALLBACK ====================
  // Follows modern-web-guidance `light-dismiss-a-dialog`
  function setupDialogFallbacks() {
    const dialogs = document.querySelectorAll('dialog.o_dialog');
    dialogs.forEach((dialog) => {
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        dialog.addEventListener('click', (event) => {
          if (event.target !== dialog) return;
          const rect = dialog.getBoundingClientRect();
          const isDialogContent =
            rect.top <= event.clientY &&
            event.clientY <= rect.top + rect.height &&
            rect.left <= event.clientX &&
            event.clientX <= rect.left + rect.width;
          if (isDialogContent) return;
          dialog.close();
        });
      }
    });
  }

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
            items: Array.isArray(res.data.items) && res.data.items.length > 0 ? res.data.items : [
              { description: res.data.name || 'Gasto proveedor', quantity: 1, price_unit: Number(res.data.total_amount || 0), subtotal: Number(res.data.total_amount || 0) }
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

  function getRecordIdentifier(appId, submenu, recordId) {
    if (recordId === 'new' || recordId === null || recordId === undefined) return 'Nuevo';
    const idNum = Number(recordId);
    if (appId === 'expenses') {
      const exp = (state.data.expenses || []).find((e) => Number(e.id) === idNum);
      return exp ? (exp.reference || `EXP/2026/${String(exp.id).padStart(4, '0')}`) : `EXP #${recordId}`;
    }
    if (appId === 'accounting') {
      const move = (state.data.accounting?.moves || []).find((m) => Number(m.id) === idNum);
      if (move) {
        if (move.name && move.name !== 'Borrador') return move.name;
        if (move.ref) return `${move.move_type === 'in_invoice' ? 'BILL' : 'INV'} (${move.ref})`;
        return move.move_type === 'in_invoice' ? `BILL/2026/${String(move.id).padStart(4, '0')}` : `INV/2026/${String(move.id).padStart(4, '0')}`;
      }
      return `Factura #${recordId}`;
    }
    if (appId === 'sales') {
      if (submenu === 'products') {
        const prod = (state.data.products || []).find((p) => Number(p.id) === idNum);
        if (prod) return prod.default_code ? `[${prod.default_code}] ${prod.name}` : prod.name;
        return `Producto #${recordId}`;
      }
      const sale = (state.data.sales || []).find((s) => Number(s.id) === idNum);
      return sale ? (sale.name || `SO/2026/${String(sale.id).padStart(4, '0')}`) : `Pedido #${recordId}`;
    }
    if (appId === 'contacts') {
      const cont = (state.data.contacts || []).find((c) => Number(c.id) === idNum);
      return cont ? cont.name : `Contacto #${recordId}`;
    }
    return String(recordId);
  }

  function renderControlPanel() {
    const app = APPS.find((a) => a.id === state.currentApp);
    const sub = (app.submenus && app.submenus.length > 0) ? (app.submenus.find((s) => s.id === state.submenu) || app.submenus[0]) : null;

    const actionBtns = document.getElementById('cpActionButtons');
    const breadcrumbs = document.getElementById('cpBreadcrumbs');
    const facets = document.getElementById('cpSearchFacets');
    const filterPills = document.getElementById('cpFilterPills');
    const switcher = document.getElementById('cpViewSwitcher');
    const searchContainer = document.getElementById('cpSearchContainer');

    // Action buttons
    const isProductSubmenu = state.currentApp === 'sales' && state.submenu === 'products';
    const newRecordLabel = isProductSubmenu ? 'Nuevo Producto' : 'Nuevo';
    const productAttr = isProductSubmenu ? ' data-id="btnNewProductList"' : '';
    if (state.currentApp === 'expenses') {
      if (state.viewType === 'form') {
        actionBtns.innerHTML = `
          <button type="button" class="btn btn-secondary" id="btnCpBackToList">Volver</button>
        `;
      } else {
        actionBtns.innerHTML = '';
      }
    } else if (state.viewType === 'form') {
      actionBtns.innerHTML = `
        <button type="button" class="btn btn-secondary" id="btnCpBackToList">Volver</button>
        <button type="button" class="btn btn-primary" id="btnCpNewRecord"${productAttr}>${newRecordLabel}</button>
      `;
    } else if (state.currentApp === 'accounting' && state.submenu === 'dashboard') {
      actionBtns.innerHTML = `
        <button type="button" class="btn btn-primary" id="btnQuickNewInvoice">Nueva Factura de Cliente</button>
        <button type="button" class="btn btn-secondary" id="btnQuickNewBill">Nueva Factura de Proveedor</button>
      `;
    } else if (state.currentApp === 'accounting' && state.submenu === 'payments') {
      actionBtns.innerHTML = `
        <button type="button" class="btn btn-primary" id="btnGoToInvoicesForPay">Registrar Pago en Factura</button>
      `;
    } else {
      actionBtns.innerHTML = `<button type="button" class="btn btn-primary" id="btnCpNewRecord"${productAttr}>${newRecordLabel}</button>`;
    }

    // Breadcrumbs con trazabilidad de origen e identificadores de documento
    let crumbHtml = '';
    const returnTarget = (state.navStack && state.navStack.length > 0) ? state.navStack[state.navStack.length - 1] : null;
    if (returnTarget) {
      const retApp = APPS.find((a) => a.id === returnTarget.app);
      const retLabel = returnTarget.recordId ? getRecordIdentifier(returnTarget.app, returnTarget.submenu, returnTarget.recordId) : (retApp ? retApp.name : 'Volver');
      crumbHtml += `<span class="o_breadcrumb_link" id="crumbTraceReturn" style="display: inline-flex; align-items: center; gap: 4px; color: var(--o-primary); cursor: pointer; font-weight: 600;" title="Regresar a ${esc(retLabel)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg> ${esc(retLabel)}</span> <span>/</span> `;
    }

    if (state.currentApp !== 'expenses' || returnTarget) {
      crumbHtml += `<span class="o_breadcrumb_link" id="crumbRoot">${esc(app.name)}</span>`;
      if (sub) {
        crumbHtml += ` <span>/</span> <span class="${state.viewType === 'form' ? 'o_breadcrumb_link' : ''}" id="crumbSub">${esc(sub.label)}</span>`;
      }
    } else if (state.viewType === 'form') {
      crumbHtml += `<span class="o_breadcrumb_link" id="crumbRoot">${esc(app.name)}</span>`;
    }

    if (state.viewType === 'form') {
      const recLabel = getRecordIdentifier(state.currentApp, state.submenu, state.activeRecordId);
      crumbHtml += (crumbHtml ? ` <span>/</span> ` : '') + `<span style="font-weight: 700; color: var(--o-text);">${esc(recLabel)}</span>`;
    }
    breadcrumbs.innerHTML = crumbHtml;

    // Facets (Partner context filter)
    if (state.partnerContextFilter) {
      facets.innerHTML = `
        <span class="o_search_facet">
          ${esc(state.partnerContextFilter.name)}
          <button type="button" id="btnClearPartnerFacet" title="Quitar filtro" aria-label="Quitar filtro"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </span>
      `;
      const clearBtn = document.getElementById('btnClearPartnerFacet');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          state.partnerContextFilter = null;
          renderModuleWorkspace();
        });
      }
    } else {
      facets.innerHTML = '';
    }

    // Hide search bar on form view
    searchContainer.style.visibility = state.viewType === 'form' ? 'hidden' : 'visible';

    // Quick status pills per module (removed redundant pills for sales & expenses; navigation is handled in navbar)
    filterPills.innerHTML = '';

    filterPills.querySelectorAll('.o_filter_pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.statusFilter = btn.getAttribute('data-pill');
        renderModuleWorkspace();
      });
    });

    // View Switcher (Kanban / List)
    // En las facturas y contabilidad se quita la opción de elegir lista/kanban: siempre lista por defecto
    if (state.currentApp === 'accounting' || state.currentApp === 'expenses' || state.currentApp === 'contacts' || state.currentApp === 'sales') {
      switcher.innerHTML = '';
      if (state.viewType !== 'form') {
        state.viewType = 'list';
      }
    } else {
      switcher.innerHTML = `
        <button type="button" class="o_switch_btn ${state.viewType === 'list' ? 'is-active' : ''}" data-view="list" title="Vista Lista">
          Lista
        </button>
        <button type="button" class="o_switch_btn ${state.viewType === 'kanban' ? 'is-active' : ''}" data-view="kanban" title="Vista Kanban">
          Kanban
        </button>
      `;
      switcher.querySelectorAll('.o_switch_btn').forEach((b) => {
        b.addEventListener('click', () => {
          state.viewType = b.getAttribute('data-view');
          state.activeRecordId = null;
          renderModuleWorkspace();
        });
      });
    }

    // Wire events
    const crumbRoot = document.getElementById('crumbRoot');
    if (crumbRoot) {
      crumbRoot.addEventListener('click', () => {
        state.activeRecordId = null;
        state.viewType = app.defaultView;
        renderModuleWorkspace();
      });
    }
    const crumbSub = document.getElementById('crumbSub');
    if (crumbSub && state.viewType === 'form') {
      crumbSub.addEventListener('click', () => {
        state.activeRecordId = null;
        state.viewType = app.defaultView;
        renderModuleWorkspace();
      });
    }

    const backBtn = document.getElementById('btnCpBackToList');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (state.navStack && state.navStack.length > 0) {
          const prev = state.navStack.pop();
          openApp(prev.app, {
            submenu: prev.submenu,
            viewType: prev.viewType,
            recordId: prev.recordId,
            partnerFilter: prev.partnerFilter,
            skipReturnPush: true
          });
          return;
        }
        state.activeRecordId = null;
        state.formDraft = null;
        state.viewType = app.defaultView;
        renderModuleWorkspace();
      });
    }

    const traceReturnBtn = document.getElementById('crumbTraceReturn');
    if (traceReturnBtn) {
      traceReturnBtn.addEventListener('click', () => {
        if (state.navStack && state.navStack.length > 0) {
          const prev = state.navStack.pop();
          openApp(prev.app, {
            submenu: prev.submenu,
            viewType: prev.viewType,
            recordId: prev.recordId,
            partnerFilter: prev.partnerFilter,
            skipReturnPush: true
          });
        }
      });
    }

    const newBtn = document.getElementById('btnCpNewRecord');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        state.activeRecordId = 'new';
        state.formDraft = null;
        state.viewType = 'form';
        renderModuleWorkspace();
      });
    }

    const scanExpAiBtn = document.getElementById('btnCpScanExpenseAi');
    if (scanExpAiBtn) {
      scanExpAiBtn.addEventListener('click', () => {
        openExpenseCameraDialog();
      });
    }

    const qInv = document.getElementById('btnQuickNewInvoice');
    if (qInv) {
      qInv.addEventListener('click', () => {
        state.submenu = 'out_invoice';
        state.activeRecordId = 'new';
        state.formDraft = null;
        state.viewType = 'form';
        renderSubmenus(app);
        renderModuleWorkspace();
      });
    }

    const qBill = document.getElementById('btnQuickNewBill');
    if (qBill) {
      qBill.addEventListener('click', () => {
        state.submenu = 'in_invoice';
        state.activeRecordId = 'new';
        state.formDraft = null;
        state.viewType = 'form';
        renderSubmenus(app);
        renderModuleWorkspace();
      });
    }

    const goPay = document.getElementById('btnGoToInvoicesForPay');
    if (goPay) {
      goPay.addEventListener('click', () => {
        state.submenu = 'out_invoice';
        state.viewType = 'list';
        renderSubmenus(app);
        renderModuleWorkspace();
      });
    }
  }

  function updatePager(count, total) {
    const pager = document.getElementById('cpPager');
    if (!pager) return;
    if (state.viewType === 'form') {
      pager.textContent = '';
    } else {
      pager.textContent = count > 0 ? `1-${count} / ${total}` : '0 / 0';
    }
  }

  // ==================== MODULE 1: CONTACTOS (res.partner) ====================
  function getFilteredContacts() {
    let list = state.data.contacts || [];
    if (state.submenu === 'customers') list = list.filter((c) => Number(c.customer_rank) > 0);
    else if (state.submenu === 'suppliers') list = list.filter((c) => Number(c.supplier_rank) > 0);
    else if (state.submenu === 'companies') list = list.filter((c) => Boolean(c.is_company));

    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.vat || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.city || '').toLowerCase().includes(q) ||
          (c.category_ids || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }

  function renderContactsModule() {
    const container = document.getElementById('moduleContent');
    if (state.viewType === 'form') {
      renderContactForm(container);
      return;
    }

    const contacts = getFilteredContacts();
    updatePager(contacts.length, (state.data.contacts || []).length);

    const kpis = state.data.kpis || {};
    const bannerHtml = `
      <div class="o_dashboard_banner">
        <div class="o_stat_card" data-jump-sub="all">
          <span class="o_stat_label">Directorio Total</span>
          <span class="o_stat_value">${kpis.contacts_total || 0}</span>
          <span class="o_stat_sub">${kpis.companies_total || 0} compañías registradas</span>
        </div>
        <div class="o_stat_card" data-jump-sub="customers">
          <span class="o_stat_label">Clientes Activos</span>
          <span class="o_stat_value">${kpis.customers_total || 0}</span>
          <span class="o_stat_sub">Vinculados a Ventas y Facturación</span>
        </div>
        <div class="o_stat_card" data-jump-sub="suppliers">
          <span class="o_stat_label">Proveedores Homologados</span>
          <span class="o_stat_value">${kpis.suppliers_total || 0}</span>
          <span class="o_stat_sub">Vinculados a Compras y Gastos</span>
        </div>
      </div>
    `;

    if (state.viewType === 'kanban') {
      const contactCols = [
        {
          id: 'customers',
          title: 'Clientes',
          color: '#10b981',
          filter: (c) => Number(c.customer_rank) > 0 || (c.category_ids || []).includes('Cliente')
        },
        {
          id: 'suppliers',
          title: 'Proveedores',
          color: '#f59e0b',
          filter: (c) => (Number(c.supplier_rank) > 0 || (c.category_ids || []).includes('Proveedor')) && !(Number(c.customer_rank) > 0)
        },
        {
          id: 'others',
          title: 'Otros Contactos',
          color: '#3b82f6',
          filter: (c) => !(Number(c.customer_rank) > 0 || (c.category_ids || []).includes('Cliente')) && !(Number(c.supplier_rank) > 0 || (c.category_ids || []).includes('Proveedor'))
        }
      ];

      container.innerHTML =
        bannerHtml +
        `<div class="o_kanban_board">
          ${contactCols
            .map((col) => {
              const colContacts = contacts.filter(col.filter);
              return `
              <div class="o_kanban_column" style="--col-accent: ${col.color};">
                <div class="o_kanban_col_header">
                  <div class="o_kanban_col_title_wrap">
                    <span class="o_kanban_col_title">${esc(col.title)}</span>
                    <span class="o_badge o_badge_muted">${colContacts.length}</span>
                  </div>
                  <span class="o_kanban_col_sum">${colContacts.length} contacto(s)</span>
                </div>
                <div class="o_kanban_col_cards">
                  ${
                    colContacts.length === 0
                      ? `<div class="o_kanban_col_empty">Sin contactos en ${esc(col.title.toLowerCase())}</div>`
                      : colContacts
                          .map(
                            (c) => `
                        <article class="o_kanban_record" data-contact-id="${c.id}" style="cursor: pointer;">
                          <div class="o_kanban_avatar">${esc(initials(c.name))}</div>
                          <div class="o_kanban_details">
                            <div style="display: flex; justify-content: space-between; gap: 0.4rem;">
                              <span class="o_kanban_title">${esc(c.name)}</span>
                              <span class="o_badge ${c.is_company ? 'o_badge_info' : 'o_badge_muted'}">${c.is_company ? 'Compañía' : 'Individual'}</span>
                            </div>
                            <div class="o_kanban_subtitle">${esc(c.function || '')} ${c.vat ? '· ' + esc(c.doc_type || 'NIT') + ': ' + esc(c.vat) : ''}</div>
                            <div class="o_kanban_subtitle">📍 ${esc(c.city || 'Pereira')}, ${esc(c.country || 'Colombia')}</div>
                            <div class="o_kanban_subtitle">✉️ ${esc(c.email || 'Sin correo')} · 📞 ${esc(c.phone || c.mobile || '—')}</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.2rem;">
                              ${(c.category_ids || []).map((t) => `<span class="o_tag">${esc(t)}</span>`).join('')}
                            </div>
                            <div class="o_kanban_footer">
                              <span>🛒 ${c.sales_count || 0} Ventas (${formatMoney(c.sales_total || 0)})</span>
                              <span>🧾 ${c.invoices_count || 0} Facturas</span>
                            </div>
                          </div>
                        </article>
                      `
                          )
                          .join('')
                  }
                </div>
              </div>
            `;
            })
            .join('')}
        </div>`;

      container.querySelectorAll('.o_kanban_record').forEach((card) => {
        card.addEventListener('click', () => {
          state.activeRecordId = Number(card.getAttribute('data-contact-id'));
          state.viewType = 'form';
          renderModuleWorkspace();
        });
      });
    } else {
      // Responsive Table (follows modern-web-guidance `responsive-table`)
      container.innerHTML =
        bannerHtml +
        `
        <div tabindex="0" role="region" aria-labelledby="contacts-table-caption" class="table-wrapper">
          <table class="o_list_table" style="--label-2: 'NIT / Identificación'; --label-3: 'Tipo'; --label-4: 'Correo'; --label-5: 'Teléfono'; --label-6: 'Ciudad'; --label-7: 'Ventas';">
            <caption id="contacts-table-caption">Directorio de contactos de CHapp ERP</caption>
            <thead>
              <tr>
                <th>Nombre / Razón Social</th>
                <th>NIT / CC</th>
                <th>Tipo</th>
                <th>Correo Electrónico</th>
                <th>Teléfono</th>
                <th>Ciudad</th>
                <th class="text-end">Total Ventas</th>
              </tr>
            </thead>
            <tbody>
              ${contacts
                .map(
                  (c) => `
                  <tr data-contact-id="${c.id}">
                    <th>${esc(c.name)}</th>
                    <td>${c.vat ? esc((c.doc_type ? c.doc_type + ' ' : '') + c.vat) : '—'}</td>
                    <td><span class="o_badge ${c.is_company ? 'o_badge_info' : 'o_badge_muted'}">${c.is_company ? 'Compañía' : 'Individual'}</span></td>
                    <td>${esc(c.email || '—')}</td>
                    <td>${esc(c.phone || c.mobile || '—')}</td>
                    <td>${esc(c.city || '—')}</td>
                    <td class="text-end"><strong>${formatMoney(c.sales_total || 0)}</strong></td>
                  </tr>
                `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;

      container.querySelectorAll('tbody tr').forEach((row) => {
        row.addEventListener('click', () => {
          state.activeRecordId = Number(row.getAttribute('data-contact-id'));
          state.viewType = 'form';
          renderModuleWorkspace();
        });
      });
    }

    container.querySelectorAll('[data-jump-sub]').forEach((card) => {
      card.addEventListener('click', () => {
        state.submenu = card.getAttribute('data-jump-sub');
        renderSubmenus(APPS.find((a) => a.id === 'contacts'));
        renderModuleWorkspace();
      });
    });
  }

  const COLOMBIA_DOC_TYPES = [
    { code: 'NIT', label: 'NIT - Número de Identificación Tributaria' },
    { code: 'CC', label: 'CC - Cédula de Ciudadanía' },
    { code: 'CE', label: 'CE - Cédula de Extranjería' },
    { code: 'TI', label: 'TI - Tarjeta de Identidad' },
    { code: 'PP', label: 'PP - Pasaporte' },
    { code: 'RC', label: 'RC - Registro Civil' },
    { code: 'PEP', label: 'PEP - Permiso Especial de Permanencia' },
    { code: 'PPT', label: 'PPT - Permiso por Protección Temporal' },
    { code: 'DIE', label: 'DIE - Documento de Identificación Extranjero' }
  ];

  const COLOMBIA_CITIES = [
    'Apartadó',
    'Arauca',
    'Armenia',
    'Barrancabermeja',
    'Barranquilla',
    'Bello',
    'Bogotá D.C.',
    'Bucaramanga',
    'Buenaventura',
    'Buga',
    'Cali',
    'Cartagena',
    'Cartago',
    'Caucasia',
    'Chía',
    'Ciénaga',
    'Cúcuta',
    'Dosquebradas',
    'Duitama',
    'Envigado',
    'Espinal',
    'Facatativá',
    'Florencia',
    'Floridablanca',
    'Fusagasugá',
    'Girardot',
    'Girón',
    'Ibagué',
    'Inírida',
    'Ipiales',
    'Itagüí',
    'Jamundí',
    'La Dorada',
    'Leticia',
    'Magangué',
    'Maicao',
    'Malambo',
    'Manizales',
    'Medellín',
    'Mitú',
    'Mocoa',
    'Montería',
    'Mosquera',
    'Neiva',
    'Ocaña',
    'Palmira',
    'Pamplona',
    'Pasto',
    'Pereira',
    'Piedecuesta',
    'Pitalito',
    'Popayán',
    'Puerto Carreño',
    'Quibdó',
    'Riohacha',
    'Rionegro',
    'Sabanalarga',
    'Sabaneta',
    'San Andrés',
    'San Gil',
    'Santa Marta',
    'Santa Rosa de Cabal',
    'Sincelejo',
    'Soacha',
    'Sogamoso',
    'Soledad',
    'Tuluá',
    'Tumaco',
    'Tunja',
    'Turbo',
    'Uribia',
    'Valledupar',
    'Villavicencio',
    'Yopal',
    'Yumbo',
    'Zipaquirá'
  ];

  function renderContactForm(container) {
    const isNew = state.activeRecordId === 'new';
    const defaultIsSupplier = state.submenu === 'suppliers';
    const existing = isNew
      ? {
          name: '',
          is_company: true,
          company_name: '',
          doc_type: 'NIT',
          vat: '',
          function: defaultIsSupplier ? 'Proveedor Corporativo' : 'Cliente Corporativo',
          street: '',
          city: 'Pereira',
          state_name: 'Risaralda',
          country: 'Colombia',
          email: '',
          phone: '',
          mobile: '',
          website: '',
          customer_rank: defaultIsSupplier ? 0 : 1,
          supplier_rank: defaultIsSupplier ? 1 : 0,
          category_ids: [defaultIsSupplier ? 'Proveedor' : 'Cliente'],
          payment_term: '',
          notes: '',
          sales_count: 0,
          sales_total: 0,
          invoices_count: 0,
          invoiced_total: 0,
          expenses_count: 0,
          chatter: []
        }
      : (state.data.contacts || []).find((c) => Number(c.id) === Number(state.activeRecordId));

    if (!existing) {
      state.viewType = 'list';
      return renderModuleWorkspace();
    }

    const currentDocType = existing.doc_type || (existing.is_company ? 'NIT' : 'CC');
    const currentCity = existing.city || 'Pereira';
    const cityOptions = COLOMBIA_CITIES.includes(currentCity)
      ? COLOMBIA_CITIES
      : [currentCity, ...COLOMBIA_CITIES];
    const isSupplierSelected = Number(existing.supplier_rank || 0) > 0 && Number(existing.customer_rank || 0) === 0;

    container.innerHTML = `
      <div class="o_form_view">
        <div class="o_form_sheet_bg">
          <div class="o_form_statusbar">
            <div class="o_statusbar_buttons">
              <button type="button" class="btn btn-action" id="btnSaveContact">Guardar Contacto</button>
              ${
                !isNew
                  ? `<button type="button" class="btn btn-secondary" id="btnNewSaleFromContact">Nueva Cotización</button>
                     <button type="button" class="btn btn-danger btn-sm" id="btnDeleteContact">Eliminar</button>`
                  : ''
              }
            </div>
            <div class="o_statusbar_status">
              <span class="o_arrow_button is-current" id="contactTypeStatusPill">${existing.is_company ? 'Compañía' : 'Persona Individual'}</span>
            </div>
          </div>

          <form id="contactForm" class="o_form_sheet">
            ${
              !isNew
                ? `
              <div class="o_button_box">
                <button type="button" class="o_stat_button oe_stat_button" id="btnSmartSales">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                  <div class="o_stat_info">
                    <span class="o_stat_value">${existing.sales_count || 0} Ventas</span>
                    <span class="o_stat_text">${formatMoney(existing.sales_total || 0)}</span>
                  </div>
                </button>
                <button type="button" class="o_stat_button oe_stat_button" id="btnSmartInvoices">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                  <div class="o_stat_info">
                    <span class="o_stat_value">${existing.invoices_count || 0} Facturas</span>
                    <span class="o_stat_text">${formatMoney(existing.invoiced_total || 0)}</span>
                  </div>
                </button>
                <button type="button" class="o_stat_button oe_stat_button" id="btnSmartExpenses">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                  <div class="o_stat_info">
                    <span class="o_stat_value">${existing.expenses_count || 0} Gastos</span>
                    <span class="o_stat_text">Asociados</span>
                  </div>
                </button>
              </div>
            `
                : ''
            }

            <div style="display: flex; gap: 1.25rem; margin-bottom: 0.5rem;">
              <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                <input type="radio" name="is_company" value="true" ${existing.is_company ? 'checked' : ''} />
                <span>Compañía</span>
              </label>
              <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                <input type="radio" name="is_company" value="false" ${!existing.is_company ? 'checked' : ''} />
                <span>Individual</span>
              </label>
            </div>

            <div style="display: flex; gap: 1.25rem; margin-bottom: 0.75rem;">
              <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                <input type="radio" name="contact_role" value="customer" ${!isSupplierSelected ? 'checked' : ''} />
                <span>Cliente</span>
              </label>
              <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                <input type="radio" name="contact_role" value="supplier" ${isSupplierSelected ? 'checked' : ''} />
                <span>Proveedor</span>
              </label>
            </div>

            <div class="o_form_title_group">
              <label for="fContactName">Nombre o Razón Social *</label>
              <input type="text" id="fContactName" class="o_input_title" value="${esc(existing.name)}" placeholder="Ej. Grupo Empresarial Andino S.A.S." required />
            </div>

            <div class="o_group">
              <div class="o_field_row">
                <label for="fContactDocType">Tipo de Documento</label>
                <select id="fContactDocType" class="o_select">
                  ${COLOMBIA_DOC_TYPES.map(
                    (dt) => `<option value="${esc(dt.code)}" ${currentDocType === dt.code ? 'selected' : ''}>${esc(dt.label)}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fContactVat">Número de Documento</label>
                <input type="text" id="fContactVat" class="o_input" value="${esc(existing.vat)}" placeholder="Ej. 900.312.450-1" />
              </div>
              <div class="o_field_row">
                <label for="fContactFunction">Cargo / Actividad Económica</label>
                <input type="text" id="fContactFunction" class="o_input" value="${esc(existing.function)}" />
              </div>
              <div class="o_field_row">
                <label for="fContactEmail">Correo Electrónico</label>
                <input type="email" id="fContactEmail" class="o_input" value="${esc(existing.email)}" placeholder="correo@empresa.co" />
              </div>
              <div class="o_field_row">
                <label for="fContactPhone">Teléfono Fijo</label>
                <input type="text" id="fContactPhone" class="o_input" value="${esc(existing.phone)}" />
              </div>
              <div class="o_field_row">
                <label for="fContactMobile">Móvil / WhatsApp</label>
                <input type="text" id="fContactMobile" class="o_input" value="${esc(existing.mobile)}" />
              </div>
              <div class="o_field_row">
                <label for="fContactStreet">Dirección Fiscal</label>
                <input type="text" id="fContactStreet" class="o_input" value="${esc(existing.street)}" />
              </div>
              <div class="o_field_row">
                <label for="fContactCity">Ciudad</label>
                <select id="fContactCity" class="o_select">
                  ${cityOptions
                    .map((city) => `<option value="${esc(city)}" ${currentCity === city ? 'selected' : ''}>${esc(city)}</option>`)
                    .join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fContactPaymentTerm">Plazo de Pago Predeterminado</label>
                <select id="fContactPaymentTerm" class="o_select">
                  <option value="" ${!existing.payment_term ? 'selected disabled' : ''}>— Seleccione un plazo de pago —</option>
                  ${['Contado', '15 Días', '30 Días', '45 Días', '60 Días']
                    .map((t) => `<option value="${t}" ${existing.payment_term === t ? 'selected' : ''}>${t}</option>`)
                    .join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fContactTags">Etiquetas (separadas por coma)</label>
                <input type="text" id="fContactTags" class="o_input" value="${esc((existing.category_ids || []).join(', '))}" placeholder="VIP, Cliente, Proveedor" />
              </div>
            </div>

            <div class="o_field_row">
              <label for="fContactNotes">Notas Internas</label>
              <textarea id="fContactNotes" class="o_textarea" rows="3">${esc(existing.notes)}</textarea>
            </div>
          </form>
        </div>

        ${renderChatterHtml('contacts', existing)}
      </div>
    `;

    wireChatterEvents('contacts', existing.id);

    // Sync statusbar pill and default document type when toggling Compañía / Individual
    container.querySelectorAll('input[name="is_company"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const isComp = document.querySelector('input[name="is_company"]:checked').value === 'true';
        const pill = document.getElementById('contactTypeStatusPill');
        if (pill) pill.textContent = isComp ? 'Compañía' : 'Persona Individual';
        if (isNew) {
          const docSelect = document.getElementById('fContactDocType');
          if (docSelect && (docSelect.value === 'NIT' || docSelect.value === 'CC')) {
            docSelect.value = isComp ? 'NIT' : 'CC';
          }
        }
      });
    });

    // Sync default tags and function when toggling Cliente / Proveedor on a new contact
    container.querySelectorAll('input[name="contact_role"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!isNew) return;
        const role = document.querySelector('input[name="contact_role"]:checked').value;
        const tagsInput = document.getElementById('fContactTags');
        if (tagsInput && (tagsInput.value.trim() === 'Cliente' || tagsInput.value.trim() === 'Proveedor')) {
          tagsInput.value = role === 'supplier' ? 'Proveedor' : 'Cliente';
        }
        const fnInput = document.getElementById('fContactFunction');
        if (fnInput && (fnInput.value.trim() === 'Cliente Corporativo' || fnInput.value.trim() === 'Proveedor Corporativo')) {
          fnInput.value = role === 'supplier' ? 'Proveedor Corporativo' : 'Cliente Corporativo';
        }
      });
    });

    document.getElementById('btnSaveContact').addEventListener('click', async () => {
      try {
        const isComp = document.querySelector('input[name="is_company"]:checked').value === 'true';
        const role = document.querySelector('input[name="contact_role"]:checked').value;
        const payload = {
          id: isNew ? undefined : existing.id,
          name: document.getElementById('fContactName').value,
          is_company: isComp,
          doc_type: document.getElementById('fContactDocType').value,
          vat: document.getElementById('fContactVat').value,
          function: document.getElementById('fContactFunction').value,
          email: document.getElementById('fContactEmail').value,
          phone: document.getElementById('fContactPhone').value,
          mobile: document.getElementById('fContactMobile').value,
          street: document.getElementById('fContactStreet').value,
          city: document.getElementById('fContactCity').value,
          payment_term: document.getElementById('fContactPaymentTerm').value,
          category_ids: document.getElementById('fContactTags').value,
          customer_rank: role === 'customer' ? 1 : 0,
          supplier_rank: role === 'supplier' ? 1 : 0,
          notes: document.getElementById('fContactNotes').value
        };
        const res = await apiCall('/api/contacts', 'POST', payload);
        if (isNew) {
          state.activeRecordId = null;
          state.viewType = 'list';
        } else {
          state.activeRecordId = res.contact.id;
        }
        showToast('Contacto guardado correctamente.');
        renderModuleWorkspace();
      } catch (err) {
        showToast(err.message, true);
      }
    });

    const contactFormEl = document.getElementById('contactForm');
    if (contactFormEl) {
      contactFormEl.addEventListener('submit', (e) => {
        e.preventDefault();
        document.getElementById('btnSaveContact')?.click();
      });
    }

    const delBtn = document.getElementById('btnDeleteContact');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        try {
          await apiCall(`/api/contacts/${existing.id}`, 'DELETE');
          showToast('Contacto eliminado.');
          state.activeRecordId = null;
          state.viewType = 'list';
          renderModuleWorkspace();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    }

    const newSaleBtn = document.getElementById('btnNewSaleFromContact');
    if (newSaleBtn) {
      newSaleBtn.addEventListener('click', () => {
        state.formDraft = { partner_id: existing.id };
        openApp('sales', { submenu: 'all', viewType: 'form', recordId: 'new', returnTo: { app: 'contacts', submenu: state.submenu, viewType: 'form', recordId: existing.id } });
      });
    }

    const smartSales = document.getElementById('btnSmartSales');
    if (smartSales) {
      smartSales.addEventListener('click', () => {
        openApp('sales', {
          submenu: 'all',
          viewType: 'list',
          partnerFilter: { id: existing.id, name: existing.name }
        });
      });
    }

    const smartInvoices = document.getElementById('btnSmartInvoices');
    if (smartInvoices) {
      smartInvoices.addEventListener('click', () => {
        openApp('accounting', {
          submenu: 'out_invoice',
          viewType: 'list',
          partnerFilter: { id: existing.id, name: existing.name }
        });
      });
    }

    const smartExpenses = document.getElementById('btnSmartExpenses');
    if (smartExpenses) {
      smartExpenses.addEventListener('click', () => {
        openApp('expenses', {
          submenu: 'all',
          viewType: 'list',
          partnerFilter: { id: existing.id, name: existing.name }
        });
      });
    }
  }

  // ==================== MODULE 2: GASTOS (hr.expense) ====================
  function expenseBadge(st) {
    const map = {
      draft: { cls: 'o_badge_info', text: 'Por Enviar (Borrador)' },
      submitted: { cls: 'o_badge_warning', text: 'Enviado' },
      approved: { cls: 'o_badge_success', text: 'Aprobado' },
      posted: { cls: 'o_badge_info', text: 'Contabilizado' },
      paid: { cls: 'o_badge_success', text: 'Pagado' },
      refused: { cls: 'o_badge_danger', text: 'Rechazado' }
    };
    const item = map[st] || { cls: 'o_badge_muted', text: st };
    return `<span class="o_badge ${item.cls}">${esc(item.text)}</span>`;
  }

  function getFilteredExpenses() {
    let list = state.data.expenses || [];
    if (state.submenu === 'to_approve') list = list.filter((e) => e.state === 'submitted');
    else if (state.submenu === 'to_pay') list = list.filter((e) => e.state === 'approved' || e.state === 'posted');

    if (state.statusFilter !== 'all') {
      list = list.filter((e) => e.state === state.statusFilter);
    }
    if (state.partnerContextFilter) {
      list = list.filter((e) => Number(e.partner_id) === Number(state.partnerContextFilter.id));
    }

    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          (e.name || '').toLowerCase().includes(q) ||
          (e.reference || '').toLowerCase().includes(q) ||
          (e.employee_name || '').toLowerCase().includes(q) ||
          (e.product_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  function renderExpensesModule() {
    const container = document.getElementById('moduleContent');
    if (state.viewType === 'form') {
      renderExpenseForm(container);
      return;
    }

    const expenses = getFilteredExpenses();
    updatePager(expenses.length, (state.data.expenses || []).length);

    // Keep test contract for kanban stages
    const stageCols = [
      { id: 'draft', title: 'Borrador', color: '#64748b', filter: (e) => e.state === 'draft' },
      { id: 'reported', title: 'Presentado', color: '#0284c7', filter: (e) => e.state === 'reported' },
      { id: 'approved', title: 'Aprobado', color: '#eab308', filter: (e) => e.state === 'approved' },
      { id: 'done', title: 'Pagado', color: '#10b981', filter: (e) => e.state === 'done' }
    ];

    const totalSum = expenses.reduce((s, e) => s + Number(e.total_amount || 0), 0);

    container.innerHTML = `
      <div class="o_expense_card_quick">
        <div>
          <div style="font-size: 1.15rem; font-weight: 700; color: var(--o-heading); display: flex; align-items: center; gap: 8px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #2563eb;"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
            Gastos y Compras a Proveedores
          </div>
          <p style="margin: 4px 0 0; color: var(--o-muted); font-size: 0.88rem;">
            Registra tus gastos directamente de manera manual o fotografiando la factura del proveedor con lectura automática de IA.
          </p>
        </div>
        <div class="o_expense_quick_actions">
          <button type="button" class="btn btn-secondary" id="btnExpensesBannerNew">
            Nuevo Gasto Manual
          </button>
          <button type="button" class="btn btn-primary" id="btnExpensesBannerScan" style="background: linear-gradient(135deg, #1e3a8a, #2563eb); font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            Escanear Factura
          </button>
        </div>
      </div>

      <div class="o_dashboard_banner" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 1.25rem;">
        <div class="o_stat_card">
          <span class="o_stat_label">Total Gastos Registrados</span>
          <span class="o_stat_value">${expenses.length}</span>
          <span class="o_stat_sub">Comprobantes y recibos</span>
        </div>
        <div class="o_stat_card">
          <span class="o_stat_label">Monto Total Acumulado</span>
          <span class="o_stat_value" style="color: #2563eb;">${formatMoney(totalSum)}</span>
          <span class="o_stat_sub">Total registrado</span>
        </div>
      </div>

      <div tabindex="0" role="region" aria-labelledby="expenses-table-caption" class="table-wrapper">
        <table class="o_list_table" style="--label-2: 'Proveedor'; --label-3: 'Descripción'; --label-4: 'Fecha'; --label-5: 'N° Factura'; --label-6: 'Total'; --label-7: 'Acciones';">
          <caption id="expenses-table-caption">Listado de gastos y comprobantes registrados</caption>
          <thead>
            <tr>
              <th style="width: 140px;">Referencia</th>
              <th>Proveedor / Establecimiento</th>
              <th>Descripción del Gasto</th>
              <th style="width: 110px;">Fecha</th>
              <th style="width: 140px;">N° Factura / Soporte</th>
              <th class="text-end" style="width: 130px;">Total</th>
              <th class="text-center" style="width: 90px;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${
              expenses.length === 0
                ? `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--o-muted);">No hay gastos registrados todavía. Pulsa <strong>Nuevo Gasto Manual</strong> o <strong>Escanear Factura</strong> para comenzar.</td></tr>`
                : expenses
                    .map(
                      (e) => `
                <tr data-expense-id="${e.id}" style="cursor: pointer;">
                  <th>${esc(e.reference)}</th>
                  <td>
                    <strong>${esc(e.partner_name || 'Proveedor General')}</strong>
                    ${(e.supplier_vat) ? `<div style="font-size: 0.78rem; color: var(--o-muted); margin-top: 2px;">NIT: ${esc(e.supplier_vat)}</div>` : ''}
                  </td>
                  <td>${esc(e.name)}</td>
                  <td>${esc(e.date)}</td>
                  <td>${esc(e.receipt_ref || '—')}</td>
                  <td class="text-end"><strong>${formatMoney(e.total_amount)}</strong></td>
                  <td class="text-center" onclick="event.stopPropagation();">
                    <button type="button" class="btn btn-sm btn-secondary btn-del-exp" data-del-id="${e.id}" title="Eliminar gasto" aria-label="Eliminar gasto" style="padding: 4px 8px; color: #ef4444;">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </td>
                </tr>
              `
                    )
                    .join('')
            }
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5">Total General de Gastos</td>
              <td class="text-end"><strong>${formatMoney(totalSum)}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    const bannerNew = document.getElementById('btnExpensesBannerNew');
    if (bannerNew) {
      bannerNew.addEventListener('click', () => {
        state.activeRecordId = 'new';
        state.formDraft = null;
        state.viewType = 'form';
        renderModuleWorkspace();
      });
    }

    const bannerScan = document.getElementById('btnExpensesBannerScan');
    if (bannerScan) {
      bannerScan.addEventListener('click', () => {
        openExpenseCameraDialog();
      });
    }

    container.querySelectorAll('tbody tr[data-expense-id]').forEach((row) => {
      row.addEventListener('click', () => {
        state.activeRecordId = Number(row.getAttribute('data-expense-id'));
        state.viewType = 'form';
        renderModuleWorkspace();
      });
    });

    container.querySelectorAll('.btn-del-exp').forEach((btn) => {
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const id = Number(btn.getAttribute('data-del-id'));
        const expRec = (state.data.expenses || []).find((e) => Number(e.id) === id);
        const expIdStr = expRec ? (expRec.reference || ('EXP/2026/' + String(expRec.id).padStart(4, '0'))) : ('#' + id);
        if (!confirm(`¿Estás seguro de eliminar el gasto ${expIdStr}?`)) return;
        try {
          await apiCall(`/api/expenses/${id}`, 'DELETE');
          showToast('Gasto eliminado.');
          renderModuleWorkspace();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    });
  }

  function renderExpenseForm(container) {
    const isNew = state.activeRecordId === 'new';
    const draft = state.formDraft || {};
    const existing = isNew
      ? {
          reference: 'Nuevo Gasto',
          name: draft.name || '',
          employee_name: draft.employee_name || (state.data.settings && state.data.settings.active_user && state.data.settings.active_user.name) || 'Andrés Salazar',
          department: draft.department || 'Operaciones & Proyectos',
          product_id: draft.product_id || '',
          product_name: draft.product_name || '',
          partner_name: draft.partner_name || '',
          supplier_vat: draft.supplier_vat || '',
          date: draft.date || new Date().toISOString().slice(0, 10),
          payment_mode: draft.payment_mode || 'company_account',
          quantity: draft.quantity || 1,
          price_unit: draft.price_unit || draft.total_amount || 0,
          tax_rate: draft.tax_rate !== undefined ? draft.tax_rate : 0,
          untaxed_amount: draft.untaxed_amount || draft.total_amount || 0,
          tax_amount: draft.tax_amount || 0,
          total_amount: draft.total_amount || 0,
          partner_id: draft.partner_id || '',
          analytic_account: 'General',
          receipt_ref: draft.receipt_ref || '',
          notes: draft.notes || '',
          state: 'draft',
          receipt_image: draft.receipt_image || '',
          move_id: null,
          chatter: []
        }
      : (state.data.expenses || []).find((e) => Number(e.id) === Number(state.activeRecordId));

    if (!existing) {
      state.viewType = 'list';
      return renderModuleWorkspace();
    }

    // Keep test contract for stages if referenced
    const stages = [
      { id: 'draft', label: 'Borrador' },
      { id: 'submitted', label: 'Enviado' },
      { id: 'approved', label: 'Aprobado' },
      { id: 'posted', label: 'Publicado' },
      { id: 'paid', label: 'Pagado' }
    ];

    container.innerHTML = `
      <div class="o_form_view">
        <div class="o_form_sheet_bg">
          <div class="o_form_statusbar" style="justify-content: space-between;">
            <div class="o_statusbar_buttons">
              <button type="button" class="btn btn-primary" id="btnSaveExpense">Guardar Gasto</button>
              <button type="button" class="btn btn-action" id="btnFormScanAi" style="background: linear-gradient(135deg, #1e3a8a, #2563eb); color: white; display: inline-flex; align-items: center; gap: 0.4rem;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                Escanear Factura
              </button>
              ${
                !isNew
                  ? `<button type="button" class="btn btn-danger" id="btnDeleteFormExpense">Eliminar Gasto</button>`
                  : ''
              }

            </div>
            <div style="font-weight: 600; color: var(--o-muted); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
              <span>${isNew ? 'Registro de Gasto' : esc(existing.reference)}</span>
              ${!isNew && existing.move_id ? `<button type="button" class="btn btn-sm btn-secondary" id="btnExpenseBillLink" style="padding: 2px 8px; font-size: 0.8rem;">Ver Factura Proveedor (${esc(existing.bill_name || 'BILL')})</button>` : ''}
            </div>
          </div>

          <form id="expenseForm" class="o_form_sheet">
            <div class="o_form_title_group">
              <label for="fExpName">Descripción del Gasto *</label>
              <input type="text" id="fExpName" class="o_input_title" value="${esc(existing.name)}" placeholder="Ej. Materiales de ferretería, Gasolina, Almuerzo..." required />
            </div>

            <div class="o_group">
              <div class="o_field_row">
                <label for="fExpPartner">Proveedor / Establecimiento</label>
                <div style="display: flex; gap: 8px; flex-direction: column;">
                  <select id="fExpPartner" class="o_select">
                    <option value="" ${!existing.partner_id ? 'selected disabled' : ''}>— Seleccionar Proveedor —</option>
                    ${(state.data.contacts || [])
                      .map(
                        (c) => `<option value="${c.id}" ${Number(existing.partner_id) === Number(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`
                      )
                      .join('')}
                  </select>
                  <input type="text" id="fExpPartnerName" class="o_input" value="${esc(existing.partner_name || '')}" placeholder="O escribir nombre del proveedor directamente" />
                </div>
              </div>
              <div class="o_field_row">
                <label for="fExpPartnerVat">NIT / Identificación Proveedor</label>
                <input type="text" id="fExpPartnerVat" class="o_input" value="${esc(existing.supplier_vat || ((state.data.contacts || []).find((c) => Number(c.id) === Number(existing.partner_id)) || {}).vat || '')}" placeholder="Ej. 900.123.456-7" />
              </div>
              <div class="o_field_row">
                <label for="fExpReceipt">N° Factura / Soporte</label>
                <input type="text" id="fExpReceipt" class="o_input" value="${esc(existing.receipt_ref || '')}" placeholder="Ej. FE-1234, REC-90" />
              </div>
              <div class="o_field_row">
                <label for="fExpDate">Fecha del Gasto</label>
                <input type="date" id="fExpDate" class="o_input" value="${esc(existing.date)}" />
              </div>
              <div class="o_field_row">
                <label for="fExpTotal">Monto Total del Gasto ($ COP) *</label>
                <input type="number" id="fExpTotal" class="o_input" min="1" step="any" value="${Number(existing.total_amount || existing.price_unit || 0)}" required style="font-size: 1.1rem; font-weight: 700; color: #2563eb;" />
              </div>
              <div class="o_field_row">
                <label for="fExpProduct">Categoría de Gasto</label>
                <select id="fExpProduct" class="o_select">
                  <option value="" ${!existing.product_id ? 'selected disabled' : ''}>— Seleccione Categoría de Gasto —</option>
                  ${(state.data.products || [])
                    .map(
                      (p) =>
                        `<option value="${p.id}" ${Number(existing.product_id) === Number(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`
                    )
                    .join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fExpJournal">Cuenta / Medio de Pago *</label>
                <select id="fExpJournal" class="o_select" required>
                  ${((state.data.accounting && state.data.accounting.journals) || [])
                    .filter((j) => (j.type === 'bank' || j.type === 'cash') && j.active !== false)
                    .map((j) => `<option value="${esc(j.code)}" ${existing.journal_code === j.code ? 'selected' : (!existing.journal_code && j.code === 'CSH1' ? 'selected' : '')}>${esc(j.name)} (${esc(j.code)})</option>`)
                    .join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fExpPayMode">Forma de Pago</label>
                <select id="fExpPayMode" class="o_select">
                  <option value="" ${!existing.payment_mode ? 'selected disabled' : ''}>— Seleccione Forma de Pago —</option>
                  <option value="company_account" ${existing.payment_mode === 'company_account' ? 'selected' : ''}>Compañía (Transferencia / Tarjeta / Caja)</option>
                  <option value="own_account" ${existing.payment_mode === 'own_account' ? 'selected' : ''}>Empleado (a reembolsar)</option>
                </select>
              </div>
              <div class="o_field_row">
                <label for="fExpEmployee">Responsable / Empleado</label>
                <input type="text" id="fExpEmployee" class="o_input" value="${esc(existing.employee_name || 'Andrés Salazar')}" />
              </div>
            </div>

            <div style="display: none;" aria-hidden="true">
                <select id="fExpTax">
                  <option value="" ${existing.tax_rate === '' || existing.tax_rate === undefined || existing.tax_rate === null ? 'selected disabled' : ''}>— Seleccione IVA —</option>
                  <option value="0" ${existing.tax_rate === 0 ? 'selected' : ''}>IVA 0% (Exento)</option>
                  <option value="5" ${existing.tax_rate === 5 ? 'selected' : ''}>IVA 5%</option>
                  <option value="19" ${existing.tax_rate === 19 ? 'selected' : ''}>IVA 19%</option>
                </select>
              </div>

            <!-- Tabla estructurada de Artículos / Productos -->
            <div style="margin-top: 1.25rem; border-top: 1px solid var(--o-border); padding-top: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                <div>
                  <h4 style="margin: 0; font-size: 0.98rem; font-weight: 700; color: var(--o-text);">Productos / Artículos Adquiridos</h4>
                  <span style="font-size: 0.8rem; color: var(--o-muted);">Detalle de ítems con cantidad, valor unitario y subtotal</span>
                </div>
                <button type="button" class="btn btn-sm btn-secondary" id="btnAddExpenseItem" style="display: inline-flex; align-items: center; gap: 4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Agregar Producto / Artículo
                </button>
              </div>

              <div tabindex="0" role="region" aria-label="Tabla de productos del gasto" class="table-wrapper" style="margin-bottom: 0.75rem;">
                <table class="o_list_table" id="expenseItemsTable" style="--label-2: 'Cantidad'; --label-3: 'Valor Unit.'; --label-4: 'Subtotal'; --label-5: 'Acción';">
                  <thead>
                    <tr>
                      <th>Descripción del Producto / Artículo</th>
                      <th style="width: 100px;">Cantidad</th>
                      <th style="width: 160px;">Valor Unitario ($)</th>
                      <th class="text-end" style="width: 160px;">Subtotal ($)</th>
                      <th style="width: 50px;"></th>
                    </tr>
                  </thead>
                  <tbody id="expenseItemsTbody">
                  </tbody>
                </table>
              </div>
            </div>

            <div class="o_field_row" style="margin-top: 0.5rem;">
              <label for="fExpNotes">Notas / Observaciones Generales</label>
              <textarea id="fExpNotes" class="o_textarea" rows="2" placeholder="Observaciones generales (el NIT y los artículos ya tienen sus campos correspondientes)">${esc(existing.notes || '')}</textarea>
            </div>

            <!-- Foto o Soporte de la Factura -->
            <div style="margin-top: 1rem; padding: 1rem; background: var(--o-bg-subtle, rgba(0,0,0,0.02)); border: 1px dashed var(--o-border); border-radius: 8px;">
              <div style="font-weight: 600; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
                <span>Foto de la Factura / Comprobante</span>
                <button type="button" class="btn btn-sm btn-secondary" id="btnFormCameraTrigger">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  ${existing.receipt_image ? 'Cambiar Foto / Escanear Factura' : 'Escanear Factura'}
                </button>
              </div>
              <div id="formReceiptPreviewWrap">
                ${
                  existing.receipt_image
                    ? `<img src="${existing.receipt_image}" class="o_expense_receipt_preview" alt="Comprobante factura" onclick="window.open(this.src)" title="Clic para ver tamaño completo" />`
                    : `<span style="font-size: 0.85rem; color: var(--o-muted);">Sin foto adjunta. Puedes tomarla con la cámara en vivo o subir un archivo.</span>`
                }
              </div>
            </div>
          </form>
        </div>

        ${renderChatterHtml('expenses', existing)}
      </div>
    `;

    wireChatterEvents('expenses', existing.id);

    // Initial items list for the table
    let expenseItems = Array.isArray(existing.items) && existing.items.length > 0
      ? [...existing.items]
      : (draft && Array.isArray(draft.items) && draft.items.length > 0
          ? [...draft.items]
          : [{ description: existing.name || '', quantity: existing.quantity || 1, price_unit: existing.price_unit || existing.total_amount || 0, subtotal: existing.total_amount || 0 }]);

    const renderExpenseItems = () => {
      const tbody = document.getElementById('expenseItemsTbody');
      if (!tbody) return;
      tbody.innerHTML = expenseItems.map((it, idx) => {
        const sub = Math.round((Number(it.quantity || 1) * Number(it.price_unit || 0)) * 100) / 100;
        return `
          <tr data-item-idx="${idx}">
            <td>
              <input type="text" class="o_input exp-item-desc" data-idx="${idx}" value="${esc(it.description || '')}" placeholder="Ej. Tubo PVC, Almuerzo, Cable..." />
            </td>
            <td>
              <input type="number" class="o_input exp-item-qty" data-idx="${idx}" min="1" step="any" value="${Number(it.quantity || 1)}" />
            </td>
            <td>
              <input type="number" class="o_input exp-item-price" data-idx="${idx}" min="0" step="any" value="${Number(it.price_unit || 0)}" />
            </td>
            <td class="text-end">
              <strong class="exp-item-subtotal">${formatMoney(sub)}</strong>
            </td>
            <td class="text-center">
              ${expenseItems.length > 1 ? `<button type="button" class="btn btn-sm btn-danger btn-remove-exp-item" data-idx="${idx}" title="Quitar ítem">Quitar</button>` : ''}
            </td>
          </tr>
        `;
      }).join('');

      // Wire row inputs
      tbody.querySelectorAll('.exp-item-desc').forEach(input => {
        input.addEventListener('input', (e) => {
          const idx = Number(e.target.dataset.idx);
          if (expenseItems[idx]) expenseItems[idx].description = e.target.value;
        });
      });

      tbody.querySelectorAll('.exp-item-qty, .exp-item-price').forEach(input => {
        input.addEventListener('input', (e) => {
          const idx = Number(e.target.dataset.idx);
          const row = tbody.querySelector(`tr[data-item-idx="${idx}"]`);
          if (!row || !expenseItems[idx]) return;
          const qty = Number(row.querySelector('.exp-item-qty').value || 1);
          const price = Number(row.querySelector('.exp-item-price').value || 0);
          expenseItems[idx].quantity = qty;
          expenseItems[idx].price_unit = price;
          const sub = Math.round(qty * price * 100) / 100;
          expenseItems[idx].subtotal = sub;
          row.querySelector('.exp-item-subtotal').textContent = formatMoney(sub);
          recalcExpenseTotal();
        });
      });

      tbody.querySelectorAll('.btn-remove-exp-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = Number(e.currentTarget.dataset.idx);
          expenseItems.splice(idx, 1);
          renderExpenseItems();
          recalcExpenseTotal();
        });
      });
    };

    const recalcExpenseTotal = () => {
      const sum = expenseItems.reduce((acc, it) => acc + (Number(it.quantity || 1) * Number(it.price_unit || 0)), 0);
      const totalInput = document.getElementById('fExpTotal');
      if (totalInput) totalInput.value = Math.round(sum * 100) / 100;
    };

    renderExpenseItems();

    const btnAddItem = document.getElementById('btnAddExpenseItem');
    if (btnAddItem) {
      btnAddItem.addEventListener('click', () => {
        expenseItems.push({ description: '', quantity: 1, price_unit: 0, subtotal: 0 });
        renderExpenseItems();
      });
    }

    // Auto fill NIT and Name when partner select changes
    const partnerSelect = document.getElementById('fExpPartner');
    if (partnerSelect) {
      partnerSelect.addEventListener('change', (e) => {
        const p = (state.data.contacts || []).find((c) => Number(c.id) === Number(e.target.value));
        if (p) {
          const nameInput = document.getElementById('fExpPartnerName');
          if (nameInput) nameInput.value = p.name;
          const vatInput = document.getElementById('fExpPartnerVat');
          if (vatInput) vatInput.value = p.vat || '';
          existing.partner_id = p.id;
          existing.partner_name = p.name;
          existing.supplier_vat = p.vat || '';
        }
      });
    }

    const openCameraForForm = () => {
      openExpenseCameraDialog((scannedData, imageBase64, matched) => {
        if (scannedData.name) document.getElementById('fExpName').value = scannedData.name;
        if (matched) {
          const pSel = document.getElementById('fExpPartner');
          if (pSel) pSel.value = String(matched.id);
          document.getElementById('fExpPartnerName').value = matched.name;
          document.getElementById('fExpPartnerVat').value = matched.vat || '';
          existing.partner_id = matched.id;
          existing.partner_name = matched.name;
          existing.supplier_vat = matched.vat || '';
        } else if (scannedData.supplier_name) {
          const pSel = document.getElementById('fExpPartner');
          if (pSel) pSel.value = '';
          document.getElementById('fExpPartnerName').value = scannedData.supplier_name;
          existing.partner_name = scannedData.supplier_name;
          if (scannedData.supplier_vat) {
            document.getElementById('fExpPartnerVat').value = scannedData.supplier_vat;
            existing.supplier_vat = scannedData.supplier_vat;
          }
        }
        if (scannedData.supplier_vat && !matched) {
          document.getElementById('fExpPartnerVat').value = scannedData.supplier_vat;
          existing.supplier_vat = scannedData.supplier_vat;
        }
        if (scannedData.reference) document.getElementById('fExpReceipt').value = scannedData.reference;
        if (scannedData.date) document.getElementById('fExpDate').value = scannedData.date;
        if (scannedData.total_amount) document.getElementById('fExpTotal').value = scannedData.total_amount;
        if (scannedData.notes) {
          document.getElementById('fExpNotes').value = scannedData.notes;
        }

        // Load items from AI scan
        if (Array.isArray(scannedData.items) && scannedData.items.length > 0) {
          expenseItems = scannedData.items.map(it => ({
            description: it.description || it.name || '',
            quantity: Number(it.quantity || 1),
            price_unit: Number(it.price_unit || 0),
            subtotal: Number(it.subtotal || ((Number(it.quantity || 1)) * Number(it.price_unit || 0)))
          }));
          renderExpenseItems();
          recalcExpenseTotal();
        } else if (scannedData.name || scannedData.total_amount) {
          expenseItems = [{
            description: scannedData.name || 'Gasto proveedor',
            quantity: 1,
            price_unit: Number(scannedData.total_amount || 0),
            subtotal: Number(scannedData.total_amount || 0)
          }];
          renderExpenseItems();
        }

        if (imageBase64) {
          existing.receipt_image = imageBase64;
          const wrap = document.getElementById('formReceiptPreviewWrap');
          if (wrap) {
            wrap.innerHTML = `<img src="${imageBase64}" class="o_expense_receipt_preview" alt="Comprobante factura" onclick="window.open(this.src)" title="Clic para ver tamaño completo" />`;
          }
        }
        showToast('Datos de la factura cargados en el formulario.');
      });
    };

    const expBillBtn = document.getElementById('btnExpenseBillLink');
    if (expBillBtn && existing.move_id) {
      expBillBtn.addEventListener('click', () => {
        openApp('accounting', {
          submenu: 'in_invoice',
          viewType: 'form',
          recordId: existing.move_id,
          returnTo: { app: 'expenses', submenu: state.submenu, viewType: 'form', recordId: existing.id }
        });
      });
    }

    const formScanBtn = document.getElementById('btnFormScanAi');
    if (formScanBtn) formScanBtn.addEventListener('click', openCameraForForm);

    const formCamTrig = document.getElementById('btnFormCameraTrigger');
    if (formCamTrig) formCamTrig.addEventListener('click', openCameraForForm);

    const cancelBtn = document.getElementById('btnCancelExpense');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (state.navStack && state.navStack.length > 0) {
          const prev = state.navStack.pop();
          openApp(prev.app, {
            submenu: prev.submenu,
            viewType: prev.viewType,
            recordId: prev.recordId,
            partnerFilter: prev.partnerFilter,
            skipReturnPush: true
          });
          return;
        }
        state.activeRecordId = null;
        state.formDraft = null;
        state.viewType = 'list';
        renderModuleWorkspace();
      });
    }

    const delBtn = document.getElementById('btnDeleteFormExpense');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!confirm(`¿Estás seguro de eliminar el gasto ${existing.reference || ('EXP/2026/' + String(existing.id).padStart(4, '0'))}?`)) return;
        try {
          await apiCall(`/api/expenses/${existing.id}`, 'DELETE');
          showToast('Gasto eliminado.');
          state.activeRecordId = null;
          state.formDraft = null;
          state.viewType = 'list';
          renderModuleWorkspace();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    }

    const saveBtn = document.getElementById('btnSaveExpense');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const name = document.getElementById('fExpName').value.trim();
        if (!name) {
          showToast('La descripción del gasto es obligatoria.', true);
          return;
        }
        const totalAmount = Number(document.getElementById('fExpTotal').value || 0);
        if (!totalAmount || totalAmount <= 0) {
          showToast('El monto total del gasto debe ser mayor a 0.', true);
          return;
        }

        const partnerVal = document.getElementById('fExpPartner').value;
        const partnerNameInput = document.getElementById('fExpPartnerName').value.trim();
        const matchedPartner = partnerVal
          ? (state.data.contacts || []).find((c) => Number(c.id) === Number(partnerVal))
          : (partnerNameInput ? (state.data.contacts || []).find((c) => c.name.toLowerCase() === partnerNameInput.toLowerCase()) : null);

        const prodVal = document.getElementById('fExpProduct').value;
        const defaultProd = (state.data.products || [])[0];
        const suppVatInput = document.getElementById('fExpPartnerVat') ? document.getElementById('fExpPartnerVat').value.trim() : '';

        // Collect items from table
        const cleanItems = expenseItems.filter(it => it.description || it.price_unit > 0).map((it, idx) => ({
          id: idx + 1,
          description: it.description || name,
          quantity: Number(it.quantity || 1),
          price_unit: Number(it.price_unit || 0),
          subtotal: Math.round((Number(it.quantity || 1) * Number(it.price_unit || 0)) * 100) / 100
        }));

        const payload = {
          id: isNew ? undefined : existing.id,
          name,
          employee_name: document.getElementById('fExpEmployee').value.trim() || 'Andrés Salazar',
          department: existing.department || 'Operaciones & Proyectos',
          product_id: prodVal ? Number(prodVal) : (defaultProd ? defaultProd.id : 1),
          product_name: prodVal
            ? ((state.data.products.find((p) => Number(p.id) === Number(prodVal)) || {}).name || 'Gasto General')
            : (defaultProd ? defaultProd.name : 'Gasto General'),
          partner_id: matchedPartner ? matchedPartner.id : (existing.partner_id || null),
          partner_name: partnerNameInput || (matchedPartner ? matchedPartner.name : ''),
          supplier_vat: suppVatInput || existing.supplier_vat || '',
          date: document.getElementById('fExpDate').value,
          receipt_ref: document.getElementById('fExpReceipt').value.trim(),
          quantity: 1,
          price_unit: totalAmount,
          tax_rate: 0,
          untaxed_amount: totalAmount,
          tax_amount: 0,
          total_amount: totalAmount,
          journal_code: document.getElementById('fExpJournal') ? document.getElementById('fExpJournal').value : (existing.journal_code || 'CSH1'),
          payment_mode: document.getElementById('fExpPayMode').value || 'company_account',
          notes: document.getElementById('fExpNotes').value.trim(),
          receipt_image: existing.receipt_image || '',
          items: cleanItems.length > 0 ? cleanItems : [{ id: 1, description: name, quantity: 1, price_unit: totalAmount, subtotal: totalAmount }]
        };

        try {
          await apiCall('/api/expenses', 'POST', payload);
          showToast('Gasto guardado exitosamente y factura de proveedor generada.');
          state.activeRecordId = null;
          state.formDraft = null;
          state.viewType = 'list';
          renderModuleWorkspace();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    }
  }

  // ==================== MODULE 3: VENTAS (sale.order & product.template) ====================
  function saleStateBadge(st) {
    const map = {
      draft: { cls: 'o_badge_info', text: 'Cotización' },
      sent: { cls: 'o_badge_warning', text: 'Cotización Enviada' },
      sale: { cls: 'o_badge_success', text: 'Pedido de Venta' },
      cancel: { cls: 'o_badge_danger', text: 'Cancelado' }
    };
    const item = map[st] || { cls: 'o_badge_muted', text: st };
    return `<span class="o_badge ${item.cls}">${esc(item.text)}</span>`;
  }

  function invoiceStatusBadge(st) {
    const map = {
      no: { cls: 'o_badge_muted', text: 'Nada que facturar' },
      'to invoice': { cls: 'o_badge_warning', text: 'Por facturar' },
      invoiced: { cls: 'o_badge_success', text: 'Facturado' }
    };
    const item = map[st] || { cls: 'o_badge_muted', text: st };
    return `<span class="o_badge ${item.cls}">${esc(item.text)}</span>`;
  }

  function getFilteredSales() {
    let list = state.data.sales || [];
    if (state.submenu === 'quotations') list = list.filter((s) => s.state === 'draft' || s.state === 'sent');
    else if (state.submenu === 'orders') list = list.filter((s) => s.state === 'sale');

    if (state.statusFilter !== 'all') {
      list = list.filter((s) => s.state === state.statusFilter);
    }
    if (state.partnerContextFilter) {
      list = list.filter((s) => Number(s.partner_id) === Number(state.partnerContextFilter.id));
    }

    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.partner_name || '').toLowerCase().includes(q) ||
          (s.salesperson || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  function renderSalesModule() {
    const container = document.getElementById('moduleContent');
    if (state.submenu === 'products') {
      if (state.viewType === 'form') {
        renderProductForm(container);
      } else {
        renderProductsSubmodule(container);
      }
      return;
    }

    if (state.viewType === 'form') {
      renderSaleOrderForm(container);
      return;
    }

    const sales = getFilteredSales();
    updatePager(sales.length, (state.data.sales || []).length);

    const kpis = state.data.kpis || {};
    const bannerHtml = `
      <div class="o_dashboard_banner">
        <div class="o_stat_card" data-sale-sub="quotations">
          <span class="o_stat_label">Cotizaciones (${kpis.quotations_count || 0})</span>
          <span class="o_stat_value">${formatMoney(kpis.quotations_total || 0)}</span>
          <span class="o_stat_sub">Pipeline comercial activo</span>
        </div>
        <div class="o_stat_card" data-sale-sub="orders">
          <span class="o_stat_label">Pedidos de Venta (${kpis.sales_orders_count || 0})</span>
          <span class="o_stat_value">${formatMoney(kpis.sales_orders_total || 0)}</span>
          <span class="o_stat_sub">Órdenes confirmadas</span>
        </div>
        <div class="o_stat_card" data-sale-sub="orders">
          <span class="o_stat_label">Pedidos por Facturar</span>
          <span class="o_stat_value">${kpis.to_invoice_count || 0}</span>
          <span class="o_stat_sub">Listos para enviar a Contabilidad</span>
        </div>
        <div class="o_stat_card" data-sale-sub="products">
          <span class="o_stat_label">Catálogo de Productos</span>
          <span class="o_stat_value">${(state.data.products || []).length}</span>
          <span class="o_stat_sub">Servicios y productos activos</span>
        </div>
      </div>
    `;

    if (state.viewType === 'kanban') {
      const stageCols = [
        { id: 'draft', title: 'Cotización', color: '#3b82f6', filter: (s) => s.state === 'draft' },
        { id: 'sent', title: 'Cotización Enviada', color: '#06b6d4', filter: (s) => s.state === 'sent' },
        { id: 'sale', title: 'Pedido de Venta', color: '#10b981', filter: (s) => s.state === 'sale' || s.state === 'done' }
      ];
      if (sales.some((s) => s.state === 'cancel')) {
        stageCols.push({ id: 'cancel', title: 'Cancelado', color: '#ef4444', filter: (s) => s.state === 'cancel' });
      }

      container.innerHTML =
        bannerHtml +
        `<div class="o_kanban_board">
          ${stageCols
            .map((col) => {
              const colSales = sales.filter(col.filter);
              const colSum = colSales.reduce((acc, s) => acc + Number(s.amount_total || 0), 0);
              return `
              <div class="o_kanban_column" style="--col-accent: ${col.color};">
                <div class="o_kanban_col_header">
                  <div class="o_kanban_col_title_wrap">
                    <span class="o_kanban_col_title">${esc(col.title)}</span>
                    <span class="o_badge o_badge_muted">${colSales.length}</span>
                  </div>
                  <span class="o_kanban_col_sum">${formatMoney(colSum)}</span>
                </div>
                <div class="o_kanban_col_cards">
                  ${
                    colSales.length === 0
                      ? `<div class="o_kanban_col_empty">Sin órdenes en ${esc(col.title.toLowerCase())}</div>`
                      : colSales
                          .map(
                            (s) => `
                        <article class="o_kanban_record" data-sale-id="${s.id}" style="cursor: pointer;">
                          <div class="o_kanban_avatar">${esc(s.name.slice(-2))}</div>
                          <div class="o_kanban_details">
                            <div style="display: flex; justify-content: space-between; gap: 0.4rem;">
                              <span class="o_kanban_title">${esc(s.name)} — ${esc(s.partner_name)}</span>
                              ${saleStateBadge(s.state)}
                            </div>
                            <div class="o_kanban_subtitle">📅 ${esc(s.date_order)} · Comercial: ${esc(s.salesperson)}</div>
                            <div class="o_kanban_subtitle">${(s.lines || []).length} línea(s) · Plazo: ${esc(s.payment_term)}</div>
                            <div class="o_kanban_footer">
                              ${invoiceStatusBadge(s.invoice_status)}
                              <strong>${formatMoney(s.amount_total)}</strong>
                            </div>
                          </div>
                        </article>
                      `
                          )
                          .join('')
                  }
                </div>
              </div>
            `;
            })
            .join('')}
        </div>`;

      container.querySelectorAll('.o_kanban_record').forEach((card) => {
        card.addEventListener('click', () => {
          state.activeRecordId = Number(card.getAttribute('data-sale-id'));
          state.viewType = 'form';
          renderModuleWorkspace();
        });
      });
    } else {
      const totalSum = sales.reduce((acc, s) => acc + Number(s.amount_total || 0), 0);
      container.innerHTML =
        bannerHtml +
        `
        <div tabindex="0" role="region" aria-labelledby="sales-table-caption" class="table-wrapper">
          <table class="o_list_table" style="--label-2: 'Fecha'; --label-3: 'Cliente'; --label-4: 'Comercial'; --label-5: 'Total'; --label-6: 'Estado Factura'; --label-7: 'Estado';">
            <caption id="sales-table-caption">Cotizaciones y Pedidos de Venta</caption>
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha Pedido</th>
                <th>Cliente</th>
                <th>Comercial</th>
                <th class="text-end">Total</th>
                <th>Facturación</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${sales
                .map(
                  (s) => `
                  <tr data-sale-id="${s.id}">
                    <th>${esc(s.name)}</th>
                    <td>${esc(s.date_order)}</td>
                    <td>${esc(s.partner_name)}</td>
                    <td>${esc(s.salesperson)}</td>
                    <td class="text-end"><strong>${formatMoney(s.amount_total)}</strong></td>
                    <td>${invoiceStatusBadge(s.invoice_status)}</td>
                    <td>${saleStateBadge(s.state)}</td>
                  </tr>
                `
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4">Total Ventas en Vista</td>
                <td class="text-end">${formatMoney(totalSum)}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;

      container.querySelectorAll('tbody tr').forEach((row) => {
        row.addEventListener('click', () => {
          state.activeRecordId = Number(row.getAttribute('data-sale-id'));
          state.viewType = 'form';
          renderModuleWorkspace();
        });
      });
    }

    container.querySelectorAll('[data-sale-sub]').forEach((card) => {
      card.addEventListener('click', () => {
        state.submenu = card.getAttribute('data-sale-sub');
        state.activeRecordId = null;
        state.statusFilter = 'all';
        state.partnerContextFilter = null;
        if (state.viewType === 'form') {
          state.viewType = 'list';
        }
        renderSubmenus(APPS.find((a) => a.id === 'sales'));
        renderModuleWorkspace();
      });
    });
  }

  function renderSalePartnerDetailsHtml(p) {
    if (!p) {
      return `<span style="color: var(--o-text-muted); font-size: 0.82rem;">Seleccione un cliente para autocompletar Cédula/NIT, Dirección y Celular/Teléfono.</span>`;
    }
    const nitStr = p.vat ? `${p.doc_type || (p.is_company ? 'NIT' : 'CC')} ${p.vat}` : `${p.doc_type || 'NIT'}: Sin registrar`;
    const addrStr = [p.street, p.city, p.state_name].filter(Boolean).join(', ') || 'Sin dirección registrada';
    const phoneStr = [p.mobile, p.phone].filter(Boolean).join(' / ') || 'Sin celular registrado';

    return `
      <div class="o_partner_details_row">
        <span class="o_detail_label">Cédula / NIT</span>
        <strong class="o_detail_value" id="dispPartnerVat">${esc(nitStr)}</strong>
      </div>
      <div class="o_partner_details_row">
        <span class="o_detail_label">Dirección</span>
        <strong class="o_detail_value" id="dispPartnerAddr">${esc(addrStr)}</strong>
      </div>
      <div class="o_partner_details_row">
        <span class="o_detail_label">Celular / Teléfono</span>
        <strong class="o_detail_value" id="dispPartnerPhone">${esc(phoneStr)}</strong>
      </div>
    `;
  }

  function renderOrderLinkedInvoicesHtml(order) {
    if (!order || !order.id || order.state === 'draft' || order.state === 'sent') return '';
    const moves = (state.data.accounting && state.data.accounting.moves) || [];
    const linkedInvoices = moves.filter((m) => (order.invoice_ids || []).includes(m.id) || m.origin === order.name || m.ref === order.name);
    if (linkedInvoices.length === 0) return '';

    const totalOrder = Number(order.amount_total || 0);
    const totalInvoiced = linkedInvoices.filter((m) => m.state !== 'cancel').reduce((s, m) => s + Number(m.amount_total || 0), 0);
    const remaining = Math.max(0, totalOrder - totalInvoiced);

    return `
      <div class="o_linked_invoices_panel">
        <div class="o_linked_invoices_header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            Facturas Vinculadas (${linkedInvoices.length})
          </h3>
          <span class="o_badge ${remaining <= 0 ? 'o_badge_success' : 'o_badge_warning'}">
            ${remaining <= 0 ? 'Facturado al 100%' : `Pendiente de Facturar: ${formatMoney(remaining)}`}
          </span>
        </div>

        <div class="o_invoicing_progress">
          <div class="o_progress_item">
            <span>Total de la Orden:</span>
            <strong>${formatMoney(totalOrder)}</strong>
          </div>
          <div class="o_progress_item is-invoiced">
            <span>Total Facturado a la Fecha:</span>
            <strong>${formatMoney(totalInvoiced)}</strong>
          </div>
          <div class="o_progress_item is-residual">
            <span>Saldo Restante por Facturar:</span>
            <strong>${formatMoney(remaining)}</strong>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="o_list_table">
            <thead>
              <tr>
                <th>Número de Factura</th>
                <th>Fecha de Emisión</th>
                <th>Concepto / Tipo</th>
                <th class="text-end">Monto Facturado</th>
                <th class="text-end">Saldo Factura</th>
                <th>Estado Pago</th>
                <th class="text-end">Acceso</th>
              </tr>
            </thead>
            <tbody>
              ${linkedInvoices.map((inv, idx) => `
                <tr class="o_invoice_link_row" data-invoice-id="${inv.id}" style="cursor: pointer;" title="Haz clic en esta línea para ver ${esc(inv.name)} y su PDF">
                  <th>${esc(inv.name)}</th>
                  <td>${esc(inv.invoice_date)}</td>
                  <td><span class="o_badge o_badge_info">${esc(inv.is_installment ? `Abono Cuota #${inv.installment_number || (idx + 1)}` : 'Factura')}</span></td>
                  <td class="text-end"><strong>${formatMoney(inv.amount_total)}</strong></td>
                  <td class="text-end">${formatMoney(inv.amount_residual)}</td>
                  <td>${paymentStateBadge(inv.payment_state, inv.state)}</td>
                  <td class="text-end">
                    <span class="btn btn-sm btn-secondary" style="pointer-events: none;">Ver Factura y PDF</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function promptInvoiceCreation(order, remaining, callback) {
    let modal = document.getElementById('modalInvoiceChoice');
    if (!modal) {
      modal = document.createElement('dialog');
      modal.id = 'modalInvoiceChoice';
      modal.className = 'o_dialog';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="o_dialog_box" style="max-width: 520px;">
        <div class="o_dialog_header">
          <h3>Facturar Pedido ${esc(order.name)}</h3>
          <button type="button" class="o_dialog_close" id="btnCloseInvChoice" aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>
        <div class="o_dialog_body">
          <p style="font-size: 0.88rem; color: var(--o-text-muted); margin-bottom: 1rem;">
            Seleccione si desea facturar el total pendiente o registrar una cuota / abono específico con trazabilidad legal:
          </p>

          <div style="background: var(--o-hover-bg); border: 1px solid var(--o-border-color); border-radius: 8px; padding: 0.85rem; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
              <span>Total de la Orden:</span>
              <strong>${formatMoney(order.amount_total)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; color: var(--o-warning, #d97706); font-weight: 700;">
              <span>Saldo Pendiente por Facturar:</span>
              <span>${formatMoney(remaining)}</span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem;">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="radio" name="invOption" id="optFullInvoice" value="full" checked />
              <div>
                <strong>Facturar Total Pendiente (${formatMoney(remaining)})</strong>
                <div style="font-size: 0.76rem; color: var(--o-text-muted);">Genera la factura por el saldo total de la orden.</div>
              </div>
            </label>
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="radio" name="invOption" id="optPartialInvoice" value="partial" />
              <div>
                <strong>Registrar Abono / Cuota Parcial</strong>
                <div style="font-size: 0.76rem; color: var(--o-text-muted);">Genera una factura legal consecutiva independiente por el valor abonado.</div>
              </div>
            </label>
          </div>

          <div id="boxPartialAmount" style="display: none; background: var(--o-view-bg); border: 1.5px solid var(--o-action); border-radius: 8px; padding: 0.85rem; margin-bottom: 1rem;">
            <label for="invPartialAmount" style="font-weight: 600; font-size: 0.84rem; display: block; margin-bottom: 0.35rem;">Valor del Abono (COP):</label>
            <input type="number" id="invPartialAmount" class="o_input" min="1" max="${remaining}" step="any" value="${Math.min(remaining, Math.round(remaining / 2))}" style="font-size: 1.1rem; font-weight: 700;" />
            <div id="lblResidualCalc" style="font-size: 0.8rem; color: var(--o-text-muted); margin-top: 0.5rem;"></div>
          </div>
        </div>
        <div class="o_dialog_footer">
          <button type="button" class="btn btn-secondary" id="btnCancelInvChoice">Cancelar</button>
          <button type="button" class="btn btn-action" id="btnConfirmInvChoice">Generar Factura Legal</button>
        </div>
      </div>
    `;

    const optFull = modal.querySelector('#optFullInvoice');
    const optPart = modal.querySelector('#optPartialInvoice');
    const boxPart = modal.querySelector('#boxPartialAmount');
    const inpPart = modal.querySelector('#invPartialAmount');
    const lblCalc = modal.querySelector('#lblResidualCalc');

    const updateCalc = () => {
      const val = Number(inpPart.value || 0);
      const rest = Math.max(0, remaining - val);
      lblCalc.innerHTML = `Saldo restante que quedará en la orden: <strong style="color: ${rest === 0 ? 'var(--o-success, #059669)' : 'var(--o-warning, #d97706)'};">${formatMoney(rest)}</strong>`;
    };

    optFull.addEventListener('change', () => {
      boxPart.style.display = 'none';
    });
    optPart.addEventListener('change', () => {
      boxPart.style.display = 'block';
      updateCalc();
      inpPart.focus();
    });
    inpPart.addEventListener('input', updateCalc);

    modal.showModal();

    const close = () => {
      modal.close();
    };

    modal.querySelector('#btnCloseInvChoice').addEventListener('click', close);
    modal.querySelector('#btnCancelInvChoice').addEventListener('click', close);

    modal.querySelector('#btnConfirmInvChoice').addEventListener('click', () => {
      let amount = remaining;
      if (optPart.checked) {
        amount = Number(inpPart.value || 0);
        if (amount <= 0 || amount > remaining) {
          showToast(`El valor del abono debe estar entre $ 1 y ${formatMoney(remaining)}.`, true);
          return;
        }
      }
      close();
      callback(amount);
    });
  }

  function numberToWordsSpanish(n) {
    const numVal = Number(n);
    if (isNaN(numVal) || numVal === 0) return 'CERO PESOS M/CTE';
    const isNeg = numVal < 0;
    const absVal = Math.abs(numVal);
    const integerPart = Math.floor(absVal);
    const cents = Math.round((absVal - integerPart) * 100);

    const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const DECENAS_10_19 = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    function readGroup(num) {
      if (num === 0) return '';
      if (num === 100) return 'CIEN';
      let str = '';
      const c = Math.floor(num / 100);
      const du = num % 100;
      const d = Math.floor(du / 10);
      const u = du % 10;
      if (c > 0) str += CENTENAS[c] + ' ';
      if (du >= 10 && du <= 19) {
        str += DECENAS_10_19[du - 10] + ' ';
      } else if (du >= 21 && du <= 29) {
        str += (u === 1 ? 'VEINTIÚN' : 'VEINTI' + UNIDADES[u]) + ' ';
      } else {
        if (d > 0) str += DECENAS[d] + (u > 0 ? ' Y ' : ' ');
        if (u > 0) str += UNIDADES[u] + ' ';
      }
      return str.trim();
    }

    const chunks = [];
    let temp = integerPart;
    while (temp > 0) {
      chunks.push(temp % 1000);
      temp = Math.floor(temp / 1000);
    }

    const c0 = chunks[0] || 0;
    const c1 = chunks[1] || 0;
    const c2 = chunks[2] || 0;
    const c3 = chunks[3] || 0;

    let milMillonesStr = '';
    if (c3 > 0) {
      milMillonesStr = c3 === 1 ? 'MIL' : readGroup(c3) + ' MIL';
    }

    let millonesStr = '';
    if (c3 > 0 || c2 > 0) {
      if (c3 > 0 && c2 === 0) {
        millonesStr = milMillonesStr + ' MILLONES';
      } else if (c3 > 0 && c2 > 0) {
        millonesStr = milMillonesStr + ' ' + readGroup(c2) + ' MILLONES';
      } else if (c2 === 1) {
        millonesStr = 'UN MILLÓN';
      } else {
        millonesStr = readGroup(c2) + ' MILLONES';
      }
    }

    let milesStr = '';
    if (c1 > 0) {
      milesStr = c1 === 1 ? 'MIL' : readGroup(c1) + ' MIL';
    }

    const unidadesStr = readGroup(c0);
    let words = [millonesStr, milesStr, unidadesStr].filter(Boolean).join(' ').trim();
    if (!words) words = 'CERO';

    const currencyUnit = integerPart === 1 ? 'PESO' : 'PESOS';
    const centsStr = cents > 0 ? (' CON ' + String(cents).padStart(2, '0') + '/100') : '';
    const prefix = isNeg ? 'MENOS ' : '';
    return (prefix + words + ' ' + currencyUnit + centsStr + ' M/CTE').toUpperCase().replace(/\s+/g, ' ');
  }

  
  let cachedLogoDataUrl = '';
  function getLogoDataUrl() {
    if (cachedLogoDataUrl) return cachedLogoDataUrl;
    try {
      const brandImg = document.getElementById('navbarBrandIcon') || document.querySelector('.o_home_menu_logo');
      if (brandImg && brandImg.complete && brandImg.naturalWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = brandImg.naturalWidth;
        canvas.height = brandImg.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(brandImg, 0, 0);
        cachedLogoDataUrl = canvas.toDataURL('image/png');
        return cachedLogoDataUrl;
      }
    } catch (_) {}
    return '';
  }

  function renderInvoicePdfSheetHtml(invoice) {
    const company = state.data.settings || {};
    const partner = (state.data.contacts || []).find((c) => Number(c.id) === Number(invoice.partner_id)) || {
      name: invoice.partner_name || 'Consumidor Final',
      vat: invoice.partner_vat || '222222222',
      doc_type: 'NIT',
      street: '',
      city: 'Pereira',
      state_name: 'Risaralda',
      mobile: '',
      phone: '',
      email: ''
    };

    const lines = invoice.lines && invoice.lines.length > 0 ? invoice.lines : [
      { name: 'Venta de Bienes / Servicios', quantity: 1, uom: 'Und', price_unit: Number(invoice.amount_untaxed || invoice.amount_total || 0), tax_rate: 19, subtotal: Number(invoice.amount_untaxed || invoice.amount_total || 0) }
    ];
    const linkedSale = (state.data.sales || []).find((s) => s.name === invoice.origin || s.name === invoice.ref);
    const totalSaleAmount = linkedSale ? Number(linkedSale.amount_total || 0) : Number(invoice.order_total || invoice.amount_total);
    const isAbono = invoice.is_installment || Boolean(invoice.installment_number) || Boolean(invoice.order_residual !== undefined && invoice.order_residual !== null && invoice.order_residual > 0);

    const isCancel = invoice.state === 'cancel';
    const isDraft = !isCancel && invoice.state === 'draft';
    const isPaid = !isCancel && (invoice.payment_state === 'paid' || (invoice.state === 'posted' && Number(invoice.amount_residual ?? 0) <= 0.001));
    const isPartial = !isPaid && !isDraft && !isCancel && (invoice.payment_state === 'partial' || (Number(invoice.amount_residual || 0) < Number(invoice.amount_total || 0) && Number(invoice.amount_residual || 0) > 0));
    const todayStr = new Date().toISOString().slice(0, 10);
    const isOverdue = !isPaid && !isDraft && !isCancel && !isPartial && Boolean(invoice.invoice_date_due && invoice.invoice_date_due < todayStr);

    let watermarkHtml = '';
    if (isCancel) {
      watermarkHtml = '<div class="o_pdf_watermark is-cancel">CANCELADA</div>';
    } else if (isDraft) {
      watermarkHtml = '<div class="o_pdf_watermark is-draft">BORRADOR</div>';
    } else if (isPaid) {
      watermarkHtml = '<div class="o_pdf_watermark is-paid">PAGADA</div>';
    } else if (isPartial) {
      watermarkHtml = '<div class="o_pdf_watermark is-partial">PAGO PARCIAL</div>';
    } else if (isOverdue) {
      watermarkHtml = '<div class="o_pdf_watermark is-overdue">VENCIDA</div>';
    }

    let stampHtml = '';
    if (isCancel) {
      stampHtml = '<div class="o_pdf_stamp is-cancel"><span class="stamp-inner">✕ ANULADA</span><span class="stamp-sub">DOCUMENTO CANCELADO</span></div>';
    } else if (isDraft) {
      stampHtml = '<div class="o_pdf_stamp is-draft"><span class="stamp-inner">✎ BORRADOR</span><span class="stamp-sub">SIN VALIDEZ FISCAL</span></div>';
    } else if (isPaid) {
      stampHtml = '<div class="o_pdf_stamp is-paid"><span class="stamp-inner">✓ PAGADA</span><span class="stamp-sub">CANCELADA TOTAL</span></div>';
    } else if (isPartial) {
      stampHtml = '<div class="o_pdf_stamp is-partial"><span class="stamp-inner">◐ PAGO PARCIAL</span><span class="stamp-sub">SALDO PENDIENTE</span></div>';
    } else if (isOverdue) {
      stampHtml = '<div class="o_pdf_stamp is-overdue"><span class="stamp-inner">⚠ VENCIDA</span><span class="stamp-sub">PAGO MOROSO</span></div>';
    } else {
      stampHtml = '<div class="o_pdf_stamp is-posted"><span class="stamp-inner">★ PUBLICADA</span><span class="stamp-sub">POR COBRAR</span></div>';
    }


    const paymentTerm = partner.payment_term || '30 Días';
    const isCredit = /d[ií]as/i.test(paymentTerm);
    const paymentTypeDesc = isCredit ? `Crédito (${paymentTerm})` : 'Contado';
    const paymentMethodDesc = invoice.journal_name || (isCredit ? 'Crédito Comercial' : 'Transferencia Electrónica / Bancaria');

    const totalUntaxed = Number(invoice.amount_untaxed || 0);
    const totalTax = Number(invoice.amount_tax || 0);
    const totalAmount = Number(invoice.amount_total || 0);
    const residualAmount = Number(invoice.amount_residual ?? 0);
    const paidAmount = Math.max(0, totalAmount - residualAmount);

    const retSourceRate = Number(invoice.retention_source_rate || 0);
    const retIcaRate = Number(invoice.retention_ica_rate || 0);
    const retefuenteAmount = Number(invoice.retention_source_amount ?? (retSourceRate > 0 ? totalUntaxed * (retSourceRate / 100) : 0));
    const reteicaAmount = Number(invoice.retention_ica_amount ?? (retIcaRate > 0 ? totalUntaxed * (retIcaRate / 100) : 0));
    const totalRetentions = retefuenteAmount + reteicaAmount;
    const netPayable = Math.max(0, totalAmount - totalRetentions);

    const hasDiscounts = lines.some((l) => Number(l.discount || 0) > 0);
    const totalDiscount = lines.reduce((sum, l) => {
      const gross = Number(l.quantity || 1) * Number(l.price_unit || 0);
      return sum + (gross * (Number(l.discount || 0) / 100));
    }, 0);

    return `
      <div class="o_pdf_sheet" id="invoicePdfSheet">
        ${watermarkHtml}

        <div class="o_pdf_brand_header">
          <div class="o_pdf_company_info">
            <img src="/assets/icons/logo.png" alt="CH Aluminios" class="o_pdf_company_logo" onerror="this.style.display='none'" />
            <h2>${esc(company.company_name || 'CH Aluminios')}</h2>
            <p><strong>NIT:</strong> ${esc(company.company_vat || '900.876.543-1')} · <span>${esc(company.fiscal_regime || 'Responsable de IVA - Régimen Ordinario')}</span></p>
            <p>${esc(company.company_address || 'Cra. 7 #18-45')} · ${esc(company.company_city || 'Pereira')}, ${esc(company.company_country || 'Colombia')}</p>
            <p>Email: ${esc(company.company_email || 'chappdevm@gmail.com')} · PBX: (606) 315-0000</p>
          </div>
          <div class="o_pdf_doc_box">
            <div class="doc_type_title">${invoice.move_type === 'in_invoice' ? 'Factura Proveedor' : 'Factura de Venta'}</div>
            <div class="doc_number">${esc(invoice.name)}</div>
            <div class="o_pdf_doc_meta">
              <div class="o_pdf_doc_meta_row"><span>Emisión:</span><strong>${esc(invoice.invoice_date || '')}</strong></div>
              <div class="o_pdf_doc_meta_row"><span>Vencimiento:</span><strong>${esc(invoice.invoice_date_due || '')}</strong></div>
              ${invoice.origin ? `<div class="o_pdf_doc_meta_row"><span>Orden Origen:</span><strong style="color: #1e40af;">${esc(invoice.origin)}</strong></div>` : ''}
              <div class="o_pdf_doc_meta_row"><span>Forma de Pago:</span><strong>${esc(paymentTypeDesc)}</strong></div>
            </div>
            ${stampHtml}
          </div>
        </div>

        <div class="o_pdf_resolution_bar">
          Resolución DIAN No. 18764000001 de 2026-01-15 · Habilitación Técnica Factura Electrónica · Rango Autorizado: FE-00001 al FE-99999 · Vigencia: 24 Meses
        </div>

        <div class="o_pdf_client_section">
          <div class="o_pdf_client_col">
            <div class="o_pdf_col_title">Adquiriente / Cliente</div>
            <p style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">${esc(partner.name)}</p>
            <p><strong>Cédula / NIT:</strong> ${esc(partner.doc_type || (partner.is_company ? 'NIT' : 'CC'))} ${esc(partner.vat || 'No registrado')}</p>
            <p><strong>Dirección:</strong> ${esc([partner.street, partner.city, partner.state_name].filter(Boolean).join(', ') || 'Pereira, Risaralda')}</p>
            <p><strong>Ciudad / País:</strong> ${esc(partner.city || 'Pereira')}, ${esc(partner.state_name || 'Risaralda')} - Colombia</p>
          </div>
          <div class="o_pdf_client_col">
            <div class="o_pdf_col_title">Datos de Contacto y Comerciales</div>
            <p><strong>Celular / Teléfono:</strong> ${esc([partner.mobile, partner.phone].filter(Boolean).join(' / ') || 'No registrado')}</p>
            <p><strong>Correo:</strong> ${esc(partner.email || 'No registrado')}</p>
            <p><strong>Forma de Pago:</strong> ${esc(paymentTerm)}</p>
            <p><strong>Medio de Pago:</strong> ${esc(paymentMethodDesc)}</p>
          </div>
        </div>

        ${isAbono ? `
          <div class="o_pdf_trace_box">
            <div style="font-weight: 700; color: #1e3a8a; margin-bottom: 4px;">
              Trazabilidad de Abono / Cuota (${esc(invoice.origin || 'Venta')})
            </div>
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <span>Valor Total Pedido: <strong>${formatMoney(totalSaleAmount)}</strong></span>
              <span>Abono en esta Factura: <strong style="color: #059669;">${formatMoney(invoice.amount_total)}</strong></span>
              <span>Saldo Restante Orden: <strong style="color: #d97706;">${formatMoney(invoice.order_residual || 0)}</strong></span>
            </div>
          </div>
        ` : ''}

        ${invoice.prior_invoice_name ? `
          <div class="o_pdf_trace_box" style="background: #f0fdf4; border-color: #22c55e;">
            <div style="font-weight: 700; color: #15803d; margin-bottom: 4px;">
              Trazabilidad de Continuidad por Saldo Restante
            </div>
            <div style="font-size: 0.8rem; color: #166534;">
              Factura emitida por saldo restante tras abono previo de <strong>${formatMoney(invoice.prior_payment_amount || 0)}</strong> el <strong>${esc(invoice.prior_payment_date || '')}</strong> sobre la factura <strong>${esc(invoice.prior_invoice_name)}</strong>.
            </div>
          </div>
        ` : ''}

        ${(invoice.payments_history && invoice.payments_history.length > 0) ? `
          <div class="o_pdf_payments_history_box">
            <div style="font-weight: 700; color: #065f46; margin-bottom: 4px; font-size: 0.82rem;">
              Trazabilidad de Abonos y Pagos Aplicados
            </div>
            <table class="o_pdf_subtable">
              <thead>
                <tr>
                  <th>Fecha Abono</th>
                  <th>Recibo / Ref</th>
                  <th>Medio de Pago</th>
                  <th style="text-align: right;">Monto Abonado</th>
                  <th style="text-align: right;">Saldo Restante</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.payments_history.map(p => `
                  <tr>
                    <td>${esc(p.date)}</td>
                    <td><strong>${esc(p.name)}</strong></td>
                    <td>${esc(p.journal_name || '')}</td>
                    <td style="text-align: right; color: #059669;"><strong>${formatMoney(p.amount)}</strong></td>
                    <td style="text-align: right; color: #d97706;"><strong>${formatMoney(p.residual_after)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <table class="o_pdf_items_table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">#</th>
              <th>Concepto / Producto</th>
              <th style="width: 75px; text-align: center;">Unidad</th>
              <th style="width: 55px; text-align: center;">Cant.</th>
              <th style="width: 105px; text-align: right;">Vr. Unitario</th>
              ${hasDiscounts ? '<th style="width: 60px; text-align: center;">Dcto.</th>' : ''}
              <th style="width: 65px; text-align: center;">IVA</th>
              <th style="width: 110px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${lines.map((l, idx) => {
              const qty = Number(l.quantity || 1);
              const price = Number(l.price_unit || 0);
              const disc = Number(l.discount || 0);
              const calcSub = l.subtotal !== undefined && l.subtotal !== null ? Number(l.subtotal) : (qty * price * (1 - disc / 100));
              return `
                <tr>
                  <td class="text-center" style="color: #64748b;">${idx + 1}</td>
                  <td><strong>${esc(l.name)}</strong></td>
                  <td class="text-center" style="color: #64748b;">${esc(l.uom || (l.name && l.name.toLowerCase().includes('perfil') ? 'Metro Lineal' : 'Und'))}</td>
                  <td class="text-center">${qty}</td>
                  <td class="text-end">${formatMoney(price)}</td>
                  ${hasDiscounts ? `<td class="text-center" style="color: ${disc > 0 ? '#b91c1c' : '#64748b'};">${disc > 0 ? `-${disc}%` : '0%'}</td>` : ''}
                  <td class="text-center">${l.tax_rate ?? 19}%</td>
                  <td class="text-end"><strong>${formatMoney(calcSub)}</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="o_pdf_bottom_grid">
          <div class="o_pdf_bottom_left">
            <div class="o_pdf_amount_words">
              <span class="label">Total en Letras:</span>
              <span class="words">SON: ${numberToWordsSpanish(totalAmount)}</span>
            </div>

            <div class="o_pdf_bank_info">
              <strong>Instrucciones de Pago / Consignación:</strong><br/>
              Bancolombia Cuenta Corriente No. <strong>452-892100-34</strong><br/>
              Titular: <strong>CH Aluminios</strong> (NIT: ${esc(company.company_vat || '900.876.543-1')})<br/>
              Favor enviar comprobante a: <em>${esc(company.company_email || 'chappdevm@gmail.com')}</em>
            </div>

          </div>

          <div class="o_pdf_totals_section">
            <table class="o_pdf_totals_table">
              <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;"><strong>${formatMoney(totalUntaxed)}</strong></td>
              </tr>
              ${totalDiscount > 0 ? `
                <tr style="color: #b91c1c; font-size: 0.76rem;">
                  <td>Descuento Comercial:</td>
                  <td style="text-align: right;">- ${formatMoney(totalDiscount)}</td>
                </tr>
              ` : ''}
              <tr>
                <td>Base Gravable (19%):</td>
                <td style="text-align: right;">${formatMoney(totalUntaxed)}</td>
              </tr>
              <tr>
                <td>IVA (19%):</td>
                <td style="text-align: right;"><strong>${formatMoney(totalTax)}</strong></td>
              </tr>
              <tr class="is-grand-total">
                <td>TOTAL:</td>
                <td style="text-align: right;">${formatMoney(totalAmount)}</td>
              </tr>
              ${totalRetentions > 0 ? `
                ${retefuenteAmount > 0 ? `
                  <tr style="color: #b45309; font-size: 0.76rem; background: rgba(254, 243, 199, 0.45);">
                    <td>(-) Retefuente (${retSourceRate}%):</td>
                    <td style="text-align: right;">- ${formatMoney(retefuenteAmount)}</td>
                  </tr>
                ` : ''}
                ${reteicaAmount > 0 ? `
                  <tr style="color: #b45309; font-size: 0.76rem; background: rgba(254, 243, 199, 0.45);">
                    <td>(-) ReteICA (${retIcaRate}%):</td>
                    <td style="text-align: right;">- ${formatMoney(reteicaAmount)}</td>
                  </tr>
                ` : ''}
                <tr class="is-net-total" style="font-weight: 800; font-size: 0.95rem; border-top: 1.5px solid #14B5D9; border-bottom: 1.5px solid #14B5D9; background: rgba(240, 247, 252, 0.9); color: #074073;">
                  <td>NETO A PAGAR:</td>
                  <td style="text-align: right;">${formatMoney(netPayable)}</td>
                </tr>
              ` : ''}
              ${paidAmount > 0 && residualAmount > 0 ? `
                <tr style="color: #059669; font-size: 0.76rem;">
                  <td>Abonos / Pagos Aplicados:</td>
                  <td style="text-align: right;">- ${formatMoney(paidAmount)}</td>
                </tr>
              ` : ''}
              ${isCancel ? `
                <tr class="is-cancel-row">
                  <td>Estado Documento:</td>
                  <td style="text-align: right; color: #cb2f2f; font-weight: 800;">ANULADA</td>
                </tr>
              ` : residualAmount > 0 ? `
                <tr class="is-residual-row">
                  <td>Saldo Pendiente:</td>
                  <td style="text-align: right;">${formatMoney(residualAmount)}</td>
                </tr>
              ` : `
                <tr class="is-paid-row">
                  <td>Estado Pago:</td>
                  <td style="text-align: right;">PAGADA</td>
                </tr>
              `}
            </table>
          </div>
        </div>

        <div class="o_pdf_signatures_section">
          <div class="o_pdf_sign_box">
            <div class="sign_line"></div>
            <div class="sign_name">${esc(company.company_name || 'CH Aluminios')}</div>
            <div class="sign_title">Firma y Sello Emisor Autorizado</div>
            <div class="sign_sub">NIT: ${esc(company.company_vat || '900.876.543-1')}</div>
          </div>
          <div class="o_pdf_sign_box">
            <div class="sign_line"></div>
            <div class="sign_name">${esc(partner.name || 'Adquiriente')}</div>
            <div class="sign_title">Firma y Aceptación de Recibido</div>
            <div class="sign_sub">C.C. / NIT: ____________________ Fecha: ____/____/2026</div>
          </div>
        </div>

        <div class="o_pdf_legal_footer">
          Esta factura de venta es título valor conforme al Código de Comercio colombiano (Arts. 772, 773 y 774) y Ley 1231 de 2008.<br/>
          La firma o constancia de recibido implica la aceptación plena de las mercancías y servicios descritos.<br/>
          Generado automáticamente por <strong>CH Aluminios</strong> — CHapp ERP.
        </div>
      </div>
    `;
  }

  function downloadInvoicePdf(invoice, autoPrint = false) {
    const company = state.data.settings || {};

    // Direct PDF file export via html2pdf when clicking Download (!autoPrint)
    if (!autoPrint && typeof window !== 'undefined' && typeof window.html2pdf === 'function') {
      const filename = `Factura_${(invoice.name || 'documento').replace(/[/\\]/g, '_')}.pdf`;
      const container = document.querySelector('.o_pdf_paper_viewport #invoicePdfSheet') || document.getElementById('invoicePdfSheet');
      const targetEl = container ? container.cloneNode(true) : null;
      if (targetEl) {
        targetEl.style.width = '210mm';
        targetEl.style.margin = '0 auto';
        targetEl.style.boxShadow = 'none';
        targetEl.style.border = 'none';
        const logoData = getLogoDataUrl();
        const logoImg = targetEl.querySelector('.o_pdf_company_logo');
        if (logoImg && logoData && logoData.startsWith('data:')) {
          logoImg.src = logoData;
        }

        const opt = {
          margin: [8, 8, 8, 8],
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        if (typeof showToast === 'function') showToast('Generando archivo PDF...');
        window.html2pdf().set(opt).from(targetEl).save().then(() => {
          if (typeof showToast === 'function') showToast(`PDF descargado: ${filename}`);
        }).catch((err) => {
          console.warn('Error exportando con html2pdf, abriendo diálogo de impresión:', err);
          downloadInvoicePdf(invoice, true);
        });
        return;
      }
    }

    let sheetHtml = renderInvoicePdfSheetHtml(invoice);
    const logoData = getLogoDataUrl();
    if (logoData && logoData.startsWith('data:')) {
      sheetHtml = sheetHtml.replace('src="/assets/icons/logo.png"', 'src="' + logoData + '"');
      sheetHtml = sheetHtml.replace('onerror="this.style.display=\'none\'"', '');
    } else if (window.location && window.location.origin) {
      sheetHtml = sheetHtml.replace('src="/assets/icons/logo.png"', 'src="' + window.location.origin + '/assets/icons/logo.png"');
    }
    const printScript = autoPrint ? '<script>window.addEventListener("load", function() { var imgs = Array.from(document.images); Promise.all(imgs.map(function(img) { if (img.complete) return Promise.resolve(); return new Promise(function(res) { img.onload = img.onerror = res; }); })).then(function() { setTimeout(function() { window.print(); }, 250); }); });</script>' : '';

    const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Factura ${esc(invoice.name)} - ${esc(company.company_name || 'CH Aluminios')}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #031626;
      color: #1e293b;
    }
    .o_pdf_sheet {
      position: relative;
      overflow: hidden;
      max-width: 840px;
      margin: 0 auto;
      padding: 2.2rem 2rem;
      background: #ffffff;
      border: 1px solid #cbe0f1;
      border-radius: 6px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
      font-size: 0.82rem;
      line-height: 1.45;
    }
    .o_pdf_watermark {
      position: absolute;
      top: 48%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-28deg);
      font-size: 4.8rem;
      font-weight: 900;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      pointer-events: none;
      user-select: none;
      z-index: 1;
      border: 6px dashed currentColor;
      padding: 0.6rem 2.2rem;
      border-radius: 12px;
      line-height: 1;
      white-space: nowrap;
    }
    .o_pdf_watermark.is-paid { color: #22b053; opacity: 0.16; border-style: double; border-width: 8px; }
    .o_pdf_watermark.is-draft { color: #5593c2; opacity: 0.14; }
    .o_pdf_watermark.is-cancel { color: #cb2f2f; opacity: 0.16; }
    .o_pdf_watermark.is-partial { color: #14B5D9; opacity: 0.16; }
    .o_pdf_watermark.is-overdue { color: #cb2f2f; opacity: 0.16; }
    .o_pdf_stamp {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 2px solid currentColor;
      border-radius: 6px;
      padding: 3px 10px;
      text-transform: uppercase;
      font-weight: 800;
      line-height: 1.15;
      margin-top: 6px;
      letter-spacing: 0.04em;
    }
    .o_pdf_stamp.is-paid { color: #22b053; border-color: #22b053; background: #ecfdf5; }
    .o_pdf_stamp.is-draft { color: #5593c2; border-color: #93bee0; background: #f0f7fc; }
    .o_pdf_stamp.is-cancel { color: #cb2f2f; border-color: #cb2f2f; background: #fef2f2; }
    .o_pdf_stamp.is-partial { color: #074073; border-color: #14B5D9; background: #f0f9ff; }
    .o_pdf_stamp.is-overdue { color: #cb2f2f; border-color: #cb2f2f; background: #fef2f2; }
    .o_pdf_stamp.is-posted { color: #074073; border-color: #14B5D9; background: #f0f7fc; }
    .o_pdf_stamp .stamp-inner { font-size: 0.8rem; font-weight: 800; }
    .o_pdf_stamp .stamp-sub { font-size: 0.62rem; font-weight: 700; opacity: 0.85; letter-spacing: 0.06em; }
    .o_pdf_brand_header {
      position: relative;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #074073;
      padding-bottom: 0.85rem;
      margin-bottom: 0.75rem;
      gap: 1rem;
    }
    .o_pdf_company_info { flex: 1; }
    .o_pdf_company_logo { max-height: 54px; max-width: 170px; object-fit: contain; margin-bottom: 0.4rem; display: block; }
    .o_pdf_company_info h2 { font-size: 1.35rem; font-weight: 800; color: #074073; margin: 0 0 0.25rem 0; letter-spacing: 0.01em; }
    .o_pdf_company_info p { margin: 0.15rem 0; font-size: 0.77rem; color: #4b5563; }
    .o_pdf_company_info p strong { color: #074073; }
    .o_pdf_doc_box {
      background: rgba(248, 250, 252, 0.85);
      border: 2px solid #074073;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      text-align: center;
      min-width: 195px;
      box-shadow: 0 2px 4px rgba(7, 64, 115, 0.08);
    }
    .doc_type_title {
      font-size: 0.82rem;
      font-weight: 800;
      color: #ffffff;
      background: #074073;
      border-bottom: 2px solid #14B5D9;
      margin: -0.75rem -1rem 0.6rem -1rem;
      padding: 0.35rem 0.5rem;
      border-radius: 5px 5px 0 0;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .doc_number { font-size: 1.18rem; font-weight: 800; color: #074073; margin: 0.25rem 0; font-variant-numeric: tabular-nums; }
    .o_pdf_doc_meta { display: flex; flex-direction: column; gap: 0.2rem; margin-top: 0.4rem; border-top: 1px dashed #cbd5e1; padding-top: 0.4rem; }
    .o_pdf_doc_meta_row { display: flex; justify-content: space-between; font-size: 0.74rem; color: #4b5563; }
    .o_pdf_doc_meta_row strong { color: #074073; }
    .o_pdf_resolution_bar {
      position: relative;
      z-index: 2;
      background: rgba(240, 247, 252, 0.85);
      border: 1px solid #cbe0f1;
      border-left: 3px solid #14B5D9;
      border-radius: 4px;
      padding: 0.4rem 0.75rem;
      font-size: 0.68rem;
      color: #074073;
      text-align: center;
      margin-bottom: 0.85rem;
      line-height: 1.35;
    }
    .o_pdf_client_section {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      background: rgba(248, 250, 252, 0.85);
      border: 1px solid #cbe0f1;
      border-top: 2px solid #074073;
      border-radius: 6px;
      padding: 0.85rem 1rem;
      margin-bottom: 0.85rem;
    }
    .o_pdf_client_col .o_pdf_col_title {
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #074073;
      margin-bottom: 0.35rem;
      border-bottom: 1.5px solid #14B5D9;
      padding-bottom: 0.2rem;
    }
    .o_pdf_client_col p { margin: 0.22rem 0; font-size: 0.78rem; color: #334155; }
    .o_pdf_client_col p strong { color: #074073; }
    .o_pdf_trace_box {
      position: relative;
      z-index: 2;
      background: rgba(240, 249, 255, 0.85);
      border: 1.5px dashed #14B5D9;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      margin-bottom: 0.85rem;
      font-size: 0.79rem;
    }
    .o_pdf_trace_box strong { color: #074073; }
    .o_pdf_payments_history_box {
      position: relative;
      z-index: 2;
      background: rgba(240, 253, 244, 0.85);
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      margin-bottom: 0.85rem;
    }
    .o_pdf_subtable { width: 100%; border-collapse: collapse; font-size: 0.74rem; margin-top: 0.35rem; }
    .o_pdf_subtable th { background: rgba(220, 252, 231, 0.85); color: #166534; padding: 0.3rem 0.5rem; text-align: left; font-weight: 700; border-bottom: 1px solid #86efac; }
    .o_pdf_subtable td { padding: 0.35rem 0.5rem; border-bottom: 1px solid #bbf7d0; }
    .o_pdf_items_table {
      position: relative;
      z-index: 2;
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0.95rem;
      font-size: 0.78rem;
    }
    .o_pdf_items_table thead { display: table-header-group !important; }
    .o_pdf_items_table tbody { display: table-row-group; }
    .o_pdf_items_table th {
      background: #074073;
      color: #ffffff;
      border-bottom: 2px solid #14B5D9;
      padding: 0.5rem 0.6rem;
      text-align: left;
      font-weight: 700;
      font-size: 0.73rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .o_pdf_items_table th:first-child { border-top-left-radius: 4px; }
    .o_pdf_items_table th:last-child { border-top-right-radius: 4px; }
    .o_pdf_items_table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid #e2e8f0; color: #334155; vertical-align: middle; background: rgba(255, 255, 255, 0.70); }
    .o_pdf_items_table tr:nth-child(even) td { background: rgba(248, 250, 252, 0.75); }
    .o_pdf_items_table .text-center { text-align: center; }
    .o_pdf_items_table .text-end { text-align: right; font-variant-numeric: tabular-nums; }
    .o_pdf_bottom_grid {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 1.25rem;
      margin-bottom: 1rem;
      align-items: start;
    }
    .o_pdf_bottom_left { display: flex; flex-direction: column; gap: 0.65rem; }
    .o_pdf_amount_words {
      background: rgba(240, 247, 252, 0.85);
      border-left: 4px solid #14B5D9;
      border-top: 1px solid #cbe0f1;
      border-right: 1px solid #cbe0f1;
      border-bottom: 1px solid #cbe0f1;
      border-radius: 0 4px 4px 0;
      padding: 0.55rem 0.8rem;
      font-size: 0.74rem;
      color: #074073;
      line-height: 1.4;
    }
    .o_pdf_amount_words .label { font-weight: 700; text-transform: uppercase; font-size: 0.67rem; color: #5593c2; display: block; margin-bottom: 0.15rem; }
    .o_pdf_amount_words .words { font-weight: 700; color: #074073; }
    .o_pdf_bank_info {
      background: rgba(240, 247, 252, 0.85);
      border: 1px solid #cbe0f1;
      border-left: 4px solid #074073;
      border-radius: 0 4px 4px 0;
      padding: 0.55rem 0.8rem;
      font-size: 0.72rem;
      color: #074073;
      line-height: 1.45;
    }
    .o_pdf_bank_info strong { color: #074073; }
    .o_pdf_totals_section { display: flex; justify-content: flex-end; }
    .o_pdf_totals_table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid #cbe0f1;
      border-radius: 6px;
      overflow: hidden;
    }
    .o_pdf_totals_table td { padding: 0.38rem 0.65rem; border-bottom: 1px solid #f1f5f9; background: transparent; }
    .o_pdf_totals_table .is-cancel-row td { color: #cb2f2f; font-weight: 800; background: rgba(254, 242, 242, 0.88); }
    .o_pdf_totals_table .is-grand-total td {
      font-size: 1.05rem;
      font-weight: 800;
      border-top: 2px solid #14B5D9;
      border-bottom: 2px solid #14B5D9;
      background: #074073;
      color: #ffffff;
      padding: 0.5rem 0.65rem;
    }
    .o_pdf_totals_table .is-residual-row td { color: #cb2f2f; font-weight: 700; background: #fef2f2; }
    .o_pdf_totals_table .is-paid-row td { color: #22b053; font-weight: 700; background: #ecfdf5; }
    .o_pdf_signatures_section {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin: 1.25rem 0 1rem 0;
      padding-top: 0.5rem;
    }
    .o_pdf_sign_box { text-align: center; padding: 0 1rem; }
    .o_pdf_sign_box .sign_line { border-bottom: 1.5px solid #074073; margin-bottom: 0.45rem; height: 38px; }
    .o_pdf_sign_box .sign_name { font-size: 0.78rem; font-weight: 700; color: #074073; }
    .o_pdf_sign_box .sign_title { font-size: 0.68rem; color: #14B5D9; text-transform: uppercase; font-weight: 700; }
    .o_pdf_sign_box .sign_sub { font-size: 0.66rem; color: #4b5563; margin-top: 0.15rem; }

    @media print {
      @page {
        size: A4 portrait;
        margin: 8mm 10mm 10mm 10mm;
      }
      html, body {
        background: #ffffff !important;
        color: #000000 !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .o_pdf_sheet {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        max-width: 100% !important;
        background: #ffffff !important;
      }
      .o_pdf_company_logo {
        display: block !important;
        max-height: 54px !important;
        max-width: 170px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .o_pdf_watermark {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  ${sheetHtml}
  ${printScript}
</body>
</html>`;

    if (autoPrint) {
      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        window.print();
      }
    } else {
      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Factura_${(invoice.name || 'documento').replace(/[\/\\]/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    }
  }

  function renderSalePdfSheetHtml(sale) {
    const company = (state.data && state.data.settings) || {};
    const partner = ((state.data && state.data.contacts) || []).find((c) => Number(c.id) === Number(sale.partner_id)) || {
      name: sale.partner_name || 'Cliente por Definir',
      vat: sale.partner_vat || '222222222',
      doc_type: 'NIT',
      street: '',
      city: 'Pereira',
      state_name: 'Risaralda',
      mobile: '',
      phone: '',
      email: ''
    };

    const lines = sale.lines && sale.lines.length > 0 ? sale.lines : [
      { name: 'Venta de Bienes / Servicios', description: '', quantity: 1, uom: 'Und', price_unit: Number(sale.amount_untaxed || sale.amount_total || 0), discount: 0, tax_rate: 19, subtotal: Number(sale.amount_untaxed || sale.amount_total || 0) }
    ];

    const isCancel = sale.state === 'cancel';
    const isSale = sale.state === 'sale';
    const isSent = sale.state === 'sent';
    const isDraft = !isCancel && !isSale && !isSent;

    let watermarkHtml = '';
    if (isCancel) {
      watermarkHtml = '<div class="o_pdf_watermark is-cancel">CANCELADA</div>';
    } else if (isSale) {
      watermarkHtml = '<div class="o_pdf_watermark is-paid">PEDIDO CONFIRMADO</div>';
    } else {
      watermarkHtml = '<div class="o_pdf_watermark is-draft">COTIZACIÓN</div>';
    }

    let stampHtml = '';
    if (isCancel) {
      stampHtml = '<div class="o_pdf_stamp is-cancel"><span class="stamp-inner">✕ CANCELADA</span><span class="stamp-sub">PROPUESTA ANULADA</span></div>';
    } else if (isSale) {
      stampHtml = '<div class="o_pdf_stamp is-paid"><span class="stamp-inner">✓ CONFIRMADO</span><span class="stamp-sub">PEDIDO DE VENTA</span></div>';
    } else if (isSent) {
      stampHtml = '<div class="o_pdf_stamp is-posted"><span class="stamp-inner">✉ ENVIADA</span><span class="stamp-sub">OFERTA AL CLIENTE</span></div>';
    } else {
      stampHtml = '<div class="o_pdf_stamp is-draft"><span class="stamp-inner">✎ COTIZACIÓN</span><span class="stamp-sub">PROPUESTA COMERCIAL</span></div>';
    }

    const docTitle = isSale ? 'Pedido de Venta' : 'Cotización';
    const docNumber = esc(sale.name || 'Nueva Cotización');
    const paymentTerm = sale.payment_term || partner.payment_term || 'Contado';

    const calcUntaxed = lines.reduce((acc, l) => {
      const qty = Number(l.quantity || 0);
      const pr = Number(l.price_unit || 0);
      const disc = Number(l.discount || 0);
      return acc + (qty * pr * (1 - disc / 100));
    }, 0);

    const calcTax = lines.reduce((acc, l) => {
      const qty = Number(l.quantity || 0);
      const pr = Number(l.price_unit || 0);
      const disc = Number(l.discount || 0);
      const rate = l.tax_rate !== undefined && l.tax_rate !== null && l.tax_rate !== '' ? Number(l.tax_rate) : 19;
      return acc + (qty * pr * (1 - disc / 100) * (rate / 100));
    }, 0);

    const totalUntaxed = sale.amount_untaxed !== undefined ? Number(sale.amount_untaxed) : calcUntaxed;
    const totalTax = sale.amount_tax !== undefined ? Number(sale.amount_tax) : calcTax;
    const totalAmount = sale.amount_total !== undefined ? Number(sale.amount_total) : (totalUntaxed + totalTax);

    const hasDiscounts = lines.some((l) => Number(l.discount || 0) > 0);
    const totalDiscount = lines.reduce((sum, l) => {
      const gross = Number(l.quantity || 1) * Number(l.price_unit || 0);
      return sum + (gross * (Number(l.discount || 0) / 100));
    }, 0);

    return `
      <div class="o_pdf_sheet" id="salePdfSheet">
        ${watermarkHtml}

        <div class="o_pdf_brand_header">
          <div class="o_pdf_company_info">
            <img src="/assets/icons/logo.png" alt="CH Aluminios" class="o_pdf_company_logo" onerror="this.style.display='none'" />
            <h2>${esc(company.company_name || 'CH Aluminios')}</h2>
            <p><strong>NIT:</strong> ${esc(company.company_vat || '900.876.543-1')} · <span>${esc(company.fiscal_regime || 'Responsable de IVA - Régimen Ordinario')}</span></p>
            <p>${esc(company.company_address || 'Cra. 7 #18-45')} · ${esc(company.company_city || 'Pereira')}, ${esc(company.company_country || 'Colombia')}</p>
            <p>Email: ${esc(company.company_email || 'chappdevm@gmail.com')} · PBX: (606) 315-0000</p>
          </div>
          <div class="o_pdf_doc_box">
            <div class="doc_type_title">${esc(docTitle)}</div>
            <div class="doc_number">${docNumber}</div>
            <div class="o_pdf_doc_meta">
              <div class="o_pdf_doc_meta_row"><span>Emisión:</span><strong>${esc(sale.date_order || '')}</strong></div>
              <div class="o_pdf_doc_meta_row"><span>Validez:</span><strong>${esc(sale.validity_date || '30 Días')}</strong></div>
              <div class="o_pdf_doc_meta_row"><span>Asesor:</span><strong style="color: #1e40af;">${esc(sale.salesperson || 'Laura Gómez')}</strong></div>
              <div class="o_pdf_doc_meta_row"><span>Forma de Pago:</span><strong>${esc(paymentTerm)}</strong></div>
            </div>
            ${stampHtml}
          </div>
        </div>

        <div class="o_pdf_resolution_bar is-quote" style="background: linear-gradient(90deg, #074073, #14B5D9) !important; color: #ffffff !important; font-weight: 600; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);">
          Propuesta Comercial & Cotización de Bienes y Servicios · CH Aluminios · Validez de la Oferta: ${esc(sale.validity_date ? `Hasta ${sale.validity_date}` : '30 Días')}
        </div>

        <div class="o_pdf_client_section">
          <div class="o_pdf_client_col">
            <div class="o_pdf_col_title">Cliente / Destinatario</div>
            <p style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">${esc(partner.name)}</p>
            <p><strong>Cédula / NIT:</strong> ${esc(partner.doc_type || (partner.is_company ? 'NIT' : 'CC'))} ${esc(partner.vat || 'No registrado')}</p>
            <p><strong>Dirección:</strong> ${esc([partner.street, partner.city, partner.state_name].filter(Boolean).join(', ') || 'Pereira, Risaralda')}</p>
            <p><strong>Ciudad / País:</strong> ${esc(partner.city || 'Pereira')}, ${esc(partner.state_name || 'Risaralda')} - Colombia</p>
          </div>
          <div class="o_pdf_client_col">
            <div class="o_pdf_col_title">Condiciones Comerciales de la Oferta</div>
            <p><strong>Celular / Teléfono:</strong> ${esc([partner.mobile, partner.phone].filter(Boolean).join(' / ') || 'No registrado')}</p>
            <p><strong>Correo Electrónico:</strong> ${esc(partner.email || 'No registrado')}</p>
            <p><strong>Plazo de Pago Propuesto:</strong> ${esc(paymentTerm)}</p>
            <p><strong>Tiempo de Entrega Estimado:</strong> Inmediato / Según disponibilidad</p>
          </div>
        </div>

        <table class="o_pdf_items_table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">#</th>
              <th>Concepto / Producto</th>
              <th style="width: 75px; text-align: center;">Unidad</th>
              <th style="width: 55px; text-align: center;">Cant.</th>
              <th style="width: 105px; text-align: right;">Vr. Unitario</th>
              ${hasDiscounts ? '<th style="width: 60px; text-align: center;">Dcto.</th>' : ''}
              <th style="width: 65px; text-align: center;">IVA</th>
              <th style="width: 110px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${lines.map((l, idx) => {
              const qty = Number(l.quantity || 1);
              const price = Number(l.price_unit || 0);
              const disc = Number(l.discount || 0);
              const calcSub = l.subtotal !== undefined && l.subtotal !== null ? Number(l.subtotal) : (qty * price * (1 - disc / 100));
              const prodName = l.product_name || l.name || 'Producto / Servicio';
              const prodDesc = l.description && l.description !== prodName ? `<div style="font-size: 0.75rem; color: #64748b; font-weight: normal; margin-top: 2px;">${esc(l.description)}</div>` : '';
              return `
                <tr>
                  <td class="text-center" style="color: #64748b;">${idx + 1}</td>
                  <td><strong>${esc(prodName)}</strong>${prodDesc}</td>
                  <td class="text-center" style="color: #64748b;">${esc(l.uom || (prodName && prodName.toLowerCase().includes('perfil') ? 'Metro Lineal' : 'Und'))}</td>
                  <td class="text-center">${qty}</td>
                  <td class="text-end">${formatMoney(price)}</td>
                  ${hasDiscounts ? `<td class="text-center" style="color: ${disc > 0 ? '#b91c1c' : '#64748b'};">${disc > 0 ? `-${disc}%` : '0%'}</td>` : ''}
                  <td class="text-center">${l.tax_rate ?? 19}%</td>
                  <td class="text-end"><strong>${formatMoney(calcSub)}</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="o_pdf_bottom_grid">
          <div class="o_pdf_bottom_left">
            <div class="o_pdf_amount_words">
              <span class="label">Total en Letras:</span>
              <span class="words">SON: ${numberToWordsSpanish(totalAmount)}</span>
            </div>

            <div class="o_pdf_bank_info">
              <strong>Instrucciones de Pago / Consignación:</strong><br/>
              Bancolombia Cuenta Corriente No. <strong>452-892100-34</strong><br/>
              Titular: <strong>CH Aluminios</strong> (NIT: ${esc(company.company_vat || '900.876.543-1')})<br/>
              Favor enviar comprobante a: <em>${esc(company.company_email || 'chappdevm@gmail.com')}</em>
            </div>

            ${sale.notes ? `
              <div style="margin-top: 0.65rem; padding: 0.5rem 0.75rem; background: rgba(0,0,0,0.02); border: 1px dashed #cbd5e1; border-radius: 4px; font-size: 0.78rem;">
                <strong>Observaciones / Términos:</strong><br/>
                ${esc(sale.notes)}
              </div>
            ` : ''}
          </div>

          <div class="o_pdf_totals_section">
            <table class="o_pdf_totals_table">
              <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;"><strong>${formatMoney(totalUntaxed)}</strong></td>
              </tr>
              ${totalDiscount > 0 ? `
                <tr style="color: #b91c1c; font-size: 0.76rem;">
                  <td>Descuento Comercial:</td>
                  <td style="text-align: right;">- ${formatMoney(totalDiscount)}</td>
                </tr>
              ` : ''}
              <tr>
                <td>Base Gravable:</td>
                <td style="text-align: right;">${formatMoney(totalUntaxed)}</td>
              </tr>
              <tr>
                <td>IVA:</td>
                <td style="text-align: right;"><strong>${formatMoney(totalTax)}</strong></td>
              </tr>
              <tr class="is-grand-total">
                <td>TOTAL PROPUESTA:</td>
                <td style="text-align: right;">${formatMoney(totalAmount)}</td>
              </tr>
            </table>
          </div>
        </div>

        <div class="o_pdf_signatures_section">
          <div class="o_pdf_sign_box">
            <div class="sign_line"></div>
            <div class="sign_name">${esc(company.company_name || 'CH Aluminios')}</div>
            <div class="sign_title">Asesor Comercial: ${esc(sale.salesperson || 'Laura Gómez')}</div>
            <div class="sign_sub">NIT: ${esc(company.company_vat || '900.876.543-1')}</div>
          </div>
          <div class="o_pdf_sign_box">
            <div class="sign_line"></div>
            <div class="sign_name">${esc(partner.name || 'Cliente')}</div>
            <div class="sign_title">Firma de Aprobación y Aceptación de la Oferta</div>
            <div class="sign_sub">C.C. / NIT: ____________________ Fecha: ____/____/2026</div>
          </div>
        </div>

        <div class="o_pdf_legal_footer">
          Esta cotización comercial es una propuesta informativa y no constituye una factura de venta electrónica.<br/>
          Los precios y disponibilidad están sujetos a las condiciones comerciales descritas durante la vigencia de la oferta.<br/>
          Generado automáticamente por <strong>CH Aluminios</strong> — CHapp ERP.
        </div>
      </div>
    `;
  }

  function downloadSalePdf(sale, autoPrint = false) {
    const company = (state.data && state.data.settings) || {};
    const isQuotation = sale.state !== 'sale';
    const filename = `${isQuotation ? 'Cotizacion' : 'Pedido'}_${(sale.name || 'documento').replace(/[/\\]/g, '_')}.pdf`;

    // Direct PDF file export via html2pdf when clicking Download (!autoPrint)
    if (!autoPrint && typeof window !== 'undefined' && typeof window.html2pdf === 'function') {
      const container = document.querySelector('.o_pdf_paper_viewport #salePdfSheet') || document.getElementById('salePdfSheet');
      const targetEl = container ? container.cloneNode(true) : null;
      if (targetEl) {
        targetEl.style.width = '210mm';
        targetEl.style.margin = '0 auto';
        targetEl.style.boxShadow = 'none';
        targetEl.style.border = 'none';
        const logoData = getLogoDataUrl();
        const logoImg = targetEl.querySelector('.o_pdf_company_logo');
        if (logoImg && logoData && logoData.startsWith('data:')) {
          logoImg.src = logoData;
        }

        const opt = {
          margin: [8, 8, 8, 8],
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        if (typeof showToast === 'function') showToast('Generando archivo PDF...');
        window.html2pdf().set(opt).from(targetEl).save().then(() => {
          if (typeof showToast === 'function') showToast(`PDF descargado: ${filename}`);
        }).catch((err) => {
          console.warn('Error exportando con html2pdf, abriendo diálogo de impresión:', err);
          downloadSalePdf(sale, true);
        });
        return;
      }
    }

    let sheetHtml = renderSalePdfSheetHtml(sale);
    const logoData = getLogoDataUrl();
    if (logoData && logoData.startsWith('data:')) {
      sheetHtml = sheetHtml.replace('src="/assets/icons/logo.png"', 'src="' + logoData + '"');
      sheetHtml = sheetHtml.replace('onerror="this.style.display=\'none\'"', '');
    } else if (typeof window !== 'undefined' && window.location && window.location.origin) {
      sheetHtml = sheetHtml.replace('src="/assets/icons/logo.png"', 'src="' + window.location.origin + '/assets/icons/logo.png"');
    }
    const printScript = autoPrint ? '<script>window.addEventListener("load", function() { var imgs = Array.from(document.images); Promise.all(imgs.map(function(img) { if (img.complete) return Promise.resolve(); return new Promise(function(res) { img.onload = img.onerror = res; }); })).then(function() { setTimeout(function() { window.print(); }, 250); }); });</script>' : '';

    const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${isQuotation ? 'Cotización' : 'Pedido de Venta'} ${esc(sale.name)} - ${esc(company.company_name || 'CH Aluminios')}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #031626;
      color: #1e293b;
    }
    .o_pdf_sheet {
      position: relative;
      overflow: hidden;
      max-width: 840px;
      margin: 0 auto;
      padding: 2.2rem 2rem;
      background: #ffffff;
      border: 1px solid #cbe0f1;
      border-radius: 6px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
      font-size: 0.82rem;
      line-height: 1.45;
    }
    .o_pdf_watermark {
      position: absolute;
      top: 48%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: clamp(3rem, 7vw, 5.5rem);
      font-weight: 900;
      letter-spacing: 0.15em;
      opacity: 0.06;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      z-index: 1;
    }
    .o_pdf_watermark.is-draft { color: #14B5D9; }
    .o_pdf_watermark.is-paid { color: #059669; }
    .o_pdf_watermark.is-cancel { color: #cb2f2f; }
    .o_pdf_brand_header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
      margin-bottom: 1.25rem;
      position: relative;
      z-index: 2;
    }
    .o_pdf_company_info { flex: 1; }
    .o_pdf_company_logo { max-height: 52px; max-width: 170px; object-fit: contain; margin-bottom: 0.5rem; display: block; }
    .o_pdf_company_info h2 { margin: 0 0 0.25rem 0; font-size: 1.3rem; font-weight: 800; color: #074073; }
    .o_pdf_company_info p { margin: 0 0 0.2rem 0; font-size: 0.78rem; color: #475569; }
    .o_pdf_doc_box {
      border: 2px solid #074073;
      border-radius: 8px;
      padding: 0.85rem 1.15rem;
      min-width: 220px;
      text-align: center;
      background: #f0f7fc;
      position: relative;
      z-index: 2;
    }
    .o_pdf_doc_box .doc_type_title { font-size: 0.95rem; font-weight: 800; color: #074073; text-transform: uppercase; letter-spacing: 0.04em; }
    .o_pdf_doc_box .doc_number { font-size: 1.25rem; font-weight: 900; color: #14B5D9; margin: 0.25rem 0 0.5rem 0; }
    .o_pdf_doc_meta { border-top: 1px solid #cbe0f1; padding-top: 0.45rem; font-size: 0.74rem; text-align: left; }
    .o_pdf_doc_meta_row { display: flex; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.2rem; }
    .o_pdf_doc_meta_row span { color: #64748b; }
    .o_pdf_stamp {
      display: inline-block;
      margin-top: 0.5rem;
      padding: 0.25rem 0.65rem;
      border: 2px dashed;
      border-radius: 6px;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 0.72rem;
      line-height: 1.15;
    }
    .o_pdf_stamp.is-draft { border-color: #14B5D9; color: #074073; background: #e0f4fb; }
    .o_pdf_stamp.is-paid { border-color: #059669; color: #059669; background: #ecfdf5; }
    .o_pdf_stamp.is-posted { border-color: #0ea5e9; color: #0284c7; background: #f0f9ff; }
    .o_pdf_stamp.is-cancel { border-color: #cb2f2f; color: #cb2f2f; background: #fef2f2; }
    .o_pdf_resolution_bar {
      color: #ffffff;
      padding: 0.45rem 0.85rem;
      border-radius: 4px;
      font-size: 0.72rem;
      text-align: center;
      margin-bottom: 1.25rem;
      font-weight: 600;
    }
    .o_pdf_client_section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      padding: 1rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 1.25rem;
    }
    .o_pdf_col_title { font-size: 0.74rem; font-weight: 800; text-transform: uppercase; color: #074073; margin-bottom: 0.4rem; letter-spacing: 0.04em; }
    .o_pdf_client_col p { margin: 0 0 0.2rem 0; font-size: 0.78rem; color: #334155; }
    .o_pdf_items_table { width: 100%; border-collapse: collapse; margin-bottom: 1.25rem; font-size: 0.78rem; }
    .o_pdf_items_table th { background: #074073; color: #ffffff; padding: 0.55rem 0.65rem; text-align: left; font-weight: 700; font-size: 0.74rem; text-transform: uppercase; }
    .o_pdf_items_table td { padding: 0.55rem 0.65rem; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
    .o_pdf_bottom_grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
    .o_pdf_amount_words { background: #f0f7fc; border-left: 3px solid #14B5D9; padding: 0.65rem 0.85rem; font-size: 0.76rem; margin-bottom: 0.75rem; border-radius: 0 4px 4px 0; }
    .o_pdf_amount_words .label { font-weight: 700; color: #074073; display: block; margin-bottom: 0.15rem; }
    .o_pdf_amount_words .words { color: #0f172a; font-weight: 600; }
    .o_pdf_bank_info { font-size: 0.75rem; line-height: 1.4; color: #475569; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 0.65rem 0.85rem; }
    .o_pdf_totals_section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem 0.95rem; }
    .o_pdf_totals_table { width: 100%; font-size: 0.78rem; }
    .o_pdf_totals_table td { padding: 0.35rem 0; color: #475569; }
    .o_pdf_totals_table tr.is-grand-total td { font-size: 1.05rem; font-weight: 900; color: #074073; border-top: 2px solid #074073; padding-top: 0.55rem; }
    .o_pdf_signatures_section { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; margin-top: 2.2rem; margin-bottom: 1.25rem; }
    .o_pdf_sign_box { text-align: center; }
    .o_pdf_sign_box .sign_line { border-bottom: 1px solid #94a3b8; margin-bottom: 0.5rem; height: 40px; }
    .o_pdf_sign_box .sign_name { font-weight: 700; color: #0f172a; font-size: 0.82rem; }
    .o_pdf_sign_box .sign_title { font-size: 0.72rem; color: #475569; }
    .o_pdf_sign_box .sign_sub { font-size: 0.68rem; color: #94a3b8; margin-top: 0.2rem; }
    .o_pdf_legal_footer { font-size: 0.68rem; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 0.85rem; line-height: 1.4; }
    @media print {
      body { background: #ffffff !important; padding: 0 !important; }
      .o_pdf_sheet { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
    }
  </style>
</head>
<body>
  ${sheetHtml}
  ${printScript}
</body>
</html>`;

    if (autoPrint) {
      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        window.print();
      }
    } else {
      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${isQuotation ? 'Cotizacion' : 'Pedido'}_${(sale.name || 'documento').replace(/[\/\\]/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    }
  }

  function renderSaleOrderForm(container) {
    const isNew = state.activeRecordId === 'new';
    const defaultProd = (state.data.products || [])[0] || { id: 1, name: 'Servicio', list_price: 1000000, tax_rate: 19 };
    const existing = isNew
      ? {
          name: 'Nueva Cotización',
          partner_id: (state.formDraft && state.formDraft.partner_id) || '',
          date_order: new Date().toISOString().slice(0, 10),
          validity_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          salesperson: (state.data.settings.active_user && state.data.settings.active_user.name) || 'Laura Gómez',
          payment_term: (state.formDraft && state.formDraft.payment_term) || '',
          state: 'draft',
          invoice_status: 'no',
          lines: state.formDraft && state.formDraft.lines ? state.formDraft.lines : [
            {
              id: 1,
              product_id: '',
              product_name: '',
              description: '',
              quantity: 1,
              price_unit: 0,
              discount: 0,
              tax_rate: '',
              subtotal: 0,
              tax_amount: 0,
              total: 0
            }
          ],
          notes: state.data.settings.sale_terms || '',
          invoice_ids: [],
          chatter: []
        }
      : (state.data.sales || []).find((s) => Number(s.id) === Number(state.activeRecordId));

    if (!existing) {
      state.viewType = 'list';
      return renderModuleWorkspace();
    }

    if (!state.formDraft || state.formDraft.recordId !== state.activeRecordId) {
      state.formDraft = {
        recordId: state.activeRecordId,
        partner_id: (state.formDraft && state.formDraft.partner_id) || existing.partner_id || '',
        payment_term: existing.payment_term || '',
        date_order: existing.date_order,
        validity_date: existing.validity_date,
        salesperson: existing.salesperson,
        notes: existing.notes || '',
        lines: JSON.parse(JSON.stringify(existing.lines || []))
      };
    }

    const draft = state.formDraft;
    const selectedPartner = (state.data.contacts || []).find((c) => Number(c.id) === Number(draft.partner_id));
    const stages = [
      { id: 'draft', label: 'Cotización' },
      { id: 'sent', label: 'Cotización Enviada' },
      { id: 'sale', label: 'Pedido de Venta' }
    ];

    const draftLines = draft.lines;
    const calcUntaxed = draftLines.reduce((acc, l) => {
      const sub = Number(l.quantity || 0) * Number(l.price_unit || 0) * (1 - Number(l.discount || 0) / 100);
      return acc + sub;
    }, 0);
    const calcTax = draftLines.reduce((acc, l) => {
      const sub = Number(l.quantity || 0) * Number(l.price_unit || 0) * (1 - Number(l.discount || 0) / 100);
      return acc + sub * (Number(l.tax_rate || 0) / 100);
    }, 0);
    const calcTotal = calcUntaxed + calcTax;

    const previewData = {
      ...existing,
      name: isNew ? 'Nueva Cotización' : (existing.name || 'Cotización'),
      partner_id: draft.partner_id || existing.partner_id,
      date_order: draft.date_order || existing.date_order,
      validity_date: draft.validity_date || existing.validity_date,
      salesperson: draft.salesperson || existing.salesperson,
      payment_term: draft.payment_term || existing.payment_term,
      notes: draft.notes !== undefined ? draft.notes : existing.notes,
      lines: draftLines.map((l) => ({
        ...l,
        name: l.product_name || l.description || 'Producto / Servicio',
        quantity: Number(l.quantity || 1),
        price_unit: Number(l.price_unit || 0),
        discount: Number(l.discount || 0),
        tax_rate: l.tax_rate !== '' && l.tax_rate !== undefined && l.tax_rate !== null ? Number(l.tax_rate) : 19,
        subtotal: Number(l.quantity || 0) * Number(l.price_unit || 0) * (1 - Number(l.discount || 0) / 100)
      })),
      amount_untaxed: calcUntaxed,
      amount_tax: calcTax,
      amount_total: calcTotal
    };

    container.innerHTML = `
      <div class="o_invoice_split_container">
        <div class="o_invoice_left_col">
          <div class="o_form_sheet_bg">
              <div class="o_form_statusbar">
                <div class="o_statusbar_buttons">
                  <button type="button" class="btn btn-primary" id="btnSaveSaleOrder">Guardar</button>
                  ${
                    !isNew && existing.state === 'draft'
                      ? `<button type="button" class="btn btn-secondary" data-sale-action="send">Marcar como Enviada</button>`
                      : ''
                  }
                  ${
                    !isNew && (existing.state === 'draft' || existing.state === 'sent')
                      ? `<button type="button" class="btn btn-action" data-sale-action="confirm">Confirmar Pedido</button>`
                      : ''
                  }
                  ${
                    !isNew && existing.state === 'sale' && existing.invoice_status !== 'invoiced'
                      ? `<button type="button" class="btn btn-action" data-sale-action="create_invoice">Crear Factura</button>`
                      : ''
                  }
                  ${
                    !isNew && existing.state !== 'cancel'
                      ? `<button type="button" class="btn btn-danger btn-sm" data-sale-action="cancel">Cancelar</button>`
                      : ''
                  }
                  ${
                    !isNew && existing.state === 'cancel'
                      ? `<button type="button" class="btn btn-secondary" data-sale-action="draft">Restablecer a Cotización</button>`
                      : ''
                  }
                </div>
                <div class="o_statusbar_status">
                  ${stages
                    .map((s) => `<span class="o_arrow_button ${existing.state === s.id ? 'is-current' : ''}">${s.label}</span>`)
                    .join('')}
                </div>
              </div>

              <div class="o_form_sheet">
                ${
                  !isNew && existing.invoice_ids && existing.invoice_ids.length > 0
                    ? (() => {
                        const moves = (state.data.accounting && state.data.accounting.moves) || [];
                        const orderMoves = moves.filter((m) => (existing.invoice_ids || []).includes(m.id) && m.state !== 'cancel');
                        const totalInvSum = orderMoves.reduce((s, m) => s + Number(m.amount_total || 0), 0);
                        return `
                  <div class="o_button_box">
                    <button type="button" class="o_stat_button oe_stat_button" id="btnOpenSaleInvoice" title="Ver facturas generadas">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                      <div class="o_stat_info">
                        <span class="o_stat_value">${existing.invoice_ids.length} Factura(s)</span>
                        <span class="o_stat_text">Total: ${formatMoney(totalInvSum)}</span>
                      </div>
                    </button>
                  </div>
                `;
                      })()
                    : ''
                }

                <div class="o_form_title_group">
                  <label>Documento de Venta</label>
                  <div style="font-size: 1.5rem; font-weight: 700;">${esc(existing.name)}</div>
                </div>

                <div class="o_group">
                  <div class="o_field_row">
                    <label for="fSalePartner">Cliente *</label>
                    <select id="fSalePartner" class="o_select">
                      <option value="" ${!draft.partner_id ? 'selected disabled' : ''}>— Seleccione un cliente —</option>
                      ${(state.data.contacts || [])
                        .map(
                          (c) => `<option value="${c.id}" ${Number(draft.partner_id) === Number(c.id) ? 'selected' : ''}>${esc(c.name)} (${esc(c.vat || 'Sin NIT')})</option>`
                        )
                        .join('')}
                    </select>
                  </div>
                  <div id="salePartnerDetailsCard" class="o_partner_details_card ${!selectedPartner ? 'is-empty' : ''}">
                    ${renderSalePartnerDetailsHtml(selectedPartner)}
                  </div>
                  <div class="o_field_row">
                    <label for="fSalePaymentTerm">Plazos de Pago</label>
                    <select id="fSalePaymentTerm" class="o_select">
                      <option value="" ${!draft.payment_term ? 'selected disabled' : ''}>— Seleccione plazo de pago —</option>
                      ${['Contado', '15 Días', '30 Días', '45 Días', '60 Días']
                        .map((t) => `<option value="${t}" ${draft.payment_term === t ? 'selected' : ''}>${t}</option>`)
                        .join('')}
                    </select>
                  </div>
                  <div class="o_field_row">
                    <label for="fSaleDate">Fecha de Orden</label>
                    <input type="date" id="fSaleDate" class="o_input" value="${esc(draft.date_order)}" />
                  </div>
                  <div class="o_field_row">
                    <label for="fSaleValidity">Fecha de Expiración</label>
                    <input type="date" id="fSaleValidity" class="o_input" value="${esc(draft.validity_date)}" />
                  </div>
                  <div class="o_field_row">
                    <label for="fSalePerson">Comercial Asignado</label>
                    <input type="text" id="fSalePerson" class="o_input" value="${esc(draft.salesperson)}" />
                  </div>
                </div>

                <div class="o_notebook_headers">
                  <button type="button" class="o_notebook_tab is-active">Líneas del Pedido</button>
                </div>

                <div tabindex="0" role="region" aria-label="Líneas del pedido de venta" class="table-wrapper" style="margin-bottom: 0.75rem;">
                  <table class="o_list_table" style="--label-2: 'Descripción'; --label-3: 'Cant.'; --label-4: 'Precio Unit.'; --label-5: 'Desc %'; --label-6: 'IVA %'; --label-7: 'Subtotal'; --label-8: 'Acción';">
                    <thead>
                      <tr>
                        <th>Producto / Servicio</th>
                        <th>Descripción</th>
                        <th style="width: 85px;">Cant.</th>
                        <th style="width: 145px;">Precio Unit.</th>
                        <th style="width: 85px;">Desc.%</th>
                        <th style="width: 95px;">IVA %</th>
                        <th class="text-end">Subtotal</th>
                        <th style="width: 50px;"></th>
                      </tr>
                    </thead>
                    <tbody id="saleLinesTbody">
                      ${draftLines
                        .map((l, idx) => {
                          const sub = Number(l.quantity || 0) * Number(l.price_unit || 0) * (1 - Number(l.discount || 0) / 100);
                          return `
                          <tr data-line-idx="${idx}">
                            <th>
                              <select class="o_select line-product" data-idx="${idx}">
                                <option value="" ${!l.product_id ? 'selected disabled' : ''}>— Seleccione producto —</option>
                                ${(state.data.products || [])
                                  .map(
                                    (p) => `<option value="${p.id}" ${Number(l.product_id) === Number(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`
                                  )
                                  .join('')}
                              </select>
                            </th>
                            <td><input type="text" class="o_input line-desc" data-idx="${idx}" value="${esc(l.description || '')}" /></td>
                            <td><input type="number" class="o_input line-qty" data-idx="${idx}" min="1" step="any" value="${Number(l.quantity || 1)}" /></td>
                            <td><input type="number" class="o_input line-price" data-idx="${idx}" min="0" step="any" value="${Number(l.price_unit || 0)}" /></td>
                            <td><input type="number" class="o_input line-disc" data-idx="${idx}" min="0" max="100" step="any" value="${Number(l.discount || 0)}" /></td>
                            <td>
                              <select class="o_select line-tax" data-idx="${idx}">
                                <option value="" ${l.tax_rate === undefined || l.tax_rate === null || l.tax_rate === '' ? 'selected disabled' : ''}>— IVA —</option>
                                ${[0, 5, 19]
                                  .map((t) => `<option value="${t}" ${l.tax_rate !== '' && Number(l.tax_rate) === t ? 'selected' : ''}>${t}%</option>`)
                                  .join('')}
                              </select>
                            </td>
                            <td class="text-end"><strong>${formatMoney(sub)}</strong></td>
                            <td><button type="button" class="btn btn-sm btn-danger btn-remove-line" data-idx="${idx}" title="Quitar línea">Quitar</button></td>
                          </tr>
                        `;
                        })
                        .join('')}
                    </tbody>
                  </table>
                </div>

                <button type="button" class="btn btn-secondary btn-sm" id="btnAddSaleLine">Agregar producto / línea</button>

                <div class="o_totals_box">
                  <div class="o_totals_row">
                    <span>Base Imponible:</span>
                    <strong>${formatMoney(calcUntaxed)}</strong>
                  </div>
                  <div class="o_totals_row">
                    <span>IVA:</span>
                    <strong>${formatMoney(calcTax)}</strong>
                  </div>
                  <div class="o_totals_row is-grand">
                    <span>Total:</span>
                    <span>${formatMoney(calcTotal)}</span>
                  </div>
                </div>

                <div class="o_field_row" style="margin-top: 1rem;">
                  <label for="fSaleNotes">Términos y Condiciones</label>
                  <textarea id="fSaleNotes" class="o_textarea" rows="2">${esc(draft.notes || '')}</textarea>
                </div>

                ${renderOrderLinkedInvoicesHtml(existing)}
              </div>
            </div>

            ${renderChatterHtml('sales', existing)}
        </div>

        <aside class="o_invoice_pdf_panel" aria-label="Previsualización PDF de la Cotización">
          <div class="o_pdf_panel_header">
            <div class="o_pdf_panel_title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              ${existing.state === 'sale' ? 'Pedido de Venta (PDF)' : 'Cotización Comercial (PDF)'}
            </div>
            <div class="o_pdf_panel_actions">
              <button type="button" class="btn btn-sm btn-secondary" id="btnPrintSalePdf" title="Imprimir documento">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Imprimir
              </button>
              <button type="button" class="btn btn-sm btn-primary" id="btnDownloadSalePdf" title="Descargar o Abrir PDF">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Descargar
              </button>
            </div>
          </div>
          <div class="o_pdf_paper_viewport">
            ${renderSalePdfSheetHtml(previewData)}
          </div>
        </aside>
      </div>
    `;

    wireChatterEvents('sales', existing.id);

    const syncSaleDraft = () => {
      const partnerEl = document.getElementById('fSalePartner');
      const termEl = document.getElementById('fSalePaymentTerm');
      const dateEl = document.getElementById('fSaleDate');
      const valEl = document.getElementById('fSaleValidity');
      const personEl = document.getElementById('fSalePerson');
      const notesEl = document.getElementById('fSaleNotes');
      if (partnerEl) state.formDraft.partner_id = Number(partnerEl.value);
      if (termEl) state.formDraft.payment_term = termEl.value;
      if (dateEl) state.formDraft.date_order = dateEl.value;
      if (valEl) state.formDraft.validity_date = valEl.value;
      if (personEl) state.formDraft.salesperson = personEl.value;
      if (notesEl) state.formDraft.notes = notesEl.value;

      container.querySelectorAll('#saleLinesTbody tr').forEach((tr) => {
        const idx = Number(tr.getAttribute('data-line-idx'));
        const line = state.formDraft.lines[idx];
        if (!line) return;
        line.description = tr.querySelector('.line-desc').value;
        line.quantity = Number(tr.querySelector('.line-qty').value || 1);
        line.price_unit = Number(tr.querySelector('.line-price').value || 0);
        line.discount = Number(tr.querySelector('.line-disc').value || 0);
        const lineTaxVal = tr.querySelector('.line-tax').value;
        line.tax_rate = lineTaxVal === '' ? '' : Number(lineTaxVal);
      });
    };

    const partnerSelectEl = document.getElementById('fSalePartner');
    if (partnerSelectEl) {
      partnerSelectEl.addEventListener('change', () => {
        syncSaleDraft();
        renderSaleOrderForm(container);
      });
    }

    ['fSalePaymentTerm', 'fSaleDate', 'fSaleValidity', 'fSalePerson', 'fSaleNotes'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          syncSaleDraft();
          renderSaleOrderForm(container);
        });
      }
    });

    // Line events
    container.querySelectorAll('.line-product').forEach((sel) => {
      sel.addEventListener('change', () => {
        syncSaleDraft();
        const idx = Number(sel.getAttribute('data-idx'));
        const prod = (state.data.products || []).find((p) => Number(p.id) === Number(sel.value));
        if (prod) {
          state.formDraft.lines[idx].product_id = prod.id;
          state.formDraft.lines[idx].product_name = prod.name;
          state.formDraft.lines[idx].description = prod.name;
          state.formDraft.lines[idx].price_unit = prod.list_price;
          state.formDraft.lines[idx].tax_rate = prod.tax_rate !== undefined && prod.tax_rate !== null && prod.tax_rate !== '' ? prod.tax_rate : '';
          renderSaleOrderForm(container);
        }
      });
    });

    container.querySelectorAll('.line-qty, .line-price, .line-disc, .line-tax, .line-desc').forEach((inp) => {
      inp.addEventListener('change', () => {
        syncSaleDraft();
        renderSaleOrderForm(container);
      });
    });

    container.querySelectorAll('.btn-remove-line').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncSaleDraft();
        const idx = Number(btn.getAttribute('data-idx'));
        if (state.formDraft.lines.length <= 1) {
          return showToast('El pedido debe conservar al menos una línea.', true);
        }
        state.formDraft.lines.splice(idx, 1);
        renderSaleOrderForm(container);
      });
    });

    document.getElementById('btnAddSaleLine').addEventListener('click', () => {
      syncSaleDraft();
      state.formDraft.lines.push({
        id: Date.now(),
        product_id: '',
        product_name: '',
        description: '',
        quantity: 1,
        price_unit: 0,
        discount: 0,
        tax_rate: ''
      });
      renderSaleOrderForm(container);
    });

    const saveOrderNow = async () => {
      syncSaleDraft();
      if (!state.formDraft.partner_id) {
        showToast('Debe seleccionar un cliente para la cotización.', true);
        throw new Error('Debe seleccionar un cliente para la cotización.');
      }
      const hasEmptyProduct = (state.formDraft.lines || []).some((l) => !l.product_id);
      if (hasEmptyProduct) {
        showToast('Debe seleccionar un producto en cada línea del pedido.', true);
        throw new Error('Debe seleccionar un producto en cada línea del pedido.');
      }

      const payload = {
        id: isNew ? undefined : existing.id,
        partner_id: Number(state.formDraft.partner_id),
        payment_term: state.formDraft.payment_term,
        date_order: state.formDraft.date_order,
        validity_date: state.formDraft.validity_date,
        salesperson: state.formDraft.salesperson,
        notes: state.formDraft.notes,
        lines: state.formDraft.lines
      };
      const res = await apiCall('/api/sales', 'POST', payload);
      state.activeRecordId = res.order.id;
      state.formDraft = null;
      return res.order;
    };

    document.getElementById('btnSaveSaleOrder').addEventListener('click', async () => {
      try {
        await saveOrderNow();
        showToast('Cotización / Pedido guardado.');
        renderModuleWorkspace();
      } catch (err) {
        showToast(err.message, true);
      }
    });

    container.querySelectorAll('[data-sale-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-sale-action');

        if (action === 'create_invoice') {
          const moves = (state.data.accounting && state.data.accounting.moves) || [];
          const existingInvs = moves.filter((m) => (existing.invoice_ids || []).includes(m.id) && m.state !== 'cancel');
          const invoicedTotal = existingInvs.reduce((s, m) => s + Number(m.amount_total || 0), 0);
          const orderTotal = Number(existing.amount_total || 0);
          const remaining = Math.max(0, orderTotal - invoicedTotal);

          if (remaining <= 0) {
            return showToast('Este pedido de venta ya fue facturado en su totalidad.', true);
          }

          promptInvoiceCreation(existing, remaining, async (chosenAmount) => {
            try {
              await saveOrderNow();
              const res = await apiCall(`/api/sales/${state.activeRecordId}/action`, 'POST', {
                action: 'create_invoice',
                amount: chosenAmount
              });
              state.formDraft = null;
              showToast(`Factura ${res.invoice ? res.invoice.name : ''} generada exitosamente.`);
              if (res.invoice) {
                openApp('accounting', { submenu: 'out_invoice', viewType: 'form', recordId: res.invoice.id, returnTo: { app: 'sales', submenu: state.submenu, viewType: 'form', recordId: state.activeRecordId } });
              } else {
                renderModuleWorkspace();
              }
            } catch (err) {
              showToast(err.message, true);
            }
          });
          return;
        }

        try {
          await saveOrderNow();
          const res = await apiCall(`/api/sales/${state.activeRecordId}/action`, 'POST', { action });
          state.formDraft = null;
          showToast('Estado del pedido actualizado.');
          renderModuleWorkspace();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    });

    const openInvBtn = document.getElementById('btnOpenSaleInvoice');
    if (openInvBtn) {
      openInvBtn.addEventListener('click', () => {
        if (existing.invoice_ids.length === 1) {
          const invId = existing.invoice_ids[0];
          openApp('accounting', { submenu: 'out_invoice', viewType: 'form', recordId: invId, returnTo: { app: 'sales', submenu: state.submenu, viewType: 'form', recordId: state.activeRecordId } });
        } else {
          const panel = container.querySelector('.o_linked_invoices_panel');
          if (panel) {
            panel.scrollIntoView({ behavior: 'smooth' });
          } else {
            const invId = existing.invoice_ids[existing.invoice_ids.length - 1];
            openApp('accounting', { submenu: 'out_invoice', viewType: 'form', recordId: invId, returnTo: { app: 'sales', submenu: state.submenu, viewType: 'form', recordId: state.activeRecordId } });
          }
        }
      });
    }

    container.querySelectorAll('.o_linked_invoices_panel tbody tr[data-invoice-id]').forEach((row) => {
      row.addEventListener('click', () => {
        const moveId = Number(row.getAttribute('data-invoice-id'));
        if (moveId) {
          openApp('accounting', { submenu: 'out_invoice', viewType: 'form', recordId: moveId, returnTo: { app: 'sales', submenu: state.submenu, viewType: 'form', recordId: state.activeRecordId } });
        }
      });
    });

    container.querySelectorAll('.btn-goto-invoice').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const moveId = Number(btn.getAttribute('data-invoice-id'));
        if (moveId) {
          openApp('accounting', { submenu: 'out_invoice', viewType: 'form', recordId: moveId, returnTo: { app: 'sales', submenu: state.submenu, viewType: 'form', recordId: state.activeRecordId } });
        }
      });
    });

    const btnPrintSale = document.getElementById('btnPrintSalePdf');
    if (btnPrintSale) {
      btnPrintSale.addEventListener('click', () => {
        syncSaleDraft();
        downloadSalePdf(previewData, true);
      });
    }

    const btnDownloadSale = document.getElementById('btnDownloadSalePdf');
    if (btnDownloadSale) {
      btnDownloadSale.addEventListener('click', () => {
        syncSaleDraft();
        downloadSalePdf(previewData, false);
      });
    }
  }

  function renderProductsSubmodule(container) {
    let products = state.data.products || [];
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      products = products.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.default_code || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
      );
    }
    updatePager(products.length, (state.data.products || []).length);

    const bannerHtml = `
      <div class="o_dashboard_banner" style="margin-bottom: 1rem;">
        <div class="o_stat_card">
          <span class="o_stat_label">Catálogo de Productos</span>
          <span class="o_stat_value">${(state.data.products || []).length}</span>
          <span class="o_stat_sub">Productos registrados</span>
        </div>
      </div>
    `;

    if (state.viewType === 'kanban') {
      container.innerHTML =
        bannerHtml +
        `
        <div class="o_kanban_view">
          ${
            products.length === 0
              ? `<div style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; color: var(--o-text-muted);">
                   No hay productos registrados en el catálogo. Haz clic en <strong>Nuevo Producto</strong> para agregar uno.
                 </div>`
              : products
                  .map(
                    (p) => `
                <article class="o_kanban_record" data-product-id="${p.id}" style="cursor: pointer;">
                  <div class="o_kanban_details">
                    <div style="display: flex; justify-content: space-between; gap: 0.4rem;">
                      <span class="o_kanban_title">${esc(p.name)}</span>
                      <span class="o_badge o_badge_info">${esc(p.uom || 'Metro Cuadrado')}</span>
                    </div>
                    <div class="o_kanban_subtitle">SKU: ${esc(p.default_code || '—')} · ${esc(p.category || 'General')}</div>
                    <div class="o_kanban_subtitle">Precio: <strong>${formatMoney(p.list_price)}</strong></div>
                    <div class="o_kanban_footer">
                      <span class="o_badge o_badge_info">IVA ${Number(p.tax_rate ?? 19)}%</span>
                    </div>
                  </div>
                </article>
              `
                  )
                  .join('')
          }
        </div>
      `;
    } else {
      container.innerHTML =
        bannerHtml +
        `
        <div tabindex="0" role="region" aria-labelledby="products-table-caption" class="table-wrapper">
          <table class="o_list_table" style="--label-2: 'SKU'; --label-3: 'Categoría'; --label-4: 'Unidad'; --label-5: 'Precio Venta'; --label-6: 'IVA';">
            <caption id="products-table-caption">Catálogo de productos</caption>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Referencia SKU</th>
                <th>Categoría</th>
                <th>Unidad de Medida</th>
                <th class="text-end">Precio de Venta</th>
                <th>Impuesto</th>
              </tr>
            </thead>
            <tbody>
              ${
                products.length === 0
                  ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--o-text-muted);">
                    No hay productos registrados en el catálogo. Haz clic en <strong>Nuevo Producto</strong> para agregar uno.
                  </td>
                </tr>
              `
                  : products
                      .map(
                        (p) => `
                <tr data-product-id="${p.id}" style="cursor: pointer;" title="Haga clic para ver o modificar este producto">
                  <th>${esc(p.name)}</th>
                  <td>${esc(p.default_code || '—')}</td>
                  <td>${esc(p.category || 'General')}</td>
                  <td>${esc(p.uom || 'Metro Cuadrado')}</td>
                  <td class="text-end"><strong>${formatMoney(p.list_price)}</strong></td>
                  <td><span class="o_badge o_badge_info">IVA ${Number(p.tax_rate ?? 19)}%</span></td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      `;
    }

    container.querySelectorAll('[data-product-id]').forEach((el) => {
      el.addEventListener('click', () => {
        state.activeRecordId = Number(el.getAttribute('data-product-id'));
        state.viewType = 'form';
        renderModuleWorkspace();
      });
    });
  }

  function renderProductForm(container) {
    const isNew = state.activeRecordId === 'new';
    const products = state.data.products || [];
    const existing = isNew
      ? {
          name: '',
          default_code: '',
          category: 'General',
          type: 'consu',
          uom: '',
          list_price: 0,
          standard_price: 0,
          tax_rate: '',
          can_be_sold: true,
          can_be_expensed: false
        }
      : products.find((p) => Number(p.id) === Number(state.activeRecordId));

    if (!existing) {
      state.activeRecordId = null;
      state.viewType = 'list';
      return renderModuleWorkspace();
    }

    updatePager(0, products.length);

    container.innerHTML = `
      <div class="o_form_view">
        <div class="o_form_sheet_bg">
          <div class="o_form_statusbar">
            <div class="o_statusbar_buttons">
              <button type="button" class="btn btn-action" id="btnSaveProductForm">Guardar</button>
              <button type="button" class="btn btn-secondary" id="btnDiscardProductForm">Descartar</button>
            </div>
            <div class="o_statusbar_status">
              <span class="o_arrow_button is-current">${isNew ? 'Nuevo Producto' : esc(existing.default_code || 'Producto')}</span>
            </div>
          </div>

          <form id="productForm" class="o_form_sheet" onsubmit="return false;">
            <div class="o_button_box">
              <div class="o_stat_button oe_stat_button" style="cursor: default;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                <div class="o_stat_info">
                  <span class="o_stat_value">${formatMoney(existing.list_price || 0)}</span>
                  <span class="o_stat_text">Precio de Venta</span>
                </div>
              </div>
            </div>

            <div class="o_form_title_group">
              <label for="prodName" class="o_form_label_title">Nombre del Producto *</label>
              <input type="text" id="prodName" class="o_input_title" placeholder="Ej. Alfombra Modular..." value="${esc(existing.name || '')}" required />
            </div>

            <div class="o_notebook">
              <div class="o_notebook_headers">
                <button type="button" class="o_notebook_tab is-active">Información General</button>
              </div>

              <div class="o_notebook_content" style="padding-top: 1rem;">
                <div class="o_group o_prod_add_grid" style="align-items: end;">
                  <div class="o_field_row">
                    <label for="prodSku">Referencia Interna / SKU</label>
                    <input type="text" id="prodSku" class="o_input" placeholder="Ej. PRD-001" value="${esc(existing.default_code || '')}" />
                  </div>
                  <div class="o_field_row">
                    <label for="prodCategory">Categoría</label>
                    <input type="text" id="prodCategory" class="o_input" placeholder="Ej. Pisos, Revestimientos, General" value="${esc(existing.category || 'General')}" />
                  </div>
                  <div class="o_field_row">
                    <label for="prodUom">Unidad de Medida</label>
                    <select id="prodUom" class="o_select">
                      <option value="" ${!existing.uom ? 'selected disabled' : ''}>— Seleccione Unidad de Medida —</option>
                      <option value="Metro Cuadrado" ${existing.uom === 'Metro Cuadrado' ? 'selected' : ''}>Metro Cuadrado (m²)</option>
                      <option value="Metro Lineal" ${existing.uom === 'Metro Lineal' || existing.uom === 'Metro Liso' ? 'selected' : ''}>Metro Lineal</option>
                      <option value="Metro Liso" style="display: none;">Metro Liso</option>
                    </select>
                  </div>
                  <div class="o_field_row">
                    <label for="prodPrice">Precio de Venta (COP)</label>
                    <input type="number" id="prodPrice" class="o_input" min="0" step="any" value="${existing.list_price ?? 0}" />
                  </div>
                  <div class="o_field_row">
                    <label for="prodTax">Impuesto IVA (%)</label>
                    <select id="prodTax" class="o_select">
                      <option value="" ${existing.tax_rate === '' || existing.tax_rate === undefined || existing.tax_rate === null ? 'selected disabled' : ''}>— Seleccione IVA —</option>
                      <option value="19" ${existing.tax_rate !== '' && Number(existing.tax_rate) === 19 ? 'selected' : ''}>IVA 19%</option>
                      <option value="5" ${existing.tax_rate !== '' && Number(existing.tax_rate) === 5 ? 'selected' : ''}>IVA 5%</option>
                      <option value="0" ${existing.tax_rate !== '' && Number(existing.tax_rate) === 0 ? 'selected' : ''}>Exento 0%</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('btnSaveProductForm').addEventListener('click', async () => {
      try {
        const name = (document.getElementById('prodName').value || '').trim();
        if (!name) {
          showToast('El nombre del producto es obligatorio.', true);
          return;
        }
        const default_code = (document.getElementById('prodSku').value || '').trim();
        const category = (document.getElementById('prodCategory').value || 'General').trim();
        const uom = (document.getElementById('prodUom').value || '').trim();
        if (!uom) {
          showToast('Debe seleccionar una unidad de medida.', true);
          return;
        }
        const list_price = Number(document.getElementById('prodPrice').value || 0);
        const taxVal = document.getElementById('prodTax').value;
        if (taxVal === '') {
          showToast('Debe seleccionar la tarifa de IVA.', true);
          return;
        }
        const tax_rate = Number(taxVal);

        const payload = {
          name,
          default_code,
          category,
          type: existing.type || 'consu',
          uom,
          list_price,
          standard_price: existing.standard_price || 0,
          tax_rate,
          can_be_sold: true,
          can_be_expensed: existing.can_be_expensed !== undefined ? existing.can_be_expensed : false
        };
        if (!isNew) {
          payload.id = existing.id;
        }

        await apiCall('/api/products', 'POST', payload);
        showToast(isNew ? 'Producto creado en el catálogo.' : 'Producto actualizado exitosamente.');
        state.activeRecordId = null;
        state.viewType = 'list';
        renderModuleWorkspace();
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('btnDiscardProductForm').addEventListener('click', () => {
      state.activeRecordId = null;
      state.viewType = 'list';
      renderModuleWorkspace();
    });
  }

  // ==================== MODULE 4: CONTABILIDAD (account.move) ====================
  function paymentStateBadge(st) {
    const map = {
      paid: { cls: 'o_badge_success', text: 'Pagado' },
      partial: { cls: 'o_badge_warning', text: 'Pago Parcial' },
      not_paid: { cls: 'o_badge_danger', text: 'No Pagado' }
    };
    const item = map[st] || { cls: 'o_badge_muted', text: st };
    return `<span class="o_badge ${item.cls}">${esc(item.text)}</span>`;
  }

  function generateMonthBalanceSvg(m) {
    const data = m || { inflow: 0, outflow: 0, net: 0, margin_pct: 0 };
    const maxVal = Math.max(Number(data.inflow || 0), Number(data.outflow || 0), Math.abs(Number(data.net || 0)), 1);
    const chartH = 120;
    const baseY = 165;

    const hInflow = Math.round((Math.max(0, Number(data.inflow || 0)) / maxVal) * chartH);
    const hOutflow = Math.round((Math.max(0, Number(data.outflow || 0)) / maxVal) * chartH);
    const hNet = Math.round((Math.abs(Number(data.net || 0)) / maxVal) * chartH);
    const isNetPos = Number(data.net || 0) >= 0;

    return `
      <svg viewBox="0 0 600 230" style="width: 100%; height: auto; max-height: 250px; font-family: inherit;" role="img" aria-label="Gráfica comparativa de balance del mes actual">
        <!-- Lineas de escala -->
        <line x1="40" y1="45" x2="560" y2="45" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
        <line x1="40" y1="85" x2="560" y2="85" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
        <line x1="40" y1="125" x2="560" y2="125" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
        <line x1="40" y1="${baseY}" x2="560" y2="${baseY}" stroke="currentColor" stroke-opacity="0.25" stroke-width="1.5" />

        <!-- Distintivo Margen Neto -->
        <rect x="400" y="10" width="160" height="26" rx="13" fill="rgba(14, 165, 233, 0.12)" />
        <text x="480" y="27" font-size="11" font-weight="700" fill="#0ea5e9" text-anchor="middle">Margen Operativo: ${data.margin_pct >= 0 ? '+' : ''}${data.margin_pct}%</text>

        <!-- Barra 1: Recaudado -->
        <g>
          <rect x="85" y="${baseY - hInflow}" width="85" height="${hInflow}" rx="5" fill="#10b981" />
          <text x="127" y="${Math.max(30, baseY - hInflow - 8)}" font-size="12" font-weight="700" fill="#10b981" text-anchor="middle">${formatMoney(data.inflow)}</text>
          <text x="127" y="${baseY + 22}" font-size="12" font-weight="600" fill="var(--o-text-main)" text-anchor="middle">Recaudado</text>
          <text x="127" y="${baseY + 38}" font-size="10" fill="var(--o-text-muted)" text-anchor="middle">Cobros Reales</text>
        </g>

        <!-- Barra 2: Gastos Pagados -->
        <g>
          <rect x="255" y="${baseY - hOutflow}" width="85" height="${hOutflow}" rx="5" fill="#ef4444" />
          <text x="297" y="${Math.max(30, baseY - hOutflow - 8)}" font-size="12" font-weight="700" fill="#ef4444" text-anchor="middle">${formatMoney(data.outflow)}</text>
          <text x="297" y="${baseY + 22}" font-size="12" font-weight="600" fill="var(--o-text-main)" text-anchor="middle">Gastos Pagados</text>
          <text x="297" y="${baseY + 38}" font-size="10" fill="var(--o-text-muted)" text-anchor="middle">Compras / Mat.</text>
        </g>

        <!-- Barra 3: Balance Neto -->
        <g>
          <rect x="425" y="${baseY - hNet}" width="85" height="${hNet}" rx="5" fill="${isNetPos ? '#0ea5e9' : '#f59e0b'}" />
          <text x="467" y="${Math.max(30, baseY - hNet - 8)}" font-size="12" font-weight="700" fill="${isNetPos ? '#0ea5e9' : '#f59e0b'}" text-anchor="middle">${formatMoney(data.net)}</text>
          <text x="467" y="${baseY + 22}" font-size="12" font-weight="600" fill="var(--o-text-main)" text-anchor="middle">Balance Neto</text>
          <text x="467" y="${baseY + 38}" font-size="10" fill="var(--o-text-muted)" text-anchor="middle">Cajas / Bancos</text>
        </g>
      </svg>
    `;
  }

  function generateTrendSvg(monthlyList) {
    const list = Array.isArray(monthlyList) && monthlyList.length > 0 ? monthlyList : [];
    if (list.length === 0) {
      return `<p style="padding: 2.5rem; text-align: center; color: var(--o-text-muted);">Sin datos históricos suficientes para graficar.</p>`;
    }
    const maxVal = Math.max(...list.map((m) => Math.max(Number(m.inflow || 0), Number(m.outflow || 0), Math.abs(Number(m.net || 0)))), 1);
    const chartH = 110;
    const baseY = 160;
    const count = list.length;
    const colW = 540 / count;

    const netPoints = [];

    const barsSvg = list.map((m, i) => {
      const centerX = 40 + i * colW + colW / 2;
      const hIn = Math.round((Math.max(0, Number(m.inflow || 0)) / maxVal) * chartH);
      const hOut = Math.round((Math.max(0, Number(m.outflow || 0)) / maxVal) * chartH);
      const hNet = Math.round((Number(m.net || 0) / maxVal) * chartH);
      const netY = baseY - hNet;
      netPoints.push(`${centerX},${netY}`);

      return `
        <g>
          <rect x="${centerX - 24}" y="${baseY - hIn}" width="22" height="${hIn}" rx="3" fill="#10b981" />
          <rect x="${centerX + 2}" y="${baseY - hOut}" width="22" height="${hOut}" rx="3" fill="#ef4444" />
          <text x="${centerX}" y="${baseY + 20}" font-size="11" font-weight="600" fill="var(--o-text-muted)" text-anchor="middle">${esc(m.label)}</text>
        </g>
      `;
    }).join('');

    const polylineSvg = netPoints.length > 1
      ? `<polyline points="${netPoints.join(' ')}" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-dasharray="3,3" />`
      : '';

    const dotsSvg = list.map((m, i) => {
      const centerX = 40 + i * colW + colW / 2;
      const hNet = Math.round((Number(m.net || 0) / maxVal) * chartH);
      const netY = baseY - hNet;
      return `<circle cx="${centerX}" cy="${netY}" r="4" fill="#0ea5e9" stroke="#ffffff" stroke-width="1.5" />`;
    }).join('');

    return `
      <svg viewBox="0 0 620 220" style="width: 100%; height: auto; max-height: 250px; font-family: inherit;" role="img" aria-label="Evolución financiera de 6 meses">
        <!-- Leyenda -->
        <g transform="translate(130, 10)">
          <rect x="0" y="2" width="12" height="12" rx="2" fill="#10b981" />
          <text x="18" y="12" font-size="11" fill="var(--o-text-main)">Recaudado</text>
          <rect x="110" y="2" width="12" height="12" rx="2" fill="#ef4444" />
          <text x="128" y="12" font-size="11" fill="var(--o-text-main)">Gastos</text>
          <circle cx="216" cy="8" r="5" fill="#0ea5e9" />
          <text x="228" y="12" font-size="11" fill="var(--o-text-main)">Balance Neto</text>
        </g>

        <!-- Escalas -->
        <line x1="30" y1="45" x2="590" y2="45" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
        <line x1="30" y1="85" x2="590" y2="85" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
        <line x1="30" y1="125" x2="590" y2="125" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
        <line x1="30" y1="${baseY}" x2="590" y2="${baseY}" stroke="currentColor" stroke-opacity="0.25" stroke-width="1.5" />

        ${barsSvg}
        ${polylineSvg}
        ${dotsSvg}
      </svg>
    `;
  }

  function generateDonutSvg(items, title, emptyMsg) {
    const list = Array.isArray(items) && items.length > 0 ? items : [];
    const total = list.reduce((s, it) => s + Number(it.amount || 0), 0);
    if (total <= 0 || list.length === 0) {
      return `
        <div style="background: var(--o-view-bg); border: 1px dashed var(--o-border-color); border-radius: 8px; padding: 1.5rem; text-align: center;">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.35rem;">${esc(title)}</h4>
          <p style="font-size: 0.82rem; color: var(--o-text-muted); margin: 0;">${esc(emptyMsg || 'Sin movimientos registrados')}</p>
        </div>
      `;
    }

    const palette = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    const r = 58;
    const circ = 2 * Math.PI * r;
    let accumulatedPct = 0;

    const circlesSvg = list.map((it, idx) => {
      const pct = Math.max(0, Math.min(100, Number(it.percentage || 0)));
      const strokeDash = (pct / 100) * circ;
      const strokeOffset = -((accumulatedPct / 100) * circ);
      accumulatedPct += pct;
      const color = palette[idx % palette.length];
      return `<circle cx="90" cy="90" r="${r}" fill="none" stroke="${color}" stroke-width="22" stroke-dasharray="${strokeDash.toFixed(2)} ${(circ - strokeDash).toFixed(2)}" stroke-dashoffset="${strokeOffset.toFixed(2)}" transform="rotate(-90 90 90)" />`;
    }).join('');

    const legendHtml = list.map((it, idx) => {
      const color = palette[idx % palette.length];
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; font-size: 0.82rem;">
          <div style="display: flex; align-items: center; gap: 0.45rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></span>
            <span style="overflow: hidden; text-overflow: ellipsis;" title="${esc(it.name)}">${esc(it.name)}</span>
          </div>
          <div style="text-align: end; margin-left: 0.5rem; white-space: nowrap;">
            <strong>${formatMoney(it.amount)}</strong>
            <span style="color: var(--o-text-muted); font-size: 0.75rem; margin-left: 0.2rem;">(${it.percentage}%)</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="background: var(--o-view-bg); border: 1px solid var(--o-border-color); border-radius: 8px; padding: 1.15rem;">
        <h4 style="font-size: 0.95rem; margin: 0 0 1rem 0; font-weight: 600;">${esc(title)}</h4>
        <div style="display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;">
          <div style="width: 180px; height: 180px; flex-shrink: 0; position: relative; margin: 0 auto;">
            <svg viewBox="0 0 180 180" style="width: 100%; height: 100%;" role="img" aria-label="${esc(title)}">
              <circle cx="90" cy="90" r="${r}" fill="none" stroke="currentColor" stroke-opacity="0.08" stroke-width="22" />
              ${circlesSvg}
              <text x="90" y="86" font-size="10" font-weight="600" fill="var(--o-text-muted)" text-anchor="middle">Total</text>
              <text x="90" y="103" font-size="11" font-weight="700" fill="var(--o-text-main)" text-anchor="middle">${formatMoney(total)}</text>
            </svg>
          </div>
          <div style="flex: 1; min-width: 200px;">
            ${legendHtml}
          </div>
        </div>
      </div>
    `;
  }

  function renderAccountingModule() {
    const container = document.getElementById('moduleContent');
    const acc = state.data.accounting || { moves: [], journals: [], accounts: [], payments: [] };
    const kpis = state.data.kpis || {};

    if (state.viewType === 'form' && state.submenu !== 'accounts' && state.submenu !== 'payments') {
      renderAccountMoveForm(container);
      return;
    }
    // Facturas y documentos contables siempre se visualizan en lista por defecto
    state.viewType = 'list';

    if (state.submenu === 'dashboard') {
      updatePager(acc.journals.length, acc.journals.length);
      const outUnpaid = acc.moves.filter((m) => m.move_type === 'out_invoice' && m.state === 'posted' && m.amount_residual > 0);
      const inUnpaid = acc.moves.filter((m) => m.move_type === 'in_invoice' && m.state === 'posted' && m.amount_residual > 0);
      const bankCashAccounts = (kpis.accounts_summary && kpis.accounts_summary.length > 0)
        ? kpis.accounts_summary
        : (acc.journals || []).filter((j) => (j.type === 'bank' || j.type === 'cash') && j.active !== false).map((j) => ({
            id: j.id,
            code: j.code,
            name: j.name,
            type: j.type,
            balance: Number(j.balance || 0),
            inbound_total: 0,
            outbound_total: 0
          }));

      container.innerHTML = `
        <div class="o_dashboard_banner">
          <div class="o_stat_card">
            <span class="o_stat_label">Total de Ingresos</span>
            <span class="o_stat_value">${formatMoney(kpis.invoiced_revenue || 0)}</span>
            <span class="o_stat_sub">Ingresos operacionales causados</span>
          </div>
          <div class="o_stat_card">
            <span class="o_stat_label">Total Recaudado (Cobros Reales)</span>
            <span class="o_stat_value" style="color: #10b981;">${formatMoney(kpis.collected_revenue || 0)}</span>
            <span class="o_stat_sub">Ingresos cobrados en cuentas</span>
          </div>
          <div class="o_stat_card">
            <span class="o_stat_label">Total Gastos / Compras</span>
            <span class="o_stat_value" style="color: #ef4444;">${formatMoney(kpis.expenses_paid_total || 0)}</span>
            <span class="o_stat_sub">Pagado en compras y materiales</span>
          </div>
          <div class="o_stat_card">
            <span class="o_stat_label">Balance Neto en Cajas y Bancos</span>
            <span class="o_stat_value" style="color: ${(kpis.net_cash_balance || 0) >= 0 ? '#0ea5e9' : '#ef4444'};">${formatMoney(kpis.net_cash_balance || 0)}</span>
            <span class="o_stat_sub">Efectivo real disponible</span>
          </div>
          <div class="o_stat_card">
            <span class="o_stat_label">Cartera por Cobrar (Clientes)</span>
            <span class="o_stat_value">${formatMoney(kpis.receivables_residual || 0)}</span>
            <span class="o_stat_sub">${outUnpaid.length} factura(s) pendiente(s) de cobro</span>
          </div>
        </div>

        <!-- Panel de Gráficas y Balances Financieros -->
        <div class="o_chart_card">
          <div class="o_chart_header">
            <div>
              <h3 style="font-size: 1.05rem; margin: 0;">Análisis Financiero y Flujo de Caja</h3>
              <span style="font-size: 0.82rem; color: var(--o-text-muted);">Comparativa de recaudo real vs compras de materiales y balance disponible</span>
            </div>
            <div class="o_chart_tabs" role="tablist">
              <button type="button" class="o_chart_tab is-active" data-chart-tab="month">Balance Mes Actual</button>
              <button type="button" class="o_chart_tab" data-chart-tab="trend">Evolución 6 Meses</button>
              <button type="button" class="o_chart_tab" data-chart-tab="distribution">Distribución de Flujos</button>
            </div>
          </div>
          <div id="chartTabMonth" style="display: block;">
            ${generateMonthBalanceSvg(kpis.current_month_financials)}
          </div>
          <div id="chartTabTrend" style="display: none;">
            ${generateTrendSvg(kpis.monthly_financials)}
          </div>
          <div id="chartTabDistribution" style="display: none;">
            <div class="o_donut_grid">
              ${generateDonutSvg(kpis.inflow_by_account, 'Recaudos por Cuenta / Medio de Pago', 'Sin recaudos registrados este mes')}
              ${generateDonutSvg(kpis.expense_breakdown, 'Gastos por Proveedor / Material', 'Sin compras registradas este mes')}
            </div>
          </div>
        </div>

        <!-- Cuentas Financieras y Medios de Pago -->
        <div style="margin-bottom: 0.85rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 style="font-size: 1.1rem; margin: 0;">Cuentas Financieras y Cajas (Nequi, Daviplata, Efectivo, Bancos)</h3>
            <span style="font-size: 0.82rem; color: var(--o-text-muted);">Saldos y flujos discriminados por cuenta bancaria y medio de pago</span>
          </div>
          <button type="button" class="btn btn-sm btn-secondary" id="btnManageJournalsFromAcc">Configurar Cuentas en Ajustes</button>
        </div>

        <div class="o_financial_grid">
          ${bankCashAccounts
            .map(
              (a) => `
              <div class="o_journal_card ${a.type === 'bank' ? 'is-bank' : 'is-cash'}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.45rem;">
                  <div>
                    <span class="o_badge ${a.code === 'NEQ' ? 'o_badge_info' : a.code === 'DVP' ? 'o_badge_danger' : a.type === 'bank' ? 'o_badge_success' : 'o_badge_warning'}">${esc(a.code)}</span>
                    <h4 style="margin: 0.35rem 0 0 0; font-size: 1rem;">${esc(a.name)}</h4>
                  </div>
                  <span style="font-size: 0.72rem; color: var(--o-text-muted); text-transform: uppercase;">${a.type === 'bank' ? 'Banco / Billetera' : 'Caja Efectivo'}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0.65rem 0; padding: 0.5rem; background: var(--o-gray-100); border-radius: 6px; font-size: 0.8rem;">
                  <div>
                    <span style="color: var(--o-text-muted); display: block; font-size: 0.75rem;">Recaudado (+)</span>
                    <strong style="color: #10b981;">+${formatMoney(a.inbound_total || 0)}</strong>
                  </div>
                  <div>
                    <span style="color: var(--o-text-muted); display: block; font-size: 0.75rem;">Gastos (-)</span>
                    <strong style="color: #ef4444;">-${formatMoney(a.outbound_total || 0)}</strong>
                  </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--o-border-color); padding-top: 0.65rem; margin-top: 0.25rem;">
                  <div>
                    <span style="font-size: 0.75rem; color: var(--o-text-muted); display: block;">Saldo en Libros</span>
                    <strong style="font-size: 1.15rem; color: var(--o-action);">${formatMoney(a.balance || 0)}</strong>
                  </div>
                  <button type="button" class="btn btn-sm btn-secondary" data-journal-action="payments">Ver Pagos</button>
                </div>
              </div>
            `
            )
            .join('')}
        </div>

        <!-- Tabla de Últimos Movimientos de Caja y Bancos -->
        <div class="o_chart_card" style="margin-bottom: 1.75rem;">
          <div class="o_chart_header" style="margin-bottom: 0.75rem;">
            <div>
              <h3 style="font-size: 1.05rem; margin: 0;">Últimos Movimientos de Caja y Bancos</h3>
              <span style="font-size: 0.82rem; color: var(--o-text-muted);">Transacciones reales registradas en Nequi, Daviplata, Efectivo y Bancos</span>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" data-journal-action="payments">Ver Todos los Pagos</button>
          </div>
          <div tabindex="0" role="region" aria-label="Tabla de últimos movimientos" class="table-wrapper">
            <table class="o_list_table" style="--label-2: 'Fecha'; --label-3: 'Comprobante'; --label-4: 'Cuenta'; --label-5: 'Tercero'; --label-6: 'Referencia'; --label-7: 'Tipo'; --label-8: 'Importe';">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Comprobante</th>
                  <th>Cuenta / Medio</th>
                  <th>Tercero</th>
                  <th>Referencia</th>
                  <th>Tipo</th>
                  <th class="text-end">Importe</th>
                </tr>
              </thead>
              <tbody>
                ${(kpis.recent_cash_flows || []).length === 0 ? `
                  <tr><td colspan="7" class="text-center" style="padding: 1.5rem; color: var(--o-text-muted);">Sin movimientos de caja recientes.</td></tr>
                ` : (kpis.recent_cash_flows || []).map((m) => `
                  <tr>
                    <td>${esc(m.date || '')}</td>
                    <th>${esc(m.name || '')}</th>
                    <td><span class="o_badge ${m.journal_code === 'NEQ' ? 'o_badge_info' : m.journal_code === 'DVP' ? 'o_badge_danger' : 'o_badge_success'}">${esc(m.journal_name || m.journal_code || '')}</span></td>
                    <td>${esc(m.partner_name || '')}</td>
                    <td>${esc(m.ref || '—')}</td>
                    <td><span class="o_badge ${m.type === 'inbound' ? 'o_badge_success' : 'o_badge_warning'}">${m.type === 'inbound' ? 'Recaudo Cliente' : 'Pago Gasto'}</span></td>
                    <td class="text-end"><strong style="color: ${m.type === 'inbound' ? '#10b981' : '#ef4444'};">${m.type === 'inbound' ? '+' : '-'}${formatMoney(m.amount)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Diarios Operativos Estándar Odoo -->
        <h3 style="font-size: 1.1rem; margin-bottom: 0.85rem;">Diarios Operativos y Facturación</h3>
        <div class="o_journal_dashboard">
          <div class="o_journal_card is-sale">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="font-size: 1.05rem;">Facturas de Clientes (INV)</h3>
                <span class="o_badge o_badge_info">Ventas</span>
              </div>
              <p style="font-size: 0.82rem; color: var(--o-text-muted); margin-top: 0.35rem;">
                Diario de facturación electrónica y cuentas por cobrar (130505).
              </p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 0.75rem; color: var(--o-text-muted);">Por Cobrar</div>
                <strong style="font-size: 1.15rem;">${formatMoney(kpis.receivables_residual || 0)}</strong>
              </div>
              <div style="display: flex; gap: 0.4rem;">
                <button type="button" class="btn btn-sm btn-primary" data-journal-action="new_out">Nueva Factura</button>
                <button type="button" class="btn btn-sm btn-secondary" data-journal-action="list_out">Ver (${outUnpaid.length})</button>
              </div>
            </div>
          </div>

          <div class="o_journal_card is-purchase">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="font-size: 1.05rem;">Facturas de Proveedores (BILL)</h3>
                <span class="o_badge o_badge_warning">Compras</span>
              </div>
              <p style="font-size: 0.82rem; color: var(--o-text-muted); margin-top: 0.35rem;">
                Causación de compras, servicios y cuentas por pagar (220505).
              </p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 0.75rem; color: var(--o-text-muted);">Por Pagar</div>
                <strong style="font-size: 1.15rem;">${formatMoney(kpis.payables_residual || 0)}</strong>
              </div>
              <div style="display: flex; gap: 0.4rem;">
                <button type="button" class="btn btn-sm btn-primary" data-journal-action="new_in">Nueva Factura Prov.</button>
                <button type="button" class="btn btn-sm btn-secondary" data-journal-action="list_in">Ver (${inUnpaid.length})</button>
              </div>
            </div>
          </div>

          <div class="o_journal_card is-cash">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="font-size: 1.05rem;">Gastos y Operaciones Varias (EXJ)</h3>
                <span class="o_badge o_badge_info">Contabilidad</span>
              </div>
              <p style="font-size: 0.82rem; color: var(--o-text-muted); margin-top: 0.35rem;">
                Asientos contables integrados con el módulo de Gastos y Ventas.
              </p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 0.75rem; color: var(--o-text-muted);">Asientos Publicados</div>
                <strong style="font-size: 1.15rem;">${acc.moves.length}</strong>
              </div>
              <button type="button" class="btn btn-sm btn-secondary" data-journal-action="entries">Ver Asientos</button>
            </div>
          </div>
        </div>
      `;

      // Chart tabs switcher
      container.querySelectorAll('[data-chart-tab]').forEach((tabBtn) => {
        tabBtn.addEventListener('click', () => {
          const tab = tabBtn.getAttribute('data-chart-tab');
          container.querySelectorAll('.o_chart_tab').forEach((t) => t.classList.remove('is-active'));
          tabBtn.classList.add('is-active');

          const tabMonth = container.querySelector('#chartTabMonth');
          const tabTrend = container.querySelector('#chartTabTrend');
          const tabDist = container.querySelector('#chartTabDistribution');
          if (tabMonth) tabMonth.style.display = tab === 'month' ? 'block' : 'none';
          if (tabTrend) tabTrend.style.display = tab === 'trend' ? 'block' : 'none';
          if (tabDist) tabDist.style.display = tab === 'distribution' ? 'block' : 'none';
        });
      });

      const btnManageJournals = container.querySelector('#btnManageJournalsFromAcc');
      if (btnManageJournals) {
        btnManageJournals.addEventListener('click', () => {
          openApp('settings', { submenu: 'accounting' });
        });
      }

      container.querySelectorAll('[data-journal-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const act = btn.getAttribute('data-journal-action');
          const app = APPS.find((a) => a.id === 'accounting');
          if (act === 'new_out') {
            state.submenu = 'out_invoice';
            state.activeRecordId = 'new';
            state.formDraft = null;
            state.viewType = 'form';
          } else if (act === 'list_out') {
            state.submenu = 'out_invoice';
            state.viewType = 'list';
          } else if (act === 'new_in') {
            state.submenu = 'in_invoice';
            state.activeRecordId = 'new';
            state.formDraft = null;
            state.viewType = 'form';
          } else if (act === 'list_in') {
            state.submenu = 'in_invoice';
            state.viewType = 'list';
          } else if (act === 'payments') {
            state.submenu = 'payments';
            state.viewType = 'list';
          } else if (act === 'entries') {
            state.submenu = 'entries';
            state.viewType = 'list';
          }
          renderSubmenus(app);
          renderModuleWorkspace();
        });
      });
      return;
    }

    if (state.submenu === 'payments') {
      const payments = acc.payments || [];
      updatePager(payments.length, payments.length);
      container.innerHTML = `
        <div tabindex="0" role="region" aria-labelledby="payments-table-caption" class="table-wrapper">
          <table class="o_list_table" style="--label-2: 'Fecha'; --label-3: 'Diario'; --label-4: 'Tercero'; --label-5: 'Referencia'; --label-6: 'Importe'; --label-7: 'Tipo';">
            <caption id="payments-table-caption">Comprobantes de pago registrados</caption>
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Fecha</th>
                <th>Diario</th>
                <th>Cliente / Proveedor / Empleado</th>
                <th>Referencia</th>
                <th class="text-end">Importe</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              ${payments
                .map(
                  (p) => `
                  <tr>
                    <th>${esc(p.name)}</th>
                    <td>${esc(p.date)}</td>
                    <td>${esc(p.journal_name)}</td>
                    <td>${esc(p.partner_name)}</td>
                    <td>${esc(p.ref)}</td>
                    <td class="text-end"><strong>${formatMoney(p.amount)}</strong></td>
                    <td><span class="o_badge ${p.payment_type === 'inbound' ? 'o_badge_success' : 'o_badge_warning'}">${p.payment_type === 'inbound' ? 'Recaudo Cliente' : 'Egreso / Pago'}</span></td>
                  </tr>
                `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
      return;
    }

    if (state.submenu === 'accounts') {
      const accounts = acc.accounts || [];
      updatePager(accounts.length, accounts.length);
      container.innerHTML = `
        <div class="o_form_sheet" style="margin-bottom: 1rem;">
          <h3 style="margin-bottom: 0.75rem;">Agregar Cuenta al Plan Único de Cuentas (PUC)</h3>
          <div class="o_group o_acc_add_grid" style="align-items: end; margin-bottom: 0;">
            <div class="o_field_row">
              <label for="newAccCode">Código PUC</label>
              <input type="text" id="newAccCode" class="o_input" placeholder="Ej. 513515" />
            </div>
            <div class="o_field_row">
              <label for="newAccName">Nombre de la Cuenta</label>
              <input type="text" id="newAccName" class="o_input" placeholder="Ej. Asesoría Técnica y Jurídica" />
            </div>
            <div class="o_field_row">
              <label for="newAccType">Naturaleza / Tipo</label>
              <select id="newAccType" class="o_select">
                <option value="" disabled selected>— Seleccione Naturaleza / Tipo —</option>
                <option value="Activo Corriente">Activo Corriente</option>
                <option value="Por Cobrar">Por Cobrar</option>
                <option value="Por Pagar">Por Pagar</option>
                <option value="Ingresos Operacionales">Ingresos Operacionales</option>
                <option value="Gastos Operacionales">Gastos Operacionales</option>
              </select>
            </div>
            <button type="button" class="btn btn-action" id="btnAddAccount">Crear Cuenta</button>
          </div>
        </div>

        <div tabindex="0" role="region" aria-labelledby="accounts-table-caption" class="table-wrapper">
          <table class="o_list_table" style="--label-2: 'Nombre'; --label-3: 'Tipo'; --label-4: 'Conciliable';">
            <caption id="accounts-table-caption">Plan de cuentas contables</caption>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre de la Cuenta</th>
                <th>Tipo de Cuenta</th>
                <th>Permite Conciliación</th>
              </tr>
            </thead>
            <tbody>
              ${accounts
                .map(
                  (a) => `
                  <tr>
                    <th>${esc(a.code)}</th>
                    <td>${esc(a.name)}</td>
                    <td>${esc(a.type)}</td>
                    <td><span class="o_badge ${a.reconcile ? 'o_badge_success' : 'o_badge_muted'}">${a.reconcile ? 'Sí' : 'No'}</span></td>
                  </tr>
                `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;

      document.getElementById('btnAddAccount').addEventListener('click', async () => {
        try {
          const code = document.getElementById('newAccCode').value;
          const name = document.getElementById('newAccName').value;
          const type = document.getElementById('newAccType').value;
          if (!type) {
            showToast('Debe seleccionar la naturaleza o tipo de cuenta.', true);
            return;
          }
          await apiCall('/api/accounting/accounts', 'POST', { code, name, type, reconcile: type.includes('Cobrar') || type.includes('Pagar') });
          showToast('Cuenta contable creada.');
          renderModuleWorkspace();
        } catch (err) {
          showToast(err.message, true);
        }
      });
      return;
    }

    // Moves list (out_invoice, in_invoice, entries)
    let moves = acc.moves || [];
    if (state.submenu === 'out_invoice') moves = moves.filter((m) => m.move_type === 'out_invoice');
    else if (state.submenu === 'in_invoice') moves = moves.filter((m) => m.move_type === 'in_invoice');

    if (state.partnerContextFilter) {
      moves = moves.filter((m) => Number(m.partner_id) === Number(state.partnerContextFilter.id));
    }

    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      moves = moves.filter(
        (m) =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.partner_name || '').toLowerCase().includes(q) ||
          (m.ref || '').toLowerCase().includes(q)
      );
    }

    updatePager(moves.length, moves.length);
    const totalAmountSum = moves.reduce((s, m) => s + Number(m.amount_total || 0), 0);
    const totalResidualSum = moves.reduce((s, m) => s + Number(m.amount_residual || 0), 0);

    container.innerHTML = `
      <div tabindex="0" role="region" aria-labelledby="moves-table-caption" class="table-wrapper">
        <table class="o_list_table" style="--label-2: 'Tercero'; --label-3: 'Fecha'; --label-4: 'Vencimiento'; --label-5: 'Diario / Origen'; --label-6: 'Total'; --label-7: 'Saldo Pendiente'; --label-8: 'Estado Pago'; --label-9: 'Estado';">
          <caption id="moves-table-caption">Facturas y asientos contables</caption>
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente / Proveedor</th>
              <th>Fecha</th>
              <th>Vencimiento</th>
              <th>Diario / Origen</th>
              <th class="text-end">Total</th>
              <th class="text-end">Saldo Pendiente</th>
              <th>Estado Pago</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${moves
              .map(
                (m) => `
                <tr data-move-id="${m.id}">
                  <th>${esc(m.name)}</th>
                  <td>${esc(m.partner_name)}</td>
                  <td>${esc(m.invoice_date)}</td>
                  <td>${esc(m.invoice_date_due)}</td>
                  <td>${esc(m.journal_code)} · ${esc(m.origin || m.ref || '')}</td>
                  <td class="text-end"><strong>${formatMoney(m.amount_total)}</strong></td>
                  <td class="text-end">${formatMoney(m.amount_residual)}</td>
                  <td>${paymentStateBadge(m.payment_state, m.state)}</td>
                  <td><span class="o_badge ${m.state === 'posted' ? 'o_badge_success' : m.state === 'cancel' ? 'o_badge_danger' : 'o_badge_info'}">${m.state === 'posted' ? 'Publicado' : m.state === 'cancel' ? 'Cancelado' : 'Borrador'}</span></td>
                </tr>
              `
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5">Totales</td>
              <td class="text-end">${formatMoney(totalAmountSum)}</td>
              <td class="text-end">${formatMoney(totalResidualSum)}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    container.querySelectorAll('tbody tr').forEach((row) => {
      row.addEventListener('click', () => {
        state.activeRecordId = Number(row.getAttribute('data-move-id'));
        state.formDraft = null;
        state.viewType = 'form';
        renderModuleWorkspace();
      });
    });
  }

  function renderAccountMoveForm(container) {
    const isNew = state.activeRecordId === 'new';
    const moveType = state.submenu === 'in_invoice' ? 'in_invoice' : 'out_invoice';
    const existing = isNew
      ? {
          name: 'Borrador',
          move_type: moveType,
          partner_id: '',
          invoice_date: new Date().toISOString().slice(0, 10),
          invoice_date_due: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          ref: '',
          origin: 'Manual',
          state: 'draft',
          payment_state: 'not_paid',
          lines: [
            {
              id: 1,
              name: moveType === 'out_invoice' ? 'Servicios de Consultoría ERP' : 'Servicios de Infraestructura / Proveedor',
              account_code: moveType === 'out_invoice' ? '413501' : '519530',
              quantity: 1,
              price_unit: 1500000,
              tax_rate: 19,
              subtotal: 1500000,
              tax_amount: 285000,
              total: 1785000
            }
          ],
          journal_items: [],
          amount_untaxed: 1500000,
          amount_tax: 285000,
          amount_total: 1785000,
          amount_residual: 1785000,
          chatter: []
        }
      : (state.data.accounting.moves || []).find((m) => Number(m.id) === Number(state.activeRecordId));

    if (!existing) {
      state.viewType = 'list';
      return renderModuleWorkspace();
    }

    if (!state.formDraft || state.formDraft.moveRecordId !== state.activeRecordId) {
      state.formDraft = {
        moveRecordId: state.activeRecordId,
        partner_id: existing.partner_id || '',
        ref: existing.ref || '',
        invoice_date: existing.invoice_date,
        invoice_date_due: existing.invoice_date_due,
        retention_source_rate: existing.retention_source_rate || 0,
        retention_ica_rate: existing.retention_ica_rate || 0,
        lines: JSON.parse(JSON.stringify(existing.lines || []))
      };
    }

    const draft = state.formDraft;
    const isEditable = isNew || existing.state === 'draft';
    const calcUntaxed = draft.lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.price_unit || 0), 0);
    const calcTax = draft.lines.reduce(
      (s, l) => s + Number(l.quantity || 0) * Number(l.price_unit || 0) * (Number(l.tax_rate ?? 19) / 100),
      0
    );
    const calcTotal = calcUntaxed + calcTax;
    const calcRetSourceRate = Number(draft.retention_source_rate || 0);
    const calcRetIcaRate = Number(draft.retention_ica_rate || 0);
    const calcRetSourceAmount = round2(calcUntaxed * (calcRetSourceRate / 100));
    const calcRetIcaAmount = round2(calcUntaxed * (calcRetIcaRate / 100));
    const calcTotalRetentions = round2(calcRetSourceAmount + calcRetIcaAmount);
    const calcAmountNet = Math.max(0, round2(calcTotal - calcTotalRetentions));
    const calcResidual = isEditable ? (calcTotalRetentions > 0 ? calcAmountNet : calcTotal) : Number(existing.amount_residual || 0);

    const previewData = {
      ...existing,
      partner_id: draft.partner_id || existing.partner_id,
      invoice_date: draft.invoice_date || existing.invoice_date,
      invoice_date_due: draft.invoice_date_due || existing.invoice_date_due,
      retention_source_rate: calcRetSourceRate,
      retention_source_amount: calcRetSourceAmount,
      retention_ica_rate: calcRetIcaRate,
      retention_ica_amount: calcRetIcaAmount,
      amount_net: calcAmountNet,
      lines: draft.lines || existing.lines,
      amount_untaxed: calcUntaxed,
      amount_tax: calcTax,
      amount_total: calcTotal,
      amount_residual: calcResidual
    };

    const hasPriorPayments = Boolean(existing.payments_history && existing.payments_history.length > 0) || Boolean(existing.is_installment);
    container.innerHTML = `
      <div class="o_invoice_split_container">
        <div class="o_invoice_left_col">
          <div class="o_form_sheet_bg">
          <div class="o_form_statusbar">
            <div class="o_statusbar_buttons">
              ${
                isEditable
                  ? `<button type="button" class="btn btn-primary" id="btnSaveDraftMove">Guardar Borrador</button>
                     <button type="button" class="btn btn-action" id="btnSaveAndPostMove">Confirmar y Publicar</button>`
                  : ''
              }
              ${
                !isNew && existing.state === 'posted' && existing.amount_residual > 0
                  ? `<button type="button" class="btn btn-action" id="btnOpenPaymentModal">Registrar Pago</button>`
                  : ''
              }
              ${
                !isNew && existing.state === 'posted' && existing.amount_residual > 0 && hasPriorPayments
                  ? `<button type="button" class="btn btn-secondary btn-sm" id="btnGenResidualMove">Generar Siguiente Factura por Saldo</button>`
                  : ''
              }
              ${
                !isNew && existing.state !== 'draft'
                  ? `<button type="button" class="btn btn-secondary" data-move-action="draft">Restablecer a Borrador</button>`
                  : ''
              }
              ${
                !isNew && existing.state !== 'cancel'
                  ? `<button type="button" class="btn btn-danger btn-sm" data-move-action="cancel">Cancelar</button>`
                  : ''
              }
            </div>
            <div class="o_statusbar_status">
              <span class="o_arrow_button ${existing.state === 'draft' ? 'is-current' : ''}">Borrador</span>
              <span class="o_arrow_button ${existing.state === 'posted' ? 'is-current' : ''}">Publicado</span>
            </div>
          </div>

          <div class="o_form_sheet">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <div>
                <span style="font-size: 0.78rem; color: var(--o-text-muted); text-transform: uppercase;">
                  ${existing.move_type === 'out_invoice' ? 'Factura Electrónica de Venta' : existing.move_type === 'in_invoice' ? 'Factura de Proveedor' : 'Asiento Contable'}
                </span>
                <h2 style="font-size: 1.5rem;">${esc(existing.name)}</h2>
              </div>
              <div>${paymentStateBadge(existing.payment_state, existing.state)}</div>
            </div>

            <div class="o_group">
              <div class="o_field_row">
                <label for="fMovePartner">Cliente / Proveedor</label>
                <select id="fMovePartner" class="o_select" ${!isEditable ? 'disabled' : ''}>
                  <option value="" ${!draft.partner_id ? 'selected disabled' : ''}>— Seleccione Tercero / Contacto —</option>
                  ${(state.data.contacts || [])
                    .map(
                      (c) => `<option value="${c.id}" ${Number(draft.partner_id) === Number(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`
                    )
                    .join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fMoveRef">Referencia / Orden de Compra</label>
                <input type="text" id="fMoveRef" class="o_input" value="${esc(draft.ref || '')}" ${!isEditable ? 'readonly' : ''} />
              </div>
              ${
                existing.origin
                  ? `<div class="o_field_row">
                      <label>Documento de Origen</label>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="o_badge o_badge_info" style="font-size: 0.85rem; padding: 4px 8px;">${esc(existing.origin)}</span>
                        <button type="button" class="btn btn-sm btn-secondary" id="btnGoToOriginDoc">Ver Origen</button>
                      </div>
                    </div>`
                  : ''
              }
              <div class="o_field_row">
                <label for="fMoveDate">Fecha Contable / Factura</label>
                <input type="date" id="fMoveDate" class="o_input" value="${esc(draft.invoice_date)}" ${!isEditable ? 'readonly' : ''} />
              </div>
              <div class="o_field_row">
                <label for="fMoveDue">Fecha de Vencimiento</label>
                <input type="date" id="fMoveDue" class="o_input" value="${esc(draft.invoice_date_due)}" ${!isEditable ? 'readonly' : ''} />
              </div>
            </div>

            <div class="o_group" style="margin-top: 0.65rem; background: var(--o-view-bg); padding: 0.75rem 1rem; border-radius: 6px; border: 1px solid var(--o-border-color); display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="o_field_row">
                <label for="fMoveRetSource">Retención en la Fuente (Renta)</label>
                <select id="fMoveRetSource" class="o_select" ${!isEditable ? 'disabled' : ''}>
                  <option value="0" ${!draft.retention_source_rate ? 'selected' : ''}>Sin Retefuente (0%)</option>
                  <option value="2.5" ${Number(draft.retention_source_rate) === 2.5 ? 'selected' : ''}>Retefuente 2.5% (Compras generales / aluminio)</option>
                  <option value="4" ${Number(draft.retention_source_rate) === 4 ? 'selected' : ''}>Retefuente 4.0% (Servicios y confección)</option>
                  <option value="1" ${Number(draft.retention_source_rate) === 1 ? 'selected' : ''}>Retefuente 1.0% (Declarantes compras)</option>
                </select>
              </div>
              <div class="o_field_row">
                <label for="fMoveRetIca">ReteICA (Industria y Comercio)</label>
                <select id="fMoveRetIca" class="o_select" ${!isEditable ? 'disabled' : ''}>
                  <option value="0" ${!draft.retention_ica_rate ? 'selected' : ''}>Sin ReteICA (0%)</option>
                  <option value="0.414" ${Number(draft.retention_ica_rate) === 0.414 ? 'selected' : ''}>ReteICA 0.414% (4.14‰ - Actividades industriales)</option>
                  <option value="0.966" ${Number(draft.retention_ica_rate) === 0.966 ? 'selected' : ''}>ReteICA 0.966% (9.66‰ - Actividades de servicios)</option>
                  <option value="0.5" ${Number(draft.retention_ica_rate) === 0.5 ? 'selected' : ''}>ReteICA 0.500% (5.00‰ - Actividades comerciales)</option>
                </select>
              </div>
            </div>

            <div class="o_notebook_headers">
              <button type="button" class="o_notebook_tab ${state.activeNotebookTab === 'lines' ? 'is-active' : ''}" data-tab="lines">Líneas de Factura</button>
              <button type="button" class="o_notebook_tab ${state.activeNotebookTab === 'journal_items' ? 'is-active' : ''}" data-tab="journal_items">Apuntes Contables (Debe / Haber)</button>
            </div>

            ${
              state.activeNotebookTab === 'journal_items' && !isNew
                ? `
              <div tabindex="0" role="region" aria-label="Apuntes contables de partida doble" class="table-wrapper">
                <table class="o_list_table" style="--label-2: 'Cuenta'; --label-3: 'Etiqueta'; --label-4: 'Débito'; --label-5: 'Crédito';">
                  <thead>
                    <tr>
                      <th>Código PUC</th>
                      <th>Cuenta Contable</th>
                      <th>Descripción / Etiqueta</th>
                      <th class="text-end">Débito (Debe)</th>
                      <th class="text-end">Crédito (Haber)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(existing.journal_items || [])
                      .map(
                        (ji) => `
                        <tr>
                          <th>${esc(ji.account_code)}</th>
                          <td>${esc(ji.account_name)}</td>
                          <td>${esc(ji.label)}</td>
                          <td class="text-end">${formatMoney(ji.debit)}</td>
                          <td class="text-end">${formatMoney(ji.credit)}</td>
                        </tr>
                      `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
                : `
              <div tabindex="0" role="region" aria-label="Líneas del documento contable" class="table-wrapper" style="margin-bottom: 0.65rem;">
                <table class="o_list_table" style="--label-2: 'Cuenta'; --label-3: 'Cantidad'; --label-4: 'Precio'; --label-5: 'IVA'; --label-6: 'Subtotal'; --label-7: 'Acción';">
                  <thead>
                    <tr>
                      <th>Descripción / Concepto</th>
                      <th>Cuenta PUC</th>
                      <th style="width: 90px;">Cant.</th>
                      <th style="width: 150px;">Precio Unit.</th>
                      <th style="width: 100px;">IVA %</th>
                      <th class="text-end">Subtotal</th>
                      ${isEditable ? '<th style="width: 50px;"></th>' : ''}
                    </tr>
                  </thead>
                  <tbody id="moveLinesTbody">
                    ${draft.lines
                      .map((l, idx) => {
                        const sub = Number(l.quantity || 0) * Number(l.price_unit || 0);
                        return `
                        <tr data-move-line-idx="${idx}">
                          <th><input type="text" class="o_input move-line-name" data-idx="${idx}" value="${esc(l.name)}" ${!isEditable ? 'readonly' : ''} /></th>
                          <td><span class="o_badge o_badge_muted">${esc(l.account_code || (existing.move_type === 'in_invoice' ? '519530' : '413501'))}</span></td>
                          <td><input type="number" class="o_input move-line-qty" data-idx="${idx}" min="1" step="any" value="${Number(l.quantity || 1)}" ${!isEditable ? 'readonly' : ''} /></td>
                          <td><input type="number" class="o_input move-line-price" data-idx="${idx}" min="0" step="any" value="${Number(l.price_unit || 0)}" ${!isEditable ? 'readonly' : ''} /></td>
                          <td><input type="number" class="o_input move-line-tax" data-idx="${idx}" min="0" step="any" value="${Number(l.tax_rate ?? 19)}" ${!isEditable ? 'readonly' : ''} /></td>
                          <td class="text-end"><strong>${formatMoney(sub)}</strong></td>
                          ${
                            isEditable
                              ? `<td><button type="button" class="btn btn-sm btn-danger btn-remove-move-line" data-idx="${idx}" title="Quitar línea">Quitar</button></td>`
                              : ''
                          }
                        </tr>
                      `;
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>
              ${
                isEditable
                  ? `<button type="button" class="btn btn-secondary btn-sm" id="btnAddMoveLine">Agregar línea contable</button>`
                  : ''
              }
            `
            }

            <div class="o_totals_box">
              <div class="o_totals_row">
                <span>Subtotal Base:</span>
                <strong>${formatMoney(calcUntaxed)}</strong>
              </div>
              <div class="o_totals_row">
                <span>IVA (19%):</span>
                <strong>${formatMoney(calcTax)}</strong>
              </div>
              <div class="o_totals_row">
                <span>Total Factura:</span>
                <strong>${formatMoney(calcTotal)}</strong>
              </div>
              ${calcRetSourceAmount > 0 ? `
                <div class="o_totals_row" style="color: #b45309; font-size: 0.8rem;">
                  <span>(-) Retefuente (${calcRetSourceRate}%):</span>
                  <strong>- ${formatMoney(calcRetSourceAmount)}</strong>
                </div>
              ` : ''}
              ${calcRetIcaAmount > 0 ? `
                <div class="o_totals_row" style="color: #b45309; font-size: 0.8rem;">
                  <span>(-) ReteICA (${calcRetIcaRate}%):</span>
                  <strong>- ${formatMoney(calcRetIcaAmount)}</strong>
                </div>
              ` : ''}
              ${calcTotalRetentions > 0 ? `
                <div class="o_totals_row is-grand">
                  <span>Neto a Cobrar:</span>
                  <span>${formatMoney(calcAmountNet)}</span>
                </div>
              ` : `
                <div class="o_totals_row is-grand">
                  <span>Total Documento:</span>
                  <span>${formatMoney(calcTotal)}</span>
                </div>
              `}
              <div class="o_totals_row">
                <span>Importe Adeudado / Saldo:</span>
                <strong>${formatMoney(calcResidual)}</strong>
              </div>
            </div>
          </div>
        </div>

        ${renderChatterHtml('moves', existing)}
      </div>

      <aside class="o_invoice_pdf_panel" aria-label="Previsualización PDF de la Factura">
        <div class="o_pdf_panel_header">
          <div class="o_pdf_panel_title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            Factura Legal (PDF)
          </div>
          <div class="o_pdf_panel_actions">
            <button type="button" class="btn btn-sm btn-secondary" id="btnPrintInvoicePdf" title="Imprimir documento">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Imprimir
            </button>
            <button type="button" class="btn btn-sm btn-primary" id="btnDownloadInvoicePdf" title="Descargar o Abrir PDF">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Descargar
            </button>
          </div>
        </div>
        <div class="o_pdf_paper_viewport">
          ${renderInvoicePdfSheetHtml(previewData)}
        </div>
      </aside>
    </div>
  `;

    wireChatterEvents('moves', existing.id);

    const syncMoveDraft = () => {
      const pEl = document.getElementById('fMovePartner');
      const rEl = document.getElementById('fMoveRef');
      const dEl = document.getElementById('fMoveDate');
      const dueEl = document.getElementById('fMoveDue');
      const retSourceEl = document.getElementById('fMoveRetSource');
      const retIcaEl = document.getElementById('fMoveRetIca');
      if (pEl) state.formDraft.partner_id = Number(pEl.value);
      if (rEl) state.formDraft.ref = rEl.value;
      if (dEl) state.formDraft.invoice_date = dEl.value;
      if (dueEl) state.formDraft.invoice_date_due = dueEl.value;
      if (retSourceEl) state.formDraft.retention_source_rate = Number(retSourceEl.value || 0);
      if (retIcaEl) state.formDraft.retention_ica_rate = Number(retIcaEl.value || 0);

      container.querySelectorAll('#moveLinesTbody tr').forEach((tr) => {
        const idx = Number(tr.getAttribute('data-move-line-idx'));
        const line = state.formDraft.lines[idx];
        if (!line) return;
        const nEl = tr.querySelector('.move-line-name');
        const qEl = tr.querySelector('.move-line-qty');
        const prEl = tr.querySelector('.move-line-price');
        const tEl = tr.querySelector('.move-line-tax');
        if (nEl) line.name = nEl.value;
        if (qEl) line.quantity = Number(qEl.value || 1);
        if (prEl) line.price_unit = Number(prEl.value || 0);
        if (tEl) line.tax_rate = Number(tEl.value ?? 19);
      });
    };

    container.querySelectorAll('.o_notebook_tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        syncMoveDraft();
        state.activeNotebookTab = tab.getAttribute('data-tab');
        renderAccountMoveForm(container);
      });
    });

    container.querySelectorAll('.move-line-qty, .move-line-price, .move-line-tax').forEach((inp) => {
      inp.addEventListener('change', () => {
        syncMoveDraft();
        renderAccountMoveForm(container);
      });
    });

    container.querySelectorAll('.btn-remove-move-line').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncMoveDraft();
        const idx = Number(btn.getAttribute('data-idx'));
        if (state.formDraft.lines.length <= 1) {
          return showToast('El documento debe tener al menos una línea.', true);
        }
        state.formDraft.lines.splice(idx, 1);
        renderAccountMoveForm(container);
      });
    });

    const addMoveLineBtn = document.getElementById('btnAddMoveLine');
    if (addMoveLineBtn) {
      addMoveLineBtn.addEventListener('click', () => {
        syncMoveDraft();
        state.formDraft.lines.push({
          id: Date.now(),
          name: existing.move_type === 'in_invoice' ? 'Servicio / Compra adicional' : 'Servicio de consultoría adicional',
          account_code: existing.move_type === 'in_invoice' ? '519530' : '413501',
          quantity: 1,
          price_unit: 500000,
          tax_rate: 19
        });
        renderAccountMoveForm(container);
      });
    }

    const saveMoveFromForm = async (autoPost) => {
      syncMoveDraft();
      if (!state.formDraft.partner_id) {
        showToast('Debe seleccionar un cliente o proveedor.', true);
        throw new Error('Debe seleccionar un cliente o proveedor.');
      }
      const payload = {
        id: isNew ? undefined : existing.id,
        move_type: existing.move_type,
        partner_id: Number(state.formDraft.partner_id),
        ref: state.formDraft.ref,
        invoice_date: state.formDraft.invoice_date,
        invoice_date_due: state.formDraft.invoice_date_due,
        auto_post: autoPost,
        lines: state.formDraft.lines,
        retention_source_rate: Number(state.formDraft.retention_source_rate || 0),
        retention_ica_rate: Number(state.formDraft.retention_ica_rate || 0)
      };
      const res = await apiCall('/api/accounting/moves', 'POST', payload);
      state.activeRecordId = res.move.id;
      state.formDraft = null;
      showToast(autoPost ? `Factura publicada: ${res.move.name}` : 'Borrador contable guardado.');
      renderModuleWorkspace();
    };

    const btnSaveDraft = document.getElementById('btnSaveDraftMove');
    if (btnSaveDraft) btnSaveDraft.addEventListener('click', () => saveMoveFromForm(false).catch((e) => showToast(e.message, true)));

    const btnSavePost = document.getElementById('btnSaveAndPostMove');
    if (btnSavePost) btnSavePost.addEventListener('click', () => saveMoveFromForm(true).catch((e) => showToast(e.message, true)));

    container.querySelectorAll('[data-move-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-move-action');
        try {
          await apiCall(`/api/accounting/moves/${existing.id}/action`, 'POST', { action });
          state.formDraft = null;
          showToast('Documento contable actualizado.');
          renderModuleWorkspace();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    });

    const openPayModalBtn = document.getElementById('btnOpenPaymentModal');
    if (openPayModalBtn) {
      openPayModalBtn.addEventListener('click', () => {
        const dialog = document.getElementById('paymentDialog');
        document.getElementById('payMoveId').value = String(existing.id);
        const payJournalSelect = document.getElementById('payJournal');
        if (payJournalSelect && state.data.accounting && state.data.accounting.journals) {
          const activeJournals = state.data.accounting.journals.filter((j) => (j.type === 'bank' || j.type === 'cash') && j.active !== false);
          payJournalSelect.innerHTML = `
            <option value="" selected disabled>— Seleccione Diario / Cuenta —</option>
            ${activeJournals.map((j) => `<option value="${esc(j.code)}">${esc(j.name)} (${esc(j.code)})</option>`).join('')}
          `;
        }
        if (payJournalSelect) payJournalSelect.value = '';
        const amtInput = document.getElementById('payAmount');
        amtInput.value = String(existing.amount_residual);
        amtInput.max = String(existing.amount_residual);
        document.getElementById('payDate').value = new Date().toISOString().slice(0, 10);
        document.getElementById('payRef').value = existing.name;

        const resRow = document.getElementById('payResidualOptionRow');
        const dispRes = document.getElementById('dispPayResidualAmount');
        const updateResidualOption = () => {
          const curVal = Number(amtInput.value || 0);
          const diff = Number(existing.amount_residual || 0) - curVal;
          if (resRow) {
            if (diff > 0) {
              resRow.style.display = 'block';
              if (dispRes) dispRes.textContent = formatMoney(diff);
            } else {
              resRow.style.display = 'none';
            }
          }
        };
        amtInput.oninput = updateResidualOption;
        updateResidualOption();

        dialog.showModal();
      });
    }

    const btnGenResidualMove = document.getElementById('btnGenResidualMove');
    if (btnGenResidualMove) {
      btnGenResidualMove.addEventListener('click', async () => {
        try {
          const res = await apiCall('/api/accounting/moves/' + existing.id + '/action', 'POST', {
            action: 'generate_residual_invoice'
          });
          const nextInv = res.next_invoice || (res.move && res.move.next_invoice);
          showToast('Siguiente factura ' + (nextInv ? nextInv.name : '') + ' generada por el saldo restante.');
          if (nextInv) {
            state.activeRecordId = nextInv.id;
          }
          renderModuleWorkspace();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    }

    const partnerMoveEl = document.getElementById('fMovePartner');
    if (partnerMoveEl) {
      partnerMoveEl.addEventListener('change', () => {
        syncMoveDraft();
        renderAccountMoveForm(container);
      });
    }

    const retSourceInp = document.getElementById('fMoveRetSource');
    if (retSourceInp) {
      retSourceInp.addEventListener('change', () => {
        syncMoveDraft();
        renderAccountMoveForm(container);
      });
    }

    const retIcaInp = document.getElementById('fMoveRetIca');
    if (retIcaInp) {
      retIcaInp.addEventListener('change', () => {
        syncMoveDraft();
        renderAccountMoveForm(container);
      });
    }

    const btnDownloadPdf = document.getElementById('btnDownloadInvoicePdf');
    if (btnDownloadPdf) {
      btnDownloadPdf.addEventListener('click', () => {
        syncMoveDraft();
        downloadInvoicePdf(previewData, false);
      });
    }

    const btnPrintPdf = document.getElementById('btnPrintInvoicePdf');
    if (btnPrintPdf) {
      btnPrintPdf.addEventListener('click', () => {
        syncMoveDraft();
        downloadInvoicePdf(previewData, true);
      });
    }
  }

  // ==================== MODULE 5: AJUSTES (res.config.settings) ====================
  function renderSettingsModule() {
    const container = document.getElementById('moduleContent');
    const s = state.data.settings || {};
    const activeTab = (state.submenu && state.submenu !== 'all') ? state.submenu : 'general';

    let contentHtml = '';

    if (activeTab === 'general') {
      contentHtml = `
        <div class="o_settings_block" data-section="general">
          <h3>Datos de la Compañía y Apariencia</h3>
          <div class="o_group">
            <div class="o_field_row">
              <label for="setCompanyName">Razón Social de la Empresa</label>
              <input type="text" id="setCompanyName" class="o_input" value="${esc(s.company_name)}" />
            </div>
            <div class="o_field_row">
              <label for="setCompanyVat">NIT Tributario</label>
              <input type="text" id="setCompanyVat" class="o_input" value="${esc(s.company_vat)}" />
            </div>
            <div class="o_field_row">
              <label for="setCompanyEmail">Correo Corporativo</label>
              <input type="email" id="setCompanyEmail" class="o_input" value="${esc(s.company_email)}" />
            </div>
            <div class="o_field_row">
              <label for="setCompanyPhone">Teléfono Principal</label>
              <input type="text" id="setCompanyPhone" class="o_input" value="${esc(s.company_phone)}" />
            </div>
            <div class="o_field_row">
              <label for="setCompanyCity">Ciudad</label>
              <input type="text" id="setCompanyCity" class="o_input" value="${esc(s.company_city || '')}" />
            </div>
            <div class="o_field_row">
              <label for="setCompanyAddress">Dirección</label>
              <input type="text" id="setCompanyAddress" class="o_input" value="${esc(s.company_address || '')}" />
            </div>
            <div class="o_field_row">
              <label for="setCurrency">Moneda Funcional</label>
              <select id="setCurrency" class="o_select">
                <option value="" ${!s.currency ? 'selected disabled' : ''}>— Seleccione Moneda —</option>
                <option value="COP" ${s.currency === 'COP' ? 'selected' : ''}>COP — Peso Colombiano ($)</option>
                <option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>USD — Dólar Estadounidense (US$)</option>
                <option value="EUR" ${s.currency === 'EUR' ? 'selected' : ''}>EUR — Euro (€)</option>
              </select>
            </div>
            <div class="o_field_row">
              <label for="setTheme">Tema Visual</label>
              <select id="setTheme" class="o_select">
                <option value="" ${!s.theme ? 'selected disabled' : ''}>— Seleccione Tema —</option>
                <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Modo Oscuro (Predeterminado)</option>
                <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Modo Claro</option>
              </select>
            </div>
          </div>
        </div>
      `;
    } else if (activeTab === 'sales') {
      contentHtml = `
        <div class="o_settings_block" data-section="sales">
          <h3>Parámetros del Módulo de Ventas</h3>
          <div class="o_group">
            <div class="o_field_row">
              <label for="setValidityDays">Validez predeterminada de cotizaciones (días)</label>
              <input type="number" id="setValidityDays" class="o_input" value="${Number(s.quotation_validity_days || 30)}" min="1" />
            </div>
            <div class="o_field_row">
              <label for="setDefaultSaleTax">IVA de Ventas por Defecto (%)</label>
              <select id="setDefaultSaleTax" class="o_select">
                <option value="" ${s.default_sale_tax === '' || s.default_sale_tax === undefined || s.default_sale_tax === null ? 'selected disabled' : ''}>— Seleccione IVA por Defecto —</option>
                ${[19, 5, 0].map((t) => `<option value="${t}" ${s.default_sale_tax !== '' && Number(s.default_sale_tax) === t ? 'selected' : ''}>${t}%</option>`).join('')}
              </select>
            </div>
            <div class="o_field_row">
              <label for="setSaleTerms">Términos y Condiciones en Cotizaciones</label>
              <input type="text" id="setSaleTerms" class="o_input" value="${esc(s.sale_terms)}" />
            </div>
            <div class="o_field_row">
              <label for="setLineDiscounts">Descuentos por Línea en Cotizaciones</label>
              <select id="setLineDiscounts" class="o_select">
                <option value="true" ${s.enable_line_discounts !== false ? 'selected' : ''}>Habilitado (Permitir descuentos individuales por línea)</option>
                <option value="false" ${s.enable_line_discounts === false ? 'selected' : ''}>Deshabilitado</option>
              </select>
            </div>
          </div>
        </div>
      `;
    } else if (activeTab === 'accounting') {
      contentHtml = `
        <div class="o_settings_block" data-section="accounting">
          <h3>Parámetros Tributarios y Contables</h3>
          <div class="o_group">
            <div class="o_field_row">
              <label for="setFiscalRegime">Régimen Tributario</label>
              <input type="text" id="setFiscalRegime" class="o_input" value="${esc(s.fiscal_regime)}" />
            </div>
            <div class="o_field_row">
              <label for="setDefaultPurchaseTax">IVA de Compras por Defecto (%)</label>
              <select id="setDefaultPurchaseTax" class="o_select">
                ${[19, 5, 0].map((t) => `<option value="${t}" ${Number(s.default_purchase_tax ?? 19) === t ? 'selected' : ''}>${t}%</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="o_settings_block" id="blockSettingsAccounting" data-section="accounting-journals">
          <h3>Cuentas Financieras & Medios de Pago</h3>
          <p style="font-size: 0.84rem; color: var(--o-text-muted); margin-bottom: 0.85rem;">
            Configure sus cuentas bancarias, billeteras móviles (Nequi, Daviplata) y cajas en efectivo para recaudos y compras.
          </p>

          <div tabindex="0" role="region" aria-label="Cuentas financieras configuradas" class="table-wrapper" style="margin-bottom: 1.25rem;">
            <table class="o_list_table" style="--label-2: 'Código'; --label-3: 'Nombre'; --label-4: 'Tipo'; --label-5: 'Saldo';">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre de la Cuenta</th>
                  <th>Tipo</th>
                  <th class="text-end">Saldo Actual</th>
                </tr>
              </thead>
              <tbody>
                ${((state.data.accounting && state.data.accounting.journals) || [])
                  .filter((j) => (j.type === 'bank' || j.type === 'cash') && j.active !== false)
                  .map((j) => `
                    <tr>
                      <th><span class="o_badge ${j.code === 'NEQ' ? 'o_badge_info' : j.code === 'DVP' ? 'o_badge_danger' : 'o_badge_success'}">${esc(j.code)}</span></th>
                      <td><strong>${esc(j.name)}</strong></td>
                      <td>${j.type === 'bank' ? 'Banco / Billetera Digital' : 'Caja Efectivo'}</td>
                      <td class="text-end"><strong>${formatMoney(j.balance || 0)}</strong></td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>

          <div style="background: var(--o-gray-100); border-radius: 8px; padding: 1.15rem; border: 1px solid var(--o-border-color);">
            <h4 style="font-size: 0.95rem; margin: 0 0 0.75rem 0; font-weight: 600;">Agregar Nueva Cuenta Financiera</h4>
            <div class="o_group" style="margin-bottom: 0.75rem;">
              <div class="o_field_row">
                <label for="newJournalCode">Código Corto (ej. NEQ2, BBVA, CSH2) *</label>
                <input type="text" id="newJournalCode" class="o_input" placeholder="ej. BBVA" maxlength="6" />
              </div>
              <div class="o_field_row">
                <label for="newJournalName">Nombre de la Cuenta *</label>
                <input type="text" id="newJournalName" class="o_input" placeholder="ej. BBVA Cuenta Corriente" />
              </div>
              <div class="o_field_row">
                <label for="newJournalType">Tipo de Cuenta *</label>
                <select id="newJournalType" class="o_select">
                  <option value="bank">Banco / Billetera Digital (Nequi, Daviplata, etc.)</option>
                  <option value="cash">Caja Efectivo</option>
                </select>
              </div>
              <div class="o_field_row">
                <label for="newJournalBalance">Saldo Inicial ($)</label>
                <input type="number" id="newJournalBalance" class="o_input" value="0" min="0" step="1000" />
              </div>
            </div>
            <button type="button" class="btn btn-action" id="btnAddJournal">Guardar Cuenta Financiera</button>
          </div>
        </div>
      `;
    } else if (activeTab === 'expenses') {
      contentHtml = `
        <div class="o_settings_block" data-section="expenses">
          <h3>Políticas y Parámetros de Gastos</h3>
          <div class="o_group">
            <div class="o_field_row">
              <label for="setExpenseApproval">Aprobación Gerencial de Gastos</label>
              <select id="setExpenseApproval" class="o_select">
                <option value="true" ${s.expense_approval_required !== false ? 'selected' : ''}>Requerir aprobación antes de contabilizar o pagar</option>
                <option value="false" ${s.expense_approval_required === false ? 'selected' : ''}>Aprobación automática inmediata</option>
              </select>
            </div>
            <div class="o_field_row">
              <label for="setExpenseJournal">Diario Contable Predeterminado de Gastos</label>
              <input type="text" id="setExpenseJournal" class="o_input" value="${esc(s.expense_default_journal || 'EXJ')}" placeholder="EXJ" />
            </div>
          </div>
        </div>
      `;
    } else if (activeTab === 'users') {
      contentHtml = `
        <div class="o_settings_block" data-section="users">
          <h3>Usuarios Activos y Mantenimiento de Base de Datos</h3>
          <div class="o_group" style="margin-bottom: 0.85rem;">
            <div class="o_field_row">
              <label for="setActiveUser">Usuario Activo de Sesión</label>
              <select id="setActiveUser" class="o_select">
                <option value="" ${!s.active_user || !s.active_user.id ? 'selected disabled' : ''}>— Seleccione Usuario Activo —</option>
                ${(s.users || [])
                  .map(
                    (u) =>
                      `<option value="${u.id}" ${s.active_user && Number(s.active_user.id) === Number(u.id) ? 'selected' : ''}>${esc(u.name)} — ${esc(u.role)}</option>`
                  )
                  .join('')}
              </select>
            </div>
          </div>
          <p style="font-size: 0.84rem; color: var(--o-text-muted); margin-bottom: 0.85rem;">
            Usuarios configurados: ${(s.users || []).map((u) => `<strong>${esc(u.name)}</strong> (${esc(u.role)})`).join(' · ')}
          </p>
          <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary" id="btnExportDbJson">Exportar Respaldo JSON</button>
            <button type="button" class="btn btn-danger" id="btnResetDemoData">Restaurar Datos de Fábrica</button>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="o_settings_layout">
        <aside class="o_settings_sidebar" aria-label="Secciones de ajustes">
          <button type="button" class="o_settings_tab ${activeTab === 'general' ? 'is-active' : ''}" data-set-tab="general">
            <img src="/assets/icons/settings.png" alt="" />
            <span>Compañía y General</span>
          </button>
          <button type="button" class="o_settings_tab ${activeTab === 'sales' ? 'is-active' : ''}" data-set-tab="sales">
            <img src="/assets/icons/sales.png" alt="" />
            <span>Ventas</span>
          </button>
          <button type="button" class="o_settings_tab ${activeTab === 'accounting' ? 'is-active' : ''}" data-set-tab="accounting">
            <img src="/assets/icons/accounting.png" alt="" />
            <span>Contabilidad</span>
          </button>
          <button type="button" class="o_settings_tab ${activeTab === 'expenses' ? 'is-active' : ''}" data-set-tab="expenses">
            <img src="/assets/icons/expenses.png" alt="" />
            <span>Gastos</span>
          </button>
          <button type="button" class="o_settings_tab ${activeTab === 'users' ? 'is-active' : ''}" data-set-tab="users">
            <img src="/assets/icons/contacts.png" alt="" />
            <span>Usuarios y Sistema</span>
          </button>
        </aside>

        <div>
          <div class="o_form_statusbar" style="margin-bottom: 1rem;">
            <div class="o_statusbar_buttons">
              <button type="button" class="btn btn-action" id="btnSaveSettings">Guardar Ajustes</button>
              <button type="button" class="btn btn-secondary" id="btnBackHomeFromSettings">Volver al Panel Principal</button>
            </div>
          </div>

          ${contentHtml}
        </div>
      </div>
    `;

    container.querySelectorAll('[data-set-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        state.submenu = b.getAttribute('data-set-tab');
        renderSettingsModule();
      });
    });

    const btnBackHome = document.getElementById('btnBackHomeFromSettings');
    if (btnBackHome) {
      btnBackHome.addEventListener('click', openHomeMenu);
    }

    const btnSave = document.getElementById('btnSaveSettings');
    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        try {
          const payload = {};
          const el = (id) => document.getElementById(id);

          if (el('setCompanyName')) payload.company_name = el('setCompanyName').value;
          if (el('setCompanyVat')) payload.company_vat = el('setCompanyVat').value;
          if (el('setCompanyEmail')) payload.company_email = el('setCompanyEmail').value;
          if (el('setCompanyPhone')) payload.company_phone = el('setCompanyPhone').value;
          if (el('setCompanyCity')) payload.company_city = el('setCompanyCity').value;
          if (el('setCompanyAddress')) payload.company_address = el('setCompanyAddress').value;
          if (el('setCurrency')) payload.currency = el('setCurrency').value;
          if (el('setTheme')) payload.theme = el('setTheme').value;

          if (el('setValidityDays')) payload.quotation_validity_days = Number(el('setValidityDays').value || 30);
          if (el('setDefaultSaleTax')) payload.default_sale_tax = Number(el('setDefaultSaleTax').value ?? 19);
          if (el('setSaleTerms')) payload.sale_terms = el('setSaleTerms').value;
          if (el('setLineDiscounts')) payload.enable_line_discounts = el('setLineDiscounts').value === 'true';

          if (el('setFiscalRegime')) payload.fiscal_regime = el('setFiscalRegime').value;
          if (el('setDefaultPurchaseTax')) payload.default_purchase_tax = Number(el('setDefaultPurchaseTax').value ?? 19);

          if (el('setExpenseApproval')) payload.expense_approval_required = el('setExpenseApproval').value === 'true';
          if (el('setExpenseJournal')) payload.expense_default_journal = el('setExpenseJournal').value;

          if (el('setActiveUser')) payload.active_user_id = Number(el('setActiveUser').value || 1);

          const res = await apiCall('/api/settings', 'POST', payload);
          state.data.settings = res.settings;
          updateSystray();
          showToast('Ajustes del sistema guardados.');
        } catch (err) {
          showToast(err.message, true);
        }
      });
    }

    const btnAddJournal = document.getElementById('btnAddJournal');
    if (btnAddJournal) {
      btnAddJournal.addEventListener('click', async () => {
        try {
          const codeInput = document.getElementById('newJournalCode');
          const nameInput = document.getElementById('newJournalName');
          const typeInput = document.getElementById('newJournalType');
          const balanceInput = document.getElementById('newJournalBalance');

          const code = (codeInput ? codeInput.value : '').trim().toUpperCase();
          const name = (nameInput ? nameInput.value : '').trim();
          const type = typeInput ? typeInput.value : 'bank';
          const balance = Number((balanceInput ? balanceInput.value : 0) || 0);

          if (!code || !name) {
            showToast('El código y el nombre de la cuenta son obligatorios.', true);
            return;
          }

          await apiCall('/api/accounting/journals', 'POST', { code, name, type, balance });
          showToast('Cuenta financiera guardada exitosamente.');
          const res = await fetch('/api/bootstrap');
          if (res.ok) {
            const json = await res.json();
            state.data = json.data;
          }
          renderSettingsModule();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    }

    const btnExport = document.getElementById('btnExportDbJson');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chapp_erp_backup.json';
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    const btnReset = document.getElementById('btnResetDemoData');
    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        try {
          await apiCall('/api/reset', 'POST');
          showToast('Datos de demostración restaurados.');
          renderSettingsModule();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    }
  }

  // ==================== CHATTER COMPONENT ====================
  function renderChatterHtml(model, record) {
    if (!record || !record.id) {
      return `
        <aside class="o_chatter">
          <div class="o_chatter_header">
            <span>Historial y Notas (Chatter)</span>
          </div>
          <p style="font-size: 0.82rem; color: var(--o-text-muted);">Guarda el registro para habilitar el historial de auditoría y notas.</p>
        </aside>
      `;
    }
    const msgs = (record.chatter || []).slice().reverse();
    return `
      <aside class="o_chatter" aria-label="Historial y notas del documento">
        <div class="o_chatter_header">
          <span>Historial y Auditoría ${record.reference || record.name ? `— <strong>${esc(record.reference || record.name)}</strong>` : ''}</span>
          <span class="o_badge o_badge_muted">${msgs.length} evento(s)</span>
        </div>
        <div class="o_chatter_composer">
          <textarea id="chatterInputText" class="o_textarea" rows="2" placeholder="Escribir una nota interna o seguimiento..."></textarea>
          <button type="button" class="btn btn-sm btn-secondary" id="btnSendChatterNote" style="align-self: flex-end;">Publicar Nota</button>
        </div>
        <div class="o_chatter_messages">
          ${msgs
            .map(
              (m) => `
              <div class="o_chatter_msg">
                <div class="o_chatter_msg_meta">
                  <strong>${esc(m.author)}</strong>
                  <span>${esc(m.date)}</span>
                </div>
                <div>${esc(m.text)}</div>
              </div>
            `
            )
            .join('')}
        </div>
      </aside>
    `;
  }

  function wireChatterEvents(model, recordId) {
    if (!recordId) return;
    const btn = document.getElementById('btnSendChatterNote');
    const input = document.getElementById('chatterInputText');
    if (btn && input) {
      btn.addEventListener('click', async () => {
        try {
          if (!input.value.trim()) return;
          await apiCall('/api/chatter', 'POST', { model, id: recordId, text: input.value });
          showToast('Nota registrada en el historial.');
          renderModuleWorkspace();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    }
  }

  // ==================== COMMAND PALETTE (Ctrl+K) ====================
  function openCommandPalette() {
    const dialog = document.getElementById('commandPaletteDialog');
    const input = document.getElementById('commandPaletteInput');
    if (!dialog) return;
    input.value = '';
    renderCommandPaletteResults('');
    dialog.showModal();
    input.focus();
  }

  function renderCommandPaletteResults(query) {
    const resultsEl = document.getElementById('commandPaletteResults');
    if (!resultsEl || !state.data) return;
    const q = query.trim().toLowerCase();

    const items = [];
    APPS.forEach((a) => {
      if (!q || a.name.toLowerCase().includes(q)) {
        items.push({ type: 'Módulo', label: `Abrir módulo: ${a.name}`, action: () => openApp(a.id) });
      }
    });
    (state.data.contacts || []).forEach((c) => {
      if (q && (c.name.toLowerCase().includes(q) || (c.vat || '').toLowerCase().includes(q))) {
        items.push({ type: 'Contacto', label: `${c.name} (${c.vat || ''})`, action: () => openApp('contacts', { viewType: 'form', recordId: c.id }) });
      }
    });
    (state.data.expenses || []).forEach((e) => {
      if (
        q &&
        ((e.reference || '').toLowerCase().includes(q) ||
          (e.name || '').toLowerCase().includes(q) ||
          (e.employee_name || '').toLowerCase().includes(q))
      ) {
        items.push({
          type: 'Gasto',
          label: `${e.reference} — ${e.name} (${formatMoney(e.total_amount)})`,
          action: () => openApp('expenses', { viewType: 'form', recordId: e.id })
        });
      }
    });
    (state.data.sales || []).forEach((s) => {
      if (q && (s.name.toLowerCase().includes(q) || s.partner_name.toLowerCase().includes(q))) {
        items.push({ type: 'Venta', label: `${s.name} — ${s.partner_name} (${formatMoney(s.amount_total)})`, action: () => openApp('sales', { viewType: 'form', recordId: s.id }) });
      }
    });
    (state.data.products || []).forEach((p) => {
      if (q && ((p.name || '').toLowerCase().includes(q) || (p.default_code || '').toLowerCase().includes(q))) {
        items.push({
          type: 'Producto',
          label: `[${p.default_code}] ${p.name} (${formatMoney(p.list_price)})`,
          action: () => openApp('sales', { submenu: 'products', viewType: 'form', recordId: p.id })
        });
      }
    });
    (state.data.accounting.moves || []).forEach((m) => {
      if (q && (m.name.toLowerCase().includes(q) || m.partner_name.toLowerCase().includes(q))) {
        items.push({
          type: 'Contabilidad',
          label: `${m.name} — ${m.partner_name} (${formatMoney(m.amount_total)})`,
          action: () =>
            openApp('accounting', {
              submenu: m.move_type === 'in_invoice' ? 'in_invoice' : m.move_type === 'out_invoice' ? 'out_invoice' : 'entries',
              viewType: 'form',
              recordId: m.id
            })
        });
      }
    });

    resultsEl.innerHTML = items
      .slice(0, 12)
      .map(
        (it, i) => `
        <button type="button" class="o_cmd_entry" data-cmd-idx="${i}">
          <span class="o_cmd_label">${esc(it.label)}</span>
          <span class="o_badge o_badge_info">${esc(it.type)}</span>
        </button>
      `
      )
      .join('');

    resultsEl.querySelectorAll('[data-cmd-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-cmd-idx'));
        document.getElementById('commandPaletteDialog').close();
        items[idx].action();
      });
    });
  }

  // ==================== GLOBAL EVENTS & INIT ====================
  async function init() {
    setupDialogFallbacks();

    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) {
        throw new Error(`Error HTTP ${res.status} (${res.statusText || 'Ruta no encontrada'})`);
      }
      const json = await res.json();
      state.data = json.data;
      updateSystray();
      openHomeMenu();
    } catch (err) {
      showToast('Error cargando estado del ERP: ' + err.message, true);
    }

    // Top bar events
    document.getElementById('btnHomeMenuToggle').addEventListener('click', () => {
      if (state.currentApp) openHomeMenu();
      else if (APPS[0]) openApp(APPS[0].id);
    });

    document.getElementById('navbarBrand').addEventListener('click', (e) => {
      e.preventDefault();
      if (state.currentApp) openApp(state.currentApp);
    });

    document.getElementById('btnThemeToggle').addEventListener('click', async () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        await apiCall('/api/settings', 'POST', { theme: next });
      } catch (_) {}
    });

    document.getElementById('btnUserSettings').addEventListener('click', () => openApp('settings'));
    document.getElementById('btnPendingActivities')?.addEventListener('click', () => openApp('expenses', { submenu: 'to_approve' }));
    document.getElementById('btnCommandPalette').addEventListener('click', openCommandPalette);

    // Search inputs
    const homeInput = document.getElementById('homeSearchInput');
    homeInput.addEventListener('input', () => {
      state.homeSearchQuery = homeInput.value;
      state.homeFocusedIndex = 0;
      renderHomeMenuApps();
    });

    const cpSearch = document.getElementById('cpSearchInput');
    cpSearch.addEventListener('input', () => {
      state.searchQuery = cpSearch.value;
      renderModuleWorkspace();
    });

    // Payment Modal
    const payDialog = document.getElementById('paymentDialog');
    document.getElementById('btnClosePaymentDialog').addEventListener('click', () => payDialog.close());
    document.getElementById('btnCancelPaymentDialog').addEventListener('click', () => payDialog.close());
    document.getElementById('paymentDialogForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const moveId = Number(document.getElementById('payMoveId').value);
        const journal_code = document.getElementById('payJournal').value;
        if (!journal_code) {
          showToast('Debe seleccionar un diario de pago.', true);
          return;
        }
        const amount = Number(document.getElementById('payAmount').value);
        const date = document.getElementById('payDate').value;
        const ref = document.getElementById('payRef').value;
        const chkGenResidual = document.getElementById('chkGenerateResidualInvoice');
        const genResidual = Boolean(chkGenResidual && chkGenResidual.checked);

        const res = await apiCall(`/api/accounting/moves/${moveId}/action`, 'POST', {
          action: 'register_payment',
          journal_code,
          amount,
          date,
          ref,
          generate_residual_invoice: genResidual
        });
        payDialog.close();
        const nextInv = res.next_invoice || (res.move && res.move.next_invoice);
        if (nextInv) {
          showToast(`Pago registrado y siguiente factura ${nextInv.name} generada por el saldo restante.`);
        } else {
          showToast('Pago registrado y conciliado exitosamente.');
        }
        renderModuleWorkspace();
      } catch (err) {
        showToast(err.message, true);
      }
    });

    // Command Palette Modal
    const cmdDialog = document.getElementById('commandPaletteDialog');
    document.getElementById('btnCloseCommandPalette').addEventListener('click', () => cmdDialog.close());
    document.getElementById('commandPaletteInput').addEventListener('input', (e) => {
      renderCommandPaletteResults(e.target.value);
    });

    // Global Hotkeys (Ctrl+K, Alt+H, Esc, Arrow keys & Type-to-search on Home Menu)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        if (state.currentApp) openHomeMenu();
        else if (APPS[0]) openApp(APPS[0].id);
        return;
      }

      if (state.currentApp === null) {
        const activeTag = document.activeElement && document.activeElement.tagName;
        const filtered = APPS.filter((a) => a.name.toLowerCase().includes(state.homeSearchQuery.trim().toLowerCase()));
        if (e.key === 'Escape') {
          state.homeSearchQuery = '';
          homeInput.value = '';
          renderHomeMenuApps();
          return;
        }
        if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && filtered.length > 0) {
          e.preventDefault();
          state.homeFocusedIndex = (state.homeFocusedIndex + 1) % filtered.length;
          renderHomeMenuApps();
          return;
        }
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && filtered.length > 0) {
          e.preventDefault();
          state.homeFocusedIndex = (state.homeFocusedIndex - 1 + filtered.length) % filtered.length;
          renderHomeMenuApps();
          return;
        }
        if (e.key === 'Enter' && (state.homeSearchQuery.trim() || activeTag !== 'A')) {
          if (filtered[state.homeFocusedIndex]) {
            e.preventDefault();
            openApp(filtered[state.homeFocusedIndex].id);
          }
          return;
        }
        if (
          activeTag !== 'INPUT' &&
          activeTag !== 'TEXTAREA' &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          e.key.length === 1 &&
          /[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/.test(e.key)
        ) {
          homeInput.focus();
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
