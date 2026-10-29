/* ==========================================================================
   CH Aluminios ERP -- JS Module: 01-state-utils.js
   Application Config, Global State, Formatting Utilities & Action Locks
   ========================================================================== */
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
      id: 'inventory',
      name: 'Inventario',
      icon: '/assets/icons/inventory.png',
      xmlid: 'stock.menu_stock_root',
      defaultSubmenu: 'stock',
      defaultView: 'list',
      submenus: [
        { id: 'stock', label: 'Existencias (Stock)' },
        { id: 'moves', label: 'Movimientos de Entrada' }
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
  const escapeHtml = esc;

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

  // ==================== MULTI-CLICK & DEDUPLICATION GUARDS ====================
  const _actionLocks = new WeakSet();
  async function withActionLock(buttonEl, asyncFn) {
    if (!buttonEl) {
      return await asyncFn();
    }
    if (_actionLocks.has(buttonEl) || buttonEl.disabled) {
      return;
    }
    _actionLocks.add(buttonEl);
    const prevDisabled = buttonEl.disabled;
    const prevPointerEvents = buttonEl.style.pointerEvents;
    const prevOpacity = buttonEl.style.opacity;

    buttonEl.disabled = true;
    buttonEl.style.pointerEvents = 'none';
    buttonEl.style.opacity = '0.65';
    try {
      return await asyncFn();
    } finally {
      setTimeout(() => {
        _actionLocks.delete(buttonEl);
        buttonEl.disabled = prevDisabled;
        buttonEl.style.pointerEvents = prevPointerEvents;
        buttonEl.style.opacity = prevOpacity;
      }, 350);
    }
  }

  function hasSaleDraftChanged(existing, draft) {
    if (!existing || !draft) return true;
    if (Number(existing.partner_id || 0) !== Number(draft.partner_id || 0)) return true;
    if (String(existing.payment_term || '').trim() !== String(draft.payment_term || '').trim()) return true;
    if (String(existing.date_order || '').slice(0, 10) !== String(draft.date_order || '').slice(0, 10)) return true;
    if (String(existing.validity_date || '').slice(0, 10) !== String(draft.validity_date || '').slice(0, 10)) return true;
    if (String(existing.salesperson || '').trim() !== String(draft.salesperson || '').trim()) return true;
    if (String(existing.notes || '').trim() !== String(draft.notes || '').trim()) return true;

    const existLines = Array.isArray(existing.lines) ? existing.lines : [];
    const draftLines = Array.isArray(draft.lines) ? draft.lines : [];
    if (existLines.length !== draftLines.length) return true;

    for (let i = 0; i < existLines.length; i++) {
      const e = existLines[i] || {};
      const d = draftLines[i] || {};
      if (Number(e.product_id || 0) !== Number(d.product_id || 0)) return true;
      if (Number(e.quantity || 0) !== Number(d.quantity || 0)) return true;
      if (Number(e.price_unit || 0) !== Number(d.price_unit || 0)) return true;
      if (Number(e.discount || 0) !== Number(d.discount || 0)) return true;
      const eTax = e.tax_rate === '' || e.tax_rate === null || e.tax_rate === undefined ? '' : Number(e.tax_rate);
      const dTax = d.tax_rate === '' || d.tax_rate === null || d.tax_rate === undefined ? '' : Number(d.tax_rate);
      if (eTax !== dTax) return true;
      if (String(e.description || '').trim() !== String(d.description || '').trim()) return true;
    }
    return false;
  }

  function hasMoveDraftChanged(existing, draft) {
    if (!existing || !draft) return true;
    if (Number(existing.partner_id || 0) !== Number(draft.partner_id || 0)) return true;
    if (String(existing.ref || '').trim() !== String(draft.ref || '').trim()) return true;
    if (String(existing.invoice_date || '').slice(0, 10) !== String(draft.invoice_date || '').slice(0, 10)) return true;
    if (String(existing.invoice_date_due || '').slice(0, 10) !== String(draft.invoice_date_due || '').slice(0, 10)) return true;
    if (Number(existing.retention_source_rate || 0) !== Number(draft.retention_source_rate || 0)) return true;
    if (Number(existing.retention_ica_rate || 0) !== Number(draft.retention_ica_rate || 0)) return true;

    const existLines = Array.isArray(existing.lines) ? existing.lines : [];
    const draftLines = Array.isArray(draft.lines) ? draft.lines : [];
    if (existLines.length !== draftLines.length) return true;

    for (let i = 0; i < existLines.length; i++) {
      const e = existLines[i] || {};
      const d = draftLines[i] || {};
      if (String(e.name || '').trim() !== String(d.name || '').trim()) return true;
      if (String(e.account_code || '').trim() !== String(d.account_code || '').trim()) return true;
      if (Number(e.quantity || 0) !== Number(d.quantity || 0)) return true;
      if (Number(e.price_unit || 0) !== Number(d.price_unit || 0)) return true;
      const eTax = e.tax_rate === '' || e.tax_rate === null || e.tax_rate === undefined ? '' : Number(e.tax_rate);
      const dTax = d.tax_rate === '' || d.tax_rate === null || d.tax_rate === undefined ? '' : Number(d.tax_rate);
      if (eTax !== dTax) return true;
    }
    return false;
  }

  function hasExpenseDraftChanged(existing, payload) {
    if (!existing || !payload) return true;
    if (String(existing.name || '').trim() !== String(payload.name || '').trim()) return true;
    if (Number(existing.partner_id || 0) !== Number(payload.partner_id || 0)) return true;
    if (String(existing.partner_name || '').trim() !== String(payload.partner_name || '').trim()) return true;
    if (String(existing.supplier_vat || '').trim() !== String(payload.supplier_vat || '').trim()) return true;
    if (String(existing.receipt_ref || '').trim() !== String(payload.receipt_ref || '').trim()) return true;
    if (String(existing.date || '').slice(0, 10) !== String(payload.date || '').slice(0, 10)) return true;
    if (Number(existing.total_amount || existing.price_unit || 0) !== Number(payload.total_amount || payload.price_unit || 0)) return true;
    if (Number(existing.product_id || 0) !== Number(payload.product_id || 0)) return true;
    if (String(existing.journal_code || '').trim() !== String(payload.journal_code || '').trim()) return true;
    if (String(existing.notes || '').trim() !== String(payload.notes || '').trim()) return true;
    if (String(existing.receipt_image || '').trim() !== String(payload.receipt_image || '').trim()) return true;

    const existItems = Array.isArray(existing.items) ? existing.items : [];
    const payItems = Array.isArray(payload.items) ? payload.items : [];
    if (existItems.length !== payItems.length) return true;
    for (let i = 0; i < existItems.length; i++) {
      const e = existItems[i] || {};
      const p = payItems[i] || {};
      if (String(e.description || '').trim() !== String(p.description || '').trim()) return true;
      if (Number(e.quantity || 0) !== Number(p.quantity || 0)) return true;
      if (Number(e.price_unit || 0) !== Number(p.price_unit || 0)) return true;
    }
    return false;
  }

  function hasContactDraftChanged(existing, payload) {
    if (!existing || !payload) return true;
    const fields = ['name', 'doc_type', 'vat', 'function', 'email', 'phone', 'mobile', 'street', 'city', 'payment_term', 'notes'];
    for (const f of fields) {
      if (String(existing[f] || '').trim() !== String(payload[f] || '').trim()) return true;
    }
    if (Boolean(existing.is_company) !== Boolean(payload.is_company)) return true;
    if (Number(existing.customer_rank || 0) !== Number(payload.customer_rank || 0)) return true;
    if (Number(existing.supplier_rank || 0) !== Number(payload.supplier_rank || 0)) return true;
    const eCat = Array.isArray(existing.category_ids) ? existing.category_ids.join(', ') : String(existing.category_ids || '');
    const pCat = Array.isArray(payload.category_ids) ? payload.category_ids.join(', ') : String(payload.category_ids || '');
    if (eCat.trim() !== pCat.trim()) return true;
    return false;
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

