/* ==========================================================================
   CH Aluminios ERP -- JS Module: 10-sales-form.js
   Module 3 (Part 2): Ventas Form & Split-View Live PDF Preview (sale.order)
   ========================================================================== */
'use strict';

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
    const isEditable = isNew || existing.state === 'draft' || existing.state === 'sent';
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
                  ${isEditable ? `<button type="button" class="btn btn-primary" id="btnSaveSaleOrder">Guardar</button>` : ''}
                  ${
                    !isNew && (existing.state === 'draft' || existing.state === 'sent')
                      ? `<button type="button" class="btn btn-action" id="btnSendSaleWhatsApp" style="background: #25D366; border-color: #25D366; color: #fff; display: inline-flex; align-items: center; gap: 0.35rem;">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2z"></path></svg>
                          <span>Enviar por WhatsApp</span>
                        </button>`
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
                    <select id="fSalePartner" class="o_select" ${!isEditable ? 'disabled' : ''}>
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
                    <select id="fSalePaymentTerm" class="o_select" ${!isEditable ? 'disabled' : ''}>
                      <option value="" ${!draft.payment_term ? 'selected disabled' : ''}>— Seleccione plazo de pago —</option>
                      ${['Contado', '15 Días', '30 Días', '45 Días', '60 Días']
                        .map((t) => `<option value="${t}" ${draft.payment_term === t ? 'selected' : ''}>${t}</option>`)
                        .join('')}
                    </select>
                  </div>
                  <div class="o_field_row">
                    <label for="fSaleDate">Fecha de Orden</label>
                    <input type="date" id="fSaleDate" class="o_input" value="${esc(draft.date_order)}" ${!isEditable ? 'disabled' : ''} />
                  </div>
                  <div class="o_field_row">
                    <label for="fSaleValidity">Fecha de Expiración</label>
                    <input type="date" id="fSaleValidity" class="o_input" value="${esc(draft.validity_date)}" ${!isEditable ? 'disabled' : ''} />
                  </div>
                  <div class="o_field_row">
                    <label for="fSalePerson">Comercial Asignado</label>
                    <input type="text" id="fSalePerson" class="o_input" value="${esc(draft.salesperson)}" ${!isEditable ? 'disabled' : ''} />
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
                        ${isEditable ? `<th style="width: 50px;"></th>` : ''}
                      </tr>
                    </thead>
                    <tbody id="saleLinesTbody">
                      ${draftLines
                        .map((l, idx) => {
                          const sub = Number(l.quantity || 0) * Number(l.price_unit || 0) * (1 - Number(l.discount || 0) / 100);
                          return `
                          <tr data-line-idx="${idx}">
                            <th>
                              <select class="o_select line-product" data-idx="${idx}" ${!isEditable ? 'disabled' : ''}>
                                <option value="" ${!l.product_id ? 'selected disabled' : ''}>— Seleccione producto —</option>
                                ${(state.data.products || [])
                                  .map(
                                    (p) => `<option value="${p.id}" ${Number(l.product_id) === Number(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`
                                  )
                                  .join('')}
                              </select>
                            </th>
                            <td><input type="text" class="o_input line-desc" data-idx="${idx}" value="${esc(l.description || '')}" ${!isEditable ? 'readonly' : ''} /></td>
                            <td><input type="number" class="o_input line-qty" data-idx="${idx}" min="1" step="any" value="${Number(l.quantity || 1)}" ${!isEditable ? 'readonly' : ''} /></td>
                            <td><input type="number" class="o_input line-price" data-idx="${idx}" min="0" step="any" value="${Number(l.price_unit || 0)}" ${!isEditable ? 'readonly' : ''} /></td>
                            <td><input type="number" class="o_input line-disc" data-idx="${idx}" min="0" max="100" step="any" value="${Number(l.discount || 0)}" ${!isEditable ? 'readonly' : ''} /></td>
                            <td>
                              <select class="o_select line-tax" data-idx="${idx}" ${!isEditable ? 'disabled' : ''}>
                                <option value="" ${l.tax_rate === undefined || l.tax_rate === null || l.tax_rate === '' ? 'selected disabled' : ''}>— IVA —</option>
                                ${[0, 5, 19]
                                  .map((t) => `<option value="${t}" ${l.tax_rate !== '' && Number(l.tax_rate) === t ? 'selected' : ''}>${t}%</option>`)
                                  .join('')}
                              </select>
                            </td>
                            <td class="text-end"><strong>${formatMoney(sub)}</strong></td>
                            ${isEditable ? `<td><button type="button" class="btn btn-sm btn-danger btn-remove-line" data-idx="${idx}" title="Quitar línea">Quitar</button></td>` : ''}
                          </tr>
                        `;
                        })
                        .join('')}
                    </tbody>
                  </table>
                </div>

                ${isEditable ? `<button type="button" class="btn btn-secondary btn-sm" id="btnAddSaleLine">Agregar producto / línea</button>` : ''}

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
                  <textarea id="fSaleNotes" class="o_textarea" rows="2" ${!isEditable ? 'readonly' : ''}>${esc(draft.notes || '')}</textarea>
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

    const btnAddLineEl = document.getElementById('btnAddSaleLine');
    if (btnAddLineEl) {
      btnAddLineEl.addEventListener('click', () => {
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
    }

    const saveOrderNow = async (forceSave = false) => {
      if (!isEditable) {
        showToast('No se puede modificar un pedido de venta confirmado o cancelado.', true);
        throw new Error('No se puede modificar un pedido de venta confirmado o cancelado.');
      }
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

      if (!isNew && !hasSaleDraftChanged(existing, state.formDraft) && !forceSave) {
        return existing;
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

    const btnSaveSale = document.getElementById('btnSaveSaleOrder');
    if (btnSaveSale) {
      btnSaveSale.addEventListener('click', () => {
        withActionLock(btnSaveSale, async () => {
          syncSaleDraft();
          if (!isNew && !hasSaleDraftChanged(existing, state.formDraft)) {
            showToast('No hay cambios pendientes por guardar.');
            return;
          }
          await saveOrderNow(true);
          showToast('Cotización / Pedido guardado.');
          renderModuleWorkspace();
        }).catch((err) => showToast(err.message, true));
      });
    }

    const btnSendSaleWa = document.getElementById('btnSendSaleWhatsApp');
    if (btnSendSaleWa) {
      btnSendSaleWa.addEventListener('click', () => {
        withActionLock(btnSendSaleWa, async () => {
          const savedOrder = await saveOrderNow(false);
          await sendDocumentViaWhatsApp({
            model: 'sales',
            record: savedOrder || existing,
            containerSelector: '.o_sale_pdf_preview #salePdfSheet',
            filename: `Cotizacion_${((savedOrder || existing).name || 'COT').replace(/[\/\\]/g, '_')}.pdf`
          });
        }).catch((err) => showToast(err.message, true));
      });
    }

    container.querySelectorAll('[data-sale-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        withActionLock(btn, async () => {
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
                if (isEditable) {
                  await saveOrderNow(false);
                }
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

          if (isEditable) {
            await saveOrderNow(false);
          }
          const res = await apiCall(`/api/sales/${state.activeRecordId}/action`, 'POST', { action });
          state.formDraft = null;
          showToast('Estado del pedido actualizado.');
          renderModuleWorkspace();
        }).catch((err) => showToast(err.message, true));
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

