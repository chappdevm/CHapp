/* ==========================================================================
   CH Aluminios ERP -- JS Module: 03-router-control-panel.js
   Workspace Router, Breadcrumb Record Identifier, Control Panel & Pager
   ========================================================================== */
'use strict';

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
    if (appId === 'inventory') {
      if (submenu === 'moves') {
        const m = (state.data.inventory_moves || []).find((x) => Number(x.id) === idNum);
        return m ? `Movimiento #${m.id}` : `Movimiento #${recordId}`;
      }
      const prod = (state.data.products || []).find((p) => Number(p.id) === idNum);
      return prod ? (prod.default_code ? `[${prod.default_code}] ${prod.name}` : prod.name) : `Producto #${recordId}`;
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
    } else if (state.currentApp === 'inventory') {
      if (state.viewType === 'form') {
        actionBtns.innerHTML = `
          <button type="button" class="btn btn-secondary" id="btnCpBackToList">Volver a Existencias</button>
        `;
      } else {
        // En inventario, los botones de acción rápida se mantienen en la tarjeta del banner para evitar duplicados
        actionBtns.innerHTML = '';
      }
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
    if (state.currentApp === 'accounting' || state.currentApp === 'expenses' || state.currentApp === 'contacts' || state.currentApp === 'sales' || state.currentApp === 'inventory') {
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

    const invExpBtn = document.getElementById('btnInvGoToExpense');
    if (invExpBtn) {
      invExpBtn.addEventListener('click', () => {
        openApp('expenses', { viewType: 'form', recordId: 'new' });
      });
    }
    const invMovesBtn = document.getElementById('btnInvViewMovesList');
    if (invMovesBtn) {
      invMovesBtn.addEventListener('click', () => {
        state.submenu = 'moves';
        state.viewType = 'list';
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

  // ==================== ODOO-STYLE LIST SELECTION & ACTIONS MENU ====================
  const LIST_GEAR_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
  const LIST_EXPORT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
  const LIST_PRINT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>';
  const LIST_TRASH_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  const LIST_ACTION_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>';

  const LIST_ENTITY_RULES = [
    { type: 'sale', attr: 'data-sale-id', label: 'Pedido(s)', delPath: (id) => `/api/sales/${id}`, actPath: (id) => `/api/sales/${id}/action` },
    { type: 'move', attr: 'data-move-id', label: 'Documento(s)', delPath: (id) => `/api/accounting/moves/${id}`, actPath: (id) => `/api/accounting/moves/${id}/action` },
    { type: 'move', attr: 'data-invoice-id', label: 'Factura(s)', delPath: (id) => `/api/accounting/moves/${id}`, actPath: (id) => `/api/accounting/moves/${id}/action` },
    { type: 'inventory_move', attr: 'data-inv-move-id', label: 'Movimiento(s)', delPath: null, actPath: null },
    { type: 'expense', attr: 'data-expense-id', label: 'Gasto(s)', delPath: (id) => `/api/expenses/${id}`, actPath: (id) => `/api/expenses/${id}/action` },
    { type: 'contact', attr: 'data-contact-id', label: 'Contacto(s)', delPath: (id) => `/api/contacts/${id}`, actPath: null },
    { type: 'product', attr: 'data-product-id', label: 'Producto(s)', delPath: (id) => `/api/products/${id}`, actPath: null },
    { type: 'product', attr: 'data-inv-prod-id', label: 'Insumo(s)', delPath: (id) => `/api/products/${id}`, actPath: null },
    { type: 'payment', attr: 'data-payment-id', label: 'Pago(s)', delPath: (id) => `/api/accounting/payments/${id}`, actPath: null },
    { type: 'account', attr: 'data-account-code', label: 'Cuenta(s)', delPath: (id) => `/api/accounting/accounts/${encodeURIComponent(id)}`, actPath: null },
    { type: 'installment_plan', attr: 'data-cuota-num', label: 'Cuota(s)', delPath: null, actPath: null }
  ];

  const WORKFLOW_ACTIONS_BY_TYPE = {
    sale: [
      { id: 'send', label: 'Marcar Cotización Enviada' },
      { id: 'confirm', label: 'Confirmar Pedido de Venta' },
      { id: 'deliver', label: 'Aprobar Contrato y Entregar (Facturar)' },
      { id: 'create_invoice', label: 'Generar Factura del Pedido' },
      { id: 'draft', label: 'Restablecer a Cotización' },
      { id: 'cancel', label: 'Cancelar Pedido', danger: true }
    ],
    expense: [
      { id: 'submit', label: 'Enviar al Gerente' },
      { id: 'approve', label: 'Aprobar Gasto' },
      { id: 'post', label: 'Contabilizar Asiento' },
      { id: 'pay', label: 'Registrar Pago / Reembolso' },
      { id: 'reset_draft', label: 'Restablecer a Borrador' },
      { id: 'refuse', label: 'Rechazar Gasto', danger: true }
    ],
    move: [
      { id: 'post', label: 'Publicar / Confirmar' },
      { id: 'register_payment', label: 'Registrar Pago' },
      { id: 'draft', label: 'Restablecer a Borrador' },
      { id: 'cancel', label: 'Cancelar Documento', danger: true }
    ],
    contact: [
      { id: 'open_sales', label: 'Ver Ventas del Contacto' },
      { id: 'open_invoices', label: 'Ver Facturas del Contacto' }
    ],
    product: [
      { id: 'open_inv_moves', label: 'Ver Movimientos de Entrada' },
      { id: 'new_expense_entry', label: 'Registrar Entrada por Gasto' }
    ],
    inventory_move: [
      { id: 'open_linked_expense', label: 'Abrir Gasto Asociado' }
    ],
    installment_plan: [
      { id: 'invoice_selected_cuotas', label: 'Facturar Cuota(s) Seleccionada(s)' }
    ]
  };

  function detectListTableEntity(table, dataRows) {
    const sample = dataRows[0] || table.querySelector('tbody tr');
    if (sample) {
      for (const rule of LIST_ENTITY_RULES) {
        if (sample.hasAttribute(rule.attr)) return rule;
      }
    }
    return { type: 'generic', attr: null, label: 'Registro(s)', delPath: null, actPath: null };
  }

  function extractCleanCellText(cell) {
    if (!cell) return '';
    const clone = cell.cloneNode(true);
    clone.querySelectorAll('.o_list_select_wrap, button, .btn').forEach((el) => el.remove());
    return String(clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function exportSelectedTableRowsCsv(table, selectedRows, entityLabel) {
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => extractCleanCellText(th));
    const lines = [headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',')];
    selectedRows.forEach((tr) => {
      const cells = Array.from(tr.children).map((cell) => `"${extractCleanCellText(cell).replace(/"/g, '""')}"`);
      lines.push(cells.join(','));
    });
    const csvContent = '\uFEFF' + lines.join('\r\n');
    const slug = String(entityLabel || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const filename = `CHapp_${slug}_${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Exportados ${selectedRows.length} registro(s) a ${filename}.`);
  }

  function printSelectedTableRows(table, selectedRows, entityLabel) {
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => `<th>${esc(extractCleanCellText(th))}</th>`).join('');
    const body = selectedRows
      .map((tr) => `<tr>${Array.from(tr.children).map((c) => `<td>${esc(extractCleanCellText(c))}</td>`).join('')}</tr>`)
      .join('');
    const win = window.open('', '_blank', 'width=960,height=700');
    if (!win) {
      window.print();
      return;
    }
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>CHapp - ${esc(entityLabel)}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}h2{margin:0 0 12px;color:#074073}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#f1f5f9;text-transform:uppercase;font-size:11px}</style></head><body><h2>CH Aluminios ERP — ${esc(entityLabel)} (${selectedRows.length})</h2><table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 200);
  }

  async function runBatchSelectionAction(ids, handler, actionLabel) {
    let okCount = 0;
    const errors = [];
    for (const id of ids) {
      try {
        await handler(id);
        okCount += 1;
      } catch (err) {
        errors.push(err && err.message ? err.message : String(err));
      }
    }
    if (okCount > 0 && errors.length === 0) {
      showToast(`${actionLabel}: ${okCount} registro(s) actualizado(s).`);
    } else if (okCount > 0 && errors.length > 0) {
      showToast(`${actionLabel}: ${okCount} completado(s), ${errors.length} omitido(s) (${errors[0]}).`, true);
    } else if (errors.length > 0) {
      showToast(errors[0], true);
    }
    if (okCount > 0 && typeof renderModuleWorkspace === 'function') renderModuleWorkspace();
  }

  async function executeSelectedListAction(actionId, table, selectedRows, entity) {
    if (!selectedRows.length) return;
    if (actionId === 'export_csv') return exportSelectedTableRowsCsv(table, selectedRows, entity.label);
    if (actionId === 'print_rows') return printSelectedTableRows(table, selectedRows, entity.label);

    const ids = entity.attr ? selectedRows.map((tr) => tr.getAttribute(entity.attr)).filter(Boolean) : [];
    if (actionId === 'delete') {
      if (!entity.delPath || ids.length === 0) return;
      const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(`¿Seguro que deseas eliminar ${ids.length} ${entity.label.toLowerCase()} seleccionado(s)? Esta acción no se puede deshacer.`)
        : true;
      if (!confirmed) return;
      return runBatchSelectionAction(ids, (id) => apiCall(entity.delPath(id), 'DELETE'), 'Eliminar');
    }

    if (entity.type === 'contact') {
      const targetId = Number(ids[0]);
      const partner = (state.data.contacts || []).find((c) => Number(c.id) === targetId);
      if (!partner) return;
      openApp(actionId === 'open_sales' ? 'sales' : 'accounting', {
        submenu: actionId === 'open_sales' ? 'all' : 'out_invoice',
        partnerFilter: partner
      });
      return;
    }

    if (entity.type === 'product') {
      if (actionId === 'new_expense_entry') return openApp('expenses', { viewType: 'form', recordId: 'new' });
      const prod = (state.data.products || []).find((p) => Number(p.id) === Number(ids[0]));
      if (prod) state.searchQuery = prod.name;
      return openApp('inventory', { submenu: 'moves', viewType: 'list' });
    }

    if (entity.type === 'inventory_move') {
      const expId = Number(selectedRows[0].getAttribute('data-expense-id') || 0);
      if (expId > 0) openApp('expenses', { viewType: 'form', recordId: expId });
      else showToast('Este movimiento no tiene un gasto directo vinculado.', true);
      return;
    }

    if (entity.type === 'installment_plan') {
      const saleId = Number(state.activeRecordId);
      const sale = (state.data.sales || []).find((s) => Number(s.id) === saleId);
      if (!sale || sale.state !== 'delivered') {
        return showToast('El pedido debe estar en estado Entregado para facturar cuotas desde el plan.', true);
      }
      const cuotas = selectedRows.map((tr) => ({
        num: Number(tr.getAttribute('data-cuota-num')),
        date: tr.getAttribute('data-cuota-date'),
        amount: Number(tr.getAttribute('data-cuota-amount') || 0)
      })).filter((c) => c.amount > 0);
      return runBatchSelectionAction(cuotas, (c) => apiCall(`/api/sales/${saleId}/action`, 'POST', {
        action: 'create_invoice',
        amount: c.amount,
        due_date: c.date,
        is_installment: true,
        installment_number: c.num,
        total_installments: (sale.installment_plan || []).length
      }), 'Facturar Cuotas');
    }

    if (entity.type === 'move' && actionId === 'register_payment') {
      const moves = (state.data.accounting && state.data.accounting.moves) || [];
      if (ids.length === 1 && typeof openPaymentModal === 'function') {
        const mv = moves.find((m) => Number(m.id) === Number(ids[0]));
        if (mv && mv.state === 'posted' && Number(mv.amount_residual || 0) > 0) return openPaymentModal(mv);
      }
      const journals = ((state.data.accounting && state.data.accounting.journals) || []).filter((j) => (j.type === 'bank' || j.type === 'cash') && j.active !== false);
      const defaultJ = journals[0] ? journals[0].code : 'BNK1';
      return runBatchSelectionAction(ids, async (id) => {
        const mv = moves.find((m) => Number(m.id) === Number(id));
        if (!mv || mv.state !== 'posted' || Number(mv.amount_residual || 0) <= 0) {
          throw new Error(`El documento ${mv ? mv.name : '#' + id} no está publicado o ya está pagado.`);
        }
        await apiCall(`/api/accounting/moves/${id}/action`, 'POST', {
          action: 'register_payment',
          amount: Number(mv.amount_residual),
          journal_code: defaultJ,
          date: new Date().toISOString().slice(0, 10)
        });
      }, 'Registrar Pago');
    }

    if (entity.actPath && ids.length > 0) {
      const extraBody = {};
      if (entity.type === 'expense' && actionId === 'pay') {
        const journals = ((state.data.accounting && state.data.accounting.journals) || []).filter((j) => (j.type === 'bank' || j.type === 'cash') && j.active !== false);
        if (journals[0]) extraBody.journal_code = journals[0].code;
      }
      const actionDef = (WORKFLOW_ACTIONS_BY_TYPE[entity.type] || []).find((a) => a.id === actionId);
      return runBatchSelectionAction(
        ids,
        (id) => apiCall(entity.actPath(id), 'POST', { action: actionId, ...extraBody }),
        actionDef ? actionDef.label : actionId
      );
    }
  }

  function buildActionsMenuMarkup(entity, selectedCount) {
    const specific = WORKFLOW_ACTIONS_BY_TYPE[entity.type] || [];
    const items = [
      `<button type="button" class="o_list_action_item" role="menuitem" data-list-action="export_csv">${LIST_EXPORT_ICON}<span>Exportar seleccionados (${selectedCount})</span></button>`,
      `<button type="button" class="o_list_action_item" role="menuitem" data-list-action="print_rows">${LIST_PRINT_ICON}<span>Imprimir selección</span></button>`
    ];
    if (specific.length > 0) {
      items.push('<div class="o_list_actions_divider" role="separator"></div>');
      specific.forEach((act) => {
        items.push(`<button type="button" class="o_list_action_item ${act.danger ? 'is-danger' : ''}" role="menuitem" data-list-action="${esc(act.id)}">${LIST_ACTION_ICON}<span>${esc(act.label)}</span></button>`);
      });
    }
    if (entity.delPath) {
      items.push('<div class="o_list_actions_divider" role="separator"></div>');
      items.push(`<button type="button" class="o_list_action_item is-danger" role="menuitem" data-list-action="delete">${LIST_TRASH_ICON}<span>Eliminar</span></button>`);
    }
    return items.join('');
  }

  function syncControlPanelActionsDropdown(activeBar, table, selectedRows, entity) {
    const cpBtns = document.getElementById('cpActionButtons');
    if (!cpBtns) return;
    const oldWrap = document.getElementById('cpListActionsWrap');
    if (oldWrap) oldWrap.remove();
    if (!activeBar || selectedRows.length === 0) return;

    const wrap = document.createElement('div');
    wrap.id = 'cpListActionsWrap';
    wrap.className = 'o_list_actions_dropdown o_cp_actions_dropdown';
    wrap.innerHTML = `
      <button type="button" class="btn btn-secondary o_list_actions_btn" id="btnCpListActions" aria-haspopup="true" aria-expanded="false">
        ${LIST_GEAR_ICON}
        <span>Acciones (${selectedRows.length})</span>
      </button>
      <div class="o_list_actions_menu" role="menu" style="display: none;">${buildActionsMenuMarkup(entity, selectedRows.length)}</div>
    `;
    const toggle = wrap.querySelector('#btnCpListActions');
    const menu = wrap.querySelector('.o_list_actions_menu');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = menu.style.display === 'none';
      document.querySelectorAll('.o_list_actions_menu').forEach((m) => { m.style.display = 'none'; });
      menu.style.display = opening ? 'block' : 'none';
      toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
    });
    menu.querySelectorAll('.o_list_action_item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.style.display = 'none';
        executeSelectedListAction(btn.getAttribute('data-list-action'), table, selectedRows, entity);
      });
    });
    cpBtns.appendChild(wrap);
  }

  function bindGlobalActionsMenuDismiss() {
    if (typeof window === 'undefined' || window.__chappListMenuDismissBound) return;
    window.__chappListMenuDismissBound = true;
    document.addEventListener('click', () => {
      document.querySelectorAll('.o_list_actions_menu').forEach((m) => { m.style.display = 'none'; });
      document.querySelectorAll('.o_list_actions_btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    });
  }

  function initListMutationObserver() {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined' || window.__chappListObserver) return;
    const viewContainer = document.getElementById('moduleContent') || document.getElementById('moduleWorkspace') || document.body;
    if (!viewContainer) return;
    window.__chappListObserver = new MutationObserver(() => {
      if (viewContainer.querySelector('table.o_list_table:not([data-list-enhanced="1"])')) {
        enhanceSelectableListTables(viewContainer);
      }
    });
    window.__chappListObserver.observe(viewContainer, { childList: true, subtree: true });
  }

  function enhanceSelectableListTables(root) {
    if (typeof document === 'undefined') return;
    bindGlobalActionsMenuDismiss();
    initListMutationObserver();

    const container = root || document.getElementById('moduleContent') || document.getElementById('moduleWorkspace') || document.body;
    if (!container) return;

    const existingCp = document.getElementById('cpListActionsWrap');
    if (existingCp && !container.querySelector('.o_list_record_selector:checked')) {
      existingCp.remove();
    }

    container.querySelectorAll('table.o_list_table:not([data-list-enhanced="1"])').forEach((table) => {
      const tbody = table.querySelector('tbody');
      const theadRow = table.querySelector('thead tr');
      if (!tbody || !theadRow || !theadRow.firstElementChild) return;
      if (['saleLinesTbody', 'expenseItemsTable', 'moveLinesTbody'].includes(tbody.id)) return;
      if (tbody.querySelector('.o_input, .o_select, .o_textarea')) return;

      table.setAttribute('data-list-enhanced', '1');
      const dataRows = Array.from(tbody.querySelectorAll('tr')).filter((tr) => !tr.querySelector('td[colspan]') && tr.children.length > 0);
      const entity = detectListTableEntity(table, dataRows);

      // Insert master checkbox inside the first header cell (preserves CSS nth-child column labels on mobile)
      if (!theadRow.firstElementChild.querySelector('.o_list_select_all')) {
        const masterWrap = document.createElement('label');
        masterWrap.className = 'o_list_select_wrap';
        masterWrap.title = 'Seleccionar todos';
        masterWrap.innerHTML = `<input type="checkbox" class="o_list_select_all" aria-label="Seleccionar todos los registros" ${dataRows.length === 0 ? 'disabled' : ''} />`;
        masterWrap.addEventListener('click', (e) => e.stopPropagation());
        theadRow.firstElementChild.prepend(masterWrap);
      }

      dataRows.forEach((tr, rowIndex) => {
        const firstCell = tr.firstElementChild;
        if (!firstCell || firstCell.querySelector('.o_list_record_selector')) return;
        const rowWrap = document.createElement('label');
        rowWrap.className = 'o_list_select_wrap';
        rowWrap.title = 'Seleccionar registro';
        rowWrap.innerHTML = `<input type="checkbox" class="o_list_record_selector" data-row-idx="${rowIndex}" aria-label="Seleccionar registro" />`;
        rowWrap.addEventListener('click', (e) => e.stopPropagation());
        firstCell.prepend(rowWrap);
      });

      const wrapper = table.closest('.table-wrapper') || table;
      let selBar = wrapper.previousElementSibling;
      if (!selBar || !selBar.classList.contains('o_list_selection_bar')) {
        selBar = document.createElement('div');
        selBar.className = 'o_list_selection_bar';
        selBar.style.display = 'none';
        selBar.innerHTML = `
          <div class="o_list_selection_info">
            <span class="o_list_selected_badge"><strong class="o_selected_count">0</strong> ${esc(entity.label)} seleccionado(s)</span>
            <button type="button" class="btn btn-sm btn-secondary o_list_clear_btn">Deseleccionar</button>
          </div>
          <div class="o_list_selection_controls">
            <button type="button" class="btn btn-sm btn-secondary o_list_quick_export_btn">${LIST_EXPORT_ICON}<span>Exportar</span></button>
            <div class="o_list_actions_dropdown">
              <button type="button" class="btn btn-sm btn-primary o_list_actions_btn" aria-haspopup="true" aria-expanded="false">${LIST_GEAR_ICON}<span>Acciones</span></button>
              <div class="o_list_actions_menu" role="menu" style="display: none;"></div>
            </div>
          </div>
        `;
        wrapper.parentNode.insertBefore(selBar, wrapper);
      }

      const masterChk = theadRow.querySelector('.o_list_select_all');
      const rowChecks = Array.from(tbody.querySelectorAll('.o_list_record_selector'));
      const actionsBtn = selBar.querySelector('.o_list_actions_btn');
      const actionsMenu = selBar.querySelector('.o_list_actions_menu');
      let lastCheckedIdx = null;

      const refreshSelectionUI = () => {
        const selectedRows = [];
        rowChecks.forEach((chk) => {
          const row = chk.closest('tr');
          if (chk.checked && row) {
            row.classList.add('is-selected');
            selectedRows.push(row);
          } else if (row) {
            row.classList.remove('is-selected');
          }
        });

        const count = selectedRows.length;
        selBar.style.display = count > 0 ? 'flex' : 'none';
        const countEl = selBar.querySelector('.o_selected_count');
        if (countEl) countEl.textContent = String(count);

        if (masterChk) {
          masterChk.checked = count > 0 && count === rowChecks.length;
          masterChk.indeterminate = count > 0 && count < rowChecks.length;
        }

        actionsMenu.innerHTML = count > 0 ? buildActionsMenuMarkup(entity, count) : '';
        actionsMenu.querySelectorAll('.o_list_action_item').forEach((itemBtn) => {
          itemBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            actionsMenu.style.display = 'none';
            executeSelectedListAction(itemBtn.getAttribute('data-list-action'), table, selectedRows, entity);
          });
        });

        const wrapperParent = table.closest('.o_form_sheet');
        if (!wrapperParent || table.id === 'saleInvoicePlanTable') {
          syncControlPanelActionsDropdown(count > 0 ? selBar : null, table, selectedRows, entity);
        }
      };

      if (masterChk) {
        masterChk.addEventListener('change', () => {
          rowChecks.forEach((chk) => { chk.checked = masterChk.checked; });
          refreshSelectionUI();
        });
      }

      rowChecks.forEach((chk, idx) => {
        chk.addEventListener('click', (e) => {
          e.stopPropagation();
          if (e.shiftKey && lastCheckedIdx !== null && lastCheckedIdx !== idx) {
            const [start, end] = [Math.min(lastCheckedIdx, idx), Math.max(lastCheckedIdx, idx)];
            for (let i = start; i <= end; i++) rowChecks[i].checked = chk.checked;
          }
          lastCheckedIdx = idx;
          refreshSelectionUI();
        });
      });

      selBar.querySelector('.o_list_clear_btn').addEventListener('click', () => {
        rowChecks.forEach((chk) => { chk.checked = false; });
        refreshSelectionUI();
      });

      selBar.querySelector('.o_list_quick_export_btn').addEventListener('click', () => {
        const selectedRows = rowChecks.filter((c) => c.checked).map((c) => c.closest('tr')).filter(Boolean);
        if (selectedRows.length > 0) exportSelectedTableRowsCsv(table, selectedRows, entity.label);
      });

      actionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const opening = actionsMenu.style.display === 'none';
        document.querySelectorAll('.o_list_actions_menu').forEach((m) => { m.style.display = 'none'; });
        actionsMenu.style.display = opening ? 'block' : 'none';
        actionsBtn.setAttribute('aria-expanded', opening ? 'true' : 'false');
      });
    });
  }

