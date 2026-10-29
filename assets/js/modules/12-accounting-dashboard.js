/* ==========================================================================
   CH Aluminios ERP -- JS Module: 12-accounting-dashboard.js
   Module 4 (Part 1): Contabilidad -- SVG Financial Charts, Dashboard, Kanban & Move List
   ========================================================================== */
'use strict';

  // ==================== MODULE 4: CONTABILIDAD (account.move) ====================
  function paymentStateBadge(st) {
    const map = {
      paid: { cls: 'o_badge_success', text: 'Pagado' },
      partial: { cls: 'o_badge_warning', text: 'Pago Parcial' },
      not_paid: { cls: 'o_badge_danger', text: 'No Pagado' }
    };
    const item = map[st] || { cls: 'o_badge_muted', text: st };
    return `<span class="o_badge ${item.cls}">${esc(item.text)}</span>`;
  }

  function calculateMonthFinancials(monthKey) {
    const acc = (state.data && state.data.accounting) || { payments: [] };
    const payments = acc.payments || [];
    const expenses = (state.data && state.data.expenses) || [];

    const inflow = payments
      .filter((p) => p.payment_type === 'inbound' && p.state !== 'cancel' && (p.date || '').startsWith(monthKey))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const monthExpensesTotal = expenses
      .filter((e) => e.state !== 'cancel' && (e.date || '').startsWith(monthKey))
      .reduce((sum, e) => sum + Number(e.total_amount || 0), 0);

    const monthOutPayments = payments
      .filter((p) => p.payment_type === 'outbound' && p.state !== 'cancel' && (p.date || '').startsWith(monthKey))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const outflow = Math.max(monthExpensesTotal, monthOutPayments);
    const net = round2(inflow - outflow);
    const margin_pct = inflow > 0 ? Math.round(((inflow - outflow) / inflow) * 100) : 0;

    return {
      inflow: round2(inflow),
      outflow: round2(outflow),
      net,
      margin_pct,
      key: monthKey
    };
  }

  function generateMonthBalanceInnerSvg(m) {
    const data = m || { inflow: 0, outflow: 0, net: 0, margin_pct: 0 };
    const maxVal = Math.max(Number(data.inflow || 0), Number(data.outflow || 0), Math.abs(Number(data.net || 0)), 1);
    const chartH = 120;
    const baseY = 165;

    const hInflow = Math.round((Math.max(0, Number(data.inflow || 0)) / maxVal) * chartH);
    const hOutflow = Math.round((Math.max(0, Number(data.outflow || 0)) / maxVal) * chartH);
    const hNet = Math.round((Math.abs(Number(data.net || 0)) / maxVal) * chartH);
    const isNetPos = Number(data.net || 0) >= 0;

    return `
      <svg viewBox="0 0 600 220" style="width: 100%; height: auto; max-height: 250px; font-family: inherit;" role="img" aria-label="Gráfica comparativa de balance del mes">
        <!-- Lineas de escala -->
        <line x1="40" y1="40" x2="560" y2="40" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" /><line x1="40" y1="80" x2="560" y2="80" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" /><line x1="40" y1="120" x2="560" y2="120" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
        <line x1="40" y1="${baseY}" x2="560" y2="${baseY}" stroke="currentColor" stroke-opacity="0.25" stroke-width="1.5" />

        <!-- Barra 1: Recaudado -->
        <g>
          <rect x="85" y="${baseY - hInflow}" width="85" height="${hInflow}" rx="5" fill="#10b981" />
          <text x="127" y="${Math.max(25, baseY - hInflow - 8)}" font-size="12" font-weight="700" fill="#10b981" text-anchor="middle">${formatMoney(data.inflow)}</text>
          <text x="127" y="${baseY + 22}" font-size="12" font-weight="600" fill="var(--o-text-main)" text-anchor="middle">Recaudado</text>
          <text x="127" y="${baseY + 38}" font-size="10" fill="var(--o-text-muted)" text-anchor="middle">Cobros Reales</text>
        </g>

        <!-- Barra 2: Gastos Pagados -->
        <g>
          <rect x="255" y="${baseY - hOutflow}" width="85" height="${hOutflow}" rx="5" fill="#ef4444" />
          <text x="297" y="${Math.max(25, baseY - hOutflow - 8)}" font-size="12" font-weight="700" fill="#ef4444" text-anchor="middle">${formatMoney(data.outflow)}</text>
          <text x="297" y="${baseY + 22}" font-size="12" font-weight="600" fill="var(--o-text-main)" text-anchor="middle">Gastos Pagados</text>
          <text x="297" y="${baseY + 38}" font-size="10" fill="var(--o-text-muted)" text-anchor="middle">Total Gastos</text>
        </g>

        <!-- Barra 3: Balance Neto -->
        <g>
          <rect x="425" y="${baseY - hNet}" width="85" height="${hNet}" rx="5" fill="${isNetPos ? '#0ea5e9' : '#f59e0b'}" />
          <text x="467" y="${Math.max(25, baseY - hNet - 8)}" font-size="12" font-weight="700" fill="${isNetPos ? '#0ea5e9' : '#f59e0b'}" text-anchor="middle">${formatMoney(data.net)}</text>
          <text x="467" y="${baseY + 22}" font-size="12" font-weight="600" fill="var(--o-text-main)" text-anchor="middle">Balance Neto</text>
          <text x="467" y="${baseY + 38}" font-size="10" fill="var(--o-text-muted)" text-anchor="middle">Cajas / Bancos</text>
        </g>
      </svg>
    `;
  }

  function generateMonthBalanceSvg(m) {
    const data = m || { inflow: 0, outflow: 0, net: 0, margin_pct: 0 };
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = String(now.getMonth() + 1).padStart(2, '0');

    const years = [currYear - 2, currYear - 1, currYear, currYear + 1];
    const months = [{ v: '01', l: 'Enero' }, { v: '02', l: 'Febrero' }, { v: '03', l: 'Marzo' }, { v: '04', l: 'Abril' }, { v: '05', l: 'Mayo' }, { v: '06', l: 'Junio' }, { v: '07', l: 'Julio' }, { v: '08', l: 'Agosto' }, { v: '09', l: 'Septiembre' }, { v: '10', l: 'Octubre' }, { v: '11', l: 'Noviembre' }, { v: '12', l: 'Diciembre' }];

    return `
      <div style="position: relative; width: 100%;">
        <!-- Toolbar con filtro de Mes/Año al estilo de la app y Badge de Margen en la esquina -->
        <div class="o_period_filter_bar">
          <div class="o_period_controls">
            <span class="o_period_badge">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              Periodo:
            </span>
            <select id="accFilterMonth" class="o_period_select" aria-label="Seleccionar mes">
              ${months.map(mo => `<option value="${mo.v}" ${mo.v === currMonth ? 'selected' : ''}>${mo.l}</option>`).join('')}
            </select>
            <select id="accFilterYear" class="o_period_select" aria-label="Seleccionar año">
              ${years.map(y => `<option value="${y}" ${y === currYear ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
            <button type="button" id="btnAccResetMonth" class="o_period_btn_reset">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg>
              Mes Actual
            </button>
          </div>

          <!-- Badge Margen Operativo ubicado en la esquina de la sección -->
          <div id="accMarginBadgeContainer">
            <span id="accMarginBadge" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 9999px; background: rgba(14, 165, 233, 0.12); color: #0ea5e9; font-size: 0.84rem; font-weight: 700; border: 1px solid rgba(14, 165, 233, 0.25);">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
              Margen Operativo: ${data.margin_pct >= 0 ? '+' : ''}${data.margin_pct}%
            </span>
          </div>
        </div>

        <div id="accMonthSvgContainer">
          ${generateMonthBalanceInnerSvg(data)}
        </div>
      </div>
    `;
  }

  function generateTrendSvg(monthlyList) {
    const list = Array.isArray(monthlyList) && monthlyList.length > 0 ? monthlyList : [];
    if (list.length === 0) {
      return `<p style="padding: 2.5rem; text-align: center; color: var(--o-text-muted);">Sin datos históricos suficientes para graficar.</p>`;
    }
    const maxVal = Math.max(...list.map((m) => Math.max(Number(m.inflow || 0), Number(m.outflow || 0), Math.abs(Number(m.net || 0)))), 1);
    const chartH = 110;
    const baseY = 160;
    const count = list.length;
    const colW = 540 / count;

    const netPoints = [];

    const barsSvg = list.map((m, i) => {
      const centerX = 40 + i * colW + colW / 2;
      const hIn = Math.round((Math.max(0, Number(m.inflow || 0)) / maxVal) * chartH);
      const hOut = Math.round((Math.max(0, Number(m.outflow || 0)) / maxVal) * chartH);
      const hNet = Math.round((Number(m.net || 0) / maxVal) * chartH);
      const netY = baseY - hNet;
      netPoints.push(`${centerX},${netY}`);

      return `
        <g class="o_trend_col" data-trend-idx="${i}" data-label="${esc(m.label)}" data-inflow="${m.inflow}" data-outflow="${m.outflow}" data-net="${m.net}">
          <!-- Barra 1: Recaudado -->
          <rect class="o_trend_bar" data-kind="Recaudado" data-amount="${m.inflow}" data-label="${esc(m.label)}" data-color="#10b981"
            x="${centerX - 24}" y="${baseY - hIn}" width="22" height="${hIn}" rx="3" fill="#10b981"
            style="cursor: pointer; transition: opacity 0.15s, transform 0.15s;">
            <title>${esc(m.label)} — Recaudado: ${formatMoney(m.inflow)}</title>
          </rect>
          <!-- Barra 2: Gastos -->
          <rect class="o_trend_bar" data-kind="Gastos" data-amount="${m.outflow}" data-label="${esc(m.label)}" data-color="#ef4444"
            x="${centerX + 2}" y="${baseY - hOut}" width="22" height="${hOut}" rx="3" fill="#ef4444"
            style="cursor: pointer; transition: opacity 0.15s, transform 0.15s;">
            <title>${esc(m.label)} — Gastos: ${formatMoney(m.outflow)}</title>
          </rect>
          <!-- Valores mostrados directamente sobre las barras al dar clic -->
          <text id="trendValIn_${i}" x="${centerX - 13}" y="${Math.max(22, baseY - hIn - 6)}" font-size="10" font-weight="700" fill="#10b981" text-anchor="middle" style="display: none;">${formatMoney(m.inflow)}</text>
          <text id="trendValOut_${i}" x="${centerX + 13}" y="${Math.max(22, baseY - hOut - 6)}" font-size="10" font-weight="700" fill="#ef4444" text-anchor="middle" style="display: none;">${formatMoney(m.outflow)}</text>
          <!-- Etiqueta de mes -->
          <text class="o_trend_label" x="${centerX}" y="${baseY + 20}" font-size="11" font-weight="600" fill="var(--o-text-muted)" text-anchor="middle" style="cursor: pointer;">${esc(m.label)}</text>
        </g>
      `;
    }).join('');

    const polylineSvg = netPoints.length > 1
      ? `<polyline points="${netPoints.join(' ')}" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-dasharray="3,3" />`
      : '';

    const dotsSvg = list.map((m, i) => {
      const centerX = 40 + i * colW + colW / 2;
      const hNet = Math.round((Number(m.net || 0) / maxVal) * chartH);
      const netY = baseY - hNet;
      return `
        <circle class="o_trend_dot" data-kind="Balance Neto" data-amount="${m.net}" data-label="${esc(m.label)}" data-color="#0ea5e9"
          cx="${centerX}" cy="${netY}" r="5" fill="#0ea5e9" stroke="#ffffff" stroke-width="2" style="cursor: pointer;">
          <title>${esc(m.label)} — Balance Neto: ${formatMoney(m.net)}</title>
        </circle>
      `;
    }).join('');

    return `
      <div style="position: relative; width: 100%;">
        <!-- Banner interactivo de valor seleccionado al dar clic en cualquier barra -->
        <div id="trendValueDisplayBanner" style="min-height: 38px; display: flex; align-items: center; justify-content: center; padding: 6px 14px; margin: 0.5rem 1rem 0; border-radius: 8px; background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.2); font-size: 0.85rem; color: var(--o-text-main); transition: all 0.2s ease;">
          <span id="trendValueDisplayText" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 500;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            Haz clic en cualquier barra o punto para ver el valor exacto del periodo
          </span>
        </div>

        <svg viewBox="0 0 620 220" style="width: 100%; height: auto; max-height: 250px; font-family: inherit;" role="img" aria-label="Evolución financiera de 6 meses">
          <!-- Leyenda -->
          <g transform="translate(130, 10)">
            <rect x="0" y="2" width="12" height="12" rx="2" fill="#10b981" />
            <text x="18" y="12" font-size="11" fill="var(--o-text-main)">Recaudado</text>
            <rect x="110" y="2" width="12" height="12" rx="2" fill="#ef4444" />
            <text x="128" y="12" font-size="11" fill="var(--o-text-main)">Gastos</text>
            <circle cx="216" cy="8" r="5" fill="#0ea5e9" />
            <text x="228" y="12" font-size="11" fill="var(--o-text-main)">Balance Neto</text>
          </g>

          <!-- Escalas -->
          <line x1="30" y1="45" x2="590" y2="45" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
          <line x1="30" y1="85" x2="590" y2="85" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
          <line x1="30" y1="125" x2="590" y2="125" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
          <line x1="30" y1="${baseY}" x2="590" y2="${baseY}" stroke="currentColor" stroke-opacity="0.25" stroke-width="1.5" />

          ${barsSvg}
          ${polylineSvg}
          ${dotsSvg}
        </svg>
      </div>
    `;
  }

  function generateFlowDistributionDonutSvg(kpis) {
    const k = kpis || {};
    const collected = Number(k.collected_revenue || 0);
    const pending = Number(k.receivables_residual || 0);
    const expenses = Number(k.expenses_paid_total || 0);
    const totalVolume = collected + pending + expenses;

    if (totalVolume <= 0) {
      return `
        <div style="background: var(--o-view-bg); border: 1px dashed var(--o-border-color); border-radius: 8px; padding: 2.5rem; text-align: center;">
          <h4 style="font-size: 1rem; margin-bottom: 0.35rem;">Distribución General de Flujos</h4>
          <p style="font-size: 0.85rem; color: var(--o-text-muted); margin: 0;">Sin movimientos de recaudos, cartera ni gastos registrados.</p>
        </div>
      `;
    }

    const pctCollected = totalVolume > 0 ? Math.round((collected / totalVolume) * 100) : 0;
    const pctPending = totalVolume > 0 ? Math.round((pending / totalVolume) * 100) : 0;
    const pctExpenses = totalVolume > 0 ? Math.max(0, 100 - pctCollected - pctPending) : 0;

    const items = [
      { name: 'Total Recaudos', label: 'Cobros Reales', amount: collected, percentage: pctCollected, color: '#10b981' },
      { name: 'Por Recaudar', label: 'Cartera Clientes', amount: pending, percentage: pctPending, color: '#0ea5e9' },
      { name: 'Gastos', label: 'Total Gastos y Compras', amount: expenses, percentage: pctExpenses, color: '#ef4444' }
    ];

    const r = 64;
    const circ = 2 * Math.PI * r;
    let accumulatedPct = 0;

    const circlesSvg = items.filter(it => it.amount > 0).map((it) => {
      const pct = Math.max(0, Math.min(100, Number(it.percentage || 0)));
      const strokeDash = (pct / 100) * circ;
      const strokeOffset = -((accumulatedPct / 100) * circ);
      accumulatedPct += pct;
      return `<circle cx="95" cy="95" r="${r}" fill="none" stroke="${it.color}" stroke-width="24" stroke-dasharray="${strokeDash.toFixed(2)} ${(circ - strokeDash).toFixed(2)}" stroke-dashoffset="${strokeOffset.toFixed(2)}" transform="rotate(-90 95 95)" />`;
    }).join('');

    return `
      <div style="background: var(--o-view-bg); border: 1px solid var(--o-border-color); border-radius: 8px; padding: 1.5rem; max-width: 720px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 1.25rem;">
          <h4 style="font-size: 1.05rem; margin: 0 0 0.25rem; font-weight: 700;">Distribución Global de Flujos</h4>
          <span style="font-size: 0.82rem; color: var(--o-text-muted);">Proporción entre Recaudos Reales (Verde), Por Recaudar (Azul) y Gastos (Rojo)</span>
        </div>

        <div style="display: flex; align-items: center; justify-content: center; gap: 2rem; flex-wrap: wrap;">
          <div style="width: 190px; height: 190px; flex-shrink: 0; position: relative;">
            <svg viewBox="0 0 190 190" style="width: 100%; height: 100%;" role="img" aria-label="Diagrama circular de distribución de flujos">
              <circle cx="95" cy="95" r="${r}" fill="none" stroke="currentColor" stroke-opacity="0.08" stroke-width="24" />
              ${circlesSvg}
              <text x="95" y="86" font-size="10" font-weight="600" fill="var(--o-text-muted)" text-anchor="middle">Balance Neto</text>
              <text x="95" y="106" font-size="12" font-weight="700" fill="${(collected - expenses) >= 0 ? '#0ea5e9' : '#ef4444'}" text-anchor="middle">${formatMoney(collected - expenses)}</text>
            </svg>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.65rem; min-width: 270px; flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; border-radius: 6px; background: rgba(16, 185, 129, 0.08); border-left: 4px solid #10b981;">
              <div>
                <strong style="color: #10b981; display: block; font-size: 0.9rem;">Total Recaudos</strong>
                <span style="font-size: 0.74rem; color: var(--o-text-muted);">Cobros Reales en Caja / Bancos</span>
              </div>
              <div style="text-align: right;">
                <strong style="font-size: 0.95rem; color: #10b981;">${formatMoney(collected)}</strong>
                <div style="font-size: 0.74rem; color: var(--o-text-muted); font-weight: 600;">${pctCollected}%</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; border-radius: 6px; background: rgba(14, 165, 233, 0.08); border-left: 4px solid #0ea5e9;">
              <div>
                <strong style="color: #0ea5e9; display: block; font-size: 0.9rem;">Por Recaudar</strong>
                <span style="font-size: 0.74rem; color: var(--o-text-muted);">Cartera Pendiente por Cobrar</span>
              </div>
              <div style="text-align: right;">
                <strong style="font-size: 0.95rem; color: #0ea5e9;">${formatMoney(pending)}</strong>
                <div style="font-size: 0.74rem; color: var(--o-text-muted); font-weight: 600;">${pctPending}%</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; border-radius: 6px; background: rgba(239, 68, 68, 0.08); border-left: 4px solid #ef4444;">
              <div>
                <strong style="color: #ef4444; display: block; font-size: 0.9rem;">Gastos</strong>
                <span style="font-size: 0.74rem; color: var(--o-text-muted);">Total de Gastos y Compras</span>
              </div>
              <div style="text-align: right;">
                <strong style="font-size: 0.95rem; color: #ef4444;">${formatMoney(expenses)}</strong>
                <div style="font-size: 0.74rem; color: var(--o-text-muted); font-weight: 600;">${pctExpenses}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function generateDonutSvg(items, title, emptyMsg) {
    const list = Array.isArray(items) && items.length > 0 ? items : [];
    const total = list.reduce((s, it) => s + Number(it.amount || 0), 0);
    if (total <= 0 || list.length === 0) {
      return `
        <div style="background: var(--o-view-bg); border: 1px dashed var(--o-border-color); border-radius: 8px; padding: 1.5rem; text-align: center;">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.35rem;">${esc(title)}</h4>
          <p style="font-size: 0.82rem; color: var(--o-text-muted); margin: 0;">${esc(emptyMsg || 'Sin movimientos registrados')}</p>
        </div>
      `;
    }

    const palette = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    const r = 58;
    const circ = 2 * Math.PI * r;
    let accumulatedPct = 0;

    const circlesSvg = list.map((it, idx) => {
      const pct = Math.max(0, Math.min(100, Number(it.percentage || 0)));
      const strokeDash = (pct / 100) * circ;
      const strokeOffset = -((accumulatedPct / 100) * circ);
      accumulatedPct += pct;
      const color = palette[idx % palette.length];
      return `<circle cx="90" cy="90" r="${r}" fill="none" stroke="${color}" stroke-width="22" stroke-dasharray="${strokeDash.toFixed(2)} ${(circ - strokeDash).toFixed(2)}" stroke-dashoffset="${strokeOffset.toFixed(2)}" transform="rotate(-90 90 90)" />`;
    }).join('');

    const legendHtml = list.map((it, idx) => {
      const color = palette[idx % palette.length];
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; font-size: 0.82rem;">
          <div style="display: flex; align-items: center; gap: 0.45rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></span>
            <span style="overflow: hidden; text-overflow: ellipsis;" title="${esc(it.name)}">${esc(it.name)}</span>
          </div>
          <div style="text-align: end; margin-left: 0.5rem; white-space: nowrap;">
            <strong>${formatMoney(it.amount)}</strong>
            <span style="color: var(--o-text-muted); font-size: 0.75rem; margin-left: 0.2rem;">(${it.percentage}%)</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="background: var(--o-view-bg); border: 1px solid var(--o-border-color); border-radius: 8px; padding: 1.15rem;">
        <h4 style="font-size: 0.95rem; margin: 0 0 1rem 0; font-weight: 600;">${esc(title)}</h4>
        <div style="display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;">
          <div style="width: 180px; height: 180px; flex-shrink: 0; position: relative; margin: 0 auto;">
            <svg viewBox="0 0 180 180" style="width: 100%; height: 100%;" role="img" aria-label="${esc(title)}">
              <circle cx="90" cy="90" r="${r}" fill="none" stroke="currentColor" stroke-opacity="0.08" stroke-width="22" />
              ${circlesSvg}
              <text x="90" y="86" font-size="10" font-weight="600" fill="var(--o-text-muted)" text-anchor="middle">Total</text>
              <text x="90" y="103" font-size="11" font-weight="700" fill="var(--o-text-main)" text-anchor="middle">${formatMoney(total)}</text>
            </svg>
          </div>
          <div style="flex: 1; min-width: 200px;">
            ${legendHtml}
          </div>
        </div>
      </div>
    `;
  }

  function renderAccountingModule() {
    const container = document.getElementById('moduleContent');
    const acc = state.data.accounting || { moves: [], journals: [], accounts: [], payments: [] };
    const kpis = state.data.kpis || {};

    if (state.viewType === 'form' && state.submenu !== 'accounts' && state.submenu !== 'payments') {
      renderAccountMoveForm(container);
      return;
    }
    // Facturas y documentos contables siempre se visualizan en lista por defecto
    state.viewType = 'list';

    if (state.submenu === 'dashboard') {
      updatePager(acc.journals.length, acc.journals.length);
      const outUnpaid = acc.moves.filter((m) => m.move_type === 'out_invoice' && m.state === 'posted' && m.amount_residual > 0);
      const inUnpaid = acc.moves.filter((m) => m.move_type === 'in_invoice' && m.state === 'posted' && m.amount_residual > 0);
      const bankCashAccounts = (kpis.accounts_summary && kpis.accounts_summary.length > 0)
        ? kpis.accounts_summary
        : (acc.journals || []).filter((j) => (j.type === 'bank' || j.type === 'cash') && j.active !== false).map((j) => ({
            id: j.id,
            code: j.code,
            name: j.name,
            type: j.type,
            balance: Number(j.balance || 0),
            inbound_total: 0,
            outbound_total: 0
          }));

      container.innerHTML = `
        <div class="o_dashboard_banner">
          <div class="o_stat_card">
            <span class="o_stat_label">Total de Ingresos</span>
            <span class="o_stat_value">${formatMoney(kpis.invoiced_revenue || 0)}</span>
            <span class="o_stat_sub">Ingresos operacionales causados</span>
          </div>
          <div class="o_stat_card">
            <span class="o_stat_label">Total Recaudado (Cobros Reales)</span>
            <span class="o_stat_value" style="color: #10b981;">${formatMoney(kpis.collected_revenue || 0)}</span>
            <span class="o_stat_sub">Ingresos cobrados en cuentas</span>
          </div>
          <div class="o_stat_card">
            <span class="o_stat_label">Total Gastos / Compras</span>
            <span class="o_stat_value" style="color: #ef4444;">${formatMoney(kpis.expenses_paid_total || 0)}</span>
            <span class="o_stat_sub">Pagado en compras y materiales</span>
          </div>
          <div class="o_stat_card">
            <span class="o_stat_label">Balance Neto en Cajas y Bancos</span>
            <span class="o_stat_value" style="color: ${(kpis.net_cash_balance || 0) >= 0 ? '#0ea5e9' : '#ef4444'};">${formatMoney(kpis.net_cash_balance || 0)}</span>
            <span class="o_stat_sub">Efectivo real disponible</span>
          </div>
          <div class="o_stat_card">
            <span class="o_stat_label">Cartera por Cobrar (Clientes)</span>
            <span class="o_stat_value">${formatMoney(kpis.receivables_residual || 0)}</span>
            <span class="o_stat_sub">${outUnpaid.length} factura(s) pendiente(s) de cobro</span>
          </div>
        </div>

        <!-- Panel de Gráficas y Balances Financieros -->
        <div class="o_chart_card">
          <div class="o_chart_header">
            <div>
              <h3 style="font-size: 1.05rem; margin: 0;">Análisis Financiero y Flujo de Caja</h3>
              <span style="font-size: 0.82rem; color: var(--o-text-muted);">Comparativa de recaudo real vs compras de materiales y balance disponible</span>
            </div>
            <div class="o_chart_tabs" role="tablist">
              <button type="button" class="o_chart_tab is-active" data-chart-tab="month">Balance Mes Actual</button>
              <button type="button" class="o_chart_tab" data-chart-tab="trend">Evolución 6 Meses</button>
              <button type="button" class="o_chart_tab" data-chart-tab="distribution">Distribución de Flujos</button>
            </div>
          </div>
          <div id="chartTabMonth" style="display: block;">
            ${generateMonthBalanceSvg(kpis.current_month_financials)}
          </div>
          <div id="chartTabTrend" style="display: none;">
            ${generateTrendSvg(kpis.monthly_financials)}
          </div>
          <div id="chartTabDistribution" style="display: none;">
            ${generateFlowDistributionDonutSvg(kpis)}
          </div>
        </div>

        <!-- Cuentas Financieras y Medios de Pago -->
        <div style="margin-bottom: 0.85rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 style="font-size: 1.1rem; margin: 0;">Cuentas Financieras y Cajas (Nequi, Daviplata, Efectivo, Bancos)</h3>
            <span style="font-size: 0.82rem; color: var(--o-text-muted);">Saldos y flujos discriminados por cuenta bancaria y medio de pago</span>
          </div>
          <button type="button" class="btn btn-sm btn-secondary" id="btnManageJournalsFromAcc">Configurar Cuentas en Ajustes</button>
        </div>

        <div class="o_financial_grid">
          ${bankCashAccounts.map((a) => `
            <div class="o_journal_card ${a.type === 'bank' ? 'is-bank' : 'is-cash'}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.45rem;">
                <div><span class="o_badge ${a.code === 'NEQ' ? 'o_badge_info' : a.code === 'DVP' ? 'o_badge_danger' : a.type === 'bank' ? 'o_badge_success' : 'o_badge_warning'}">${esc(a.code)}</span><h4 style="margin: 0.35rem 0 0 0; font-size: 1rem;">${esc(a.name)}</h4></div>
                <span style="font-size: 0.72rem; color: var(--o-text-muted); text-transform: uppercase;">${a.type === 'bank' ? 'Banco / Billetera' : 'Caja Efectivo'}</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0.65rem 0; padding: 0.5rem; background: var(--o-gray-100); border-radius: 6px; font-size: 0.8rem;">
                <div><span style="color: var(--o-text-muted); display: block; font-size: 0.75rem;">Recaudado (+)</span><strong style="color: #10b981;">+${formatMoney(a.inbound_total || 0)}</strong></div>
                <div><span style="color: var(--o-text-muted); display: block; font-size: 0.75rem;">Gastos (-)</span><strong style="color: #ef4444;">-${formatMoney(a.outbound_total || 0)}</strong></div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--o-border-color); padding-top: 0.65rem; margin-top: 0.25rem;">
                <div><span style="font-size: 0.75rem; color: var(--o-text-muted); display: block;">Saldo en Libros</span><strong style="font-size: 1.15rem; color: var(--o-action);">${formatMoney(a.balance || 0)}</strong></div>
                <button type="button" class="btn btn-sm btn-secondary" data-journal-action="payments">Ver Pagos</button>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Tabla de Últimos Movimientos de Caja y Bancos -->
        <div class="o_chart_card" style="margin-bottom: 1.75rem;">
          <div class="o_chart_header" style="margin-bottom: 0.75rem;">
            <div>
              <h3 style="font-size: 1.05rem; margin: 0;">Últimos Movimientos de Caja y Bancos</h3>
              <span style="font-size: 0.82rem; color: var(--o-text-muted);">Transacciones reales registradas en Nequi, Daviplata, Efectivo y Bancos</span>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" data-journal-action="payments">Ver Todos los Pagos</button>
          </div>
          <div tabindex="0" role="region" aria-label="Tabla de últimos movimientos" class="table-wrapper">
            <table class="o_list_table" style="--label-2: 'Fecha'; --label-3: 'Comprobante'; --label-4: 'Cuenta'; --label-5: 'Tercero'; --label-6: 'Referencia'; --label-7: 'Tipo'; --label-8: 'Importe';">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Comprobante</th>
                  <th>Cuenta / Medio</th>
                  <th>Tercero</th>
                  <th>Referencia</th>
                  <th>Tipo</th>
                  <th class="text-end">Importe</th>
                </tr>
              </thead>
              <tbody>
                ${(kpis.recent_cash_flows || []).length === 0 ? `
                  <tr><td colspan="7" class="text-center" style="padding: 1.5rem; color: var(--o-text-muted);">Sin movimientos de caja recientes.</td></tr>
                ` : (kpis.recent_cash_flows || []).map((m) => `
                  <tr>
                    <td>${esc(m.date || '')}</td>
                    <th>${esc(m.name || '')}</th>
                    <td><span class="o_badge ${m.journal_code === 'NEQ' ? 'o_badge_info' : m.journal_code === 'DVP' ? 'o_badge_danger' : 'o_badge_success'}">${esc(m.journal_name || m.journal_code || '')}</span></td>
                    <td>${esc(m.partner_name || '')}</td>
                    <td>${esc(m.ref || '—')}</td>
                    <td><span class="o_badge ${m.type === 'inbound' ? 'o_badge_success' : 'o_badge_warning'}">${m.type === 'inbound' ? 'Recaudo Cliente' : 'Pago Gasto'}</span></td>
                    <td class="text-end"><strong style="color: ${m.type === 'inbound' ? '#10b981' : '#ef4444'};">${m.type === 'inbound' ? '+' : '-'}${formatMoney(m.amount)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Diarios Operativos Estándar Odoo -->
        <h3 style="font-size: 1.1rem; margin-bottom: 0.85rem;">Diarios Operativos y Facturación</h3>
        <div class="o_journal_dashboard">
          <div class="o_journal_card is-sale">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="font-size: 1.05rem;">Facturas de Clientes (INV)</h3>
                <span class="o_badge o_badge_info">Ventas</span>
              </div>
              <p style="font-size: 0.82rem; color: var(--o-text-muted); margin-top: 0.35rem;">
                Diario de facturación electrónica y cuentas por cobrar (130505).
              </p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 0.75rem; color: var(--o-text-muted);">Por Cobrar</div>
                <strong style="font-size: 1.15rem;">${formatMoney(kpis.receivables_residual || 0)}</strong>
              </div>
              <div style="display: flex; gap: 0.4rem;">
                <button type="button" class="btn btn-sm btn-primary" data-journal-action="new_out">Nueva Factura</button>
                <button type="button" class="btn btn-sm btn-secondary" data-journal-action="list_out">Ver (${outUnpaid.length})</button>
              </div>
            </div>
          </div>

          <div class="o_journal_card is-purchase">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="font-size: 1.05rem;">Facturas de Proveedores (BILL)</h3>
                <span class="o_badge o_badge_warning">Compras</span>
              </div>
              <p style="font-size: 0.82rem; color: var(--o-text-muted); margin-top: 0.35rem;">
                Causación de compras, servicios y cuentas por pagar (220505).
              </p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 0.75rem; color: var(--o-text-muted);">Por Pagar</div>
                <strong style="font-size: 1.15rem;">${formatMoney(kpis.payables_residual || 0)}</strong>
              </div>
              <div style="display: flex; gap: 0.4rem;">
                <button type="button" class="btn btn-sm btn-primary" data-journal-action="new_in">Nueva Factura Prov.</button>
                <button type="button" class="btn btn-sm btn-secondary" data-journal-action="list_in">Ver (${inUnpaid.length})</button>
              </div>
            </div>
          </div>

          <div class="o_journal_card is-cash">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="font-size: 1.05rem;">Gastos y Operaciones Varias (EXJ)</h3>
                <span class="o_badge o_badge_info">Contabilidad</span>
              </div>
              <p style="font-size: 0.82rem; color: var(--o-text-muted); margin-top: 0.35rem;">
                Asientos contables integrados con el módulo de Gastos y Ventas.
              </p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 0.75rem; color: var(--o-text-muted);">Asientos Publicados</div>
                <strong style="font-size: 1.15rem;">${acc.moves.length}</strong>
              </div>
              <button type="button" class="btn btn-sm btn-secondary" data-journal-action="entries">Ver Asientos</button>
            </div>
          </div>
        </div>
      `;

      // 1. Filtro Mes y Año en Balance Mes
      const selectMonth = container.querySelector('#accFilterMonth');
      const selectYear = container.querySelector('#accFilterYear');
      const btnResetMonth = container.querySelector('#btnAccResetMonth');
      const svgMonthContainer = container.querySelector('#accMonthSvgContainer');
      const badgeMargin = container.querySelector('#accMarginBadge');

      function updateFilteredMonthView() {
        if (!selectMonth || !selectYear || !svgMonthContainer) return;
        const key = `${selectYear.value}-${selectMonth.value}`;
        const fin = calculateMonthFinancials(key);
        svgMonthContainer.innerHTML = generateMonthBalanceInnerSvg(fin);
        if (badgeMargin) {
          badgeMargin.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
            Margen Operativo: ${fin.margin_pct >= 0 ? '+' : ''}${fin.margin_pct}%
          `;
        }
      }

      if (selectMonth) selectMonth.addEventListener('change', updateFilteredMonthView);
      if (selectYear) selectYear.addEventListener('change', updateFilteredMonthView);
      if (btnResetMonth) {
        btnResetMonth.addEventListener('click', () => {
          const now = new Date();
          if (selectMonth) selectMonth.value = String(now.getMonth() + 1).padStart(2, '0');
          if (selectYear) selectYear.value = String(now.getFullYear());
          updateFilteredMonthView();
        });
      }

      // 2. Click en barras de Evolución 6 Meses para ver su valor
      const bannerTrendText = container.querySelector('#trendValueDisplayText');
      container.querySelectorAll('.o_trend_col, .o_trend_bar, .o_trend_dot').forEach((elem) => {
        elem.addEventListener('click', (e) => {
          e.stopPropagation();
          const col = elem.closest('.o_trend_col') || elem;
          const idx = col.getAttribute('data-trend-idx');
          const label = col.getAttribute('data-label') || elem.getAttribute('data-label');
          const inflow = Number(col.getAttribute('data-inflow') || 0);
          const outflow = Number(col.getAttribute('data-outflow') || 0);
          const net = Number(col.getAttribute('data-net') || 0);

          container.querySelectorAll('[id^="trendValIn_"], [id^="trendValOut_"]').forEach((el) => el.style.display = 'none');
          const valIn = container.querySelector(`#trendValIn_${idx}`);
          const valOut = container.querySelector(`#trendValOut_${idx}`);
          if (valIn) valIn.style.display = 'block';
          if (valOut) valOut.style.display = 'block';

          if (bannerTrendText) {
            const isClickOnSpecificBar = elem.classList.contains('o_trend_bar') || elem.classList.contains('o_trend_dot');
            const kind = elem.getAttribute('data-kind');
            const amt = Number(elem.getAttribute('data-amount') || 0);

            if (isClickOnSpecificBar && kind) {
              const color = elem.getAttribute('data-color') || '#0ea5e9';
              bannerTrendText.innerHTML = `
                <span style="font-weight: 700; color: var(--o-text-main); font-size: 0.92rem;">${esc(label)}</span> &bull; 
                <span style="color: ${color}; font-weight: 700;">${esc(kind)}: ${formatMoney(amt)}</span>
                <span style="color: var(--o-text-muted); font-size: 0.78rem; margin-left: 6px;">(Recaudado: ${formatMoney(inflow)} | Gastos: ${formatMoney(outflow)} | Neto: ${formatMoney(net)})</span>
              `;
            } else {
              bannerTrendText.innerHTML = `
                <span style="font-weight: 700; color: var(--o-text-main); font-size: 0.92rem;">${esc(label)}:</span>
                <span style="color: #10b981; font-weight: 700;">Recaudado: ${formatMoney(inflow)}</span> &bull; 
                <span style="color: #ef4444; font-weight: 700;">Gastos: ${formatMoney(outflow)}</span> &bull; 
                <span style="color: ${net >= 0 ? '#0ea5e9' : '#ef4444'}; font-weight: 700;">Neto: ${formatMoney(net)}</span>
              `;
            }
          }
        });
      });

      // Chart tabs switcher
      container.querySelectorAll('[data-chart-tab]').forEach((tabBtn) => {
        tabBtn.addEventListener('click', () => {
          const tab = tabBtn.getAttribute('data-chart-tab');
          container.querySelectorAll('.o_chart_tab').forEach((t) => t.classList.remove('is-active'));
          tabBtn.classList.add('is-active');

          const tabMonth = container.querySelector('#chartTabMonth');
          const tabTrend = container.querySelector('#chartTabTrend');
          const tabDist = container.querySelector('#chartTabDistribution');
          if (tabMonth) tabMonth.style.display = tab === 'month' ? 'block' : 'none';
          if (tabTrend) tabTrend.style.display = tab === 'trend' ? 'block' : 'none';
          if (tabDist) tabDist.style.display = tab === 'distribution' ? 'block' : 'none';
        });
      });

      const btnManageJournals = container.querySelector('#btnManageJournalsFromAcc');
      if (btnManageJournals) {
        btnManageJournals.addEventListener('click', () => {
          openApp('settings', { submenu: 'accounting' });
        });
      }

      container.querySelectorAll('[data-journal-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const act = btn.getAttribute('data-journal-action');
          const app = APPS.find((a) => a.id === 'accounting');
          if (act === 'new_out') {
            state.submenu = 'out_invoice';
            state.activeRecordId = 'new';
            state.formDraft = null;
            state.viewType = 'form';
          } else if (act === 'list_out') {
            state.submenu = 'out_invoice';
            state.viewType = 'list';
          } else if (act === 'new_in') {
            state.submenu = 'in_invoice';
            state.activeRecordId = 'new';
            state.formDraft = null;
            state.viewType = 'form';
          } else if (act === 'list_in') {
            state.submenu = 'in_invoice';
            state.viewType = 'list';
          } else if (act === 'payments') {
            state.submenu = 'payments';
            state.viewType = 'list';
          } else if (act === 'entries') {
            state.submenu = 'entries';
            state.viewType = 'list';
          }
          renderSubmenus(app);
          renderModuleWorkspace();
        });
      });
      return;
    }

    if (state.submenu === 'payments') {
      const payments = acc.payments || [];
      updatePager(payments.length, payments.length);
      container.innerHTML = `
        <div tabindex="0" role="region" aria-labelledby="payments-table-caption" class="table-wrapper">
          <table class="o_list_table" style="--label-2: 'Fecha'; --label-3: 'Diario'; --label-4: 'Tercero'; --label-5: 'Referencia'; --label-6: 'Importe'; --label-7: 'Tipo';">
            <caption id="payments-table-caption">Comprobantes de pago registrados</caption>
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Fecha</th>
                <th>Diario</th>
                <th>Cliente / Proveedor / Empleado</th>
                <th>Referencia</th>
                <th class="text-end">Importe</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map((p) => `<tr><th>${esc(p.name)}</th><td>${esc(p.date)}</td><td>${esc(p.journal_name)}</td><td>${esc(p.partner_name)}</td><td>${esc(p.ref)}</td><td class="text-end"><strong>${formatMoney(p.amount)}</strong></td><td><span class="o_badge ${p.payment_type === 'inbound' ? 'o_badge_success' : 'o_badge_warning'}">${p.payment_type === 'inbound' ? 'Recaudo Cliente' : 'Egreso / Pago'}</span></td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
      return;
    }

    if (state.submenu === 'accounts') {
      const accounts = acc.accounts || [];
      updatePager(accounts.length, accounts.length);
      container.innerHTML = `
        <div class="o_form_sheet" style="margin-bottom: 1rem;">
          <h3 style="margin-bottom: 0.75rem;">Agregar Cuenta al Plan Único de Cuentas (PUC)</h3>
          <div class="o_group o_acc_add_grid" style="align-items: end; margin-bottom: 0;">
            <div class="o_field_row">
              <label for="newAccCode">Código PUC</label>
              <input type="text" id="newAccCode" class="o_input" placeholder="Ej. 513515" />
            </div>
            <div class="o_field_row">
              <label for="newAccName">Nombre de la Cuenta</label>
              <input type="text" id="newAccName" class="o_input" placeholder="Ej. Asesoría Técnica y Jurídica" />
            </div>
            <div class="o_field_row">
              <label for="newAccType">Naturaleza / Tipo</label>
              <select id="newAccType" class="o_select">
                <option value="" disabled selected>— Seleccione Naturaleza / Tipo —</option>
                <option value="Activo Corriente">Activo Corriente</option>
                <option value="Por Cobrar">Por Cobrar</option>
                <option value="Por Pagar">Por Pagar</option>
                <option value="Ingresos Operacionales">Ingresos Operacionales</option>
                <option value="Gastos Operacionales">Gastos Operacionales</option>
              </select>
            </div>
            <button type="button" class="btn btn-action" id="btnAddAccount">Crear Cuenta</button>
          </div>
        </div>

        <div tabindex="0" role="region" aria-labelledby="accounts-table-caption" class="table-wrapper">
          <table class="o_list_table" style="--label-2: 'Nombre'; --label-3: 'Tipo'; --label-4: 'Conciliable';">
            <caption id="accounts-table-caption">Plan de cuentas contables</caption>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre de la Cuenta</th>
                <th>Tipo de Cuenta</th>
                <th>Permite Conciliación</th>
              </tr>
            </thead>
            <tbody>
              ${accounts.map((a) => `<tr><th>${esc(a.code)}</th><td>${esc(a.name)}</td><td>${esc(a.type)}</td><td><span class="o_badge ${a.reconcile ? 'o_badge_success' : 'o_badge_muted'}">${a.reconcile ? 'Sí' : 'No'}</span></td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;

      document.getElementById('btnAddAccount').addEventListener('click', async () => {
        try {
          const code = document.getElementById('newAccCode').value;
          const name = document.getElementById('newAccName').value;
          const type = document.getElementById('newAccType').value;
          if (!type) {
            showToast('Debe seleccionar la naturaleza o tipo de cuenta.', true);
            return;
          }
          await apiCall('/api/accounting/accounts', 'POST', { code, name, type, reconcile: type.includes('Cobrar') || type.includes('Pagar') });
          showToast('Cuenta contable creada.');
          renderModuleWorkspace();
        } catch (err) {
          showToast(err.message, true);
        }
      });
      return;
    }

    // Moves list (out_invoice, in_invoice, entries)
    let moves = acc.moves || [];
    if (state.submenu === 'out_invoice') moves = moves.filter((m) => m.move_type === 'out_invoice');
    else if (state.submenu === 'in_invoice') moves = moves.filter((m) => m.move_type === 'in_invoice');

    if (state.partnerContextFilter) {
      moves = moves.filter((m) => Number(m.partner_id) === Number(state.partnerContextFilter.id));
    }

    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      moves = moves.filter(
        (m) =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.partner_name || '').toLowerCase().includes(q) ||
          (m.ref || '').toLowerCase().includes(q)
      );
    }

    updatePager(moves.length, moves.length);
    const totalAmountSum = moves.reduce((s, m) => s + Number(m.amount_total || 0), 0);
    const totalResidualSum = moves.reduce((s, m) => s + Number(m.amount_residual || 0), 0);

    container.innerHTML = `
      <div tabindex="0" role="region" aria-labelledby="moves-table-caption" class="table-wrapper">
        <table class="o_list_table" style="--label-2: 'Tercero'; --label-3: 'Fecha'; --label-4: 'Vencimiento'; --label-5: 'Diario / Origen'; --label-6: 'Total'; --label-7: 'Saldo Pendiente'; --label-8: 'Estado Pago'; --label-9: 'Estado';">
          <caption id="moves-table-caption">Facturas y asientos contables</caption>
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente / Proveedor</th>
              <th>Fecha</th>
              <th>Vencimiento</th>
              <th>Diario / Origen</th>
              <th class="text-end">Total</th>
              <th class="text-end">Saldo Pendiente</th>
              <th>Estado Pago</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${moves.map((m) => `<tr data-move-id="${m.id}"><th>${esc(m.name)}</th><td>${esc(m.partner_name)}</td><td>${esc(m.invoice_date)}</td><td>${esc(m.invoice_date_due)}</td><td>${esc(m.journal_code)} · ${esc(m.origin || m.ref || '')}</td><td class="text-end"><strong>${formatMoney(m.amount_total)}</strong></td><td class="text-end">${formatMoney(m.amount_residual)}</td><td>${paymentStateBadge(m.payment_state, m.state)}</td><td><span class="o_badge ${m.state === 'posted' ? 'o_badge_success' : m.state === 'cancel' ? 'o_badge_danger' : 'o_badge_info'}">${m.state === 'posted' ? 'Publicado' : m.state === 'cancel' ? 'Cancelado' : 'Borrador'}</span></td></tr>`).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5">Totales</td>
              <td class="text-end">${formatMoney(totalAmountSum)}</td>
              <td class="text-end">${formatMoney(totalResidualSum)}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    container.querySelectorAll('tbody tr').forEach((row) => {
      row.addEventListener('click', () => {
        state.activeRecordId = Number(row.getAttribute('data-move-id'));
        state.formDraft = null;
        state.viewType = 'form';
        renderModuleWorkspace();
      });
    });
  }
