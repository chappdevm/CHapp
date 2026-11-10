/* ==========================================================================
   CH Aluminios ERP -- JS Module: 08b-pdf-contract.js
   Sale Order Physical Contract & Promissory Note (Letra de Cambio)
   Matches physical printed contract layout with unified ERP styling
   ========================================================================== */
'use strict';

  function getSaleContractData(sale) {
    const s = sale || {};
    const cd = (s && s.contract_data) || {};
    const company = (typeof state !== 'undefined' && state.data && state.data.settings) || {};
    const partner = (typeof state !== 'undefined' && state.data && state.data.contacts
      ? state.data.contacts.find((c) => Number(c.id) === Number(s.partner_id))
      : null) || {};

    const totalAmount = (() => {
      if (s.amount_total !== undefined && s.amount_total !== null && Number(s.amount_total) > 0) {
        return Number(s.amount_total);
      }
      const dLines = Array.isArray(s.lines) ? s.lines : [];
      const untaxed = dLines.reduce((acc, l) => acc + Number(l.quantity || 0) * Number(l.price_unit || 0) * (1 - Number(l.discount || 0) / 100), 0);
      const tax = dLines.reduce((acc, l) => {
        const sub = Number(l.quantity || 0) * Number(l.price_unit || 0) * (1 - Number(l.discount || 0) / 100);
        return acc + sub * (Number(l.tax_rate || 0) / 100);
      }, 0);
      const isInst = typeof isInstallmentPaymentTerm === 'function' ? isInstallmentPaymentTerm(s.payment_term) : false;
      const finRate = isInst ? Math.max(0, Number(s.financing_rate || 0)) : 0;
      const finAmt = finRate > 0 ? (untaxed + tax) * (finRate / 100) : 0;
      return Math.round((untaxed + tax + finAmt) * 100) / 100;
    })();
    const dateStr = s.date_order ? String(s.date_order).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const parts = dateStr.split('-');
    const dYear = parts[0] || String(new Date().getFullYear());
    const dMonth = parts[1] || String(new Date().getMonth() + 1).padStart(2, '0');
    const dDay = parts[2] || String(new Date().getDate()).padStart(2, '0');

    const numCuotas = typeof getInstallmentsCountFromTerm === 'function'
      ? getInstallmentsCountFromTerm(s.payment_term)
      : (() => {
          const term = String(s.payment_term || '').toLowerCase();
          if (term.includes('45') || term.includes('60')) return 2;
          if (term.includes('90')) return 3;
          if (term.includes('120')) return 4;
          if (term.includes('150')) return 5;
          if (term.includes('180')) return 6;
          if (term.includes('210')) return 7;
          if (term.includes('240')) return 8;
          if (term.includes('270')) return 9;
          if (term.includes('300')) return 10;
          if (term.includes('330')) return 11;
          if (term.includes('360')) return 12;
          return 1;
        })();

    const rawCdCuotas = Number(cd.installments_count || 0);
    const effectiveCuotas = numCuotas > 1 && rawCdCuotas <= 1
      ? numCuotas
      : (rawCdCuotas >= 1 ? rawCdCuotas : Math.max(1, numCuotas));

    const downPayment = cd.down_payment !== undefined && cd.down_payment !== '' ? Number(cd.down_payment) : 0;
    const financedTotal = Math.max(0, totalAmount - downPayment);
    const calcInstallmentVal = effectiveCuotas > 0 ? Math.round(financedTotal / effectiveCuotas) : financedTotal;
    const defaultPeriodicity = typeof getPaymentPeriodicityFromTerm === 'function'
      ? getPaymentPeriodicityFromTerm(s.payment_term, effectiveCuotas)
      : (effectiveCuotas > 1 ? 'Mensual' : 'De contado');
    const rawPayDates = String(cd.payment_dates || '').trim();
    const effectivePayDates = (!rawPayDates || (effectiveCuotas > 1 && rawPayDates.toLowerCase() === 'de contado'))
      ? defaultPeriodicity
      : rawPayDates;

    // Helper for adding days
    const calcInstDate = () => {
      try {
        const d = new Date(dateStr + 'T12:00:00Z');
        d.setUTCDate(d.getUTCDate() + 8);
        return d.toISOString().slice(0, 10);
      } catch (e) {
        return dateStr;
      }
    };

    return {
      day: cd.day || dDay,
      month: cd.month || dMonth,
      year: cd.year || dYear,
      client_name: cd.client_name || s.partner_name || partner.name || 'Cliente por Definir',
      order_number: s.name || 'Pedido',
      residence_address: cd.residence_address || partner.street || '',
      residence_neighborhood: cd.residence_neighborhood || partner.city || '',
      residence_phone: cd.residence_phone || partner.mobile || partner.phone || '',
      work_address: cd.work_address || '',
      work_neighborhood: cd.work_neighborhood || '',
      work_phone: cd.work_phone || '',
      installments_count: effectiveCuotas,
      installment_amount: totalAmount > 0 ? calcInstallmentVal : (cd.installment_amount !== undefined && cd.installment_amount !== '' ? cd.installment_amount : 0),
      payment_dates: effectivePayDates,
      down_payment: cd.down_payment !== undefined && cd.down_payment !== '' ? cd.down_payment : (downPayment > 0 ? downPayment : 0),
      total_amount: totalAmount,
      ref_commercial_1: cd.ref_commercial_1 || '',
      ref_commercial_phone_1: cd.ref_commercial_phone_1 || '',
      ref_commercial_2: cd.ref_commercial_2 || '',
      ref_commercial_phone_2: cd.ref_commercial_phone_2 || '',
      ref_family_1: cd.ref_family_1 || '',
      ref_family_phone_1: cd.ref_family_phone_1 || '',
      ref_family_2: cd.ref_family_2 || '',
      ref_family_phone_2: cd.ref_family_phone_2 || '',
      observations: cd.observations !== undefined ? cd.observations : (s.notes || ''),
      installation_date: cd.installation_date || cd.install_date || calcInstDate(),
      down_payment_date: cd.down_payment_date || dateStr,
      client_vat: cd.client_vat || partner.vat || '222222222',
      codeudor_name: cd.codeudor_name || cd.codebtor_name || '',
      codeudor_vat: cd.codeudor_vat || cd.codebtor_vat || '',
      codeudor_phone: cd.codeudor_phone || cd.codebtor_phone || '',
      codeudor_address: cd.codeudor_address || cd.codebtor_address || '',
      salesperson_name: cd.salesperson_name || s.salesperson || company.company_name || 'CH Aluminios',
      salesperson_vat: cd.salesperson_vat || company.company_vat || company.company_phone || '3138483191',
      collection_place: (() => {
        const raw = String(cd.collection_place || '').toLowerCase();
        if (raw === 'work' || raw === 'trabajo') return 'trabajo';
        if (raw === 'home' || raw === 'casa') return 'casa';
        if (raw === 'seller' || raw === 'vendedor') return 'vendedor';
        return 'oficina';
      })(),
      city_payment: cd.city_payment || company.company_city || 'Pereira',
      order_to_name: cd.order_to_name || company.company_name || 'ALUMINIOS C.H.',
      interest_rate: cd.interest_rate !== undefined && cd.interest_rate !== '' ? cd.interest_rate : '0',
      mora_rate: cd.mora_rate !== undefined && cd.mora_rate !== '' ? cd.mora_rate : '3'
    };
  }

  function syncContractInstallmentsWithTerm(draft, forceResetCuotas = false) {
    if (!draft) return;
    if (!draft.contract_data) draft.contract_data = {};
    const cd = draft.contract_data;
    const isInst = typeof isInstallmentPaymentTerm === 'function' ? isInstallmentPaymentTerm(draft.payment_term) : false;
    const termCuotas = typeof getInstallmentsCountFromTerm === 'function' ? getInstallmentsCountFromTerm(draft.payment_term) : 1;
    const defaultPeriodicity = typeof getPaymentPeriodicityFromTerm === 'function'
      ? getPaymentPeriodicityFromTerm(draft.payment_term, termCuotas)
      : (termCuotas > 1 ? 'Mensual' : 'De contado');

    if (!isInst) {
      cd.installments_count = '1';
      cd.payment_dates = 'De contado';
    } else if (forceResetCuotas || !cd.installments_count || (termCuotas > 1 && Number(cd.installments_count) <= 1)) {
      cd.installments_count = String(termCuotas);
      cd.payment_dates = defaultPeriodicity;
    } else if (!cd.payment_dates || String(cd.payment_dates).toLowerCase() === 'de contado') {
      cd.payment_dates = defaultPeriodicity;
    }

    const dLines = Array.isArray(draft.lines) ? draft.lines : [];
    const untaxed = dLines.reduce((acc, l) => acc + Number(l.quantity || 0) * Number(l.price_unit || 0) * (1 - Number(l.discount || 0) / 100), 0);
    const tax = dLines.reduce((acc, l) => {
      const sub = Number(l.quantity || 0) * Number(l.price_unit || 0) * (1 - Number(l.discount || 0) / 100);
      return acc + sub * (Number(l.tax_rate || 0) / 100);
    }, 0);
    const finRate = isInst ? Math.max(0, Number(draft.financing_rate || 0)) : 0;
    const finAmt = finRate > 0 ? (untaxed + tax) * (finRate / 100) : 0;
    const totalAmount = Math.round((untaxed + tax + finAmt) * 100) / 100;
    const numCuotas = Math.max(1, Number(cd.installments_count || termCuotas || 1));
    const downPayment = Math.max(0, Number(cd.down_payment || 0));
    const financedTotal = Math.max(0, totalAmount - downPayment);
    cd.installment_amount = String(Math.round(financedTotal / numCuotas));
  }

  function renderContract3DLogoSvg() {
    return `
      <svg width="68" height="68" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 4px rgba(7,64,115,0.25));">
        <defs>
          <linearGradient id="chGradFront" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="50%" stop-color="#0284c7"/>
            <stop offset="100%" stop-color="#074073"/>
          </linearGradient>
          <linearGradient id="chGradSide" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#074073"/>
            <stop offset="100%" stop-color="#031d36"/>
          </linearGradient>
          <linearGradient id="chGradTop" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#7dd3fc"/>
            <stop offset="100%" stop-color="#38bdf8"/>
          </linearGradient>
        </defs>
        <!-- Isometric 3D Hexagon / Shield Frame -->
        <polygon points="50,4 92,26 92,74 50,96 8,74 8,26" fill="#f0f7fc" stroke="#074073" stroke-width="3"/>
        <!-- 3D C letter block -->
        <path d="M 22,34 L 42,34 L 42,44 L 32,44 L 32,56 L 42,56 L 42,66 L 22,66 Z" fill="url(#chGradFront)" stroke="#031d36" stroke-width="1"/>
        <path d="M 42,34 L 46,30 L 46,40 L 42,44 Z" fill="url(#chGradSide)"/>
        <path d="M 22,34 L 26,30 L 46,30 L 42,34 Z" fill="url(#chGradTop)"/>
        <!-- 3D H letter block -->
        <path d="M 50,34 L 60,34 L 60,45 L 70,45 L 70,34 L 80,34 L 80,66 L 70,66 L 70,55 L 60,55 L 60,66 L 50,66 Z" fill="url(#chGradFront)" stroke="#031d36" stroke-width="1"/>
        <path d="M 80,34 L 84,30 L 84,62 L 80,66 Z" fill="url(#chGradSide)"/>
        <path d="M 50,34 L 54,30 L 84,30 L 80,34 Z" fill="url(#chGradTop)"/>
      </svg>
    `;
  }

  function renderContractPdfSheetHtml(sale, options = {}) {
    const data = getSaleContractData(sale);
    const rawLines = sale && Array.isArray(sale.lines) && sale.lines.length > 0 ? sale.lines : [
      { quantity: 1, measure: 1, uom: 'Und', product_name: 'Venta de Productos y Servicios', total: sale.amount_total || 0 }
    ];
    const lines = Number(sale && sale.amount_financing || 0) > 0
      ? [...rawLines, { quantity: 1, measure: '', uom: '%', product_name: `Financiación Crédito (${Number(sale.financing_rate || 0)}%)`, total: Number(sale.amount_financing || 0) }]
      : rawLines;

    const logoData = typeof getLogoDataUrl === 'function' ? getLogoDataUrl() : '';
    const logoSrc = logoData && logoData.startsWith('data:') ? logoData : '/assets/icons/logo.png';

    // Build at least 7 rows for the products grid, expanding if more lines exist
    const totalGridRows = Math.max(7, lines.length);
    const tableRows = [];
    for (let i = 0; i < totalGridRows; i++) {
      const line = lines[i];
      if (line) {
        const cantStr = line.quantity !== undefined ? String(line.quantity) : '1';
        const uomShort = typeof formatUomShort === 'function' ? formatUomShort(line.uom || '') : (line.uom || '');
        const medidaStr = line.measure ? `${line.measure} ${uomShort}`.trim() : (uomShort || '—');
        const descStr = line.product_name || line.description || 'Producto';
        const valStr = typeof formatMoney === 'function' ? formatMoney(line.total || line.subtotal || 0) : `$ ${Number(line.total || 0).toLocaleString('es-CO')}`;
        tableRows.push(`
          <tr>
            <td class="o_item_cant">${esc(cantStr)}</td>
            <td class="o_item_medida">${esc(medidaStr)}</td>
            <td class="o_item_desc">${esc(descStr)}</td>
            <td class="o_item_val">${esc(valStr)}</td>
          </tr>
        `);
      } else {
        tableRows.push(`
          <tr>
            <td class="o_item_cant">&nbsp;</td>
            <td class="o_item_medida">&nbsp;</td>
            <td class="o_item_desc">&nbsp;</td>
            <td class="o_item_val">&nbsp;</td>
          </tr>
        `);
      }
    }

    const fmtMoney = (n) => typeof formatMoney === 'function' ? formatMoney(n) : `$ ${Number(n || 0).toLocaleString('es-CO')}`;
    const amountInWords = typeof numberToWordsSpanish === 'function'
      ? numberToWordsSpanish(data.total_amount)
      : `${Number(data.total_amount).toLocaleString('es-CO')} PESOS M/CTE`;

    const isColTrabajo = data.collection_place === 'trabajo';
    const isColCasa = data.collection_place === 'casa';
    const isColOficina = data.collection_place === 'oficina';
    const isColVendedor = data.collection_place === 'vendedor';
    const company = (typeof state !== 'undefined' && state.data && state.data.settings) || {};
    const contractCompanyTitle = company.company_name && company.company_name !== 'CH Aluminios' ? company.company_name : 'ALUMINIOS C.H.';
    const contractCompanyAddr = company.company_address
      ? `${company.company_address}${company.company_city ? ` - ${company.company_city}` : ''}`
      : 'MZ 32 CASA 584 LAS MERCEDES CUBA - PEREIRA';
    const contractCompanyPhone = company.company_phone || '3138483191';
    const contractCompanyNit = company.company_vat ? ` · NIT: ${company.company_vat}` : '';
    const contractCompanyEmail = company.company_email ? ` · ${company.company_email}` : '';

    return `
      <div class="o_contract_sheet" id="contractPdfSheet">
        <!-- 1. HEADER -->
        <div class="o_contract_header">
          <div class="o_contract_logo_col">
            <img src="${logoSrc}" alt="Aluminio C.H." class="o_contract_logo_left o_pdf_company_logo" onerror="if(!this.src.startsWith('data:'))this.style.display='none'" />
          </div>
          <div class="o_contract_title_col">
            <h1 class="o_contract_main_title">${esc(contractCompanyTitle)}</h1>
            <div class="o_contract_slogan">CALIDAD PARA TU HOGAR</div>
            <div class="o_contract_address_cel">DIRECCIÓN: ${esc(contractCompanyAddr)} &nbsp;&nbsp;&nbsp;&nbsp; CEL: ${esc(contractCompanyPhone)}${esc(contractCompanyNit)}${esc(contractCompanyEmail)}</div>
          </div>
          <div class="o_contract_logo_right">
            ${renderContract3DLogoSvg()}
          </div>
        </div>

        <!-- 2. DATE, CLIENT & ORDER TABLE -->
        <table class="o_contract_table">
          <tr>
            <td style="width: 18%; padding: 0;">
              <div class="o_contract_date_grid">
                <div class="o_contract_date_cell">
                  <div class="o_contract_date_head">D</div>
                  <div class="o_contract_date_val">${esc(data.day)}</div>
                </div>
                <div class="o_contract_date_cell">
                  <div class="o_contract_date_head">M</div>
                  <div class="o_contract_date_val">${esc(data.month)}</div>
                </div>
                <div class="o_contract_date_cell">
                  <div class="o_contract_date_head">A</div>
                  <div class="o_contract_date_val">${esc(data.year)}</div>
                </div>
              </div>
            </td>
            <td style="width: 58%;">
              <span class="o_contract_label">CLIENTE:</span>
              <span class="o_contract_val">${esc(data.client_name)}</span>
            </td>
            <td style="width: 24%;">
              <span class="o_contract_label">PEDIDO No.</span>
              <span class="o_contract_val" style="color: #074073; font-weight: 800;">${esc(data.order_number)}</span>
            </td>
          </tr>
        </table>

        <!-- 3. ADDRESS ROWS -->
        <table class="o_contract_table">
          <tr>
            <td style="width: 50%;">
              <span class="o_contract_label">Dirección Residencia:</span>
              <span class="o_contract_val">${esc(data.residence_address)}</span>
            </td>
            <td style="width: 25%;">
              <span class="o_contract_label">Barrio:</span>
              <span class="o_contract_val">${esc(data.residence_neighborhood)}</span>
            </td>
            <td style="width: 25%;">
              <span class="o_contract_label">Tel:</span>
              <span class="o_contract_val">${esc(data.residence_phone)}</span>
            </td>
          </tr>
          <tr>
            <td style="width: 50%;">
              <span class="o_contract_label">Dirección Trabajo:</span>
              <span class="o_contract_val">${esc(data.work_address || '—')}</span>
            </td>
            <td style="width: 25%;">
              <span class="o_contract_label">Barrio:</span>
              <span class="o_contract_val">${esc(data.work_neighborhood || '—')}</span>
            </td>
            <td style="width: 25%;">
              <span class="o_contract_label">Tel:</span>
              <span class="o_contract_val">${esc(data.work_phone || '—')}</span>
            </td>
          </tr>
        </table>

        <!-- 4. PRODUCTS AND SERVICES TABLE -->
        <table class="o_contract_table o_contract_items_table">
          <thead>
            <tr>
              <th style="width: 10%;">CANT.</th>
              <th style="width: 14%;">MEDIDA</th>
              <th style="width: 56%; text-align: left;">PRODUCTOS Y SERVICIOS</th>
              <th style="width: 20%; text-align: right;">VALORES</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows.join('')}
          </tbody>
        </table>

        <!-- 5. FINANCIAL TERMS ROW -->
        <table class="o_contract_table o_contract_finance_table">
          <thead>
            <tr>
              <th style="width: 15%;">No Cuotas</th>
              <th style="width: 22%;">Vlor Cuotas $</th>
              <th style="width: 21%;">Fecha pagos</th>
              <th style="width: 20%;">Couta Inicial $</th>
              <th style="width: 22%;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: 700;">${esc(String(data.installments_count))}</td>
              <td style="font-weight: 700;">${fmtMoney(data.installment_amount)}</td>
              <td style="font-weight: 600;">${esc(data.payment_dates)}</td>
              <td style="font-weight: 700;">${fmtMoney(data.down_payment)}</td>
              <td class="o_contract_total_cell">${fmtMoney(data.total_amount)}</td>
            </tr>
          </tbody>
        </table>

        <!-- 6. REFERENCES (2 ROWS) -->
        <table class="o_contract_table">
          <tr>
            <td style="width: 32%;">
              <span class="o_contract_label">Referencia Comercial:</span>
              <span class="o_contract_val">${esc(data.ref_commercial_1 || '—')}</span>
            </td>
            <td style="width: 18%;">
              <span class="o_contract_label">Tel.</span>
              <span class="o_contract_val">${esc(data.ref_commercial_phone_1 || '—')}</span>
            </td>
            <td style="width: 32%;">
              <span class="o_contract_label">Referencia familiar:</span>
              <span class="o_contract_val">${esc(data.ref_family_1 || '—')}</span>
            </td>
            <td style="width: 18%;">
              <span class="o_contract_label">Tel.</span>
              <span class="o_contract_val">${esc(data.ref_family_phone_1 || '—')}</span>
            </td>
          </tr>
          <tr>
            <td style="width: 32%;">
              <span class="o_contract_label">Referencia Comercial:</span>
              <span class="o_contract_val">${esc(data.ref_commercial_2 || '—')}</span>
            </td>
            <td style="width: 18%;">
              <span class="o_contract_label">Tel.</span>
              <span class="o_contract_val">${esc(data.ref_commercial_phone_2 || '—')}</span>
            </td>
            <td style="width: 32%;">
              <span class="o_contract_label">Referencia familiar:</span>
              <span class="o_contract_val">${esc(data.ref_family_2 || '—')}</span>
            </td>
            <td style="width: 18%;">
              <span class="o_contract_label">Tel.</span>
              <span class="o_contract_val">${esc(data.ref_family_phone_2 || '—')}</span>
            </td>
          </tr>
        </table>

        <!-- 7. OBSERVACIONES DEL CLIENTE WITH SOFT LOGO WATERMARK -->
        <div class="o_contract_obs_box">
          <div class="o_contract_watermark_inner">
            <img src="${logoSrc}" alt="CH Logo Watermark" />
          </div>
          <div class="o_contract_obs_title">OBSERVACIONES DEL CLIENTE</div>
          <div class="o_contract_obs_content">${esc(data.observations || 'Sin observaciones adicionales.')}</div>
        </div>

        <!-- 8. DATES ROW -->
        <div class="o_contract_dates_row">
          <div>Fecha Instalar: <u>${esc(data.installation_date)}</u></div>
          <div>Fecha Cuota Inicial: <u>${esc(data.down_payment_date)}</u></div>
        </div>

        <!-- 9. LEGAL CLAUSES -->
        <div class="o_contract_clauses">
          <p><strong>1.</strong> Una vez este hecho y firmado el contrato del pedido no aceptamos devoluciones, favor notificar cualquier cambio el mismo dia que hizo el contrato, recuerda nuestra linea de productos y servicios es amplia variada. Pague oportunamente y asegurará la mejora de inmuebles con cómodas cuotas.</p>
          <p><strong>2.</strong> Al firmar este contrato esta autorizando a nuestra empresa para retirar el producto por incumplimiento del pago acordado.</p>
          <p><strong>3.</strong> Con su firma, autoriza a nuestra compañía a consultarlo y reportarlo a las centrales de riesgo, en caso de mora. Favor notificar cualquier cambio de direccion.</p>
          <p><strong>4.</strong> Se cobrará el 3% Mensual por mora en los acuerdos de pago.</p>
        </div>

        <!-- 10. SIGNATURES -->
        <div class="o_contract_signatures">
          <div class="o_contract_sig_col">
            <div class="o_contract_sig_line"></div>
            <div class="o_contract_sig_title">Firma Cliente</div>
            <div class="o_contract_sig_sub">C.C. No. ${esc(data.client_vat)}</div>
          </div>
          <div class="o_contract_sig_col">
            <div class="o_contract_sig_line"></div>
            <div class="o_contract_sig_title">Firma Codeudor</div>
            <div class="o_contract_sig_sub">C.C. No. ${esc(data.codeudor_vat || '____________________')}</div>
          </div>
          <div class="o_contract_sig_col">
            <div class="o_contract_sig_line"></div>
            <div class="o_contract_sig_title">Firma Vendedor</div>
            <div class="o_contract_sig_sub">C.C. No. ${esc(data.salesperson_vat || '3138483191')}</div>
          </div>
        </div>

        <!-- 11. COLLECTION METHOD -->
        <div class="o_contract_collection_row">
          <div>Cobrar en el trabajo <span class="o_contract_check ${isColTrabajo ? 'is-checked' : ''}">${isColTrabajo ? '✓' : ''}</span></div>
          <div>En la casa <span class="o_contract_check ${isColCasa ? 'is-checked' : ''}">${isColCasa ? '✓' : ''}</span></div>
          <div>Paga en la oficina <span class="o_contract_check ${isColOficina ? 'is-checked' : ''}">${isColOficina ? '✓' : ''}</span></div>
          <div>Vendedor <span class="o_contract_check ${isColVendedor ? 'is-checked' : ''}">${isColVendedor ? '✓' : ''}</span></div>
        </div>

        <!-- 12. CUT SEPARATOR -->
        <div class="o_contract_cut_separator">
          <span class="o_contract_cut_icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>
          </span>
        </div>

        <!-- 13. PROMISSORY NOTE (LETRA DE CAMBIO) -->
        <div class="o_contract_letra_wrap">
          <div class="o_contract_letra_left">
            <div class="o_contract_letra_col">
              <span class="o_contract_letra_rotated">ACEPTADA</span>
              <span class="o_contract_letra_nit_label">CEDULA O NIT</span>
            </div>
            <div class="o_contract_letra_col">
              <span class="o_contract_letra_nit_label">CEDULA O NIT</span>
            </div>
            <div class="o_contract_letra_col">
              <span class="o_contract_letra_nit_label">CEDULA O NIT</span>
            </div>
          </div>
          <div class="o_contract_letra_right">
            <div class="o_contract_letra_header">
              <div class="o_contract_letra_no">No. <u>${esc(data.order_number)}</u></div>
              <div class="o_contract_letra_amount">LETRA DE CAMBIO POR $ <u>${Number(data.total_amount).toLocaleString('es-CO')}</u></div>
            </div>
            <div class="o_contract_letra_legal">
              <div><strong>SEÑOR(ES):</strong> <u>${esc(data.client_name)}${data.codeudor_name ? ' / ' + esc(data.codeudor_name) : ''}</u></div>
              <div style="margin-top: 3px;">
                EL DÍA <u>${esc(data.day)}</u> DEL MES <u>${esc(data.month)}</u> DEL AÑO <u>${esc(data.year)}</u> SE SERVIRA(N) UD.(S) PAGAR SOLIDARIAMENTE EN <u>${esc(data.city_payment)}</u> POR ESTA ÚNICA DE CAMBIO SIN PROTESTO EXCUSANDO EL AVISO DE RECHAZO Y LA PRESENTACIÓN PARA EL PAGO, A LA ORDEN DE <u>${esc(data.order_to_name)}</u> LA CANTIDAD DE <u>${esc(amountInWords)}</u> PESOS MAS INTERES DURANTE EL PLAZO DEL <u>${esc(data.interest_rate)}</u> % DE MORA DEL <u>${esc(data.mora_rate)}</u> % MENSUALES.
              </div>
            </div>
            <div class="o_contract_letra_footer">
              <div class="o_contract_letra_atentamente">ATENTAMENTE</div>
              <div class="o_contract_letra_address_rows">
                <div class="o_contract_letra_addr_line">
                  <span>DIRECCIÓN: <u>${esc(data.residence_address)}</u></span>
                  <span>TEL: <u>${esc(data.residence_phone)}</u></span>
                </div>
                <div class="o_contract_letra_addr_line">
                  <span>DIRECCIÓN: <u>${esc(data.work_address || data.codeudor_address || '—')}</u></span>
                  <span>TEL: <u>${esc(data.work_phone || data.codeudor_phone || '—')}</u></span>
                </div>
                <div class="o_contract_letra_addr_line">
                  <span>DIRECCIÓN: <u>${esc(data.codeudor_address || '—')}</u></span>
                  <span>TEL: <u>${esc(data.codeudor_phone || '—')}</u></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSaleContractTabHtml(draft, existing, isEditable) {
    const cd = getSaleContractData({ ...existing, ...draft });
    const disabledAttr = !isEditable ? 'disabled' : '';

    return `
      <div class="o_contract_tab_wrap">
        <div class="o_contract_info_banner">
          <div class="o_contract_info_title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            <span>Datos Oficiales del Contrato de Compraventa y Pagaré</span>
          </div>
          <p class="o_contract_info_desc">
            Los campos se autocompletan con la información del cliente y del pedido. Modifique o complete los datos que falten para generar el formato oficial idéntico al talonario físico.
          </p>
        </div>

        <div class="o_contract_cards_grid">
          <!-- Tarjeta 1: Residencia y Trabajo del Cliente -->
          <div class="o_contract_form_card">
            <h4 class="o_contract_card_header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span>1. Residencia y Trabajo del Cliente</span>
            </h4>
            
            <div class="o_field_row">
              <label for="fContractResAddress">Dirección Residencia</label>
              <input type="text" id="fContractResAddress" class="o_input contract-input" data-contract-field="residence_address" value="${esc(cd.residence_address)}" ${disabledAttr} />
            </div>

            <div class="o_contract_row_2col">
              <div class="o_field_row">
                <label for="fContractResBarrio">Barrio Residencia</label>
                <input type="text" id="fContractResBarrio" class="o_input contract-input" data-contract-field="residence_neighborhood" value="${esc(cd.residence_neighborhood)}" ${disabledAttr} />
              </div>
              <div class="o_field_row">
                <label for="fContractResPhone">Teléfono Residencia</label>
                <input type="text" id="fContractResPhone" class="o_input contract-input" data-contract-field="residence_phone" value="${esc(cd.residence_phone)}" ${disabledAttr} />
              </div>
            </div>

            <div class="o_field_row">
              <label for="fContractWorkAddress">Dirección Trabajo</label>
              <input type="text" id="fContractWorkAddress" class="o_input contract-input" data-contract-field="work_address" value="${esc(cd.work_address)}" placeholder="Ej: Calle 20 # 5-40" ${disabledAttr} />
            </div>

            <div class="o_contract_row_2col">
              <div class="o_field_row">
                <label for="fContractWorkBarrio">Barrio Trabajo</label>
                <input type="text" id="fContractWorkBarrio" class="o_input contract-input" data-contract-field="work_neighborhood" value="${esc(cd.work_neighborhood)}" placeholder="Centro" ${disabledAttr} />
              </div>
              <div class="o_field_row">
                <label for="fContractWorkPhone">Teléfono Trabajo</label>
                <input type="text" id="fContractWorkPhone" class="o_input contract-input" data-contract-field="work_phone" value="${esc(cd.work_phone)}" placeholder="310..." ${disabledAttr} />
              </div>
            </div>
          </div>

          <!-- Tarjeta 2: Condiciones Financieras y Fechas -->
          <div class="o_contract_form_card">
            <h4 class="o_contract_card_header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
              <span>2. Condiciones Financieras y Fechas</span>
            </h4>
            
            <div class="o_contract_row_2col">
              <div class="o_field_row">
                <label for="fContractNumCuotas">No. Cuotas</label>
                <input type="number" id="fContractNumCuotas" class="o_input contract-input" data-contract-field="installments_count" min="1" step="1" value="${esc(String(cd.installments_count))}" ${disabledAttr} />
              </div>
              <div class="o_field_row">
                <label for="fContractValCuota">Valor Cuota ($)</label>
                <input type="number" id="fContractValCuota" class="o_input contract-input" data-contract-field="installment_amount" min="0" step="any" value="${esc(String(cd.installment_amount))}" ${disabledAttr} />
              </div>
            </div>

            <div class="o_contract_row_2col">
              <div class="o_field_row">
                <label for="fContractFechaPagos">Fecha / Periodicidad Pagos</label>
                <input type="text" id="fContractFechaPagos" class="o_input contract-input" data-contract-field="payment_dates" value="${esc(cd.payment_dates)}" placeholder="Mensual / 15 y 30" ${disabledAttr} />
              </div>
              <div class="o_field_row">
                <label for="fContractCuotaInicial">Cuota Inicial ($)</label>
                <input type="number" id="fContractCuotaInicial" class="o_input contract-input" data-contract-field="down_payment" min="0" step="any" value="${esc(String(cd.down_payment))}" ${disabledAttr} />
              </div>
            </div>

            <div class="o_contract_row_2col">
              <div class="o_field_row">
                <label for="fContractFechaInstalar">Fecha Instalar</label>
                <input type="date" id="fContractFechaInstalar" class="o_input contract-input" data-contract-field="installation_date" value="${esc(cd.installation_date)}" ${disabledAttr} />
              </div>
              <div class="o_field_row">
                <label for="fContractFechaCuotaIni">Fecha Cuota Inicial</label>
                <input type="date" id="fContractFechaCuotaIni" class="o_input contract-input" data-contract-field="down_payment_date" value="${esc(cd.down_payment_date)}" ${disabledAttr} />
              </div>
            </div>

            <div class="o_field_row">
              <label>Lugar de Cobro Acordado</label>
              <div class="o_contract_radio_grid">
                <label class="o_contract_radio_chip ${cd.collection_place === 'oficina' || !cd.collection_place ? 'is-active' : ''}">
                  <input type="radio" name="fContractColPlace" value="oficina" class="contract-radio" ${cd.collection_place === 'oficina' || !cd.collection_place ? 'checked' : ''} ${disabledAttr} />
                  <span>Paga en oficina</span>
                </label>
                <label class="o_contract_radio_chip ${cd.collection_place === 'casa' ? 'is-active' : ''}">
                  <input type="radio" name="fContractColPlace" value="casa" class="contract-radio" ${cd.collection_place === 'casa' ? 'checked' : ''} ${disabledAttr} />
                  <span>En la casa</span>
                </label>
                <label class="o_contract_radio_chip ${cd.collection_place === 'trabajo' ? 'is-active' : ''}">
                  <input type="radio" name="fContractColPlace" value="trabajo" class="contract-radio" ${cd.collection_place === 'trabajo' ? 'checked' : ''} ${disabledAttr} />
                  <span>En el trabajo</span>
                </label>
                <label class="o_contract_radio_chip ${cd.collection_place === 'vendedor' ? 'is-active' : ''}">
                  <input type="radio" name="fContractColPlace" value="vendedor" class="contract-radio" ${cd.collection_place === 'vendedor' ? 'checked' : ''} ${disabledAttr} />
                  <span>Vendedor</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Tarjeta 3: Codeudor y Datos de Firmas -->
          <div class="o_contract_form_card">
            <h4 class="o_contract_card_header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span>3. Codeudor y Datos de Firmas</span>
            </h4>
            
            <div class="o_field_row">
              <label for="fContractCodeudorName">Nombre del Codeudor</label>
              <input type="text" id="fContractCodeudorName" class="o_input contract-input" data-contract-field="codeudor_name" value="${esc(cd.codeudor_name)}" placeholder="Nombre completo" ${disabledAttr} />
            </div>

            <div class="o_contract_row_2col">
              <div class="o_field_row">
                <label for="fContractCodeudorVat">C.C. Codeudor</label>
                <input type="text" id="fContractCodeudorVat" class="o_input contract-input" data-contract-field="codeudor_vat" value="${esc(cd.codeudor_vat)}" placeholder="Cédula" ${disabledAttr} />
              </div>
              <div class="o_field_row">
                <label for="fContractCodeudorPhone">Teléfono Codeudor</label>
                <input type="text" id="fContractCodeudorPhone" class="o_input contract-input" data-contract-field="codeudor_phone" value="${esc(cd.codeudor_phone)}" placeholder="310..." ${disabledAttr} />
              </div>
            </div>

            <div class="o_field_row">
              <label for="fContractCodeudorAddress">Dirección Codeudor</label>
              <input type="text" id="fContractCodeudorAddress" class="o_input contract-input" data-contract-field="codeudor_address" value="${esc(cd.codeudor_address)}" placeholder="Dirección residencia codeudor" ${disabledAttr} />
            </div>

            <div class="o_field_row">
              <label for="fContractSalespersonVat">C.C. / Celular Vendedor</label>
              <input type="text" id="fContractSalespersonVat" class="o_input contract-input" data-contract-field="salesperson_vat" value="${esc(cd.salesperson_vat)}" placeholder="3138483191" ${disabledAttr} />
            </div>
          </div>

          <!-- Tarjeta 4: Referencias y Observaciones -->
          <div class="o_contract_form_card">
            <h4 class="o_contract_card_header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              <span>4. Referencias y Observaciones</span>
            </h4>
            
            <div class="o_contract_row_ref">
              <div class="o_field_row">
                <label for="fContractRefCom1">Ref. Comercial 1</label>
                <input type="text" id="fContractRefCom1" class="o_input contract-input" data-contract-field="ref_commercial_1" value="${esc(cd.ref_commercial_1)}" placeholder="Nombre establecimiento" ${disabledAttr} />
              </div>
              <div class="o_field_row">
                <label for="fContractRefComPhone1">Teléfono</label>
                <input type="text" id="fContractRefComPhone1" class="o_input contract-input" data-contract-field="ref_commercial_phone_1" value="${esc(cd.ref_commercial_phone_1)}" placeholder="Teléfono" ${disabledAttr} />
              </div>
            </div>

            <div class="o_contract_row_ref">
              <div class="o_field_row">
                <label for="fContractRefCom2">Ref. Comercial 2</label>
                <input type="text" id="fContractRefCom2" class="o_input contract-input" data-contract-field="ref_commercial_2" value="${esc(cd.ref_commercial_2)}" placeholder="Segundo establecimiento" ${disabledAttr} />
              </div>
              <div class="o_field_row">
                <label for="fContractRefComPhone2">Teléfono</label>
                <input type="text" id="fContractRefComPhone2" class="o_input contract-input" data-contract-field="ref_commercial_phone_2" value="${esc(cd.ref_commercial_phone_2)}" placeholder="Teléfono" ${disabledAttr} />
              </div>
            </div>

            <div class="o_contract_row_ref">
              <div class="o_field_row">
                <label for="fContractRefFam1">Ref. Familiar 1</label>
                <input type="text" id="fContractRefFam1" class="o_input contract-input" data-contract-field="ref_family_1" value="${esc(cd.ref_family_1)}" placeholder="Nombre familiar" ${disabledAttr} />
              </div>
              <div class="o_field_row">
                <label for="fContractRefFamPhone1">Teléfono</label>
                <input type="text" id="fContractRefFamPhone1" class="o_input contract-input" data-contract-field="ref_family_phone_1" value="${esc(cd.ref_family_phone_1)}" placeholder="Teléfono" ${disabledAttr} />
              </div>
            </div>

            <div class="o_contract_row_ref">
              <div class="o_field_row">
                <label for="fContractRefFam2">Ref. Familiar 2</label>
                <input type="text" id="fContractRefFam2" class="o_input contract-input" data-contract-field="ref_family_2" value="${esc(cd.ref_family_2)}" placeholder="Segundo familiar" ${disabledAttr} />
              </div>
              <div class="o_field_row">
                <label for="fContractRefFamPhone2">Teléfono</label>
                <input type="text" id="fContractRefFamPhone2" class="o_input contract-input" data-contract-field="ref_family_phone_2" value="${esc(cd.ref_family_phone_2)}" placeholder="Teléfono" ${disabledAttr} />
              </div>
            </div>

            <div class="o_field_row">
              <label for="fContractObs">Observaciones del Cliente</label>
              <textarea id="fContractObs" class="o_input contract-input" data-contract-field="observations" rows="2" placeholder="Especificaciones de instalación, entrega o acuerdos especiales" ${disabledAttr}>${esc(cd.observations)}</textarea>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function downloadContractPdf(sale, autoPrint = false) {
    if (typeof window === 'undefined') return;

    if (autoPrint) {
      window.print();
      return;
    }

    if (typeof window.html2pdf !== 'function') {
      return window.print();
    }

    const container = document.getElementById('contractPdfSheet');
    if (!container) {
      return window.print();
    }

    const opt = {
      margin: [6, 6, 6, 6],
      filename: `Contrato_${sale ? (sale.name || 'Pedido') : 'CHapp'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      showToast('Generando PDF del Contrato oficial...');
      await window.html2pdf().set(opt).from(container).save();
      showToast('Contrato PDF descargado exitosamente.');
    } catch (err) {
      showToast('Error generando PDF: ' + err.message, true);
    }
  }
