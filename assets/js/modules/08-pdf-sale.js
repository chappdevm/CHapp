/* ==========================================================================
   CH Aluminios ERP -- JS Module: 08-pdf-sale.js
   Document Engine (Part 2): A4 Quotation & Sale Order PDF Renderer/Exporter
   ========================================================================== */
'use strict';

  function renderSalePdfSheetHtml(sale) {
    const company = (state.data && state.data.settings) || {};
    const partner = ((state.data && state.data.contacts) || []).find((c) => Number(c.id) === Number(sale.partner_id)) || {
      name: sale.partner_name || 'Cliente por Definir',
      vat: sale.partner_vat || '222222222',
      doc_type: 'NIT',
      street: '',
      city: 'Pereira',
      state_name: 'Risaralda',
      mobile: '',
      phone: '',
      email: ''
    };

    const lines = sale.lines && sale.lines.length > 0 ? sale.lines : [
      { name: 'Venta de Bienes / Servicios', description: '', quantity: 1, uom: 'Und', price_unit: Number(sale.amount_untaxed || sale.amount_total || 0), discount: 0, tax_rate: 19, subtotal: Number(sale.amount_untaxed || sale.amount_total || 0) }
    ];

    const isCancel = sale.state === 'cancel';
    const isSale = sale.state === 'sale';
    const isSent = sale.state === 'sent';
    const isDraft = !isCancel && !isSale && !isSent;

    let watermarkHtml = '';
    if (isCancel) {
      watermarkHtml = '<div class="o_pdf_watermark is-cancel">CANCELADA</div>';
    } else if (isSale) {
      watermarkHtml = '<div class="o_pdf_watermark is-paid">PEDIDO CONFIRMADO</div>';
    } else {
      watermarkHtml = '<div class="o_pdf_watermark is-draft">COTIZACIÓN</div>';
    }

    let stampHtml = '';
    if (isCancel) {
      stampHtml = '<div class="o_pdf_stamp is-cancel"><span class="stamp-inner">✕ CANCELADA</span><span class="stamp-sub">PROPUESTA ANULADA</span></div>';
    } else if (isSale) {
      stampHtml = '<div class="o_pdf_stamp is-paid"><span class="stamp-inner">✓ CONFIRMADO</span><span class="stamp-sub">PEDIDO DE VENTA</span></div>';
    } else if (isSent) {
      stampHtml = '<div class="o_pdf_stamp is-posted"><span class="stamp-inner">✉ ENVIADA</span><span class="stamp-sub">OFERTA AL CLIENTE</span></div>';
    } else {
      stampHtml = '<div class="o_pdf_stamp is-draft"><span class="stamp-inner">✎ COTIZACIÓN</span><span class="stamp-sub">PROPUESTA COMERCIAL</span></div>';
    }

    const docTitle = isSale ? 'Pedido de Venta' : 'Cotización';
    const docNumber = esc(sale.name || 'Nueva Cotización');
    const paymentTerm = sale.payment_term || partner.payment_term || 'Contado';

    const calcUntaxed = lines.reduce((acc, l) => {
      const qty = Number(l.quantity || 0);
      const pr = Number(l.price_unit || 0);
      const disc = Number(l.discount || 0);
      return acc + (qty * pr * (1 - disc / 100));
    }, 0);

    const calcTax = lines.reduce((acc, l) => {
      const qty = Number(l.quantity || 0);
      const pr = Number(l.price_unit || 0);
      const disc = Number(l.discount || 0);
      const rate = l.tax_rate !== undefined && l.tax_rate !== null && l.tax_rate !== '' ? Number(l.tax_rate) : 19;
      return acc + (qty * pr * (1 - disc / 100) * (rate / 100));
    }, 0);

    const totalUntaxed = sale.amount_untaxed !== undefined ? Number(sale.amount_untaxed) : calcUntaxed;
    const totalTax = sale.amount_tax !== undefined ? Number(sale.amount_tax) : calcTax;
    const totalAmount = sale.amount_total !== undefined ? Number(sale.amount_total) : (totalUntaxed + totalTax);

    const hasDiscounts = lines.some((l) => Number(l.discount || 0) > 0);
    const totalDiscount = lines.reduce((sum, l) => {
      const gross = Number(l.quantity || 1) * Number(l.price_unit || 0);
      return sum + (gross * (Number(l.discount || 0) / 100));
    }, 0);

    const logoData = typeof getLogoDataUrl === 'function' ? getLogoDataUrl() : '';
    const logoSrc = logoData && logoData.startsWith('data:') ? logoData : '/assets/icons/logo.png';
    const bannerData = typeof getBannerDataUrl === 'function' ? getBannerDataUrl() : '';
    const bannerSrc = bannerData && bannerData.startsWith('data:') ? bannerData : '/assets/icons/brand-banner.jpg';

    return `
      <div class="o_pdf_sheet" id="salePdfSheet">
        ${watermarkHtml}

        <div class="o_pdf_brand_header">
          <div class="o_pdf_brand_identity">
            <div class="o_pdf_brand_top">
              <div class="o_pdf_logo_col">
                <img src="${logoSrc}" alt="CH Aluminios" class="o_pdf_company_logo" onerror="if(!this.src.startsWith('data:'))this.style.display='none'" />
              </div>
              <div class="o_pdf_company_title_box">
                <img src="${bannerSrc}" alt="${esc(company.company_name || 'CH Aluminios')} - Calidad para tu Hogar" class="o_pdf_brand_banner" onerror="if(!this.src.startsWith('data:'))this.style.display='none'" />
              </div>
            </div>
            <div class="o_pdf_company_info">
              <div class="o_pdf_company_details">
                <div class="o_pdf_detail_row">
                  <span><strong>NIT:</strong> ${esc(company.company_vat || '900.876.543-1')}</span>
                  <span class="detail-sep">·</span>
                  <span>${esc(company.fiscal_regime || 'Responsable de IVA - Régimen Ordinario')}</span>
                </div>
                <div class="o_pdf_detail_row">
                  <span><strong>Dirección:</strong> ${esc(company.company_address || 'Cra. 7 #18-45')} · ${esc(company.company_city || 'Pereira')}, ${esc(company.company_country || 'Colombia')}</span>
                </div>
                <div class="o_pdf_detail_row">
                  <span><strong>PBX:</strong> (606) 315-0000</span>
                  <span class="detail-sep">·</span>
                  <span><strong>Email:</strong> ${esc(company.company_email || 'chappdevm@gmail.com')}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="o_pdf_doc_box">
            <div class="doc_type_title">${esc(docTitle)}</div>
            <div class="doc_number">${docNumber}</div>
            <div class="o_pdf_doc_meta">
              <div class="o_pdf_doc_meta_row"><span>Emisión:</span><strong>${esc(sale.date_order || '')}</strong></div>
              <div class="o_pdf_doc_meta_row"><span>Validez:</span><strong>${esc(sale.validity_date || '30 Días')}</strong></div>
              <div class="o_pdf_doc_meta_row"><span>Asesor:</span><strong style="color: #1e40af;">${esc(sale.salesperson || 'Laura Gómez')}</strong></div>
              <div class="o_pdf_doc_meta_row"><span>Forma de Pago:</span><strong>${esc(paymentTerm)}</strong></div>
            </div>
            ${stampHtml}
          </div>
        </div>

        <div class="o_pdf_resolution_bar is-quote" style="background: linear-gradient(90deg, #074073, #14B5D9) !important; color: #ffffff !important; font-weight: 600; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);">
          Propuesta Comercial & Cotización de Bienes y Servicios · CH Aluminios · Validez de la Oferta: ${esc(sale.validity_date ? `Hasta ${sale.validity_date}` : '30 Días')}
        </div>

        <div class="o_pdf_client_section">
          <div class="o_pdf_client_col">
            <div class="o_pdf_col_title">Cliente / Destinatario</div>
            <p style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">${esc(partner.name)}</p>
            <p><strong>Cédula / NIT:</strong> ${esc(partner.doc_type || (partner.is_company ? 'NIT' : 'CC'))} ${esc(partner.vat || 'No registrado')}</p>
            <p><strong>Dirección:</strong> ${esc([partner.street, partner.city, partner.state_name].filter(Boolean).join(', ') || 'Pereira, Risaralda')}</p>
            <p><strong>Ciudad / País:</strong> ${esc(partner.city || 'Pereira')}, ${esc(partner.state_name || 'Risaralda')} - Colombia</p>
          </div>
          <div class="o_pdf_client_col">
            <div class="o_pdf_col_title">Condiciones Comerciales de la Oferta</div>
            <p><strong>Celular / Teléfono:</strong> ${esc([partner.mobile, partner.phone].filter(Boolean).join(' / ') || 'No registrado')}</p>
            <p><strong>Correo Electrónico:</strong> ${esc(partner.email || 'No registrado')}</p>
            <p><strong>Plazo de Pago Propuesto:</strong> ${esc(paymentTerm)}</p>
            <p><strong>Tiempo de Entrega Estimado:</strong> Inmediato / Según disponibilidad</p>
          </div>
        </div>

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
              const prodName = l.product_name || l.name || 'Producto / Servicio';
              const prodDesc = l.description && l.description !== prodName ? `<div style="font-size: 0.75rem; color: #64748b; font-weight: normal; margin-top: 2px;">${esc(l.description)}</div>` : '';
              return `
                <tr>
                  <td class="text-center" style="color: #64748b;">${idx + 1}</td>
                  <td><strong>${esc(prodName)}</strong>${prodDesc}</td>
                  <td class="text-center" style="color: #64748b;">${esc(l.uom || (prodName && prodName.toLowerCase().includes('perfil') ? 'Metro Lineal' : 'Und'))}</td>
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

            ${sale.notes ? `
              <div style="margin-top: 0.65rem; padding: 0.5rem 0.75rem; background: rgba(0,0,0,0.02); border: 1px dashed #cbd5e1; border-radius: 4px; font-size: 0.78rem;">
                <strong>Observaciones / Términos:</strong><br/>
                ${esc(sale.notes)}
              </div>
            ` : ''}
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
                <td>Base Gravable:</td>
                <td style="text-align: right;">${formatMoney(totalUntaxed)}</td>
              </tr>
              <tr>
                <td>IVA:</td>
                <td style="text-align: right;"><strong>${formatMoney(totalTax)}</strong></td>
              </tr>
              <tr class="is-grand-total">
                <td>TOTAL PROPUESTA:</td>
                <td style="text-align: right;">${formatMoney(totalAmount)}</td>
              </tr>
            </table>
          </div>
        </div>

        <div class="o_pdf_legal_footer">
          Esta cotización comercial es una propuesta informativa y no constituye una factura de venta electrónica.<br/>
          Los precios y disponibilidad están sujetos a las condiciones comerciales descritas durante la vigencia de la oferta.<br/>
          Generado automáticamente por <strong>CH Aluminios</strong> — CHapp ERP.
        </div>
      </div>
    `;
  }

  function downloadSalePdf(sale, autoPrint = false) {
    const company = (state.data && state.data.settings) || {};
    const isQuotation = sale.state !== 'sale';
    const filename = `${isQuotation ? 'Cotizacion' : 'Pedido'}_${(sale.name || 'documento').replace(/[/\\]/g, '_')}.pdf`;

    // Direct PDF file export via html2pdf when clicking Download (!autoPrint)
    if (!autoPrint && typeof window !== 'undefined' && typeof window.html2pdf === 'function') {
      const container = document.querySelector('.o_pdf_paper_viewport #salePdfSheet') || document.getElementById('salePdfSheet');
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
        const bannerData = typeof getBannerDataUrl === 'function' ? getBannerDataUrl() : '';
        const bannerImg = targetEl.querySelector('.o_pdf_brand_banner');
        if (bannerImg) {
          bannerImg.style.display = 'block';
          if (bannerData && bannerData.startsWith('data:')) {
            bannerImg.src = bannerData;
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
          downloadSalePdf(sale, true);
        });
        return;
      }
    }

    let sheetHtml = renderSalePdfSheetHtml(sale);
    const logoData = getLogoDataUrl();
    if (logoData && logoData.startsWith('data:')) {
      sheetHtml = sheetHtml.replace('src="/assets/icons/logo.png"', 'src="' + logoData + '"');
      sheetHtml = sheetHtml.replace(/onerror="[^"]*"/g, '');
    } else if (typeof window !== 'undefined' && window.location && window.location.origin) {
      sheetHtml = sheetHtml.replace('src="/assets/icons/logo.png"', 'src="' + window.location.origin + '/assets/icons/logo.png"');
    }
    const bannerData = typeof getBannerDataUrl === 'function' ? getBannerDataUrl() : '';
    if (bannerData && bannerData.startsWith('data:')) {
      sheetHtml = sheetHtml.replace('src="/assets/icons/brand-banner.jpg"', 'src="' + bannerData + '"');
    } else if (typeof window !== 'undefined' && window.location && window.location.origin) {
      sheetHtml = sheetHtml.replace('src="/assets/icons/brand-banner.jpg"', 'src="' + window.location.origin + '/assets/icons/brand-banner.jpg"');
    }
    const printScript = autoPrint ? '<script>window.addEventListener("load", function() { var imgs = Array.from(document.images); Promise.all(imgs.map(function(img) { if (img.complete) return Promise.resolve(); return new Promise(function(res) { img.onload = img.onerror = res; }); })).then(function() { setTimeout(function() { window.print(); }, 250); }); });</script>' : '';

    const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${isQuotation ? 'Cotización' : 'Pedido de Venta'} ${esc(sale.name)} - ${esc(company.company_name || 'CH Aluminios')}</title>
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
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: clamp(3rem, 7vw, 5.5rem);
      font-weight: 900;
      letter-spacing: 0.15em;
      opacity: 0.06;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      z-index: 1;
    }
    .o_pdf_watermark.is-draft { color: #14B5D9; }
    .o_pdf_watermark.is-paid { color: #059669; }
    .o_pdf_watermark.is-cancel { color: #cb2f2f; }
    .o_pdf_brand_header {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(240px, 280px);
      align-items: start;
      gap: 1.5rem;
      border-bottom: 2.5px solid #074073;
      padding-bottom: 0.95rem;
      margin-bottom: 1.25rem;
    }
    .o_pdf_brand_identity {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      min-width: 0;
    }
    .o_pdf_brand_top {
      display: flex;
      align-items: center;
      gap: 1.15rem;
      min-width: 0;
    }
    .o_pdf_logo_col {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 95px;
      height: 95px;
    }
    .o_pdf_company_logo {
      max-height: 95px;
      max-width: 95px;
      width: auto;
      height: auto;
      object-fit: contain;
      margin: 0 auto;
      display: block;
      filter: drop-shadow(0 2px 4px rgba(7, 64, 115, 0.12));
    }
    .o_pdf_company_title_box { display: flex; align-items: center; justify-content: flex-start; min-width: 0; flex: 1; }
    .o_pdf_brand_banner { max-height: 85px; max-width: 100%; width: auto; height: auto; object-fit: contain; display: block; }
    .o_pdf_company_details {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      font-size: 0.88rem;
      color: #334155;
      line-height: 1.45;
      border-top: 1px dashed #cbd5e1;
      padding-top: 0.65rem;
    }
    .o_pdf_detail_row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.35rem 0.6rem;
    }
    .o_pdf_detail_row strong {
      color: #074073;
      font-weight: 700;
    }
    .o_pdf_detail_row .detail-sep {
      color: #94a3b8;
      font-weight: bold;
    }
    .o_pdf_company_info p { margin: 0.2rem 0; font-size: 0.82rem; color: #475569; line-height: 1.45; }
    .o_pdf_company_info p strong { color: #074073; }
    .o_pdf_doc_box {
      border: 2px solid #074073;
      border-radius: 8px;
      padding: 0.85rem 1.15rem;
      width: 100%;
      text-align: center;
      background: #f0f7fc;
      position: relative;
      z-index: 2;
    }
    .o_pdf_doc_box .doc_type_title { font-size: 0.95rem; font-weight: 800; color: #074073; text-transform: uppercase; letter-spacing: 0.04em; }
    .o_pdf_doc_box .doc_number { font-size: 1.25rem; font-weight: 900; color: #14B5D9; margin: 0.25rem 0 0.5rem 0; }
    .o_pdf_doc_meta { border-top: 1px solid #cbe0f1; padding-top: 0.45rem; font-size: 0.74rem; text-align: left; }
    .o_pdf_doc_meta_row { display: flex; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.2rem; }
    .o_pdf_doc_meta_row span { color: #64748b; }
    .o_pdf_stamp {
      display: inline-block;
      margin-top: 0.5rem;
      padding: 0.25rem 0.65rem;
      border: 2px dashed;
      border-radius: 6px;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 0.72rem;
      line-height: 1.15;
    }
    .o_pdf_stamp.is-draft { border-color: #14B5D9; color: #074073; background: #e0f4fb; }
    .o_pdf_stamp.is-paid { border-color: #059669; color: #059669; background: #ecfdf5; }
    .o_pdf_stamp.is-posted { border-color: #0ea5e9; color: #0284c7; background: #f0f9ff; }
    .o_pdf_stamp.is-cancel { border-color: #cb2f2f; color: #cb2f2f; background: #fef2f2; }
    .o_pdf_resolution_bar {
      color: #ffffff;
      padding: 0.45rem 0.85rem;
      border-radius: 4px;
      font-size: 0.72rem;
      text-align: center;
      margin-bottom: 1.25rem;
      font-weight: 600;
    }
    .o_pdf_client_section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      padding: 1rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 1.25rem;
    }
    .o_pdf_col_title { font-size: 0.74rem; font-weight: 800; text-transform: uppercase; color: #074073; margin-bottom: 0.4rem; letter-spacing: 0.04em; }
    .o_pdf_client_col p { margin: 0 0 0.2rem 0; font-size: 0.78rem; color: #334155; }
    .o_pdf_items_table { width: 100%; border-collapse: collapse; margin-bottom: 1.25rem; font-size: 0.78rem; }
    .o_pdf_items_table th { background: #074073; color: #ffffff; padding: 0.55rem 0.65rem; text-align: left; font-weight: 700; font-size: 0.74rem; text-transform: uppercase; }
    .o_pdf_items_table td { padding: 0.55rem 0.65rem; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
    .o_pdf_bottom_grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
    .o_pdf_amount_words { background: #f0f7fc; border-left: 3px solid #14B5D9; padding: 0.65rem 0.85rem; font-size: 0.76rem; margin-bottom: 0.75rem; border-radius: 0 4px 4px 0; }
    .o_pdf_amount_words .label { font-weight: 700; color: #074073; display: block; margin-bottom: 0.15rem; }
    .o_pdf_amount_words .words { color: #0f172a; font-weight: 600; }
    .o_pdf_bank_info { font-size: 0.75rem; line-height: 1.4; color: #475569; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 0.65rem 0.85rem; }
    .o_pdf_totals_section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem 0.95rem; }
    .o_pdf_totals_table { width: 100%; font-size: 0.78rem; }
    .o_pdf_totals_table td { padding: 0.35rem 0; color: #475569; }
    .o_pdf_totals_table tr.is-grand-total td { font-size: 1.05rem; font-weight: 900; color: #074073; border-top: 2px solid #074073; padding-top: 0.55rem; }
    .o_pdf_signatures_section { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; margin-top: 2.2rem; margin-bottom: 1.25rem; }
    .o_pdf_sign_box { text-align: center; }
    .o_pdf_sign_box .sign_line { border-bottom: 1px solid #94a3b8; margin-bottom: 0.5rem; height: 40px; }
    .o_pdf_sign_box .sign_name { font-weight: 700; color: #0f172a; font-size: 0.82rem; }
    .o_pdf_sign_box .sign_title { font-size: 0.72rem; color: #475569; }
    .o_pdf_sign_box .sign_sub { font-size: 0.68rem; color: #94a3b8; margin-top: 0.2rem; }
    .o_pdf_legal_footer { font-size: 0.68rem; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 0.85rem; line-height: 1.4; }
    @media print {
      body { background: #ffffff !important; padding: 0 !important; }
      .o_pdf_sheet { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
      .o_pdf_brand_header {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 270px !important;
        align-items: start !important;
        gap: 1.25rem !important;
      }
      .o_pdf_brand_identity {
        display: flex !important;
        flex-direction: column !important;
        gap: 0.65rem !important;
      }
      .o_pdf_brand_top {
        display: flex !important;
        align-items: center !important;
        gap: 1.15rem !important;
      }
      .o_pdf_logo_col {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex: 0 0 auto !important;
        width: 95px !important;
        height: 95px !important;
      }
      .o_pdf_company_logo {
        display: block !important;
        max-height: 95px !important;
        max-width: 95px !important;
        width: auto !important;
        height: auto !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        object-fit: contain !important;
        margin: 0 auto !important;
      }
      .o_pdf_brand_banner {
        display: block !important;
        max-height: 85px !important;
        max-width: 100% !important;
        width: auto !important;
        height: auto !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        object-fit: contain !important;
      }
      .o_pdf_company_details {
        font-size: 0.88rem !important;
      }
      .o_pdf_doc_box {
        width: 100% !important;
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
      a.download = `${isQuotation ? 'Cotizacion' : 'Pedido'}_${(sale.name || 'documento').replace(/[\/\\]/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    }
  }

