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

