/* ==========================================================================
   CHapp ERP — Odoo 20 Webclient & Module Controller
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
      defaultView: 'kanban',
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
      submenus: [
        { id: 'all', label: 'Mis Gastos' },
        { id: 'to_approve', label: 'Por Aprobar' },
        { id: 'to_pay', label: 'Por Reembolsar' },
        { id: 'analysis', label: 'Análisis de Gastos' }
      ]
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
      defaultView: 'kanban',
      submenus: [
        { id: 'dashboard', label: 'Tablero' },
        { id: 'out_invoice', label: 'Facturas Clientes' },
        { id: 'in_invoice', label: 'Facturas Proveedores' },
        { id: 'payments', label: 'Pagos' },
        { id: 'entries', label: 'Asientos Contables' },
        { id: 'accounts', label: 'Plan de Cuentas' }
      ]
    },
    {
      id: 'settings',
      name: 'Ajustes',
      icon: '/assets/icons/settings.png',
      xmlid: 'base.menu_administration',
      defaultSubmenu: 'general',
      defaultView: 'form',
      submenus: [
        { id: 'general', label: 'Ajustes Generales' },
        { id: 'sales', label: 'Ventas' },
        { id: 'accounting', label: 'Contabilidad' },
        { id: 'expenses', label: 'Gastos' },
        { id: 'users', label: 'Usuarios y Sistema' }
      ]
    }
  ];

  const state = {
    data: null,
    currentApp: null, // null = Odoo 20 Home Menu
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
    const lbl = document.getElementById('themeIconLabel');
    if (lbl) lbl.textContent = t === 'dark' ? '🌙 Oscuro' : '☀️ Claro';
  }

  function updateSystray() {
    if (!state.data) return;
    const settings = state.data.settings || {};
    applyTheme(settings.theme || 'dark');

    const compEl = document.getElementById('systrayCompanyName');
    if (compEl) compEl.textContent = settings.company_name || 'CHapp ERP S.A.S.';

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

  function renderControlPanel() {
    const app = APPS.find((a) => a.id === state.currentApp);
    const sub = app.submenus.find((s) => s.id === state.submenu) || app.submenus[0];

    const actionBtns = document.getElementById('cpActionButtons');
    const breadcrumbs = document.getElementById('cpBreadcrumbs');
    const facets = document.getElementById('cpSearchFacets');
    const filterPills = document.getElementById('cpFilterPills');
    const switcher = document.getElementById('cpViewSwitcher');
    const searchContainer = document.getElementById('cpSearchContainer');

    // Action buttons
    if (state.viewType === 'form') {
      actionBtns.innerHTML = `
        <button type="button" class="btn btn-secondary" id="btnCpBackToList">← Volver</button>
        <button type="button" class="btn btn-primary" id="btnCpNewRecord">Nuevo</button>
      `;
    } else if (state.currentApp === 'accounting' && state.submenu === 'dashboard') {
      actionBtns.innerHTML = `
        <button type="button" class="btn btn-primary" id="btnQuickNewInvoice">+ Factura de Cliente</button>
        <button type="button" class="btn btn-secondary" id="btnQuickNewBill">+ Factura de Proveedor</button>
      `;
    } else if (state.currentApp === 'accounting' && state.submenu === 'payments') {
      actionBtns.innerHTML = `
        <button type="button" class="btn btn-primary" id="btnGoToInvoicesForPay">Registrar Pago en Factura</button>
      `;
    } else {
      actionBtns.innerHTML = `<button type="button" class="btn btn-primary" id="btnCpNewRecord">Nuevo</button>`;
    }

    // Breadcrumbs
    let crumbHtml = `<span class="o_breadcrumb_link" id="crumbRoot">${esc(app.name)}</span> <span>/</span> <span class="${state.viewType === 'form' ? 'o_breadcrumb_link' : ''}" id="crumbSub">${esc(sub.label)}</span>`;
    if (state.viewType === 'form') {
      const recLabel = state.activeRecordId === 'new' ? 'Nuevo' : `#${state.activeRecordId}`;
      crumbHtml += ` <span>/</span> <span>${esc(recLabel)}</span>`;
    }
    breadcrumbs.innerHTML = crumbHtml;

    // Facets (Partner context filter)
    if (state.partnerContextFilter) {
      facets.innerHTML = `
        <span class="o_search_facet">
          ${esc(state.partnerContextFilter.name)}
          <button type="button" id="btnClearPartnerFacet" title="Quitar filtro">✕</button>
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

    // Quick status pills per module
    if (state.viewType === 'form') {
      filterPills.innerHTML = '';
    } else if (state.currentApp === 'expenses') {
      const pills = [
        { id: 'all', label: 'Todos' },
        { id: 'draft', label: 'Borrador' },
        { id: 'submitted', label: 'Enviados' },
        { id: 'approved', label: 'Aprobados' },
        { id: 'posted', label: 'Publicados' },
        { id: 'paid', label: 'Pagados' }
      ];
      filterPills.innerHTML = pills
        .map((p) => `<button type="button" class="o_filter_pill ${state.statusFilter === p.id ? 'is-active' : ''}" data-pill="${p.id}">${p.label}</button>`)
        .join('');
    } else if (state.currentApp === 'sales' && state.submenu !== 'products') {
      const pills = [
        { id: 'all', label: 'Todos' },
        { id: 'draft', label: 'Cotización' },
        { id: 'sent', label: 'Enviada' },
        { id: 'sale', label: 'Pedido de Venta' }
      ];
      filterPills.innerHTML = pills
        .map((p) => `<button type="button" class="o_filter_pill ${state.statusFilter === p.id ? 'is-active' : ''}" data-pill="${p.id}">${p.label}</button>`)
        .join('');
    } else {
      filterPills.innerHTML = '';
    }

    filterPills.querySelectorAll('.o_filter_pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.statusFilter = btn.getAttribute('data-pill');
        renderModuleWorkspace();
      });
    });

    // View Switcher (Kanban / List)
    if (state.currentApp === 'accounting' && state.submenu === 'dashboard') {
      switcher.innerHTML = '';
    } else {
      switcher.innerHTML = `
        <button type="button" class="o_switch_btn ${state.viewType === 'list' ? 'is-active' : ''}" data-view="list" title="Vista Lista">
          ☰ Lista
        </button>
        <button type="button" class="o_switch_btn ${state.viewType === 'kanban' ? 'is-active' : ''}" data-view="kanban" title="Vista Kanban">
          ⊞ Kanban
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
        state.activeRecordId = null;
        state.viewType = app.defaultView;
        renderModuleWorkspace();
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
      container.innerHTML =
        bannerHtml +
        `<div class="o_kanban_view">
          ${contacts
            .map(
              (c) => `
              <article class="o_kanban_record" data-contact-id="${c.id}">
                <div class="o_kanban_avatar">${esc(initials(c.name))}</div>
                <div class="o_kanban_details">
                  <div style="display: flex; justify-content: space-between; gap: 0.4rem;">
                    <span class="o_kanban_title">${esc(c.name)}</span>
                    <span class="o_badge ${c.is_company ? 'o_badge_info' : 'o_badge_muted'}">${c.is_company ? 'Compañía' : 'Individual'}</span>
                  </div>
                  <div class="o_kanban_subtitle">${esc(c.function || '')} ${c.vat ? '· NIT/CC: ' + esc(c.vat) : ''}</div>
                  <div class="o_kanban_subtitle">📍 ${esc(c.city || 'Bogotá')}, ${esc(c.country || 'Colombia')}</div>
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
                    <td>${esc(c.vat || '—')}</td>
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

  function renderContactForm(container) {
    const isNew = state.activeRecordId === 'new';
    const existing = isNew
      ? {
          name: '',
          is_company: true,
          company_name: '',
          vat: '',
          function: 'Cliente Corporativo',
          street: '',
          city: 'Bogotá D.C.',
          state_name: 'Cundinamarca',
          country: 'Colombia',
          email: '',
          phone: '',
          mobile: '',
          website: '',
          customer_rank: 1,
          supplier_rank: 0,
          category_ids: ['Cliente'],
          payment_term: '30 Días',
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
      state.viewType = 'kanban';
      return renderModuleWorkspace();
    }

    container.innerHTML = `
      <div class="o_form_view">
        <div class="o_form_sheet_bg">
          <div class="o_form_statusbar">
            <div class="o_statusbar_buttons">
              <button type="button" class="btn btn-action" id="btnSaveContact">💾 Guardar Contacto</button>
              ${
                !isNew
                  ? `<button type="button" class="btn btn-secondary" id="btnNewSaleFromContact">+ Nueva Cotización</button>
                     <button type="button" class="btn btn-danger btn-sm" id="btnDeleteContact">Eliminar</button>`
                  : ''
              }
            </div>
            <div class="o_statusbar_status">
              <span class="o_arrow_button is-current">${existing.is_company ? 'Compañía' : 'Persona Individual'}</span>
            </div>
          </div>

          <form id="contactForm" class="o_form_sheet">
            ${
              !isNew
                ? `
              <div class="o_button_box">
                <button type="button" class="o_stat_button" id="btnSmartSales">
                  <span>🛒</span>
                  <div class="o_stat_info">
                    <span class="o_stat_value">${existing.sales_count || 0} Ventas</span>
                    <span class="o_stat_text">${formatMoney(existing.sales_total || 0)}</span>
                  </div>
                </button>
                <button type="button" class="o_stat_button" id="btnSmartInvoices">
                  <span>🧾</span>
                  <div class="o_stat_info">
                    <span class="o_stat_value">${existing.invoices_count || 0} Facturas</span>
                    <span class="o_stat_text">${formatMoney(existing.invoiced_total || 0)}</span>
                  </div>
                </button>
                <button type="button" class="o_stat_button" id="btnSmartExpenses">
                  <span>💼</span>
                  <div class="o_stat_info">
                    <span class="o_stat_value">${existing.expenses_count || 0} Gastos</span>
                    <span class="o_stat_text">Asociados</span>
                  </div>
                </button>
              </div>
            `
                : ''
            }

            <div style="display: flex; gap: 1.25rem; margin-bottom: 0.75rem;">
              <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                <input type="radio" name="is_company" value="true" ${existing.is_company ? 'checked' : ''} />
                <span>Compañía</span>
              </label>
              <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                <input type="radio" name="is_company" value="false" ${!existing.is_company ? 'checked' : ''} />
                <span>Individual</span>
              </label>
            </div>

            <div class="o_form_title_group">
              <label for="fContactName">Nombre o Razón Social *</label>
              <input type="text" id="fContactName" class="o_input_title" value="${esc(existing.name)}" placeholder="Ej. Grupo Empresarial Andino S.A.S." required />
            </div>

            <div class="o_group">
              <div class="o_field_row">
                <label for="fContactVat">NIT / Documento de Identidad</label>
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
                <label for="fContactWebsite">Sitio Web</label>
                <input type="text" id="fContactWebsite" class="o_input" value="${esc(existing.website)}" placeholder="https://..." />
              </div>
              <div class="o_field_row">
                <label for="fContactStreet">Dirección Fiscal</label>
                <input type="text" id="fContactStreet" class="o_input" value="${esc(existing.street)}" />
              </div>
              <div class="o_field_row">
                <label for="fContactCity">Ciudad</label>
                <input type="text" id="fContactCity" class="o_input" value="${esc(existing.city)}" />
              </div>
              <div class="o_field_row">
                <label for="fContactPaymentTerm">Plazo de Pago Predeterminado</label>
                <select id="fContactPaymentTerm" class="o_select">
                  ${['Contado', '15 Días', '30 Días', '45 Días', '60 Días']
                    .map((t) => `<option value="${t}" ${existing.payment_term === t ? 'selected' : ''}>${t}</option>`)
                    .join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fContactTags">Etiquetas (separadas por coma)</label>
                <input type="text" id="fContactTags" class="o_input" value="${esc((existing.category_ids || []).join(', '))}" placeholder="VIP, Cliente, Proveedor" />
              </div>
              <div class="o_field_row">
                <label for="fCustomerRank">Clasificación Cliente (0 = No, 1-3 = Sí)</label>
                <input type="number" id="fCustomerRank" class="o_input" min="0" max="10" value="${Number(existing.customer_rank || 0)}" />
              </div>
              <div class="o_field_row">
                <label for="fSupplierRank">Clasificación Proveedor (0 = No, 1-3 = Sí)</label>
                <input type="number" id="fSupplierRank" class="o_input" min="0" max="10" value="${Number(existing.supplier_rank || 0)}" />
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

    document.getElementById('btnSaveContact').addEventListener('click', async () => {
      try {
        const isComp = document.querySelector('input[name="is_company"]:checked').value === 'true';
        const payload = {
          id: isNew ? undefined : existing.id,
          name: document.getElementById('fContactName').value,
          is_company: isComp,
          vat: document.getElementById('fContactVat').value,
          function: document.getElementById('fContactFunction').value,
          email: document.getElementById('fContactEmail').value,
          phone: document.getElementById('fContactPhone').value,
          mobile: document.getElementById('fContactMobile').value,
          website: document.getElementById('fContactWebsite').value,
          street: document.getElementById('fContactStreet').value,
          city: document.getElementById('fContactCity').value,
          payment_term: document.getElementById('fContactPaymentTerm').value,
          category_ids: document.getElementById('fContactTags').value,
          customer_rank: Number(document.getElementById('fCustomerRank').value || 0),
          supplier_rank: Number(document.getElementById('fSupplierRank').value || 0),
          notes: document.getElementById('fContactNotes').value
        };
        const res = await apiCall('/api/contacts', 'POST', payload);
        state.activeRecordId = res.contact.id;
        showToast('Contacto guardado correctamente.');
        renderModuleWorkspace();
      } catch (err) {
        showToast(err.message, true);
      }
    });

    const delBtn = document.getElementById('btnDeleteContact');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        try {
          await apiCall(`/api/contacts/${existing.id}`, 'DELETE');
          showToast('Contacto eliminado.');
          state.activeRecordId = null;
          state.viewType = 'kanban';
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
        openApp('sales', { submenu: 'all', viewType: 'form', recordId: 'new' });
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

    const kpis = state.data.kpis || {};
    const statusHeader = `
      <div class="o_dashboard_banner">
        <div class="o_stat_card" data-exp-filter="draft">
          <span class="o_stat_label">Por Enviar</span>
          <span class="o_stat_value">${formatMoney(kpis.expenses_draft_total || 0)}</span>
          <span class="o_stat_sub">Gastos en borrador</span>
        </div>
        <div class="o_stat_card" data-exp-filter="submitted">
          <span class="o_stat_label">Esperando Aprobación</span>
          <span class="o_stat_value">${formatMoney(kpis.expenses_submitted_total || 0)}</span>
          <span class="o_stat_sub">Enviados al gerente</span>
        </div>
        <div class="o_stat_card" data-exp-filter="approved">
          <span class="o_stat_label">Por Contabilizar</span>
          <span class="o_stat_value">${formatMoney(kpis.expenses_approved_total || 0)}</span>
          <span class="o_stat_sub">Aprobados listos para asiento</span>
        </div>
        <div class="o_stat_card" data-exp-filter="posted">
          <span class="o_stat_label">Por Reembolsar</span>
          <span class="o_stat_value">${formatMoney(kpis.expenses_reimburse_total || 0)}</span>
          <span class="o_stat_sub">Asiento publicado</span>
        </div>
        <div class="o_stat_card" data-exp-filter="paid">
          <span class="o_stat_label">Pagados / Legalizados</span>
          <span class="o_stat_value">${formatMoney(kpis.expenses_paid_total || 0)}</span>
          <span class="o_stat_sub">Flujo completado</span>
        </div>
      </div>
    `;

    if (state.submenu === 'analysis') {
      const byDept = {};
      expenses.forEach((e) => {
        const d = e.department || 'General';
        byDept[d] = (byDept[d] || 0) + Number(e.total_amount || 0);
      });
      container.innerHTML =
        statusHeader +
        `
        <div class="o_form_sheet">
          <h3 style="margin-bottom: 1rem;">📊 Análisis de Gastos por Departamento y Categoría</h3>
          <div class="o_kanban_view">
            ${Object.entries(byDept)
              .map(
                ([dept, total]) => `
                <div class="o_stat_card">
                  <span class="o_stat_label">${esc(dept)}</span>
                  <span class="o_stat_value">${formatMoney(total)}</span>
                  <span class="o_stat_sub">Ejecución acumulada</span>
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      `;
    } else if (state.viewType === 'kanban') {
      container.innerHTML =
        statusHeader +
        `<div class="o_kanban_view">
          ${expenses
            .map(
              (e) => `
              <article class="o_kanban_record" data-expense-id="${e.id}">
                <div class="o_kanban_avatar">${esc(initials(e.employee_name))}</div>
                <div class="o_kanban_details">
                  <div style="display: flex; justify-content: space-between; gap: 0.4rem;">
                    <span class="o_kanban_title">${esc(e.name)}</span>
                    ${expenseBadge(e.state)}
                  </div>
                  <div class="o_kanban_subtitle">${esc(e.reference)} · ${esc(e.employee_name)} (${esc(e.department)})</div>
                  <div class="o_kanban_subtitle">📅 ${esc(e.date)} · ${esc(e.product_name)}</div>
                  <div class="o_kanban_footer">
                    <span>${e.payment_mode === 'company_account' ? '💳 Pagado por Compañía' : '👤 Empleado (a reembolsar)'}</span>
                    <strong>${formatMoney(e.total_amount)}</strong>
                  </div>
                </div>
              </article>
            `
            )
            .join('')}
        </div>`;

      container.querySelectorAll('.o_kanban_record').forEach((card) => {
        card.addEventListener('click', () => {
          state.activeRecordId = Number(card.getAttribute('data-expense-id'));
          state.viewType = 'form';
          renderModuleWorkspace();
        });
      });
    } else {
      const totalSum = expenses.reduce((s, e) => s + Number(e.total_amount || 0), 0);
      container.innerHTML =
        statusHeader +
        `
        <div tabindex="0" role="region" aria-labelledby="expenses-table-caption" class="table-wrapper">
          <table class="o_list_table" style="--label-2: 'Descripción'; --label-3: 'Empleado'; --label-4: 'Fecha'; --label-5: 'Pagado por'; --label-6: 'Total'; --label-7: 'Estado';">
            <caption id="expenses-table-caption">Listado de gastos de empleados Odoo 20</caption>
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Descripción del Gasto</th>
                <th>Empleado</th>
                <th>Fecha</th>
                <th>Pagado Por</th>
                <th class="text-end">Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${expenses
                .map(
                  (e) => `
                  <tr data-expense-id="${e.id}">
                    <th>${esc(e.reference)}</th>
                    <td>${esc(e.name)}</td>
                    <td>${esc(e.employee_name)}</td>
                    <td>${esc(e.date)}</td>
                    <td>${e.payment_mode === 'company_account' ? 'Compañía' : 'Empleado (a reembolsar)'}</td>
                    <td class="text-end"><strong>${formatMoney(e.total_amount)}</strong></td>
                    <td>${expenseBadge(e.state)}</td>
                  </tr>
                `
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5">Total Gastos Listados</td>
                <td class="text-end">${formatMoney(totalSum)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;

      container.querySelectorAll('tbody tr').forEach((row) => {
        row.addEventListener('click', () => {
          state.activeRecordId = Number(row.getAttribute('data-expense-id'));
          state.viewType = 'form';
          renderModuleWorkspace();
        });
      });
    }

    container.querySelectorAll('[data-exp-filter]').forEach((card) => {
      card.addEventListener('click', () => {
        const f = card.getAttribute('data-exp-filter');
        state.statusFilter = state.statusFilter === f ? 'all' : f;
        renderModuleWorkspace();
      });
    });
  }

  function renderExpenseForm(container) {
    const isNew = state.activeRecordId === 'new';
    const existing = isNew
      ? {
          reference: 'Nuevo',
          name: '',
          employee_name: (state.data.settings.active_user && state.data.settings.active_user.name) || 'Andrés Salazar',
          department: 'Operaciones & Proyectos',
          product_id: 4,
          product_name: 'Viáticos y Alojamiento Corporativo',
          date: new Date().toISOString().slice(0, 10),
          payment_mode: 'own_account',
          quantity: 1,
          price_unit: 250000,
          tax_rate: 19,
          untaxed_amount: 250000,
          tax_amount: 47500,
          total_amount: 297500,
          partner_id: 6,
          analytic_account: 'General',
          receipt_ref: '',
          notes: '',
          state: 'draft',
          move_id: null,
          chatter: []
        }
      : (state.data.expenses || []).find((e) => Number(e.id) === Number(state.activeRecordId));

    if (!existing) {
      state.viewType = 'list';
      return renderModuleWorkspace();
    }

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
          <div class="o_form_statusbar">
            <div class="o_statusbar_buttons">
              <button type="button" class="btn btn-primary" id="btnSaveExpense">💾 Guardar</button>
              ${
                !isNew && existing.state === 'draft'
                  ? `<button type="button" class="btn btn-action" data-exp-action="submit">Enviar al Gerente</button>`
                  : ''
              }
              ${
                !isNew && existing.state === 'submitted'
                  ? `<button type="button" class="btn btn-action" data-exp-action="approve">✓ Aprobar Gasto</button>
                     <button type="button" class="btn btn-danger" data-exp-action="refuse">✕ Rechazar</button>`
                  : ''
              }
              ${
                !isNew && existing.state === 'approved'
                  ? `<button type="button" class="btn btn-action" data-exp-action="post">📘 Publicar Asiento Contable</button>`
                  : ''
              }
              ${
                !isNew && existing.state === 'posted'
                  ? `<button type="button" class="btn btn-action" data-exp-action="pay">💳 Registrar Reembolso / Pago</button>`
                  : ''
              }
              ${
                !isNew && existing.state !== 'draft' && existing.state !== 'paid'
                  ? `<button type="button" class="btn btn-secondary" data-exp-action="reset">Restablecer a Borrador</button>`
                  : ''
              }
            </div>
            <div class="o_statusbar_status">
              ${stages
                .map((s) => `<span class="o_arrow_button ${existing.state === s.id ? 'is-current' : ''}">${s.label}</span>`)
                .join('')}
            </div>
          </div>

          <form id="expenseForm" class="o_form_sheet">
            ${
              !isNew && existing.move_id
                ? `
              <div class="o_button_box">
                <button type="button" class="o_stat_button" id="btnOpenExpenseMove">
                  <span>📘</span>
                  <div class="o_stat_info">
                    <span class="o_stat_value">Asiento Contable</span>
                    <span class="o_stat_text">Ver en Contabilidad</span>
                  </div>
                </button>
              </div>
            `
                : ''
            }

            <div class="o_form_title_group">
              <label for="fExpName">Descripción del Gasto (${esc(existing.reference)}) *</label>
              <input type="text" id="fExpName" class="o_input_title" value="${esc(existing.name)}" placeholder="Ej. Tiquetes y hotel visita cliente..." required />
            </div>

            <div class="o_group">
              <div class="o_field_row">
                <label for="fExpEmployee">Empleado</label>
                <input type="text" id="fExpEmployee" class="o_input" value="${esc(existing.employee_name)}" />
              </div>
              <div class="o_field_row">
                <label for="fExpDept">Departamento</label>
                <input type="text" id="fExpDept" class="o_input" value="${esc(existing.department)}" />
              </div>
              <div class="o_field_row">
                <label for="fExpProduct">Categoría de Gasto</label>
                <select id="fExpProduct" class="o_select">
                  ${(state.data.products || [])
                    .map(
                      (p) =>
                        `<option value="${p.id}" ${Number(existing.product_id) === Number(p.id) ? 'selected' : ''}>${esc(p.name)} (${formatMoney(p.list_price)})</option>`
                    )
                    .join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fExpPartner">Proveedor / Comercio</label>
                <select id="fExpPartner" class="o_select">
                  <option value="">— Seleccionar Proveedor —</option>
                  ${(state.data.contacts || [])
                    .map(
                      (c) => `<option value="${c.id}" ${Number(existing.partner_id) === Number(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`
                    )
                    .join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fExpDate">Fecha del Gasto</label>
                <input type="date" id="fExpDate" class="o_input" value="${esc(existing.date)}" />
              </div>
              <div class="o_field_row">
                <label for="fExpReceipt">Factura / Recibo Soporte</label>
                <input type="text" id="fExpReceipt" class="o_input" value="${esc(existing.receipt_ref)}" placeholder="Ej. FAC-9012" />
              </div>
              <div class="o_field_row">
                <label for="fExpQty">Cantidad</label>
                <input type="number" id="fExpQty" class="o_input" min="1" step="any" value="${Number(existing.quantity || 1)}" />
              </div>
              <div class="o_field_row">
                <label for="fExpPrice">Valor Unitario (sin IVA)</label>
                <input type="number" id="fExpPrice" class="o_input" min="0" step="any" value="${Number(existing.price_unit || 0)}" />
              </div>
              <div class="o_field_row">
                <label for="fExpTax">Impuesto IVA (%)</label>
                <select id="fExpTax" class="o_select">
                  ${[0, 5, 19]
                    .map((t) => `<option value="${t}" ${Number(existing.tax_rate) === t ? 'selected' : ''}>IVA ${t}%</option>`)
                    .join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fExpPayMode">Pagado Por</label>
                <select id="fExpPayMode" class="o_select">
                  <option value="own_account" ${existing.payment_mode === 'own_account' ? 'selected' : ''}>Empleado (a reembolsar)</option>
                  <option value="company_account" ${existing.payment_mode === 'company_account' ? 'selected' : ''}>Compañía (Tarjeta / Caja)</option>
                </select>
              </div>
            </div>

            <div class="o_field_row">
              <label for="fExpNotes">Notas y Justificación</label>
              <textarea id="fExpNotes" class="o_textarea" rows="2">${esc(existing.notes)}</textarea>
            </div>

            <div class="o_totals_box">
              <div class="o_totals_row">
                <span>Subtotal Base:</span>
                <strong id="expCalcUntaxed">${formatMoney(existing.untaxed_amount)}</strong>
              </div>
              <div class="o_totals_row">
                <span>Impuestos:</span>
                <strong id="expCalcTax">${formatMoney(existing.tax_amount)}</strong>
              </div>
              <div class="o_totals_row is-grand">
                <span>Total Gasto:</span>
                <span id="expCalcTotal">${formatMoney(existing.total_amount)}</span>
              </div>
            </div>
          </form>
        </div>

        ${renderChatterHtml('expenses', existing)}
      </div>
    `;

    wireChatterEvents('expenses', existing.id);

    const recalc = () => {
      const q = Number(document.getElementById('fExpQty').value || 0);
      const p = Number(document.getElementById('fExpPrice').value || 0);
      const tx = Number(document.getElementById('fExpTax').value || 0);
      const u = q * p;
      const t = u * (tx / 100);
      document.getElementById('expCalcUntaxed').textContent = formatMoney(u);
      document.getElementById('expCalcTax').textContent = formatMoney(t);
      document.getElementById('expCalcTotal').textContent = formatMoney(u + t);
    };
    ['fExpQty', 'fExpPrice', 'fExpTax'].forEach((id) => {
      document.getElementById(id).addEventListener('input', recalc);
    });

    document.getElementById('btnSaveExpense').addEventListener('click', async () => {
      try {
        const payload = {
          id: isNew ? undefined : existing.id,
          name: document.getElementById('fExpName').value,
          employee_name: document.getElementById('fExpEmployee').value,
          department: document.getElementById('fExpDept').value,
          product_id: Number(document.getElementById('fExpProduct').value),
          partner_id: Number(document.getElementById('fExpPartner').value) || null,
          date: document.getElementById('fExpDate').value,
          receipt_ref: document.getElementById('fExpReceipt').value,
          quantity: Number(document.getElementById('fExpQty').value),
          price_unit: Number(document.getElementById('fExpPrice').value),
          tax_rate: Number(document.getElementById('fExpTax').value),
          payment_mode: document.getElementById('fExpPayMode').value,
          notes: document.getElementById('fExpNotes').value
        };
        const res = await apiCall('/api/expenses', 'POST', payload);
        state.activeRecordId = res.expense.id;
        showToast('Gasto guardado.');
        renderModuleWorkspace();
      } catch (err) {
        showToast(err.message, true);
      }
    });

    container.querySelectorAll('[data-exp-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-exp-action');
        try {
          await apiCall(`/api/expenses/${existing.id}/action`, 'POST', { action });
          showToast('Estado del gasto actualizado.');
          renderModuleWorkspace();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    });

    const openMoveBtn = document.getElementById('btnOpenExpenseMove');
    if (openMoveBtn) {
      openMoveBtn.addEventListener('click', () => {
        openApp('accounting', { submenu: 'entries', viewType: 'form', recordId: existing.move_id });
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
      renderProductsSubmodule(container);
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
      container.innerHTML =
        bannerHtml +
        `<div class="o_kanban_view">
          ${sales
            .map(
              (s) => `
              <article class="o_kanban_record" data-sale-id="${s.id}">
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
            <caption id="sales-table-caption">Cotizaciones y Pedidos de Venta Odoo 20</caption>
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
        renderSubmenus(APPS.find((a) => a.id === 'sales'));
        renderModuleWorkspace();
      });
    });
  }

  function renderSaleOrderForm(container) {
    const isNew = state.activeRecordId === 'new';
    const defaultProd = (state.data.products || [])[0] || { id: 1, name: 'Servicio', list_price: 1000000, tax_rate: 19 };
    const existing = isNew
      ? {
          name: 'Nueva Cotización',
          partner_id: (state.formDraft && state.formDraft.partner_id) || ((state.data.contacts || [])[0] && state.data.contacts[0].id) || 1,
          date_order: new Date().toISOString().slice(0, 10),
          validity_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          salesperson: (state.data.settings.active_user && state.data.settings.active_user.name) || 'Laura Gómez',
          payment_term: '30 Días',
          state: 'draft',
          invoice_status: 'no',
          lines: [
            {
              id: 1,
              product_id: defaultProd.id,
              product_name: defaultProd.name,
              description: defaultProd.name,
              quantity: 1,
              price_unit: defaultProd.list_price,
              discount: 0,
              tax_rate: defaultProd.tax_rate,
              subtotal: defaultProd.list_price,
              tax_amount: Math.round(defaultProd.list_price * (defaultProd.tax_rate / 100)),
              total: Math.round(defaultProd.list_price * (1 + defaultProd.tax_rate / 100))
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
        partner_id: (state.formDraft && state.formDraft.partner_id) || existing.partner_id,
        payment_term: existing.payment_term || '30 Días',
        date_order: existing.date_order,
        validity_date: existing.validity_date,
        salesperson: existing.salesperson,
        notes: existing.notes || '',
        lines: JSON.parse(JSON.stringify(existing.lines || []))
      };
    }

    const draft = state.formDraft;
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

    container.innerHTML = `
      <div class="o_form_view">
        <div class="o_form_sheet_bg">
          <div class="o_form_statusbar">
            <div class="o_statusbar_buttons">
              <button type="button" class="btn btn-primary" id="btnSaveSaleOrder">💾 Guardar</button>
              ${
                !isNew && existing.state === 'draft'
                  ? `<button type="button" class="btn btn-secondary" data-sale-action="send">✉️ Marcar como Enviada</button>`
                  : ''
              }
              ${
                !isNew && (existing.state === 'draft' || existing.state === 'sent')
                  ? `<button type="button" class="btn btn-action" data-sale-action="confirm">✓ Confirmar Pedido</button>`
                  : ''
              }
              ${
                !isNew && existing.state === 'sale' && existing.invoice_status !== 'invoiced'
                  ? `<button type="button" class="btn btn-action" data-sale-action="create_invoice">🧾 Crear Factura</button>`
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
                ? `
              <div class="o_button_box">
                <button type="button" class="o_stat_button" id="btnOpenSaleInvoice">
                  <span>🧾</span>
                  <div class="o_stat_info">
                    <span class="o_stat_value">${existing.invoice_ids.length} Factura(s)</span>
                    <span class="o_stat_text">Ver en Contabilidad</span>
                  </div>
                </button>
              </div>
            `
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
                  ${(state.data.contacts || [])
                    .map(
                      (c) => `<option value="${c.id}" ${Number(draft.partner_id) === Number(c.id) ? 'selected' : ''}>${esc(c.name)} (${esc(c.vat || 'Sin NIT')})</option>`
                    )
                    .join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fSalePaymentTerm">Plazos de Pago</label>
                <select id="fSalePaymentTerm" class="o_select">
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
                            ${[0, 5, 19]
                              .map((t) => `<option value="${t}" ${Number(l.tax_rate) === t ? 'selected' : ''}>${t}%</option>`)
                              .join('')}
                          </select>
                        </td>
                        <td class="text-end"><strong>${formatMoney(sub)}</strong></td>
                        <td><button type="button" class="btn btn-sm btn-danger btn-remove-line" data-idx="${idx}" title="Quitar línea">✕</button></td>
                      </tr>
                    `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>

            <button type="button" class="btn btn-secondary btn-sm" id="btnAddSaleLine">+ Agregar un producto / línea</button>

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
          </div>
        </div>

        ${renderChatterHtml('sales', existing)}
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
        line.tax_rate = Number(tr.querySelector('.line-tax').value || 0);
      });
    };

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
          state.formDraft.lines[idx].tax_rate = prod.tax_rate;
          renderSaleOrderForm(container);
        }
      });
    });

    container.querySelectorAll('.line-qty, .line-price, .line-disc, .line-tax').forEach((inp) => {
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
        product_id: defaultProd.id,
        product_name: defaultProd.name,
        description: defaultProd.name,
        quantity: 1,
        price_unit: defaultProd.list_price,
        discount: 0,
        tax_rate: defaultProd.tax_rate
      });
      renderSaleOrderForm(container);
    });

    const saveOrderNow = async () => {
      syncSaleDraft();
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
        try {
          await saveOrderNow();
          const res = await apiCall(`/api/sales/${state.activeRecordId}/action`, 'POST', { action });
          state.formDraft = null;
          if (action === 'create_invoice' && res.invoice) {
            showToast(`Factura ${res.invoice.name} creada en Contabilidad.`);
          } else {
            showToast('Estado del pedido actualizado.');
          }
          renderModuleWorkspace();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    });

    const openInvBtn = document.getElementById('btnOpenSaleInvoice');
    if (openInvBtn) {
      openInvBtn.addEventListener('click', () => {
        const invId = existing.invoice_ids[existing.invoice_ids.length - 1];
        openApp('accounting', { submenu: 'out_invoice', viewType: 'form', recordId: invId });
      });
    }
  }

  function renderProductsSubmodule(container) {
    const products = state.data.products || [];
    updatePager(products.length, products.length);

    container.innerHTML = `
      <div class="o_form_sheet" style="margin-bottom: 1rem;">
        <h3 style="margin-bottom: 0.75rem;">➕ Crear / Actualizar Producto o Servicio</h3>
        <div class="o_group" style="grid-template-columns: 2fr 1fr 1fr 1fr auto; align-items: end; margin-bottom: 0;">
          <div class="o_field_row">
            <label for="newProdName">Nombre del Producto / Servicio</label>
            <input type="text" id="newProdName" class="o_input" placeholder="Ej. Licencia Adicional Usuario ERP" />
          </div>
          <div class="o_field_row">
            <label for="newProdSku">Referencia / SKU</label>
            <input type="text" id="newProdSku" class="o_input" placeholder="Ej. LIC-001" />
          </div>
          <div class="o_field_row">
            <label for="newProdPrice">Precio Venta</label>
            <input type="number" id="newProdPrice" class="o_input" value="500000" min="0" />
          </div>
          <div class="o_field_row">
            <label for="newProdTax">IVA (%)</label>
            <select id="newProdTax" class="o_select">
              <option value="19">19%</option>
              <option value="5">5%</option>
              <option value="0">0%</option>
            </select>
          </div>
          <button type="button" class="btn btn-action" id="btnAddProductCatalog">Guardar Producto</button>
        </div>
      </div>

      <div tabindex="0" role="region" aria-labelledby="products-table-caption" class="table-wrapper">
        <table class="o_list_table" style="--label-2: 'SKU'; --label-3: 'Categoría'; --label-4: 'Precio Venta'; --label-5: 'Costo'; --label-6: 'IVA';">
          <caption id="products-table-caption">Catálogo de productos y servicios</caption>
          <thead>
            <tr>
              <th>Producto / Servicio</th>
              <th>Referencia SKU</th>
              <th>Categoría</th>
              <th class="text-end">Precio de Venta</th>
              <th class="text-end">Costo Estándar</th>
              <th>Impuesto</th>
            </tr>
          </thead>
          <tbody>
            ${products
              .map(
                (p) => `
                <tr>
                  <th>${esc(p.name)}</th>
                  <td>${esc(p.default_code)}</td>
                  <td>${esc(p.category)}</td>
                  <td class="text-end"><strong>${formatMoney(p.list_price)}</strong></td>
                  <td class="text-end">${formatMoney(p.standard_price)}</td>
                  <td><span class="o_badge o_badge_info">IVA ${Number(p.tax_rate)}%</span></td>
                </tr>
              `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('btnAddProductCatalog').addEventListener('click', async () => {
      try {
        const name = document.getElementById('newProdName').value;
        const default_code = document.getElementById('newProdSku').value;
        const list_price = Number(document.getElementById('newProdPrice').value || 0);
        const tax_rate = Number(document.getElementById('newProdTax').value || 19);
        await apiCall('/api/products', 'POST', { name, default_code, list_price, standard_price: Math.round(list_price * 0.4), tax_rate });
        showToast('Producto agregado al catálogo.');
        renderModuleWorkspace();
      } catch (err) {
        showToast(err.message, true);
      }
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

  function renderAccountingModule() {
    const container = document.getElementById('moduleContent');
    const acc = state.data.accounting || { moves: [], journals: [], accounts: [], payments: [] };
    const kpis = state.data.kpis || {};

    if (state.viewType === 'form' && state.submenu !== 'accounts' && state.submenu !== 'payments') {
      renderAccountMoveForm(container);
      return;
    }

    if (state.submenu === 'dashboard') {
      updatePager(acc.journals.length, acc.journals.length);
      const outUnpaid = acc.moves.filter((m) => m.move_type === 'out_invoice' && m.state === 'posted' && m.amount_residual > 0);
      const inUnpaid = acc.moves.filter((m) => m.move_type === 'in_invoice' && m.state === 'posted' && m.amount_residual > 0);
      const bnkJournal = (acc.journals || []).find((j) => j.code === 'BNK1') || { balance: 48500000 };
      const cshJournal = (acc.journals || []).find((j) => j.code === 'CSH1') || { balance: 4200000 };

      container.innerHTML = `
        <div class="o_dashboard_banner">
          <div class="o_stat_card">
            <span class="o_stat_label">Facturación Clientes Publicada</span>
            <span class="o_stat_value">${formatMoney(kpis.invoiced_revenue || 0)}</span>
            <span class="o_stat_sub">Ingresos operacionales causados</span>
          </div>
          <div class="o_stat_card">
            <span class="o_stat_label">Cartera por Cobrar (Clientes)</span>
            <span class="o_stat_value">${formatMoney(kpis.receivables_residual || 0)}</span>
            <span class="o_stat_sub">${outUnpaid.length} factura(s) pendiente(s) de cobro</span>
          </div>
          <div class="o_stat_card">
            <span class="o_stat_label">Cuentas por Pagar (Proveedores)</span>
            <span class="o_stat_value">${formatMoney(kpis.payables_residual || 0)}</span>
            <span class="o_stat_sub">${inUnpaid.length} factura(s) por pagar</span>
          </div>
        </div>

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

          <div class="o_journal_card is-bank">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="font-size: 1.05rem;">Banco Bancolombia Cta Cte (BNK1)</h3>
                <span class="o_badge o_badge_success">Banco</span>
              </div>
              <p style="font-size: 0.82rem; color: var(--o-text-muted); margin-top: 0.35rem;">
                Recaudos de clientes, pagos a proveedores y reembolsos (111005). Caja General (CSH1): ${formatMoney(cshJournal.balance)}.
              </p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 0.75rem; color: var(--o-text-muted);">Saldo en Libros (BNK1)</div>
                <strong style="font-size: 1.15rem;">${formatMoney(bnkJournal.balance)}</strong>
              </div>
              <button type="button" class="btn btn-sm btn-secondary" data-journal-action="payments">Ver Pagos</button>
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
          <h3 style="margin-bottom: 0.75rem;">➕ Agregar Cuenta al Plan Único de Cuentas (PUC)</h3>
          <div class="o_group" style="grid-template-columns: 1fr 2fr 1.5fr auto; align-items: end; margin-bottom: 0;">
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
                  <td>${paymentStateBadge(m.payment_state)}</td>
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
          partner_id: ((state.data.contacts || [])[0] && state.data.contacts[0].id) || 1,
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
        partner_id: existing.partner_id,
        ref: existing.ref || '',
        invoice_date: existing.invoice_date,
        invoice_date_due: existing.invoice_date_due,
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
    const calcResidual = isEditable ? calcTotal : Number(existing.amount_residual || 0);

    container.innerHTML = `
      <div class="o_form_view">
        <div class="o_form_sheet_bg">
          <div class="o_form_statusbar">
            <div class="o_statusbar_buttons">
              ${
                isEditable
                  ? `<button type="button" class="btn btn-primary" id="btnSaveDraftMove">💾 Guardar Borrador</button>
                     <button type="button" class="btn btn-action" id="btnSaveAndPostMove">✓ Confirmar y Publicar</button>`
                  : ''
              }
              ${
                !isNew && existing.state === 'posted' && existing.amount_residual > 0
                  ? `<button type="button" class="btn btn-action" id="btnOpenPaymentModal">💳 Registrar Pago</button>`
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
              <div>${paymentStateBadge(existing.payment_state)}</div>
            </div>

            <div class="o_group">
              <div class="o_field_row">
                <label for="fMovePartner">Cliente / Proveedor</label>
                <select id="fMovePartner" class="o_select" ${!isEditable ? 'disabled' : ''}>
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
              <div class="o_field_row">
                <label for="fMoveDate">Fecha Contable / Factura</label>
                <input type="date" id="fMoveDate" class="o_input" value="${esc(draft.invoice_date)}" ${!isEditable ? 'readonly' : ''} />
              </div>
              <div class="o_field_row">
                <label for="fMoveDue">Fecha de Vencimiento</label>
                <input type="date" id="fMoveDue" class="o_input" value="${esc(draft.invoice_date_due)}" ${!isEditable ? 'readonly' : ''} />
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
                              ? `<td><button type="button" class="btn btn-sm btn-danger btn-remove-move-line" data-idx="${idx}" title="Quitar línea">✕</button></td>`
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
                  ? `<button type="button" class="btn btn-secondary btn-sm" id="btnAddMoveLine">+ Agregar línea contable</button>`
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
                <span>IVA:</span>
                <strong>${formatMoney(calcTax)}</strong>
              </div>
              <div class="o_totals_row is-grand">
                <span>Total Documento:</span>
                <span>${formatMoney(calcTotal)}</span>
              </div>
              <div class="o_totals_row">
                <span>Importe Adeudado:</span>
                <strong>${formatMoney(calcResidual)}</strong>
              </div>
            </div>
          </div>
        </div>

        ${renderChatterHtml('moves', existing)}
      </div>
    `;

    wireChatterEvents('moves', existing.id);

    const syncMoveDraft = () => {
      const pEl = document.getElementById('fMovePartner');
      const rEl = document.getElementById('fMoveRef');
      const dEl = document.getElementById('fMoveDate');
      const dueEl = document.getElementById('fMoveDue');
      if (pEl) state.formDraft.partner_id = Number(pEl.value);
      if (rEl) state.formDraft.ref = rEl.value;
      if (dEl) state.formDraft.invoice_date = dEl.value;
      if (dueEl) state.formDraft.invoice_date_due = dueEl.value;

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
      const payload = {
        id: isNew ? undefined : existing.id,
        move_type: existing.move_type,
        partner_id: Number(state.formDraft.partner_id),
        ref: state.formDraft.ref,
        invoice_date: state.formDraft.invoice_date,
        invoice_date_due: state.formDraft.invoice_date_due,
        auto_post: autoPost,
        lines: state.formDraft.lines
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
        document.getElementById('payAmount').value = String(existing.amount_residual);
        document.getElementById('payDate').value = new Date().toISOString().slice(0, 10);
        document.getElementById('payRef').value = existing.name;
        dialog.showModal();
      });
    }
  }

  // ==================== MODULE 5: AJUSTES (res.config.settings) ====================
  function renderSettingsModule() {
    const container = document.getElementById('moduleContent');
    const s = state.data.settings || {};

    container.innerHTML = `
      <div class="o_settings_layout">
        <aside class="o_settings_sidebar" aria-label="Secciones de ajustes">
          <button type="button" class="o_settings_tab ${state.submenu === 'general' ? 'is-active' : ''}" data-set-tab="general">
            <img src="/assets/icons/settings.png" alt="" />
            <span>Compañía y General</span>
          </button>
          <button type="button" class="o_settings_tab ${state.submenu === 'sales' ? 'is-active' : ''}" data-set-tab="sales">
            <img src="/assets/icons/sales.png" alt="" />
            <span>Ventas</span>
          </button>
          <button type="button" class="o_settings_tab ${state.submenu === 'accounting' ? 'is-active' : ''}" data-set-tab="accounting">
            <img src="/assets/icons/accounting.png" alt="" />
            <span>Contabilidad</span>
          </button>
          <button type="button" class="o_settings_tab ${state.submenu === 'expenses' ? 'is-active' : ''}" data-set-tab="expenses">
            <img src="/assets/icons/expenses.png" alt="" />
            <span>Gastos</span>
          </button>
          <button type="button" class="o_settings_tab ${state.submenu === 'users' ? 'is-active' : ''}" data-set-tab="users">
            <img src="/assets/icons/contacts.png" alt="" />
            <span>Usuarios y Sistema</span>
          </button>
        </aside>

        <div>
          <div class="o_form_statusbar" style="margin-bottom: 1rem;">
            <div class="o_statusbar_buttons">
              <button type="button" class="btn btn-action" id="btnSaveSettings">💾 Guardar Ajustes</button>
              <button type="button" class="btn btn-secondary" id="btnBackHomeFromSettings">Volver al Panel Principal</button>
            </div>
            <span style="font-size: 0.8rem; color: var(--o-text-muted);">Basado en Odoo 20 Enterprise (${esc(state.data.meta.version)})</span>
          </div>

          <div class="o_settings_block">
            <h3>🏢 Datos de la Compañía y Apariencia</h3>
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
                <label for="setCurrency">Moneda Funcional</label>
                <select id="setCurrency" class="o_select">
                  <option value="COP" ${s.currency === 'COP' ? 'selected' : ''}>COP — Peso Colombiano ($)</option>
                  <option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>USD — Dólar Estadounidense (US$)</option>
                  <option value="EUR" ${s.currency === 'EUR' ? 'selected' : ''}>EUR — Euro (€)</option>
                </select>
              </div>
              <div class="o_field_row">
                <label for="setTheme">Tema Visual Odoo 20</label>
                <select id="setTheme" class="o_select">
                  <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Modo Oscuro Odoo 20 (Predeterminado)</option>
                  <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Modo Claro</option>
                </select>
              </div>
            </div>
          </div>

          <div class="o_settings_block">
            <h3>📈 Parámetros de Ventas, Contabilidad y Gastos</h3>
            <div class="o_group">
              <div class="o_field_row">
                <label for="setValidityDays">Validez predeterminada de cotizaciones (días)</label>
                <input type="number" id="setValidityDays" class="o_input" value="${Number(s.quotation_validity_days || 30)}" min="1" />
              </div>
              <div class="o_field_row">
                <label for="setDefaultSaleTax">IVA de Ventas por Defecto (%)</label>
                <select id="setDefaultSaleTax" class="o_select">
                  ${[19, 5, 0].map((t) => `<option value="${t}" ${Number(s.default_sale_tax) === t ? 'selected' : ''}>${t}%</option>`).join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="setFiscalRegime">Régimen Tributario</label>
                <input type="text" id="setFiscalRegime" class="o_input" value="${esc(s.fiscal_regime)}" />
              </div>
              <div class="o_field_row">
                <label for="setSaleTerms">Términos y Condiciones en Cotizaciones</label>
                <input type="text" id="setSaleTerms" class="o_input" value="${esc(s.sale_terms)}" />
              </div>
            </div>
          </div>

          <div class="o_settings_block">
            <h3>👥 Usuarios Activos y Mantenimiento de Base de Datos</h3>
            <div class="o_group" style="margin-bottom: 0.85rem;">
              <div class="o_field_row">
                <label for="setActiveUser">Usuario Activo de Sesión</label>
                <select id="setActiveUser" class="o_select">
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
              <button type="button" class="btn btn-secondary" id="btnExportDbJson">⬇️ Exportar Respaldo JSON</button>
              <button type="button" class="btn btn-danger" id="btnResetDemoData">🔄 Restaurar Datos Demo de Fábrica</button>
            </div>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('[data-set-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        state.submenu = b.getAttribute('data-set-tab');
        renderSubmenus(APPS.find((a) => a.id === 'settings'));
        renderSettingsModule();
      });
    });

    document.getElementById('btnBackHomeFromSettings').addEventListener('click', openHomeMenu);

    document.getElementById('btnSaveSettings').addEventListener('click', async () => {
      try {
        const payload = {
          company_name: document.getElementById('setCompanyName').value,
          company_vat: document.getElementById('setCompanyVat').value,
          company_email: document.getElementById('setCompanyEmail').value,
          company_phone: document.getElementById('setCompanyPhone').value,
          currency: document.getElementById('setCurrency').value,
          theme: document.getElementById('setTheme').value,
          quotation_validity_days: Number(document.getElementById('setValidityDays').value || 30),
          default_sale_tax: Number(document.getElementById('setDefaultSaleTax').value ?? 19),
          fiscal_regime: document.getElementById('setFiscalRegime').value,
          sale_terms: document.getElementById('setSaleTerms').value,
          active_user_id: Number(document.getElementById('setActiveUser').value || 1)
        };
        const res = await apiCall('/api/settings', 'POST', payload);
        state.data.settings = res.settings;
        updateSystray();
        showToast('Ajustes del sistema guardados.');
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('btnExportDbJson').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chapp_erp_backup.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btnResetDemoData').addEventListener('click', async () => {
      try {
        await apiCall('/api/reset', 'POST');
        showToast('Datos de demostración restaurados.');
        renderSettingsModule();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  // ==================== CHATTER COMPONENT ====================
  function renderChatterHtml(model, record) {
    if (!record || !record.id) {
      return `
        <aside class="o_chatter">
          <div class="o_chatter_header">
            <span>💬 Historial y Notas (Chatter)</span>
          </div>
          <p style="font-size: 0.82rem; color: var(--o-text-muted);">Guarda el registro para habilitar el historial de auditoría y notas.</p>
        </aside>
      `;
    }
    const msgs = (record.chatter || []).slice().reverse();
    return `
      <aside class="o_chatter" aria-label="Historial y notas del documento">
        <div class="o_chatter_header">
          <span>💬 Historial y Auditoría</span>
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
          action: () => openApp('sales', { submenu: 'products', viewType: 'list' })
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
        <button type="button" class="o_nav_entry" data-cmd-idx="${i}" style="display: flex; justify-content: space-between; width: 100%; text-align: start; padding: 0.5rem 0.75rem; background: var(--o-gray-100); border: 1px solid var(--o-border-color);">
          <span>${esc(it.label)}</span>
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
    document.getElementById('btnPendingActivities').addEventListener('click', () => openApp('expenses', { submenu: 'to_approve' }));
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
        const amount = Number(document.getElementById('payAmount').value);
        const date = document.getElementById('payDate').value;
        const ref = document.getElementById('payRef').value;
        await apiCall(`/api/accounting/moves/${moveId}/action`, 'POST', {
          action: 'register_payment',
          journal_code,
          amount,
          date,
          ref
        });
        payDialog.close();
        showToast('Pago registrado y conciliado exitosamente.');
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
