/* ==========================================================================
   CH Aluminios ERP -- JS Module: 13-accounting-form.js
   Module 4 (Part 2): Contabilidad -- Invoice/Bill Form & Split-View Live PDF Preview
   ========================================================================== */
'use strict';


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
                !isNew && existing.move_type === 'out_invoice' && existing.state !== 'cancel'
                  ? `<button type="button" class="btn btn-action" id="btnSendInvoiceWhatsApp" style="background: #25D366; border-color: #25D366; color: #fff; display: inline-flex; align-items: center; gap: 0.35rem;">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2z"></path></svg>
                      <span>Enviar por WhatsApp</span>
                    </button>`
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

    const saveMoveFromForm = async (autoPost, forceSave = false) => {
      syncMoveDraft();
      if (!state.formDraft.partner_id) {
        showToast('Debe seleccionar un cliente o proveedor.', true);
        throw new Error('Debe seleccionar un cliente o proveedor.');
      }
      if (!isNew && !autoPost && !hasMoveDraftChanged(existing, state.formDraft) && !forceSave) {
        showToast('No hay cambios pendientes por guardar.');
        return existing;
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
      return res.move;
    };

    const btnSaveDraft = document.getElementById('btnSaveDraftMove');
    if (btnSaveDraft) {
      btnSaveDraft.addEventListener('click', () => {
        withActionLock(btnSaveDraft, () => saveMoveFromForm(false, false)).catch((e) => showToast(e.message, true));
      });
    }

    const btnSavePost = document.getElementById('btnSaveAndPostMove');
    if (btnSavePost) {
      btnSavePost.addEventListener('click', () => {
        withActionLock(btnSavePost, () => saveMoveFromForm(true, true)).catch((e) => showToast(e.message, true));
      });
    }

    const btnSendInvWa = document.getElementById('btnSendInvoiceWhatsApp');
    if (btnSendInvWa) {
      btnSendInvWa.addEventListener('click', () => {
        withActionLock(btnSendInvWa, async () => {
          if (isEditable && hasMoveDraftChanged(existing, state.formDraft)) {
            await saveMoveFromForm(false, true);
          }
          await sendDocumentViaWhatsApp({
            model: 'accounting',
            record: existing,
            containerSelector: '.o_pdf_paper_viewport #invoicePdfSheet',
            filename: `Factura_${(existing.name || 'FAC').replace(/[\/\\]/g, '_')}.pdf`
          });
        }).catch((err) => showToast(err.message, true));
      });
    }

    container.querySelectorAll('[data-move-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        withActionLock(btn, async () => {
          const action = btn.getAttribute('data-move-action');
          await apiCall(`/api/accounting/moves/${existing.id}/action`, 'POST', { action });
          state.formDraft = null;
          showToast('Documento contable actualizado.');
          renderModuleWorkspace();
        }).catch((err) => showToast(err.message, true));
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
      btnGenResidualMove.addEventListener('click', () => {
        withActionLock(btnGenResidualMove, async () => {
          const res = await apiCall('/api/accounting/moves/' + existing.id + '/action', 'POST', {
            action: 'generate_residual_invoice'
          });
          const nextInv = res.next_invoice || (res.move && res.move.next_invoice);
          showToast('Siguiente factura ' + (nextInv ? nextInv.name : '') + ' generada por el saldo restante.');
          if (nextInv) {
            state.activeRecordId = nextInv.id;
          }
          renderModuleWorkspace();
        }).catch((err) => showToast(err.message, true));
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

