/* ==========================================================================
   CH Aluminios ERP -- JS Module: 07-pdf-invoice.js
   Document Engine (Part 1): Spanish Number-to-Words & A4 Invoice PDF Renderer/Exporter
   ========================================================================== */
'use strict';

  function numberToWordsSpanish(n) {
    const numVal = Number(n);
    if (isNaN(numVal) || numVal === 0) return 'CERO PESOS M/CTE';
    const isNeg = numVal < 0;
    const absVal = Math.abs(numVal);
    const integerPart = Math.floor(absVal);
    const cents = Math.round((absVal - integerPart) * 100);

    const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const DECENAS_10_19 = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    function readGroup(num) {
      if (num === 0) return '';
      if (num === 100) return 'CIEN';
      let str = '';
      const c = Math.floor(num / 100);
      const du = num % 100;
      const d = Math.floor(du / 10);
      const u = du % 10;
      if (c > 0) str += CENTENAS[c] + ' ';
      if (du >= 10 && du <= 19) {
        str += DECENAS_10_19[du - 10] + ' ';
      } else if (du >= 21 && du <= 29) {
        str += (u === 1 ? 'VEINTIÚN' : 'VEINTI' + UNIDADES[u]) + ' ';
      } else {
        if (d > 0) str += DECENAS[d] + (u > 0 ? ' Y ' : ' ');
        if (u > 0) str += UNIDADES[u] + ' ';
      }
      return str.trim();
    }

    const chunks = [];
    let temp = integerPart;
    while (temp > 0) {
      chunks.push(temp % 1000);
      temp = Math.floor(temp / 1000);
    }

    const c0 = chunks[0] || 0;
    const c1 = chunks[1] || 0;
    const c2 = chunks[2] || 0;
    const c3 = chunks[3] || 0;

    let milMillonesStr = '';
    if (c3 > 0) {
      milMillonesStr = c3 === 1 ? 'MIL' : readGroup(c3) + ' MIL';
    }

    let millonesStr = '';
    if (c3 > 0 || c2 > 0) {
      if (c3 > 0 && c2 === 0) {
        millonesStr = milMillonesStr + ' MILLONES';
      } else if (c3 > 0 && c2 > 0) {
        millonesStr = milMillonesStr + ' ' + readGroup(c2) + ' MILLONES';
      } else if (c2 === 1) {
        millonesStr = 'UN MILLÓN';
      } else {
        millonesStr = readGroup(c2) + ' MILLONES';
      }
    }

    let milesStr = '';
    if (c1 > 0) {
      milesStr = c1 === 1 ? 'MIL' : readGroup(c1) + ' MIL';
    }

    const unidadesStr = readGroup(c0);
    let words = [millonesStr, milesStr, unidadesStr].filter(Boolean).join(' ').trim();
    if (!words) words = 'CERO';

    const currencyUnit = integerPart === 1 ? 'PESO' : 'PESOS';
    const centsStr = cents > 0 ? (' CON ' + String(cents).padStart(2, '0') + '/100') : '';
    const prefix = isNeg ? 'MENOS ' : '';
    return (prefix + words + ' ' + currencyUnit + centsStr + ' M/CTE').toUpperCase().replace(/\s+/g, ' ');
  }

  
  let cachedLogoDataUrl = '';
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    fetch('/assets/icons/logo.png')
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result && typeof reader.result === 'string') {
            cachedLogoDataUrl = reader.result;
          }
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {});
  }

  function getLogoDataUrl() {
    if (cachedLogoDataUrl) return cachedLogoDataUrl;
    try {
      const homeLogo = document.querySelector('.o_home_menu_logo');
      if (homeLogo && homeLogo.complete && homeLogo.naturalWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = homeLogo.naturalWidth;
        canvas.height = homeLogo.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(homeLogo, 0, 0);
        cachedLogoDataUrl = canvas.toDataURL('image/png');
        return cachedLogoDataUrl;
      }
    } catch (_) {}
    return cachedLogoDataUrl || '';
  }

  function renderInvoicePdfSheetHtml(invoice) {
    const company = state.data.settings || {};
    const partner = (state.data.contacts || []).find((c) => Number(c.id) === Number(invoice.partner_id)) || {
      name: invoice.partner_name || 'Consumidor Final',
      vat: invoice.partner_vat || '222222222',
      doc_type: 'NIT',
      street: '',
      city: 'Pereira',
      state_name: 'Risaralda',
      mobile: '',
      phone: '',
      email: ''
    };

    const lines = invoice.lines && invoice.lines.length > 0 ? invoice.lines : [
      { name: 'Venta de Bienes / Servicios', quantity: 1, uom: 'Und', price_unit: Number(invoice.amount_untaxed || invoice.amount_total || 0), tax_rate: 19, subtotal: Number(invoice.amount_untaxed || invoice.amount_total || 0) }
    ];
    const linkedSale = (state.data.sales || []).find((s) => s.name === invoice.origin || s.name === invoice.ref);
    const totalSaleAmount = linkedSale ? Number(linkedSale.amount_total || 0) : Number(invoice.order_total || invoice.amount_total);
    const isAbono = invoice.is_installment || Boolean(invoice.installment_number) || Boolean(invoice.order_residual !== undefined && invoice.order_residual !== null && invoice.order_residual > 0);

    const isCancel = invoice.state === 'cancel';
    const isDraft = !isCancel && invoice.state === 'draft';
    const isPaid = !isCancel && (invoice.payment_state === 'paid' || (invoice.state === 'posted' && Number(invoice.amount_residual ?? 0) <= 0.001));
    const isPartial = !isPaid && !isDraft && !isCancel && (invoice.payment_state === 'partial' || (Number(invoice.amount_residual || 0) < Number(invoice.amount_total || 0) && Number(invoice.amount_residual || 0) > 0));
    const todayStr = new Date().toISOString().slice(0, 10);
    const isOverdue = !isPaid && !isDraft && !isCancel && !isPartial && Boolean(invoice.invoice_date_due && invoice.invoice_date_due < todayStr);

    let watermarkHtml = '';
    if (isCancel) {
      watermarkHtml = '<div class="o_pdf_watermark is-cancel">CANCELADA</div>';
    } else if (isDraft) {
      watermarkHtml = '<div class="o_pdf_watermark is-draft">BORRADOR</div>';
    } else if (isPaid) {
      watermarkHtml = '<div class="o_pdf_watermark is-paid">PAGADA</div>';
    } else if (isPartial) {
      watermarkHtml = '<div class="o_pdf_watermark is-partial">PAGO PARCIAL</div>';
    } else if (isOverdue) {
      watermarkHtml = '<div class="o_pdf_watermark is-overdue">VENCIDA</div>';
    }

    let stampHtml = '';
    if (isCancel) {
      stampHtml = '<div class="o_pdf_stamp is-cancel"><span class="stamp-inner">✕ ANULADA</span><span class="stamp-sub">DOCUMENTO CANCELADO</span></div>';
    } else if (isDraft) {
      stampHtml = '<div class="o_pdf_stamp is-draft"><span class="stamp-inner">✎ BORRADOR</span><span class="stamp-sub">SIN VALIDEZ FISCAL</span></div>';
    } else if (isPaid) {
      stampHtml = '<div class="o_pdf_stamp is-paid"><span class="stamp-inner">✓ PAGADA</span><span class="stamp-sub">CANCELADA TOTAL</span></div>';
    } else if (isPartial) {
      stampHtml = '<div class="o_pdf_stamp is-partial"><span class="stamp-inner">◐ PAGO PARCIAL</span><span class="stamp-sub">SALDO PENDIENTE</span></div>';
    } else if (isOverdue) {
      stampHtml = '<div class="o_pdf_stamp is-overdue"><span class="stamp-inner">⚠ VENCIDA</span><span class="stamp-sub">PAGO MOROSO</span></div>';
    } else {
      stampHtml = '<div class="o_pdf_stamp is-posted"><span class="stamp-inner">★ PUBLICADA</span><span class="stamp-sub">POR COBRAR</span></div>';
    }


    const paymentTerm = partner.payment_term || '30 Días';
    const isCredit = /d[ií]as/i.test(paymentTerm);
    const paymentTypeDesc = isCredit ? `Crédito (${paymentTerm})` : 'Contado';
    const paymentMethodDesc = invoice.journal_name || (isCredit ? 'Crédito Comercial' : 'Transferencia Electrónica / Bancaria');

    const totalUntaxed = Number(invoice.amount_untaxed || 0);
    const totalTax = Number(invoice.amount_tax || 0);
    const totalAmount = Number(invoice.amount_total || 0);
    const residualAmount = Number(invoice.amount_residual ?? 0);
    const paidAmount = Math.max(0, totalAmount - residualAmount);

    const retSourceRate = Number(invoice.retention_source_rate || 0);
    const retIcaRate = Number(invoice.retention_ica_rate || 0);
    const retefuenteAmount = Number(invoice.retention_source_amount ?? (retSourceRate > 0 ? totalUntaxed * (retSourceRate / 100) : 0));
    const reteicaAmount = Number(invoice.retention_ica_amount ?? (retIcaRate > 0 ? totalUntaxed * (retIcaRate / 100) : 0));
    const totalRetentions = retefuenteAmount + reteicaAmount;
    const netPayable = Math.max(0, totalAmount - totalRetentions);

    const hasDiscounts = lines.some((l) => Number(l.discount || 0) > 0);
    const totalDiscount = lines.reduce((sum, l) => {
      const gross = Number(l.quantity || 1) * Number(l.price_unit || 0);
      return sum + (gross * (Number(l.discount || 0) / 100));
    }, 0);

    const logoData = typeof getLogoDataUrl === 'function' ? getLogoDataUrl() : '';
    const logoSrc = logoData && logoData.startsWith('data:') ? logoData : '/assets/icons/logo.png';

    return `
      <div class="o_pdf_sheet" id="invoicePdfSheet">
        ${watermarkHtml}

        <div class="o_pdf_brand_header">
          <div class="o_pdf_brand_identity">
            <div class="o_pdf_logo_col">
              <img src="${logoSrc}" alt="CH Aluminios" class="o_pdf_company_logo" onerror="if(!this.src.startsWith('data:'))this.style.display='none'" />
            </div>
            <div class="o_pdf_company_info">
              <h2>${esc(company.company_name || 'CH Aluminios')}</h2>
              <p><strong>NIT:</strong> ${esc(company.company_vat || '900.876.543-1')} · <span>${esc(company.fiscal_regime || 'Responsable de IVA - Régimen Ordinario')}</span></p>
              <p>${esc(company.company_address || 'Cra. 7 #18-45')} · ${esc(company.company_city || 'Pereira')}, ${esc(company.company_country || 'Colombia')}</p>
              <p>Email: ${esc(company.company_email || 'chappdevm@gmail.com')} · PBX: (606) 315-0000</p>
            </div>
          </div>
          <div class="o_pdf_doc_box">
            <div class="doc_type_title">${invoice.move_type === 'in_invoice' ? 'Factura Proveedor' : 'Factura de Venta'}</div>
            <div class="doc_number">${esc(invoice.name)}</div>
            <div class="o_pdf_doc_meta">
              <div class="o_pdf_doc_meta_row"><span>Emisión:</span><strong>${esc(invoice.invoice_date || '')}</strong></div>
              <div class="o_pdf_doc_meta_row"><span>Vencimiento:</span><strong>${esc(invoice.invoice_date_due || '')}</strong></div>
              ${invoice.origin ? `<div class="o_pdf_doc_meta_row"><span>Orden Origen:</span><strong style="color: #1e40af;">${esc(invoice.origin)}</strong></div>` : ''}
              <div class="o_pdf_doc_meta_row"><span>Forma de Pago:</span><strong>${esc(paymentTypeDesc)}</strong></div>
            </div>
            ${stampHtml}
          </div>
        </div>

        <div class="o_pdf_resolution_bar">
          Resolución DIAN No. 18764000001 de 2026-01-15 · Habilitación Técnica Factura Electrónica · Rango Autorizado: FE-00001 al FE-99999 · Vigencia: 24 Meses
        </div>

        <div class="o_pdf_client_section">
          <div class="o_pdf_client_col">
            <div class="o_pdf_col_title">Adquiriente / Cliente</div>
            <p style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">${esc(partner.name)}</p>
            <p><strong>Cédula / NIT:</strong> ${esc(partner.doc_type || (partner.is_company ? 'NIT' : 'CC'))} ${esc(partner.vat || 'No registrado')}</p>
            <p><strong>Dirección:</strong> ${esc([partner.street, partner.city, partner.state_name].filter(Boolean).join(', ') || 'Pereira, Risaralda')}</p>
            <p><strong>Ciudad / País:</strong> ${esc(partner.city || 'Pereira')}, ${esc(partner.state_name || 'Risaralda')} - Colombia</p>
          </div>
          <div class="o_pdf_client_col">
            <div class="o_pdf_col_title">Datos de Contacto y Comerciales</div>
            <p><strong>Celular / Teléfono:</strong> ${esc([partner.mobile, partner.phone].filter(Boolean).join(' / ') || 'No registrado')}</p>
            <p><strong>Correo:</strong> ${esc(partner.email || 'No registrado')}</p>
            <p><strong>Forma de Pago:</strong> ${esc(paymentTerm)}</p>
            <p><strong>Medio de Pago:</strong> ${esc(paymentMethodDesc)}</p>
          </div>
        </div>

        ${isAbono ? `
          <div class="o_pdf_trace_box">
            <div style="font-weight: 700; color: #1e3a8a; margin-bottom: 4px;">
              Trazabilidad de Abono / Cuota (${esc(invoice.origin || 'Venta')})
            </div>
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <span>Valor Total Pedido: <strong>${formatMoney(totalSaleAmount)}</strong></span>
              <span>Abono en esta Factura: <strong style="color: #059669;">${formatMoney(invoice.amount_total)}</strong></span>
              <span>Saldo Restante Orden: <strong style="color: #d97706;">${formatMoney(invoice.order_residual || 0)}</strong></span>
            </div>
          </div>
        ` : ''}

        ${invoice.prior_invoice_name ? `
          <div class="o_pdf_trace_box" style="background: #f0fdf4; border-color: #22c55e;">
            <div style="font-weight: 700; color: #15803d; margin-bottom: 4px;">
              Trazabilidad de Continuidad por Saldo Restante
            </div>
            <div style="font-size: 0.8rem; color: #166534;">
              Factura emitida por saldo restante tras abono previo de <strong>${formatMoney(invoice.prior_payment_amount || 0)}</strong> el <strong>${esc(invoice.prior_payment_date || '')}</strong> sobre la factura <strong>${esc(invoice.prior_invoice_name)}</strong>.
            </div>
          </div>
        ` : ''}

        ${(invoice.payments_history && invoice.payments_history.length > 0) ? `
          <div class="o_pdf_payments_history_box">
            <div style="font-weight: 700; color: #065f46; margin-bottom: 4px; font-size: 0.82rem;">
              Trazabilidad de Abonos y Pagos Aplicados
            </div>
            <table class="o_pdf_subtable">
              <thead>
                <tr>
                  <th>Fecha Abono</th>
                  <th>Recibo / Ref</th>
                  <th>Medio de Pago</th>
                  <th style="text-align: right;">Monto Abonado</th>
                  <th style="text-align: right;">Saldo Restante</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.payments_history.map(p => `
                  <tr>
                    <td>${esc(p.date)}</td>
                    <td><strong>${esc(p.name)}</strong></td>
                    <td>${esc(p.journal_name || '')}</td>
                    <td style="text-align: right; color: #059669;"><strong>${formatMoney(p.amount)}</strong></td>
                    <td style="text-align: right; color: #d97706;"><strong>${formatMoney(p.residual_after)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <table class="o_pdf_items_table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">#</th>
              <th>Concepto / Producto</th>
              <th style="width: 75px; text-align: center;">Unidad</th>
              <th style="width: 55px; text-align: center;">Cant.</th>
              <th style="width: 105px; text-align: right;">Vr. Unitario</th>
              ${hasDiscounts ? '<th style="width: 60px; text-align: center;">Dcto.</th>' : ''}
              <th style="width: 65px; text-align: center;">IVA</th>
              <th style="width: 110px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${lines.map((l, idx) => {
              const qty = Number(l.quantity || 1);
              const price = Number(l.price_unit || 0);
              const disc = Number(l.discount || 0);
              const calcSub = l.subtotal !== undefined && l.subtotal !== null ? Number(l.subtotal) : (qty * price * (1 - disc / 100));
              return `
                <tr>
                  <td class="text-center" style="color: #64748b;">${idx + 1}</td>
                  <td><strong>${esc(l.name)}</strong></td>
                  <td class="text-center" style="color: #64748b;">${esc(l.uom || (l.name && l.name.toLowerCase().includes('perfil') ? 'Metro Lineal' : 'Und'))}</td>
                  <td class="text-center">${qty}</td>
                  <td class="text-end">${formatMoney(price)}</td>
                  ${hasDiscounts ? `<td class="text-center" style="color: ${disc > 0 ? '#b91c1c' : '#64748b'};">${disc > 0 ? `-${disc}%` : '0%'}</td>` : ''}
                  <td class="text-center">${l.tax_rate ?? 19}%</td>
                  <td class="text-end"><strong>${formatMoney(calcSub)}</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="o_pdf_bottom_grid">
          <div class="o_pdf_bottom_left">
            <div class="o_pdf_amount_words">
              <span class="label">Total en Letras:</span>
              <span class="words">SON: ${numberToWordsSpanish(totalAmount)}</span>
            </div>
          </div>

          <div class="o_pdf_totals_section">
            <table class="o_pdf_totals_table">
              <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;"><strong>${formatMoney(totalUntaxed)}</strong></td>
              </tr>
              ${totalDiscount > 0 ? `
                <tr style="color: #b91c1c; font-size: 0.76rem;">
                  <td>Descuento Comercial:</td>
                  <td style="text-align: right;">- ${formatMoney(totalDiscount)}</td>
                </tr>
              ` : ''}
              <tr>
                <td>Base Gravable (19%):</td>
                <td style="text-align: right;">${formatMoney(totalUntaxed)}</td>
              </tr>
              <tr>
                <td>IVA (19%):</td>
                <td style="text-align: right;"><strong>${formatMoney(totalTax)}</strong></td>
              </tr>
              <tr class="is-grand-total">
                <td>TOTAL:</td>
                <td style="text-align: right;">${formatMoney(totalAmount)}</td>
              </tr>
              ${totalRetentions > 0 ? `
                ${retefuenteAmount > 0 ? `
                  <tr style="color: #b45309; font-size: 0.76rem; background: rgba(254, 243, 199, 0.45);">
                    <td>(-) Retefuente (${retSourceRate}%):</td>
                    <td style="text-align: right;">- ${formatMoney(retefuenteAmount)}</td>
                  </tr>
                ` : ''}
                ${reteicaAmount > 0 ? `
                  <tr style="color: #b45309; font-size: 0.76rem; background: rgba(254, 243, 199, 0.45);">
                    <td>(-) ReteICA (${retIcaRate}%):</td>
                    <td style="text-align: right;">- ${formatMoney(reteicaAmount)}</td>
                  </tr>
                ` : ''}
                <tr class="is-net-total" style="font-weight: 800; font-size: 0.95rem; border-top: 1.5px solid #14B5D9; border-bottom: 1.5px solid #14B5D9; background: rgba(240, 247, 252, 0.9); color: #074073;">
                  <td>NETO A PAGAR:</td>
                  <td style="text-align: right;">${formatMoney(netPayable)}</td>
                </tr>
              ` : ''}
              ${paidAmount > 0 && residualAmount > 0 ? `
                <tr style="color: #059669; font-size: 0.76rem;">
                  <td>Abonos / Pagos Aplicados:</td>
                  <td style="text-align: right;">- ${formatMoney(paidAmount)}</td>
                </tr>
              ` : ''}
              ${isCancel ? `
                <tr class="is-cancel-row">
                  <td>Estado Documento:</td>
                  <td style="text-align: right; color: #cb2f2f; font-weight: 800;">ANULADA</td>
                </tr>
              ` : residualAmount > 0 ? `
                <tr class="is-residual-row">
                  <td>Saldo Pendiente:</td>
                  <td style="text-align: right;">${formatMoney(residualAmount)}</td>
                </tr>
              ` : `
                <tr class="is-paid-row">
                  <td>Estado Pago:</td>
                  <td style="text-align: right;">PAGADA</td>
                </tr>
              `}
            </table>
          </div>
        </div>

        <div class="o_pdf_legal_footer">
          Esta factura de venta es título valor conforme al Código de Comercio colombiano (Arts. 772, 773 y 774) y Ley 1231 de 2008.<br/>
          La firma o constancia de recibido implica la aceptación plena de las mercancías y servicios descritos.<br/>
          Generado automáticamente por <strong>CH Aluminios</strong> — CHapp ERP.
        </div>
      </div>
    `;
  }

  function downloadInvoicePdf(invoice, autoPrint = false) {
    const company = state.data.settings || {};

    // Direct PDF file export via html2pdf when clicking Download (!autoPrint)
    if (!autoPrint && typeof window !== 'undefined' && typeof window.html2pdf === 'function') {
      const filename = `Factura_${(invoice.name || 'documento').replace(/[/\\]/g, '_')}.pdf`;
      const container = document.querySelector('.o_pdf_paper_viewport #invoicePdfSheet') || document.getElementById('invoicePdfSheet');
      const targetEl = container ? container.cloneNode(true) : null;
      if (targetEl) {
        targetEl.style.width = '210mm';
        targetEl.style.margin = '0 auto';
        targetEl.style.boxShadow = 'none';
        targetEl.style.border = 'none';
        const logoData = getLogoDataUrl();
        const logoImg = targetEl.querySelector('.o_pdf_company_logo');
        if (logoImg) {
          logoImg.style.display = 'block';
          if (logoData && logoData.startsWith('data:')) {
            logoImg.src = logoData;
          }
        }

        const opt = {
          margin: [8, 8, 8, 8],
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        if (typeof showToast === 'function') showToast('Generando archivo PDF...');
        window.html2pdf().set(opt).from(targetEl).save().then(() => {
          if (typeof showToast === 'function') showToast(`PDF descargado: ${filename}`);
        }).catch((err) => {
          console.warn('Error exportando con html2pdf, abriendo diálogo de impresión:', err);
          downloadInvoicePdf(invoice, true);
        });
        return;
      }
    }

    let sheetHtml = renderInvoicePdfSheetHtml(invoice);
    const logoData = getLogoDataUrl();
    if (logoData && logoData.startsWith('data:')) {
      sheetHtml = sheetHtml.replace('src="/assets/icons/logo.png"', 'src="' + logoData + '"');
      sheetHtml = sheetHtml.replace(/onerror="[^"]*"/g, '');
    } else if (window.location && window.location.origin) {
      sheetHtml = sheetHtml.replace('src="/assets/icons/logo.png"', 'src="' + window.location.origin + '/assets/icons/logo.png"');
    }
    const printScript = autoPrint ? '<script>window.addEventListener("load", function() { var imgs = Array.from(document.images); Promise.all(imgs.map(function(img) { if (img.complete) return Promise.resolve(); return new Promise(function(res) { img.onload = img.onerror = res; }); })).then(function() { setTimeout(function() { window.print(); }, 250); }); });</script>' : '';

    const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Factura ${esc(invoice.name)} - ${esc(company.company_name || 'CH Aluminios')}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #031626;
      color: #1e293b;
    }
    .o_pdf_sheet {
      position: relative;
      overflow: hidden;
      max-width: 840px;
      margin: 0 auto;
      padding: 2.2rem 2rem;
      background: #ffffff;
      border: 1px solid #cbe0f1;
      border-radius: 6px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
      font-size: 0.82rem;
      line-height: 1.45;
    }
    .o_pdf_watermark {
      position: absolute;
      top: 48%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-28deg);
      font-size: 4.8rem;
      font-weight: 900;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      pointer-events: none;
      user-select: none;
      z-index: 1;
      border: 6px dashed currentColor;
      padding: 0.6rem 2.2rem;
      border-radius: 12px;
      line-height: 1;
      white-space: nowrap;
    }
    .o_pdf_watermark.is-paid { color: #22b053; opacity: 0.16; border-style: double; border-width: 8px; }
    .o_pdf_watermark.is-draft { color: #5593c2; opacity: 0.14; }
    .o_pdf_watermark.is-cancel { color: #cb2f2f; opacity: 0.16; }
    .o_pdf_watermark.is-partial { color: #14B5D9; opacity: 0.16; }
    .o_pdf_watermark.is-overdue { color: #cb2f2f; opacity: 0.16; }
    .o_pdf_stamp {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 2px solid currentColor;
      border-radius: 6px;
      padding: 3px 10px;
      text-transform: uppercase;
      font-weight: 800;
      line-height: 1.15;
      margin-top: 6px;
      letter-spacing: 0.04em;
    }
    .o_pdf_stamp.is-paid { color: #22b053; border-color: #22b053; background: #ecfdf5; }
    .o_pdf_stamp.is-draft { color: #5593c2; border-color: #93bee0; background: #f0f7fc; }
    .o_pdf_stamp.is-cancel { color: #cb2f2f; border-color: #cb2f2f; background: #fef2f2; }
    .o_pdf_stamp.is-partial { color: #074073; border-color: #14B5D9; background: #f0f9ff; }
    .o_pdf_stamp.is-overdue { color: #cb2f2f; border-color: #cb2f2f; background: #fef2f2; }
    .o_pdf_stamp.is-posted { color: #074073; border-color: #14B5D9; background: #f0f7fc; }
    .o_pdf_stamp .stamp-inner { font-size: 0.8rem; font-weight: 800; }
    .o_pdf_stamp .stamp-sub { font-size: 0.62rem; font-weight: 700; opacity: 0.85; letter-spacing: 0.06em; }
    .o_pdf_brand_header {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(240px, 280px);
      align-items: center;
      border-bottom: 2.5px solid #074073;
      padding-bottom: 0.95rem;
      margin-bottom: 0.95rem;
      gap: 1.5rem;
    }
    .o_pdf_brand_identity {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      min-width: 0;
    }
    .o_pdf_logo_col {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 105px;
      height: 105px;
    }
    .o_pdf_company_logo {
      max-height: 105px;
      max-width: 105px;
      width: auto;
      height: auto;
      object-fit: contain;
      margin: 0 auto;
      display: block;
    }
    .o_pdf_company_info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
      flex: 1;
    }
    .o_pdf_company_info h2 { font-size: 1.45rem; font-weight: 800; color: #074073; margin: 0 0 0.35rem 0; letter-spacing: 0.01em; white-space: nowrap; }
    .o_pdf_company_info p { margin: 0.2rem 0; font-size: 0.82rem; color: #475569; line-height: 1.45; }
    .o_pdf_company_info p strong { color: #074073; }
    .o_pdf_doc_box {
      background: rgba(248, 250, 252, 0.85);
      border: 2px solid #074073;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      text-align: center;
      width: 100%;
      box-shadow: 0 2px 4px rgba(7, 64, 115, 0.08);
    }
    .doc_type_title {
      font-size: 0.82rem;
      font-weight: 800;
      color: #ffffff;
      background: #074073;
      border-bottom: 2px solid #14B5D9;
      margin: -0.75rem -1rem 0.6rem -1rem;
      padding: 0.35rem 0.5rem;
      border-radius: 5px 5px 0 0;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .doc_number { font-size: 1.18rem; font-weight: 800; color: #074073; margin: 0.25rem 0; font-variant-numeric: tabular-nums; }
    .o_pdf_doc_meta { display: flex; flex-direction: column; gap: 0.2rem; margin-top: 0.4rem; border-top: 1px dashed #cbd5e1; padding-top: 0.4rem; }
    .o_pdf_doc_meta_row { display: flex; justify-content: space-between; font-size: 0.74rem; color: #4b5563; }
    .o_pdf_doc_meta_row strong { color: #074073; }
    .o_pdf_resolution_bar {
      position: relative;
      z-index: 2;
      background: rgba(240, 247, 252, 0.85);
      border: 1px solid #cbe0f1;
      border-left: 3px solid #14B5D9;
      border-radius: 4px;
      padding: 0.4rem 0.75rem;
      font-size: 0.68rem;
      color: #074073;
      text-align: center;
      margin-bottom: 0.85rem;
      line-height: 1.35;
    }
    .o_pdf_client_section {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      background: rgba(248, 250, 252, 0.85);
      border: 1px solid #cbe0f1;
      border-top: 2px solid #074073;
      border-radius: 6px;
      padding: 0.85rem 1rem;
      margin-bottom: 0.85rem;
    }
    .o_pdf_client_col .o_pdf_col_title {
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #074073;
      margin-bottom: 0.35rem;
      border-bottom: 1.5px solid #14B5D9;
      padding-bottom: 0.2rem;
    }
    .o_pdf_client_col p { margin: 0.22rem 0; font-size: 0.78rem; color: #334155; }
    .o_pdf_client_col p strong { color: #074073; }
    .o_pdf_trace_box {
      position: relative;
      z-index: 2;
      background: rgba(240, 249, 255, 0.85);
      border: 1.5px dashed #14B5D9;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      margin-bottom: 0.85rem;
      font-size: 0.79rem;
    }
    .o_pdf_trace_box strong { color: #074073; }
    .o_pdf_payments_history_box {
      position: relative;
      z-index: 2;
      background: rgba(240, 253, 244, 0.85);
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      margin-bottom: 0.85rem;
    }
    .o_pdf_subtable { width: 100%; border-collapse: collapse; font-size: 0.74rem; margin-top: 0.35rem; }
    .o_pdf_subtable th { background: rgba(220, 252, 231, 0.85); color: #166534; padding: 0.3rem 0.5rem; text-align: left; font-weight: 700; border-bottom: 1px solid #86efac; }
    .o_pdf_subtable td { padding: 0.35rem 0.5rem; border-bottom: 1px solid #bbf7d0; }
    .o_pdf_items_table {
      position: relative;
      z-index: 2;
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0.95rem;
      font-size: 0.78rem;
    }
    .o_pdf_items_table thead { display: table-header-group !important; }
    .o_pdf_items_table tbody { display: table-row-group; }
    .o_pdf_items_table th {
      background: #074073;
      color: #ffffff;
      border-bottom: 2px solid #14B5D9;
      padding: 0.5rem 0.6rem;
      text-align: left;
      font-weight: 700;
      font-size: 0.73rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .o_pdf_items_table th:first-child { border-top-left-radius: 4px; }
    .o_pdf_items_table th:last-child { border-top-right-radius: 4px; }
    .o_pdf_items_table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid #e2e8f0; color: #334155; vertical-align: middle; background: rgba(255, 255, 255, 0.70); }
    .o_pdf_items_table tr:nth-child(even) td { background: rgba(248, 250, 252, 0.75); }
    .o_pdf_items_table .text-center { text-align: center; }
    .o_pdf_items_table .text-end { text-align: right; font-variant-numeric: tabular-nums; }
    .o_pdf_bottom_grid {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 1.25rem;
      margin-bottom: 1rem;
      align-items: start;
    }
    .o_pdf_bottom_left { display: flex; flex-direction: column; gap: 0.65rem; }
    .o_pdf_amount_words {
      background: rgba(240, 247, 252, 0.85);
      border-left: 4px solid #14B5D9;
      border-top: 1px solid #cbe0f1;
      border-right: 1px solid #cbe0f1;
      border-bottom: 1px solid #cbe0f1;
      border-radius: 0 4px 4px 0;
      padding: 0.55rem 0.8rem;
      font-size: 0.74rem;
      color: #074073;
      line-height: 1.4;
    }
    .o_pdf_amount_words .label { font-weight: 700; text-transform: uppercase; font-size: 0.67rem; color: #5593c2; display: block; margin-bottom: 0.15rem; }
    .o_pdf_amount_words .words { font-weight: 700; color: #074073; }
    .o_pdf_bank_info {
      background: rgba(240, 247, 252, 0.85);
      border: 1px solid #cbe0f1;
      border-left: 4px solid #074073;
      border-radius: 0 4px 4px 0;
      padding: 0.55rem 0.8rem;
      font-size: 0.72rem;
      color: #074073;
      line-height: 1.45;
    }
    .o_pdf_bank_info strong { color: #074073; }
    .o_pdf_totals_section { display: flex; justify-content: flex-end; }
    .o_pdf_totals_table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid #cbe0f1;
      border-radius: 6px;
      overflow: hidden;
    }
    .o_pdf_totals_table td { padding: 0.38rem 0.65rem; border-bottom: 1px solid #f1f5f9; background: transparent; }
    .o_pdf_totals_table .is-cancel-row td { color: #cb2f2f; font-weight: 800; background: rgba(254, 242, 242, 0.88); }
    .o_pdf_totals_table .is-grand-total td {
      font-size: 1.05rem;
      font-weight: 800;
      border-top: 2px solid #14B5D9;
      border-bottom: 2px solid #14B5D9;
      background: #074073;
      color: #ffffff;
      padding: 0.5rem 0.65rem;
    }
    .o_pdf_totals_table .is-residual-row td { color: #cb2f2f; font-weight: 700; background: #fef2f2; }
    .o_pdf_totals_table .is-paid-row td { color: #22b053; font-weight: 700; background: #ecfdf5; }
    .o_pdf_signatures_section {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin: 1.25rem 0 1rem 0;
      padding-top: 0.5rem;
    }
    .o_pdf_sign_box { text-align: center; padding: 0 1rem; }
    .o_pdf_sign_box .sign_line { border-bottom: 1.5px solid #074073; margin-bottom: 0.45rem; height: 38px; }
    .o_pdf_sign_box .sign_name { font-size: 0.78rem; font-weight: 700; color: #074073; }
    .o_pdf_sign_box .sign_title { font-size: 0.68rem; color: #14B5D9; text-transform: uppercase; font-weight: 700; }
    .o_pdf_sign_box .sign_sub { font-size: 0.66rem; color: #4b5563; margin-top: 0.15rem; }

    @media print {
      @page {
        size: A4 portrait;
        margin: 8mm 10mm 10mm 10mm;
      }
      html, body {
        background: #ffffff !important;
        color: #000000 !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .o_pdf_sheet {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        max-width: 100% !important;
        background: #ffffff !important;
      }
      .o_pdf_brand_header {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 270px !important;
        align-items: center !important;
        gap: 1.25rem !important;
      }
      .o_pdf_brand_identity {
        display: flex !important;
        align-items: center !important;
        gap: 1.25rem !important;
      }
      .o_pdf_logo_col {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex: 0 0 auto !important;
        width: 105px !important;
        height: 105px !important;
      }
      .o_pdf_company_logo {
        display: block !important;
        max-height: 105px !important;
        max-width: 105px !important;
        width: auto !important;
        height: auto !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        object-fit: contain !important;
        margin: 0 auto !important;
      }
      .o_pdf_company_info h2 {
        white-space: nowrap !important;
      }
      .o_pdf_doc_box {
        width: 100% !important;
      }
      .o_pdf_watermark {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  ${sheetHtml}
  ${printScript}
</body>
</html>`;

    if (autoPrint) {
      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        window.print();
      }
    } else {
      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Factura_${(invoice.name || 'documento').replace(/[\/\\]/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    }
  }

