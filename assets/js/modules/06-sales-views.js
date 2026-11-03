/* ==========================================================================
   CH Aluminios ERP -- JS Module: 06-sales-views.js
   Module 3 (Part 1): Ventas (sale.order) -- List, Kanban, Partner Card & Linked Invoices
   ========================================================================== */
'use strict';

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
                  <td class="text-end" style="white-space: nowrap;">
                    <button type="button" class="btn btn-sm btn-secondary btn-goto-invoice" data-invoice-id="${inv.id}">Ver Factura</button>
                    ${inv.state === 'posted' && inv.amount_residual > 0 ? `<button type="button" class="btn btn-sm btn-action btn-pay-sale-invoice" data-invoice-id="${inv.id}">Registrar Pago</button>` : ''}
                    ${inv.state === 'draft' ? `<button type="button" class="btn btn-sm btn-action btn-post-sale-invoice" data-invoice-id="${inv.id}">Publicar</button>` : ''}
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

    const moves = (state.data && state.data.accounting && state.data.accounting.moves) || [];
    const linkedInvs = moves.filter((m) => (order.invoice_ids || []).includes(m.id) || m.origin === order.name || m.ref === order.name);
    const planItems = typeof buildSaleInstallmentPlan === 'function' ? buildSaleInstallmentPlan(order.payment_term, order.date_order, order.amount_total, linkedInvs) : [];
    const nextPendingCuota = planItems.find((p) => p.status === 'pending');
    const suggestedPartial = nextPendingCuota && nextPendingCuota.amount > 0
      ? Math.min(remaining, nextPendingCuota.amount)
      : Math.min(remaining, Math.round(remaining / 2));

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
            <input type="number" id="invPartialAmount" class="o_input" min="1" max="${remaining}" step="any" value="${suggestedPartial}" style="font-size: 1.1rem; font-weight: 700;" />
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



  const SALE_PAYMENT_TERMS_OPTIONS = [
    { value: 'Contado', label: 'Contado' },
    { value: '15 Días', label: '15 Días (1 Cuota Quincenal)' },
    { value: '30 Días', label: '30 Días (1 Mes / 1 Cuota)' },
    { value: '45 Días', label: '45 Días (2 Cuotas)' },
    { value: '60 Días', label: '60 Días (2 Meses / 2 Cuotas)' },
    { value: '90 Días', label: '90 Días (3 Meses / 3 Cuotas)' },
    { value: '120 Días', label: '120 Días (4 Meses / 4 Cuotas)' },
    { value: '150 Días', label: '150 Días (5 Meses / 5 Cuotas)' },
    { value: '180 Días', label: '180 Días (6 Meses / 6 Cuotas)' },
    { value: '210 Días', label: '210 Días (7 Meses / 7 Cuotas)' },
    { value: '240 Días', label: '240 Días (8 Meses / 8 Cuotas)' },
    { value: '270 Días', label: '270 Días (9 Meses / 9 Cuotas)' },
    { value: '300 Días', label: '300 Días (10 Meses / 10 Cuotas)' },
    { value: '330 Días', label: '330 Días (11 Meses / 11 Cuotas)' },
    { value: '360 Días', label: '360 Días (12 Meses / 12 Cuotas)' }
  ];

  function isInstallmentPaymentTerm(paymentTerm) {
    const s = String(paymentTerm || '').trim().toLowerCase();
    if (!s || s === 'contado' || s === 'immediate' || s === 'inmediato') return false;
    return true;
  }

  function addDaysISO(dateStr, daysToAdd) {
    const clean = String(dateStr || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const parts = clean.split('-').map(Number);
    const dt = new Date(Date.UTC(parts[0] || 2026, (parts[1] || 1) - 1, (parts[2] || 1) + Number(daysToAdd || 0)));
    return dt.toISOString().slice(0, 10);
  }

  function addMonthsISO(dateStr, monthsToAdd) {
    const clean = String(dateStr || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const parts = clean.split('-').map(Number);
    const y = parts[0] || new Date().getUTCFullYear();
    const m = (parts[1] || 1) - 1;
    const d = parts[2] || 1;
    const targetMonthTotal = m + Number(monthsToAdd || 0);
    const targetYear = y + Math.floor(targetMonthTotal / 12);
    const targetMonth = ((targetMonthTotal % 12) + 12) % 12;
    const maxDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const finalDay = Math.min(d, maxDay);
    return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
  }

  function formatDateShortEs(dateStr) {
    const clean = String(dateStr || '').slice(0, 10);
    const parts = clean.split('-').map(Number);
    if (parts.length !== 3 || !parts[0]) return clean;
    const monthsEs = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const dd = String(parts[2]).padStart(2, '0');
    const mName = monthsEs[(parts[1] - 1) % 12] || '';
    return `${dd} ${mName} ${parts[0]}`;
  }

  function buildSaleInstallmentPlan(paymentTerm, dateOrder, totalAmount, linkedInvoices = []) {
    if (!isInstallmentPaymentTerm(paymentTerm)) return [];
    const rawTerm = String(paymentTerm || '').trim();
    const lower = rawTerm.toLowerCase();
    const baseDate = String(dateOrder || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const total = Math.max(0, round2(totalAmount || 0));

    let schedule = [];
    if (lower.includes('15') && lower.includes('d')) {
      schedule = [{ installment_number: 1, period_label: 'Quincena (15 Días)', due_date: addDaysISO(baseDate, 15) }];
    } else if (lower.includes('45') && lower.includes('d')) {
      schedule = [
        { installment_number: 1, period_label: 'Mes 1 (30 Días)', due_date: addMonthsISO(baseDate, 1) },
        { installment_number: 2, period_label: 'Plazo Final (45 Días)', due_date: addDaysISO(baseDate, 45) }
      ];
    } else {
      let numCuotas = 1;
      const matchMonths = lower.match(/(\d+)\s*(?:mes|meses|cuota|cuotas)/i);
      const matchDays = lower.match(/(\d+)\s*d[ií]a/i);
      if (matchMonths) {
        numCuotas = Math.max(1, parseInt(matchMonths[1], 10));
      } else if (matchDays) {
        const days = parseInt(matchDays[1], 10);
        numCuotas = Math.max(1, Math.round(days / 30));
      }
      for (let k = 1; k <= numCuotas; k++) {
        schedule.push({
          installment_number: k,
          period_label: `Mes ${k} (${k * 30} Días)`,
          due_date: addMonthsISO(baseDate, k)
        });
      }
    }

    const n = schedule.length;
    const isInt = Number.isInteger(total);
    const baseAmount = n > 0 ? (isInt ? Math.floor(total / n) : Math.floor((total / n) * 100) / 100) : 0;

    const validMoves = (linkedInvoices || [])
      .filter((m) => m && m.state !== 'cancel')
      .sort((a, b) => Number(a.id) - Number(b.id));
    const totalInvoiced = round2(validMoves.reduce((s, m) => s + Number(m.amount_total || 0), 0));

    let accumulated = 0;
    return schedule.map((item, idx) => {
      const cuotaNum = idx + 1;
      const amount = cuotaNum === n ? Math.max(0, round2(total - accumulated)) : baseAmount;
      accumulated = round2(accumulated + amount);
      const balanceAfter = Math.max(0, round2(total - accumulated));
      const pct = total > 0 ? round2((amount / total) * 100) : round2(100 / n);

      const matchedInv = validMoves.find((m) => Number(m.installment_number) === cuotaNum) || validMoves[idx] || null;
      let status = 'pending';
      if (matchedInv) {
        if (matchedInv.state === 'draft') {
          status = 'draft';
        } else if (matchedInv.payment_state === 'paid') {
          status = 'paid';
        } else if (matchedInv.payment_state === 'partial') {
          status = 'partial';
        } else {
          status = 'invoiced';
        }
      } else if (total > 0 && totalInvoiced >= accumulated) {
        status = 'invoiced';
      }

      return {
        installment_number: cuotaNum,
        total_installments: n,
        period_label: item.period_label,
        due_date: item.due_date,
        due_date_display: formatDateShortEs(item.due_date),
        percentage: pct,
        amount,
        accumulated,
        balance_after: balanceAfter,
        status,
        invoice_id: matchedInv ? matchedInv.id : null,
        invoice_name: matchedInv ? matchedInv.name : null,
        invoice_state: matchedInv ? matchedInv.state : null,
        payment_state: matchedInv ? matchedInv.payment_state : null,
        amount_residual: matchedInv ? matchedInv.amount_residual : 0,
        amount_total: matchedInv ? matchedInv.amount_total : 0
      };
    });
  }

  function renderSaleInstallmentPlanHtml(plan, paymentTerm, dateOrder, totalAmount, order, isEditable) {
    const cuotasCount = plan.length;
    const firstAmount = cuotasCount > 0 ? plan[0].amount : 0;
    const canInvoiceCuotas = Boolean(order && order.id && order.state === 'sale' && order.invoice_status !== 'invoiced' && totalAmount > 0);
    const installmentTerms = SALE_PAYMENT_TERMS_OPTIONS.filter((opt) => opt.value !== 'Contado');

    return `
      <div class="o_installment_plan_panel" id="saleInstallmentPlanContainer">
        <div class="o_installment_plan_toolbar">
          <div class="o_installment_plan_title_wrap">
            <h4 class="o_installment_plan_title">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              Cronograma Automático del Plan de Facturas (Mes a Mes)
            </h4>
            <p class="o_installment_plan_subtitle">
              Proyección diferida línea por línea según el plazo acordado (${esc(paymentTerm)}) a partir del ${esc(dateOrder)} (${esc(formatDateShortEs(dateOrder))}).
            </p>
          </div>
          ${
            isEditable
              ? `
            <div class="o_installment_plan_selector">
              <label for="fPlanQuickTermSelect">Ajustar Plazo / Cuotas:</label>
              <select id="fPlanQuickTermSelect" class="o_select">
                ${installmentTerms
                  .map((opt) => `<option value="${esc(opt.value)}" ${paymentTerm === opt.value ? 'selected' : ''}>${esc(opt.label)}</option>`)
                  .join('')}
              </select>
            </div>
          `
              : ''
          }
        </div>

        <div class="o_installment_plan_summary">
          <div class="o_installment_stat">
            <span class="o_installment_stat_label">Total Diferido de la Venta</span>
            <strong class="o_installment_stat_value">${formatMoney(totalAmount)}</strong>
          </div>
          <div class="o_installment_stat">
            <span class="o_installment_stat_label">Total de Cuotas</span>
            <strong class="o_installment_stat_value">${cuotasCount} ${cuotasCount === 1 ? 'Cuota' : 'Cuotas'}</strong>
          </div>
          <div class="o_installment_stat">
            <span class="o_installment_stat_label">Valor por Cuota</span>
            <strong class="o_installment_stat_value is-accent">${formatMoney(firstAmount)}</strong>
          </div>
          <div class="o_installment_stat">
            <span class="o_installment_stat_label">Vencimiento Final</span>
            <strong class="o_installment_stat_value">${cuotasCount > 0 ? esc(plan[cuotasCount - 1].due_date) : esc(dateOrder)}</strong>
          </div>
        </div>

        <div tabindex="0" role="region" aria-label="Tabla de plan de facturas por cuotas" class="table-wrapper" style="margin-bottom: 0.75rem;">
          <table class="o_list_table" id="saleInvoicePlanTable" style="--label-2: 'Mes / Plazo'; --label-3: 'Fecha de Pago'; --label-4: '% Diferido'; --label-5: 'Cantidad a Pagar'; --label-6: 'Saldo Restante'; --label-7: 'Estado';">
            <thead>
              <tr>
                <th>N° de Cuota</th>
                <th>Mes / Plazo</th>
                <th>Fecha de Pago</th>
                <th class="text-end">% Diferido</th>
                <th class="text-end">Cantidad a Pagar</th>
                <th class="text-end">Saldo Diferido Restante</th>
                <th>Estado / Factura</th>
              </tr>
            </thead>
            <tbody id="saleInvoicePlanTbody">
              ${plan
                .map((row) => {
                  const statusBadge =
                    row.status === 'paid'
                      ? `<span class="o_badge o_badge_success">Pagada ${row.invoice_name ? '· ' + esc(row.invoice_name) : ''}</span>`
                      : row.status === 'partial'
                        ? `<span class="o_badge o_badge_warning">Pago Parcial ${row.invoice_name ? '· ' + esc(row.invoice_name) : ''} (${formatMoney(row.amount_residual)} pendiente)</span>`
                        : row.status === 'draft'
                          ? `<span class="o_badge o_badge_info">Borrador ${row.invoice_name ? '· ' + esc(row.invoice_name) : ''}</span>`
                          : row.status === 'invoiced'
                            ? `<span class="o_badge o_badge_info">Facturada ${row.invoice_name ? '· ' + esc(row.invoice_name) : ''}</span>`
                            : `<span class="o_badge o_badge_warning">Programada / Pendiente</span>`;

                  const cuotaActionButtons = row.invoice_id
                    ? `
                      <button type="button" class="btn btn-sm btn-secondary btn-goto-invoice" data-invoice-id="${row.invoice_id}">Ver Factura</button>
                      ${
                        row.invoice_state === 'posted' && row.amount_residual > 0
                          ? `<button type="button" class="btn btn-sm btn-action btn-pay-plan-invoice" data-invoice-id="${row.invoice_id}">Registrar Pago</button>`
                          : ''
                      }
                      ${
                        row.invoice_state === 'draft'
                          ? `<button type="button" class="btn btn-sm btn-action btn-post-plan-invoice" data-invoice-id="${row.invoice_id}">Publicar Factura</button>`
                          : ''
                      }
                    `
                    : canInvoiceCuotas && row.status === 'pending'
                      ? `<button type="button" class="btn btn-sm btn-action btn-invoice-plan-cuota" data-plan-amount="${row.amount}" data-plan-date="${esc(row.due_date)}" data-plan-num="${row.installment_number}">Facturar Cuota</button>`
                      : '';

                  return `
                    <tr data-cuota-num="${row.installment_number}" data-cuota-date="${esc(row.due_date)}" data-cuota-amount="${row.amount}">
                      <th>Cuota #${row.installment_number} de ${row.total_installments}</th>
                      <td><strong>${esc(row.period_label)}</strong></td>
                      <td>
                        <span class="o_plan_date_badge">${esc(row.due_date)}</span>
                        <span style="font-size: 0.78rem; color: var(--o-text-muted); margin-left: 4px;">(${esc(row.due_date_display)})</span>
                      </td>
                      <td class="text-end">${row.percentage}%</td>
                      <td class="text-end"><strong style="color: var(--o-action, #074073); font-size: 0.96rem;">${formatMoney(row.amount)}</strong></td>
                      <td class="text-end">${formatMoney(row.balance_after)}</td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                          ${statusBadge}
                          ${cuotaActionButtons}
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">Total Plan de Facturas (${cuotasCount} ${cuotasCount === 1 ? 'Cuota' : 'Cuotas'})</td>
                <td class="text-end">100%</td>
                <td class="text-end"><strong>${formatMoney(totalAmount)}</strong></td>
                <td class="text-end">${formatMoney(0)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }
