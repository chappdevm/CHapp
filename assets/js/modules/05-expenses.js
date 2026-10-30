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
                  <td>
                    <div>${esc(e.name)}</div>
                    ${Array.isArray(e.items) && e.items.length > 0
                      ? `<div style="font-size: 0.78rem; color: var(--o-muted); margin-top: 2px;">${e.items.length} insumo(s): ${esc(e.items.map((it) => it.description || it.name).filter(Boolean).join(', '))}</div>`
                      : ''}
                  </td>
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
                <label for="fExpPartnerName">Proveedor / Establecimiento</label>
                <div class="o_supplier_combobox" id="fExpSupplierCombobox" style="position: relative; width: 100%;">
                  <input type="hidden" id="fExpPartner" value="${esc(existing.partner_id || '')}" />
                  <div style="position: relative; display: flex; align-items: center;">
                    <input
                      type="text"
                      id="fExpPartnerName"
                      class="o_input"
                      autocomplete="off"
                      value="${esc(existing.partner_name || ((state.data.contacts || []).find((c) => Number(c.id) === Number(existing.partner_id)) || {}).name || '')}"
                      placeholder="Escribe o selecciona un proveedor..."
                      style="padding-right: 32px; width: 100%;"
                    />
                    <button
                      type="button"
                      id="btnToggleSupplierDropdown"
                      tabindex="-1"
                      title="Mostrar lista de proveedores"
                      style="position: absolute; right: 6px; background: transparent; border: none; color: var(--o-muted); cursor: pointer; padding: 4px; display: inline-flex; align-items: center;"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                  </div>
                  <div
                    id="fExpSupplierDropdown"
                    class="o_supplier_dropdown_menu"
                    style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; max-height: 230px; overflow-y: auto; background: var(--o-surface, #1e293b); border: 1px solid var(--o-border, #334155); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.28); z-index: 60;"
                  ></div>
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
                <label for="fExpJournal">Cuenta / Medio de Pago *</label>
                <select id="fExpJournal" class="o_select" required>
                  ${((state.data.accounting && state.data.accounting.journals) || [])
                    .filter((j) => (j.type === 'bank' || j.type === 'cash') && j.active !== false)
                    .map((j) => `<option value="${esc(j.code)}" ${existing.journal_code === j.code ? 'selected' : (!existing.journal_code && j.code === 'CSH1' ? 'selected' : '')}>${esc(j.name)} (${esc(j.code)})</option>`)
                    .join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fExpEmployee">Responsable / Empleado</label>
                <input type="text" id="fExpEmployee" class="o_input" value="${esc(existing.employee_name || 'Andrés Salazar')}" />
              </div>
            </div>

            <div style="display: none;" aria-hidden="true">
              <select id="fExpPartnerLegacy"><option value="" ${!existing.partner_id ? 'selected disabled' : ''}>— Seleccionar Proveedor —</option></select>
              <select id="fExpProduct">
                <option value="" ${!existing.product_id ? 'selected disabled' : ''}>— Seleccione Categoría de Gasto —</option>
                ${(state.data.products || []).map((p) => `<option value="${p.id}" ${Number(existing.product_id) === Number(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
              <select id="fExpPayMode">
                <option value="" ${!existing.payment_mode ? 'selected disabled' : ''}>— Seleccione Forma de Pago —</option>
                <option value="company_account" ${existing.payment_mode === 'company_account' || !existing.payment_mode ? 'selected' : ''}>Compañía (Transferencia / Tarjeta / Caja)</option>
                <option value="own_account" ${existing.payment_mode === 'own_account' ? 'selected' : ''}>Empleado (a reembolsar)</option>
              </select>
              <select id="fExpTax">
                <option value="" ${existing.tax_rate === '' || existing.tax_rate === undefined || existing.tax_rate === null ? 'selected disabled' : ''}>— Seleccione IVA —</option>
                <option value="0" ${existing.tax_rate === 0 ? 'selected' : ''}>IVA 0% (Exento)</option>
                <option value="5" ${existing.tax_rate === 5 ? 'selected' : ''}>IVA 5%</option>
                <option value="19" ${existing.tax_rate === 19 ? 'selected' : ''}>IVA 19%</option>
              </select>
            </div>

            <!-- Tabla estructurada de Insumos / Materiales -->
            <div style="margin-top: 1.25rem; border-top: 1px solid var(--o-border); padding-top: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                <div>
                  <h4 style="margin: 0; font-size: 0.98rem; font-weight: 700; color: var(--o-text);">Insumos / Materiales de la Factura de Gasto</h4>
                  <span style="font-size: 0.8rem; color: var(--o-muted);">Cada insumo se guarda por separado y entra automáticamente al Inventario</span>
                </div>
                <button type="button" class="btn btn-sm btn-secondary" id="btnAddExpenseItem" style="display: inline-flex; align-items: center; gap: 4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Agregar Insumo / Material
                </button>
              </div>

              <div tabindex="0" role="region" aria-label="Tabla de insumos del gasto" class="table-wrapper" style="margin-bottom: 0.75rem;">
                <table class="o_list_table" id="expenseItemsTable" style="--label-2: 'Cantidad'; --label-3: 'Valor Unit.'; --label-4: 'IVA %'; --label-5: 'Total'; --label-6: 'Acción';">
                  <thead>
                    <tr>
                      <th>Descripción del Insumo / Material</th>
                      <th style="width: 90px;">Cantidad</th>
                      <th style="width: 130px;">Valor Unitario ($)</th>
                      <th style="width: 90px;">IVA %</th>
                      <th style="width: 140px;">Total ($)</th>
                      <th style="width: 50px;"></th>
                    </tr>
                  </thead>
                  <tbody id="expenseItemsTbody">
                  </tbody>
                </table>
                <datalist id="expenseInsumosDatalist">
                  ${(typeof getInventoryInsumosList === 'function' ? getInventoryInsumosList() : [])
                    .map((ins) => `<option value="${esc(ins.name)}">${esc(ins.default_code || '')} · Stock: ${Number(ins.qty_available || 0)} ${esc(ins.uom || 'Und')}</option>`)
                    .join('')}
                </datalist>
              </div>
              <div id="expenseItemsSummary" style="display: flex; gap: 1.25rem; justify-content: flex-end; flex-wrap: wrap; font-size: 0.9rem; margin-bottom: 0.75rem;"></div>
            </div>

            <div class="o_field_row" style="margin-top: 0.5rem;">
              <label for="fExpNotes">Notas / Observaciones Generales</label>
              <textarea id="fExpNotes" class="o_textarea" rows="2" placeholder="Observaciones generales (el NIT y los artículos ya tienen sus campos correspondientes)">${esc(existing.notes || '')}</textarea>
            </div>

            <!-- Foto o Soporte de la Factura (Archivo Adjunto) -->
            <div style="margin-top: 1rem; padding: 1rem; background: var(--o-bg-subtle, rgba(0,0,0,0.02)); border: 1px dashed var(--o-border); border-radius: 8px;">
              <div style="font-weight: 600; margin-bottom: 0.65rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <span style="display: inline-flex; align-items: center; gap: 6px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                  Archivo Adjunto — Foto de la Factura / Comprobante
                </span>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  <label class="btn btn-sm btn-secondary" style="cursor: pointer; margin: 0; display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    Adjuntar Foto
                    <input type="file" id="fExpDirectFileAttach" accept="image/*" style="display: none;" />
                  </label>
                  <button type="button" class="btn btn-sm btn-secondary" id="btnFormCameraTrigger">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                    ${existing.receipt_image ? 'Cambiar / Escanear con IA' : 'Escanear Factura con IA'}
                  </button>
                </div>
              </div>
              <div id="formReceiptPreviewWrap">
                ${
                  existing.receipt_image
                    ? `<div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                        <img src="${existing.receipt_image}" class="o_expense_receipt_preview" alt="Comprobante factura" onclick="openImageLightbox(this.src, 'Comprobante de Factura')" title="Clic para ver tamaño grande" />
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                          <span class="o_badge o_badge_success" style=" align-self: flex-start;">✓ Foto de Factura Adjuntada</span>
                          <span style="font-size: 0.82rem; color: var(--o-muted);">Este archivo queda guardado en el gasto y registrado en el Chatter.</span>
                          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button type="button" class="btn btn-sm btn-secondary" onclick="openImageLightbox(document.querySelector('#formReceiptPreviewWrap img')?.src, 'Comprobante de Factura')">Ver Tamaño Completo</button>
                            <a href="${existing.receipt_image}" download="Factura_${esc((existing.receipt_ref || existing.reference || 'Gasto').replace(/[\/\\]/g, '_'))}.jpg" class="btn btn-sm btn-secondary" style="text-decoration: none;">Descargar Adjunto</a>
                          </div>
                        </div>
                      </div>`
                    : `<span style="font-size: 0.85rem; color: var(--o-muted);">Sin foto adjunta. Al escanear la factura o adjuntar una foto, se guardará como archivo adjunto y quedará registrada en el Chatter.</span>`
                }
              </div>
            </div>
          </form>
        </div>

        ${renderChatterHtml('expenses', existing)}
      </div>
    `;

    wireChatterEvents('expenses', existing.id);

    // Initial items list for the table (valores literales de la factura, sin recalcular)
    const normalizeExpenseItem = (it) => {
      const qty = Number(it.quantity || 1);
      const price = Number(it.price_unit || 0);
      const rate = Number(it.tax_rate || 0);
      let total = it.total !== undefined && it.total !== null && it.total !== '' && Number(it.total) > 0
        ? Number(it.total)
        : (it.subtotal !== undefined && it.subtotal !== null && it.subtotal !== '' ? Number(it.subtotal) + Number(it.tax_amount || 0) : Math.round(qty * price * (1 + rate / 100) * 100) / 100);
      total = Math.round(total * 100) / 100;
      const sub = it.subtotal !== undefined && it.subtotal !== null && it.subtotal !== '' ? Number(it.subtotal) : (rate > 0 ? Math.round((total / (1 + rate / 100)) * 100) / 100 : total);
      const tax = it.tax_amount !== undefined && it.tax_amount !== null && it.tax_amount !== '' ? Number(it.tax_amount) : Math.round((total - sub) * 100) / 100;
      return { ...it, description: it.description || it.name || '', quantity: qty, price_unit: price || (qty > 0 ? Math.round((sub / qty) * 100) / 100 : 0), tax_rate: rate, tax_amount: tax, subtotal: sub, total };
    };
    let recoveredItems = null;
    if (!isNew && (!Array.isArray(existing.items) || existing.items.length === 0)) {
      const invMoves = ((state.data && state.data.inventory_moves) || []).filter((m) => m.origin_type === 'expense' && Number(m.origin_id) === Number(existing.id) && m.state !== 'cancel');
      if (invMoves.length > 0) {
        recoveredItems = invMoves.map((m, idx) => ({ id: m.item_id || idx + 1, product_id: m.product_id || null, description: m.product_name || existing.name || '', quantity: Number(m.quantity || 1), price_unit: Number(m.price_unit || 0), subtotal: Number(m.total_value || 0), total: Number(m.total_value || 0) }));
      } else if (existing.move_id || existing.bill_id) {
        const linkedMove = ((state.data && state.data.accounting && state.data.accounting.moves) || []).find((mv) => Number(mv.id) === Number(existing.move_id || existing.bill_id));
        if (linkedMove && Array.isArray(linkedMove.lines) && linkedMove.lines.length > 0) {
          recoveredItems = linkedMove.lines.map((l, idx) => ({ id: l.id || idx + 1, product_id: l.product_id || null, description: l.name || l.description || existing.name || '', quantity: Number(l.quantity || 1), price_unit: Number(l.price_unit || 0), tax_rate: Number(l.tax_rate || 0), tax_amount: Number(l.tax_amount || 0), subtotal: Number(l.subtotal || 0), total: Number(l.total || 0) }));
        }
      }
    }
    let expenseItems = (Array.isArray(existing.items) && existing.items.length > 0 ? [...existing.items] : (recoveredItems && recoveredItems.length > 0 ? recoveredItems : (draft && Array.isArray(draft.items) && draft.items.length > 0 ? [...draft.items] : [{ description: existing.name || '', quantity: existing.quantity || 1, price_unit: existing.price_unit || existing.total_amount || 0, total: existing.total_amount || 0 }]))).map(normalizeExpenseItem);

    let literalTotals = draft && draft.literal_totals ? { ...draft.literal_totals } : null;
    const round2c = (n) => Math.round(Number(n || 0) * 100) / 100;
    const renderExpenseSummary = () => {
      const box = document.getElementById('expenseItemsSummary');
      if (!box) return;
      const tot = literalTotals ? literalTotals.total : round2c(expenseItems.reduce((a, it) => a + Number(it.total || 0), 0));
      box.innerHTML = `<span>Total: <strong style="color: #2563eb; font-size: 1.05rem;">${formatMoney(tot)}</strong></span>`;
    };

    const renderExpenseItems = () => {
      const tbody = document.getElementById('expenseItemsTbody');
      if (!tbody) return;
      tbody.innerHTML = expenseItems.map((it, idx) => `
        <tr data-item-idx="${idx}">
          <td><input type="text" class="o_input exp-item-desc" list="expenseInsumosDatalist" data-idx="${idx}" value="${esc(it.description || '')}" placeholder="Ej. Tubo PVC, Perfil Aluminio, Tornillos..." /></td>
          <td><input type="number" class="o_input exp-item-field" data-field="quantity" data-idx="${idx}" min="0" step="any" value="${Number(it.quantity || 1)}" /></td>
          <td><input type="number" class="o_input exp-item-field" data-field="price_unit" data-idx="${idx}" min="0" step="any" value="${Number(it.price_unit || 0)}" /></td>
          <td><input type="number" class="o_input exp-item-field" data-field="tax_rate" data-idx="${idx}" min="0" step="any" value="${Number(it.tax_rate || 0)}" /></td>
          <td><input type="number" class="o_input exp-item-field text-end" data-field="total" data-idx="${idx}" min="0" step="any" value="${Number(it.total || 0)}" style="font-weight: 600;" /></td>
          <td class="text-center">${expenseItems.length > 1 ? `<button type="button" class="btn btn-sm btn-danger btn-remove-exp-item" data-idx="${idx}" title="Quitar ítem">Quitar</button>` : ''}</td>
        </tr>`).join('');

      tbody.querySelectorAll('.exp-item-desc').forEach((input) => {
        input.addEventListener('input', (e) => {
          const i = Number(e.target.dataset.idx);
          if (expenseItems[i]) expenseItems[i].description = e.target.value;
        });
      });

      tbody.querySelectorAll('.exp-item-field').forEach((input) => {
        input.addEventListener('input', (e) => {
          const i = Number(e.target.dataset.idx);
          const field = e.target.dataset.field;
          const item = expenseItems[i];
          const row = tbody.querySelector(`tr[data-item-idx="${i}"]`);
          if (!row || !item) return;
          item[field] = Number(e.target.value || 0);
          const setField = (f, v) => { item[f] = v; const el = row.querySelector(`[data-field="${f}"]`); if (el) el.value = v; };
          if (field === 'total') {
            const rate = Number(item.tax_rate || 0);
            const sub = rate > 0 ? round2c(item.total / (1 + rate / 100)) : item.total;
            item.subtotal = sub;
            item.tax_amount = round2c(item.total - sub);
            if (Number(item.quantity || 0) > 0 && !item.price_unit) setField('price_unit', round2c(sub / item.quantity));
          } else if (field === 'quantity' || field === 'price_unit') {
            const sub = round2c(Number(item.quantity || 0) * Number(item.price_unit || 0));
            const tax = round2c(sub * (Number(item.tax_rate || 0) / 100));
            item.subtotal = sub;
            item.tax_amount = tax;
            setField('total', round2c(sub + tax));
          } else if (field === 'tax_rate') {
            const rate = Number(item.tax_rate || 0);
            if (item.total > 0 && (!item.price_unit || !item.quantity)) {
              const sub = rate > 0 ? round2c(item.total / (1 + rate / 100)) : item.total;
              item.subtotal = sub;
              item.tax_amount = round2c(item.total - sub);
            } else {
              const sub = round2c(Number(item.quantity || 1) * Number(item.price_unit || 0));
              const tax = round2c(sub * (rate / 100));
              item.subtotal = sub;
              item.tax_amount = tax;
              setField('total', round2c(sub + tax));
            }
          }
          literalTotals = null;
          recalcExpenseTotal();
        });
      });

      tbody.querySelectorAll('.btn-remove-exp-item').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          expenseItems.splice(Number(e.currentTarget.dataset.idx), 1);
          literalTotals = null;
          renderExpenseItems();
          recalcExpenseTotal();
        });
      });
      renderExpenseSummary();
    };

    const recalcExpenseTotal = () => {
      const sum = expenseItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
      const totalInput = document.getElementById('fExpTotal');
      if (totalInput) totalInput.value = Math.round(sum * 100) / 100;
      renderExpenseSummary();
    };
    renderExpenseItems();

    const btnAddItem = document.getElementById('btnAddExpenseItem');
    if (btnAddItem) {
      btnAddItem.addEventListener('click', () => {
        expenseItems.push({ description: '', quantity: 1, price_unit: 0, tax_rate: 0, tax_amount: 0, subtotal: 0, total: 0 });
        literalTotals = null;
        renderExpenseItems();
      });
    }

    // Unified Supplier Combobox (filters only suppliers, searches live, and offers "Crear proveedor" option)
    const partnerIdInput = document.getElementById('fExpPartner');
    const partnerNameInputEl = document.getElementById('fExpPartnerName');
    const supplierDropdown = document.getElementById('fExpSupplierDropdown');
    const toggleSupplierBtn = document.getElementById('btnToggleSupplierDropdown');

    const renderSupplierDropdownOptions = (filterText = '') => {
      if (!supplierDropdown) return;
      const suppliers = typeof getSupplierContactsList === 'function' ? getSupplierContactsList() : (state.data.contacts || []).filter((c) => Number(c.supplier_rank) > 0);
      const q = String(filterText || '').trim().toLowerCase();
      const matches = q ? suppliers.filter((c) => (c.name || '').toLowerCase().includes(q) || (c.company_name || '').toLowerCase().includes(q) || (c.vat || '').toLowerCase().includes(q)) : suppliers;
      const exactMatch = q && suppliers.some((c) => (c.name || '').trim().toLowerCase() === q);

      let html = matches.length === 0 && !q
        ? `<div style="padding: 10px 12px; font-size: 0.83rem; color: var(--o-muted);">No hay proveedores registrados. Escribe el nombre para crearlo.</div>`
        : matches.map((c) => `<div class="o_supplier_option" data-supp-id="${c.id}" style="padding: 8px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(148,163,184,0.12); font-size: 0.88rem;"><div><strong>${esc(c.name)}</strong>${c.vat ? `<span style="font-size: 0.78rem; color: var(--o-muted); margin-left: 6px;">NIT: ${esc(c.vat)}</span>` : ''}</div><span class="o_badge o_badge_info" style="font-size: 0.7rem;">Proveedor</span></div>`).join('');

      if (q && !exactMatch) {
        const rawTyped = String(filterText || '').trim();
        html += `<div class="o_supplier_create_option" data-create-name="${esc(rawTyped)}" style="padding: 9px 12px; cursor: pointer; background: rgba(37, 99, 235, 0.12); color: #38bdf8; font-weight: 600; font-size: 0.88rem; display: flex; align-items: center; gap: 6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span>Crear proveedor "<strong>${esc(rawTyped)}</strong>"</span></div>`;
      }

      supplierDropdown.innerHTML = html;
      supplierDropdown.style.display = 'block';

      supplierDropdown.querySelectorAll('.o_supplier_option').forEach((opt) => {
        opt.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          const p = suppliers.find((c) => Number(c.id) === Number(opt.getAttribute('data-supp-id')));
          if (p) {
            if (partnerIdInput) partnerIdInput.value = String(p.id);
            if (partnerNameInputEl) partnerNameInputEl.value = p.name;
            const vatInput = document.getElementById('fExpPartnerVat');
            if (vatInput) vatInput.value = p.vat || '';
            existing.partner_id = p.id;
            existing.partner_name = p.name;
            existing.supplier_vat = p.vat || '';
          }
          supplierDropdown.style.display = 'none';
        });
      });

      const createOpt = supplierDropdown.querySelector('.o_supplier_create_option');
      if (createOpt) {
        createOpt.addEventListener('mousedown', async (ev) => {
          ev.preventDefault();
          const newName = createOpt.getAttribute('data-create-name') || (partnerNameInputEl ? partnerNameInputEl.value.trim() : '');
          if (!newName) return;
          const vatInput = document.getElementById('fExpPartnerVat');
          const currentVat = vatInput ? vatInput.value.trim() : '';
          supplierDropdown.style.display = 'none';
          try {
            const res = await apiCall('/api/contacts', 'POST', { name: newName, company_name: newName, is_company: true, doc_type: 'NIT', vat: currentVat, customer_rank: 0, supplier_rank: 1, category_ids: ['Proveedor'], notes: 'Proveedor creado desde el módulo de Gastos.' });
            const created = res.contact;
            if (created) {
              if (partnerIdInput) partnerIdInput.value = String(created.id);
              if (partnerNameInputEl) partnerNameInputEl.value = created.name;
              if (vatInput && created.vat) vatInput.value = created.vat;
              existing.partner_id = created.id;
              existing.partner_name = created.name;
              existing.supplier_vat = created.vat || currentVat;
              showToast(`Proveedor "${created.name}" creado y seleccionado.`);
            }
          } catch (err) {
            showToast(err.message, true);
          }
        });
      }
    };

    if (partnerNameInputEl) {
      partnerNameInputEl.addEventListener('focus', () => renderSupplierDropdownOptions(partnerNameInputEl.value));
      partnerNameInputEl.addEventListener('input', (e) => {
        const val = e.target.value;
        const suppliers = typeof getSupplierContactsList === 'function' ? getSupplierContactsList() : [];
        const matched = suppliers.find((c) => (c.name || '').trim().toLowerCase() === val.trim().toLowerCase());
        if (partnerIdInput) partnerIdInput.value = matched ? String(matched.id) : '';
        if (matched && matched.vat && document.getElementById('fExpPartnerVat')) document.getElementById('fExpPartnerVat').value = matched.vat;
        renderSupplierDropdownOptions(val);
      });
      partnerNameInputEl.addEventListener('blur', () => setTimeout(() => { if (supplierDropdown) supplierDropdown.style.display = 'none'; }, 180));
    }

    if (toggleSupplierBtn) {
      toggleSupplierBtn.addEventListener('click', () => {
        if (!supplierDropdown) return;
        if (supplierDropdown.style.display === 'block') supplierDropdown.style.display = 'none';
        else { renderSupplierDropdownOptions(''); if (partnerNameInputEl) partnerNameInputEl.focus(); }
      });
    }

    const updateReceiptAttachmentPreview = (imgSrc) => {
      existing.receipt_image = imgSrc;
      const wrap = document.getElementById('formReceiptPreviewWrap');
      if (wrap) {
        wrap.innerHTML = `<div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;"><img src="${imgSrc}" class="o_expense_receipt_preview" alt="Comprobante factura" onclick="openImageLightbox(this.src, 'Comprobante de Factura')" title="Clic para ver tamaño grande" /><div style="display: flex; flex-direction: column; gap: 6px;"><span class="o_badge o_badge_success" style="align-self: flex-start;">✓ Foto de Factura Adjuntada</span><span style="font-size: 0.82rem; color: var(--o-muted);">Se guardará como archivo adjunto y quedará registrada en el Chatter al guardar el gasto.</span><div style="display: flex; gap: 8px; flex-wrap: wrap;"><button type="button" class="btn btn-sm btn-secondary" onclick="openImageLightbox(document.querySelector('#formReceiptPreviewWrap img')?.src, 'Comprobante de Factura')">Ver Tamaño Completo</button><a href="${imgSrc}" download="Factura_Adjunta.jpg" class="btn btn-sm btn-secondary" style="text-decoration: none;">Descargar Adjunto</a></div></div></div>`;
      }
    };

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
        literalTotals = scannedData.total_amount ? { untaxed: Number(scannedData.subtotal_amount || 0) || (Number(scannedData.total_amount) - Number(scannedData.tax_amount || 0)), tax: Number(scannedData.tax_amount || 0), total: Number(scannedData.total_amount) } : null;
        if (scannedData.notes) document.getElementById('fExpNotes').value = scannedData.notes;

        if (Array.isArray(scannedData.items) && scannedData.items.length > 0) {
          expenseItems = scannedData.items.map(normalizeExpenseItem);
          renderExpenseItems();
        } else if (scannedData.name || scannedData.total_amount) {
          expenseItems = [normalizeExpenseItem({ description: scannedData.name || 'Gasto proveedor', quantity: 1, price_unit: Number(scannedData.subtotal_amount || scannedData.total_amount || 0), tax_amount: Number(scannedData.tax_amount || 0), subtotal: Number(scannedData.subtotal_amount || scannedData.total_amount || 0), total: Number(scannedData.total_amount || 0) })];
          renderExpenseItems();
        }

        if (imageBase64) updateReceiptAttachmentPreview(imageBase64);
        showToast('Datos de la factura cargados en el formulario.');
      });
    };

    const expBillBtn = document.getElementById('btnExpenseBillLink');
    if (expBillBtn && existing.move_id) {
      expBillBtn.addEventListener('click', () => {
        openApp('accounting', { submenu: 'in_invoice', viewType: 'form', recordId: existing.move_id, returnTo: { app: 'expenses', submenu: state.submenu, viewType: 'form', recordId: existing.id } });
      });
    }

    const formScanBtn = document.getElementById('btnFormScanAi');
    if (formScanBtn) formScanBtn.addEventListener('click', openCameraForForm);
    const formCamTrig = document.getElementById('btnFormCameraTrigger');
    if (formCamTrig) formCamTrig.addEventListener('click', openCameraForForm);

    const directFileAttach = document.getElementById('fExpDirectFileAttach');
    if (directFileAttach) {
      directFileAttach.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const compressed = await compressImageFile(file, 1280, 1280, 0.82);
          updateReceiptAttachmentPreview(compressed);
          showToast('Foto adjuntada al gasto.');
        } catch (err) {
          showToast(err.message, true);
        }
      });
    }

    const cancelBtn = document.getElementById('btnCancelExpense');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (state.navStack && state.navStack.length > 0) {
          const prev = state.navStack.pop();
          openApp(prev.app, { submenu: prev.submenu, viewType: prev.viewType, recordId: prev.recordId, partnerFilter: prev.partnerFilter, skipReturnPush: true });
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
          if (!name) { showToast('La descripción del gasto es obligatoria.', true); return; }
          const totalAmount = Number(document.getElementById('fExpTotal').value || 0);
          if (!totalAmount || totalAmount <= 0) { showToast('El monto total del gasto debe ser mayor a 0.', true); return; }

          const partnerVal = document.getElementById('fExpPartner').value;
          const partnerNameInput = document.getElementById('fExpPartnerName').value.trim();
          const matchedPartner = partnerVal
            ? (state.data.contacts || []).find((c) => Number(c.id) === Number(partnerVal))
            : (partnerNameInput ? (state.data.contacts || []).find((c) => c.name.toLowerCase() === partnerNameInput.toLowerCase()) : null);

          const prodEl = document.getElementById('fExpProduct');
          const prodVal = prodEl && prodEl.value ? prodEl.value : (existing.product_id || null);
          const suppVatInput = document.getElementById('fExpPartnerVat') ? document.getElementById('fExpPartnerVat').value.trim() : '';

          const domRows = document.querySelectorAll('#expenseItemsTbody tr[data-item-idx]');
          if (domRows && domRows.length > 0) {
            domRows.forEach((tr) => {
              const rIdx = Number(tr.getAttribute('data-item-idx'));
              if (!expenseItems[rIdx]) return;
              const descInp = tr.querySelector('.exp-item-desc');
              const qtyInp = tr.querySelector('[data-field="quantity"]');
              const priceInp = tr.querySelector('[data-field="price_unit"]');
              const taxInp = tr.querySelector('[data-field="tax_rate"]');
              const totInp = tr.querySelector('[data-field="total"]');
              if (descInp) expenseItems[rIdx].description = descInp.value.trim();
              if (qtyInp) expenseItems[rIdx].quantity = Number(qtyInp.value || 1);
              if (priceInp) expenseItems[rIdx].price_unit = Number(priceInp.value || 0);
              if (taxInp) expenseItems[rIdx].tax_rate = Number(taxInp.value || 0);
              if (totInp) expenseItems[rIdx].total = Number(totInp.value || 0);
            });
          }

          const cleanItems = expenseItems
            .filter((it) => (it.description && String(it.description).trim()) || Number(it.price_unit) > 0 || Number(it.total) > 0 || Number(it.subtotal) > 0)
            .map((it, idx) => {
              const qty = Math.max(0.001, Number(it.quantity || 1));
              const rate = Number(it.tax_rate || 0);
              const rawPrice = Number(it.price_unit || 0);
              const rawTot = Number(it.total || 0);
              const tot = rawTot > 0 ? rawTot : round2c(qty * rawPrice * (1 + rate / 100));
              const sub = it.subtotal !== undefined && it.subtotal !== null && Number(it.subtotal) > 0 ? Number(it.subtotal) : (rate > 0 ? round2c(tot / (1 + rate / 100)) : tot);
              const tax = it.tax_amount !== undefined && it.tax_amount !== null && Number(it.tax_amount) > 0 ? Number(it.tax_amount) : round2c(tot - sub);
              return { id: it.id || idx + 1, product_id: it.product_id || null, description: String(it.description || name).trim(), quantity: qty, price_unit: rawPrice > 0 ? rawPrice : (qty > 0 ? round2c(sub / qty) : 0), tax_rate: rate, tax_amount: tax, subtotal: sub, total: tot };
            });
          const useLiteral = Boolean(literalTotals && Math.abs(literalTotals.total - totalAmount) < 0.01);

          const payload = {
            id: isNew ? undefined : existing.id,
            name,
            employee_name: document.getElementById('fExpEmployee').value.trim() || 'Andrés Salazar',
            department: existing.department || 'Operaciones & Proyectos',
            product_id: prodVal ? Number(prodVal) : null,
            product_name: prodVal ? ((state.data.products.find((p) => Number(p.id) === Number(prodVal)) || {}).name || name) : (cleanItems[0] ? cleanItems[0].description : name),
            partner_id: matchedPartner ? matchedPartner.id : (existing.partner_id || null),
            partner_name: partnerNameInput || (matchedPartner ? matchedPartner.name : ''),
            supplier_vat: suppVatInput || existing.supplier_vat || '',
            date: document.getElementById('fExpDate').value,
            receipt_ref: document.getElementById('fExpReceipt').value.trim(),
            quantity: 1,
            price_unit: totalAmount,
            tax_rate: 0,
            untaxed_amount: useLiteral ? literalTotals.untaxed : undefined,
            tax_amount: useLiteral ? literalTotals.tax : undefined,
            total_amount: totalAmount,
            literal_totals: useLiteral,
            journal_code: document.getElementById('fExpJournal') ? document.getElementById('fExpJournal').value : (existing.journal_code || 'CSH1'),
            payment_mode: (document.getElementById('fExpPayMode') && document.getElementById('fExpPayMode').value) || existing.payment_mode || 'company_account',
            notes: document.getElementById('fExpNotes').value.trim(),
            receipt_image: existing.receipt_image || '',
            items: cleanItems.length > 0 ? cleanItems : [{ id: 1, description: name, quantity: 1, price_unit: totalAmount, tax_rate: 0, tax_amount: 0, subtotal: totalAmount, total: totalAmount }]
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
