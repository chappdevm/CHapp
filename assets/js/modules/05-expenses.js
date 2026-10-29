/* ==========================================================================
   CH Aluminios ERP -- JS Module: 05-expenses.js
   Module 2: Gastos (hr.expense) -- List, Kanban, Form & OCR Auto-Fill
   ========================================================================== */
'use strict';

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

    const delExpBtn = document.getElementById('btnDeleteFormExpense');
    if (delExpBtn) {
      delExpBtn.addEventListener('click', () => {
        withActionLock(delExpBtn, async () => {
          if (!confirm(`¿Estás seguro de eliminar el gasto ${existing.reference || ('EXP/2026/' + String(existing.id).padStart(4, '0'))}?`)) return;
          await apiCall(`/api/expenses/${existing.id}`, 'DELETE');
          showToast('Gasto eliminado.');
          state.activeRecordId = null;
          state.formDraft = null;
          state.viewType = 'list';
          renderModuleWorkspace();
        }).catch((err) => showToast(err.message, true));
      });
    }

    const saveBtn = document.getElementById('btnSaveExpense');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        withActionLock(saveBtn, async () => {
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

          if (!isNew && !hasExpenseDraftChanged(existing, payload)) {
            showToast('No hay cambios pendientes por guardar.');
            return;
          }

          await apiCall('/api/expenses', 'POST', payload);
          showToast('Gasto guardado exitosamente y factura de proveedor generada.');
          state.activeRecordId = null;
          state.formDraft = null;
          state.viewType = 'list';
          renderModuleWorkspace();
        }).catch((err) => showToast(err.message, true));
      });
    }
  }

