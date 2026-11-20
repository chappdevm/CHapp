/* ==========================================================================
   CH Aluminios ERP -- JS Module: 01-state-utils.js
   Application Config, Global State, Formatting Utilities & Action Locks
   ========================================================================== */
'use strict';

  const APPS = [
    {
      id: 'contacts',
      name: 'Contactos',
      icon: '/assets/icons/contacts.png?v=2.39',
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
      icon: '/assets/icons/expenses.png?v=2.39',
      xmlid: 'hr_expense.menu_hr_expense_root',
      defaultSubmenu: 'all',
      defaultView: 'list',
      submenus: []
    },
    {
      id: 'sales',
      name: 'Ventas',
      icon: '/assets/icons/sales.png?v=2.39',
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
      icon: '/assets/icons/accounting.png?v=2.39',
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
      icon: '/assets/icons/inventory.png?v=2.39',
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
      icon: '/assets/icons/settings.png?v=2.39',
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
    activeNotebookTab: 'lines',
    activeSaleTab: 'lines'
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

  function isInsumoItem(p) {
    if (!p) return false;
    if (p.is_insumo === true || p.type === 'insumo') return true;
    if (p.is_insumo === false) return false;
    if (p.can_be_expensed === true && p.can_be_sold === false) return true;
    return false;
  }

  function getInventoryInsumosList() {
    const all = (state.data && state.data.products) || [];
    const moves = (state.data && state.data.inventory_moves) || [];
    const moveProdIds = new Set(moves.filter((m) => m.state !== 'cancel').map((m) => Number(m.product_id)));
    return all.filter((p) => {
      if (isInsumoItem(p)) return true;
      if (p.can_be_sold === true && p.can_be_expensed === false) return false;
      return moveProdIds.has(Number(p.id));
    });
  }

  function getSaleProductsList() {
    const all = (state.data && state.data.products) || [];
    return all.filter((p) => !isInsumoItem(p) && p.can_be_sold !== false);
  }

  function isSupplierContact(c) {
    if (!c) return false;
    if (Number(c.supplier_rank) > 0) return true;
    if (Array.isArray(c.category_ids) && c.category_ids.some((t) => String(t).toLowerCase().includes('proveedor'))) return true;
    return false;
  }

  function getSupplierContactsList() {
    const all = (state.data && state.data.contacts) || [];
    return all.filter(isSupplierContact);
  }

  function formatUomShort(uom) {
    if (!uom) return 'm²';
    const s = String(uom).toLowerCase().trim();
    if (s.includes('cuadrado') || s.includes('m2') || s.includes('m²')) return 'm²';
    if (s.includes('lineal') || s.includes('liso') || s === 'metro' || s === 'm') return 'm';
    if (s.includes('unidad') || s === 'und') return 'und';
    return uom;
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
    if (Number(existing.financing_rate || 0) !== Number(draft.financing_rate || 0)) return true;
    if (String(existing.date_order || '').slice(0, 10) !== String(draft.date_order || '').slice(0, 10)) return true;
    if (String(existing.validity_date || '').slice(0, 10) !== String(draft.validity_date || '').slice(0, 10)) return true;
    if (String(existing.salesperson || '').trim() !== String(draft.salesperson || '').trim()) return true;
    if (String(existing.notes || '').trim() !== String(draft.notes || '').trim()) return true;
    if (draft.contract_data && JSON.stringify(draft.contract_data) !== JSON.stringify(existing.contract_data || {})) return true;

    const existLines = Array.isArray(existing.lines) ? existing.lines : [];
    const draftLines = Array.isArray(draft.lines) ? draft.lines : [];
    if (existLines.length !== draftLines.length) return true;

    for (let i = 0; i < existLines.length; i++) {
      const e = existLines[i] || {};
      const d = draftLines[i] || {};
      if (Number(e.product_id || 0) !== Number(d.product_id || 0)) return true;
      if (Number(e.measure || 1) !== Number(d.measure || 1)) return true;
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
    if (String(existing.payment_term || '').trim() !== String(draft.payment_term || '').trim()) return true;
    if (Number(existing.financing_rate || 0) !== Number(draft.financing_rate || 0)) return true;
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
      if (Number(e.tax_rate || 0) !== Number(p.tax_rate || 0)) return true;
      if (Number(e.tax_amount || 0) !== Number(p.tax_amount || 0)) return true;
      if (Number(e.subtotal || 0) !== Number(p.subtotal || 0)) return true;
      if (Number(e.total || 0) !== Number(p.total || 0)) return true;
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

  // ==================== SEARCH & PALETTE UTILITIES ====================
  function normalizeSearchText(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function getFilteredHomeApps(query) {
    const q = normalizeSearchText(query);
    if (!q) return APPS.map((a) => ({ ...a, matchedSubmenu: null, matchedSubmenuLabel: null }));

    const matches = [];
    APPS.forEach((app) => {
      const appNameNorm = normalizeSearchText(app.name);
      let appMatches = appNameNorm.includes(q);

      // Check submenus
      let matchedSub = (app.submenus || []).find((s) => {
        const subLabelNorm = normalizeSearchText(s.label);
        return subLabelNorm.includes(q);
      });

      // Semantic aliases for Colombian ERP workflows
      if (!matchedSub) {
        if ((q.includes('factur') || q === 'fac') && app.id === 'accounting') {
          matchedSub = (app.submenus || []).find((s) => s.id === 'out_invoice') || (app.submenus || [])[1];
        } else if ((q.includes('client') || q === 'cli') && (app.id === 'contacts' || app.id === 'accounting')) {
          matchedSub = (app.submenus || []).find((s) => s.id === 'customers' || s.id === 'out_invoice');
        } else if ((q.includes('proveed') || q === 'prov') && (app.id === 'contacts' || app.id === 'accounting' || app.id === 'expenses')) {
          matchedSub = (app.submenus || []).find((s) => s.id === 'suppliers' || s.id === 'in_invoice');
        } else if ((q.includes('pedid') || q === 'ped' || q.includes('cotiz') || q === 'cot') && app.id === 'sales') {
          matchedSub = (app.submenus || []).find((s) => q.includes('cotiz') ? s.id === 'quotations' : s.id === 'orders');
        } else if ((q.includes('product') || q === 'prod' || q.includes('insum')) && app.id === 'sales') {
          matchedSub = (app.submenus || []).find((s) => s.id === 'products');
        } else if ((q.includes('stock') || q.includes('existenc') || q.includes('inventari')) && app.id === 'inventory') {
          matchedSub = (app.submenus || []).find((s) => s.id === 'stock');
        } else if ((q.includes('pago') || q === 'pag') && app.id === 'accounting') {
          matchedSub = (app.submenus || []).find((s) => s.id === 'payments');
        }
      }

      if (appMatches || matchedSub) {
        matches.push({
          ...app,
          matchedSubmenu: matchedSub ? matchedSub.id : null,
          matchedSubmenuLabel: matchedSub ? matchedSub.label : null
        });
      }
    });
    return matches;
  }

