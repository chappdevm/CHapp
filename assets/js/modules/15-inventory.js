/* ==========================================================================
   CH Aluminios ERP -- JS Module: 15-inventory.js
   Módulo 6: Inventario y Control de Stock -- Existencias, Kardex y Entradas por Gastos
   ========================================================================== */
'use strict';

  let currentInventoryFilter = 'all';

  function stockBadge(qty, uom = 'Und') {
    const q = Number(qty || 0);
    const u = esc(uom || 'Und');
    if (q >= 5) {
      return `<span class="o_stock_badge_in" title="Stock disponible">✓ ${q} ${u}</span>`;
    }
    if (q > 0) {
      return `<span class="o_stock_badge_low" title="Stock bajo en almacén">⚠ ${q} ${u} (Bajo)</span>`;
    }
    return `<span class="o_stock_badge_out" title="Agotado sin existencias">✕ 0 ${u} (Agotado)</span>`;
  }

  function renderInventoryModule() {
    const container = document.getElementById('moduleContent');
    if (!container) return;

    if (state.viewType === 'form') {
      renderInventoryProductDetail(container);
      return;
    }

    if (state.submenu === 'moves') {
      renderInventoryMovesSubmodule(container);
      return;
    }

    renderInventoryStockSubmodule(container);
  }

  function renderInventoryStockSubmodule(container) {
    let products = state.data.products || [];
    const moves = state.data.inventory_moves || [];

    // Filter by pills
    if (currentInventoryFilter === 'in_stock') {
      products = products.filter((p) => (Number(p.qty_available) || 0) > 0);
    } else if (currentInventoryFilter === 'out_stock') {
      products = products.filter((p) => (Number(p.qty_available) || 0) <= 0);
    } else if (currentInventoryFilter === 'materials') {
      products = products.filter((p) => (p.category || '').toLowerCase().includes('material') || (p.category || '').toLowerCase().includes('perfil'));
    } else if (currentInventoryFilter === 'hardware') {
      products = products.filter((p) => (p.category || '').toLowerCase().includes('herraje') || (p.category || '').toLowerCase().includes('accesorio'));
    }

    // Filter by live search query
    const q = (state.searchQuery || '').trim().toLowerCase();
    if (q) {
      products = products.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.default_code || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.uom || '').toLowerCase().includes(q)
      );
    }

    updatePager(products.length, (state.data.products || []).length);

    // Calculate inventory metrics
    const allProducts = state.data.products || [];
    const totalUnits = allProducts.reduce((sum, p) => sum + (Number(p.qty_available) || 0), 0);
    const totalValuation = allProducts.reduce((sum, p) => sum + ((Number(p.qty_available) || 0) * (Number(p.standard_price) || 0)), 0);
    const inStockCount = allProducts.filter((p) => (Number(p.qty_available) || 0) > 0).length;
    const lastMove = moves.length > 0 ? moves[0] : null;

    const bannerHtml = `
      <div class="o_inventory_quick_card">
        <div>
          <div style="font-size: 1.15rem; font-weight: 700; color: var(--o-heading); display: flex; align-items: center; gap: 8px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--o-accent, #14B5D9);"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            Control de Inventario y Almacén — CH Aluminios
          </div>
          <p style="margin: 4px 0 0; color: var(--o-muted); font-size: 0.88rem;">
            Las existencias aumentan automáticamente con cada compra o gasto registrado a proveedores. Trazabilidad completa sin duplicados.
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button type="button" class="btn btn-primary" id="btnInvBannerNewExpense" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Entrada por Gasto
          </button>
          <button type="button" class="btn btn-secondary" id="btnInvBannerViewMoves">
            Kardex de Movimientos
          </button>
        </div>
      </div>

      <div class="o_dashboard_banner" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); margin-bottom: 1.2rem;">
        <div class="o_stat_card">
          <span class="o_stat_label">Unidades en Almacén</span>
          <span class="o_stat_value" style="color: var(--o-primary, #074073);">${totalUnits.toLocaleString('es-CO')}</span>
          <span class="o_stat_sub">${inStockCount} de ${allProducts.length} referencias con stock</span>
        </div>
        <div class="o_stat_card">
          <span class="o_stat_label">Valoración Total Inventario</span>
          <span class="o_stat_value" style="color: #059669;">${formatMoney(totalValuation)}</span>
          <span class="o_stat_sub">Valoración a costo de compra</span>
        </div>
        <div class="o_stat_card">
          <span class="o_stat_label">Catálogo de Productos</span>
          <span class="o_stat_value">${allProducts.length}</span>
          <span class="o_stat_sub">Referencias configuradas</span>
        </div>
        <div class="o_stat_card">
          <span class="o_stat_label">Última Entrada</span>
          <span class="o_stat_value" style="font-size: 1.15rem; font-weight: 700;">${lastMove ? esc(lastMove.origin_ref || lastMove.date) : 'Sin entradas'}</span>
          <span class="o_stat_sub">${lastMove ? `${esc(lastMove.product_name)} (+${lastMove.quantity})` : 'Registra un gasto para sumar stock'}</span>
        </div>
      </div>

      <div class="o_inventory_filter_bar">
        <span style="font-size: 0.8rem; font-weight: 700; color: var(--o-muted); margin-right: 4px;">Filtros:</span>
        <button type="button" class="o_inv_pill ${currentInventoryFilter === 'all' ? 'is-active' : ''}" data-inv-filter="all">Todos (${allProducts.length})</button>
        <button type="button" class="o_inv_pill ${currentInventoryFilter === 'in_stock' ? 'is-active' : ''}" data-inv-filter="in_stock">Con Stock (${inStockCount})</button>
        <button type="button" class="o_inv_pill ${currentInventoryFilter === 'out_stock' ? 'is-active' : ''}" data-inv-filter="out_stock">Agotados (${allProducts.length - inStockCount})</button>
        <button type="button" class="o_inv_pill ${currentInventoryFilter === 'materials' ? 'is-active' : ''}" data-inv-filter="materials">Perfilería y Materiales</button>
        <button type="button" class="o_inv_pill ${currentInventoryFilter === 'hardware' ? 'is-active' : ''}" data-inv-filter="hardware">Herrajes y Accesorios</button>
      </div>
    `;

    if (state.viewType === 'kanban') {
      container.innerHTML = bannerHtml + `
        <div class="o_kanban_view">
          ${products.length === 0
            ? `<div style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; color: var(--o-text-muted);">
                 No se encontraron productos en el inventario con el filtro actual.
               </div>`
            : products.map((p) => {
                const q = Number(p.qty_available || 0);
                const cost = Number(p.standard_price || 0);
                const val = q * cost;
                return `
                  <article class="o_kanban_record" data-inv-prod-id="${p.id}" style="cursor: pointer;">
                    <div class="o_kanban_details">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.4rem;">
                        <span class="o_kanban_title" style="font-size: 1rem;">${esc(p.name)}</span>
                        ${stockBadge(q, p.uom)}
                      </div>
                      <div class="o_kanban_subtitle" style="margin-top: 4px;">
                        SKU: <strong>${esc(p.default_code || '—')}</strong> · ${esc(p.category || 'General')}
                      </div>
                      <div style="margin: 0.75rem 0; padding: 0.5rem; background: var(--o-bg-subtle, rgba(0,0,0,0.02)); border-radius: 6px; display: flex; justify-content: space-between;">
                        <div>
                          <div style="font-size: 0.75rem; color: var(--o-muted);">Costo Unit.</div>
                          <strong style="font-size: 0.95rem;">${formatMoney(cost)}</strong>
                        </div>
                        <div style="text-align: right;">
                          <div style="font-size: 0.75rem; color: var(--o-muted);">Valoración Stock</div>
                          <strong style="font-size: 0.95rem; color: #059669;">${formatMoney(val)}</strong>
                        </div>
                      </div>
                      <div class="o_kanban_footer" style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="o_badge o_badge_info">${esc(p.uom || 'Unidad')}</span>
                        <span style="font-size: 0.78rem; color: var(--o-primary); font-weight: 600;">Ver trazabilidad →</span>
                      </div>
                    </div>
                  </article>
                `;
              }).join('')
          }
        </div>
      `;
    } else {
      container.innerHTML = bannerHtml + `
        <div tabindex="0" role="region" aria-labelledby="inventory-table-caption" class="table-wrapper">
          <table class="o_list_table" style="--label-2: 'SKU'; --label-3: 'Categoría'; --label-4: 'Stock'; --label-5: 'Unidad'; --label-6: 'Costo'; --label-7: 'Valoración';">
            <caption id="inventory-table-caption" style="display: none;">Existencias de inventario</caption>
            <thead>
              <tr>
                <th>Referencia / SKU</th>
                <th>Producto / Material</th>
                <th>Categoría</th>
                <th class="text-center" style="width: 140px;">Stock en Almacén</th>
                <th>Unidad</th>
                <th class="text-end" style="width: 140px;">Costo Promedio</th>
                <th class="text-end" style="width: 150px;">Valoración Total</th>
                <th class="text-center" style="width: 120px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${products.length === 0
                ? `<tr>
                     <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--o-text-muted);">
                       No hay artículos que coincidan con la búsqueda. Puedes registrar un nuevo gasto para ingresar existencias.
                     </td>
                   </tr>`
                : products.map((p) => {
                    const q = Number(p.qty_available || 0);
                    const cost = Number(p.standard_price || 0);
                    const val = q * cost;
                    return `
                      <tr data-inv-prod-id="${p.id}" style="cursor: pointer;" title="Haga clic para ver el detalle y trazabilidad de este producto">
                        <td><strong>${esc(p.default_code || '—')}</strong></td>
                        <th>${esc(p.name)}</th>
                        <td><span class="o_badge o_badge_muted">${esc(p.category || 'General')}</span></td>
                        <td class="text-center">${stockBadge(q, p.uom)}</td>
                        <td>${esc(p.uom || 'Unidad')}</td>
                        <td class="text-end">${formatMoney(cost)}</td>
                        <td class="text-end"><strong style="color: #059669;">${formatMoney(val)}</strong></td>
                        <td class="text-center">
                          <button type="button" class="btn btn-sm btn-secondary btn-view-prod-moves" data-prod-id="${p.id}">
                            Entradas
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3"><strong>Totales Almacén</strong></td>
                <td class="text-center"><strong>${totalUnits.toLocaleString('es-CO')} Unidades</strong></td>
                <td></td>
                <td></td>
                <td class="text-end"><strong>${formatMoney(totalValuation)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    // Wire quick banner actions
    document.getElementById('btnInvBannerNewExpense')?.addEventListener('click', () => {
      openApp('expenses', { viewType: 'form', recordId: 'new' });
    });
    document.getElementById('btnInvBannerViewMoves')?.addEventListener('click', () => {
      state.submenu = 'moves';
      state.viewType = 'list';
      renderSubmenus(APPS.find((a) => a.id === 'inventory'));
      renderModuleWorkspace();
    });

    // Wire filter pills
    container.querySelectorAll('[data-inv-filter]').forEach((pill) => {
      pill.addEventListener('click', () => {
        currentInventoryFilter = pill.getAttribute('data-inv-filter');
        renderInventoryStockSubmodule(container);
      });
    });

    // Wire row clicks for product detail
    container.querySelectorAll('[data-inv-prod-id]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-view-prod-moves')) return;
        const pid = Number(row.getAttribute('data-inv-prod-id'));
        state.activeRecordId = pid;
        state.viewType = 'form';
        renderModuleWorkspace();
      });
    });

    // Wire "Entradas" button
    container.querySelectorAll('.btn-view-prod-moves').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = Number(btn.getAttribute('data-prod-id'));
        const p = (state.data.products || []).find((x) => Number(x.id) === pid);
        state.submenu = 'moves';
        state.viewType = 'list';
        if (p) state.searchQuery = p.name;
        renderSubmenus(APPS.find((a) => a.id === 'inventory'));
        renderModuleWorkspace();
      });
    });
  }

  function renderInventoryMovesSubmodule(container) {
    let moves = state.data.inventory_moves || [];

    const q = (state.searchQuery || '').trim().toLowerCase();
    if (q) {
      moves = moves.filter(
        (m) =>
          (m.product_name || '').toLowerCase().includes(q) ||
          (m.product_code || '').toLowerCase().includes(q) ||
          (m.origin_ref || '').toLowerCase().includes(q) ||
          (m.partner_name || '').toLowerCase().includes(q) ||
          (m.employee_name || '').toLowerCase().includes(q)
      );
    }

    updatePager(moves.length, (state.data.inventory_moves || []).length);

    const totalQty = moves.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
    const totalValue = moves.reduce((sum, m) => sum + (Number(m.total_value) || 0), 0);

    container.innerHTML = `
      <div class="o_dashboard_banner" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 1.2rem;">
        <div class="o_stat_card">
          <span class="o_stat_label">Movimientos de Entrada</span>
          <span class="o_stat_value">${moves.length}</span>
          <span class="o_stat_sub">Entradas registradas por compras</span>
        </div>
        <div class="o_stat_card">
          <span class="o_stat_label">Total Unidades Ingresadas</span>
          <span class="o_stat_value" style="color: var(--o-primary, #074073);">${totalQty.toLocaleString('es-CO')}</span>
          <span class="o_stat_sub">Materiales agregados al stock</span>
        </div>
        <div class="o_stat_card">
          <span class="o_stat_label">Inversión Total en Entradas</span>
          <span class="o_stat_value" style="color: #059669;">${formatMoney(totalValue)}</span>
          <span class="o_stat_sub">Costo de mercancía comprada</span>
        </div>
      </div>

      <div tabindex="0" role="region" aria-labelledby="moves-table-caption" class="table-wrapper">
        <table class="o_list_table" style="--label-2: 'Origen'; --label-3: 'Producto'; --label-4: 'Cantidad'; --label-5: 'Costo'; --label-6: 'Total'; --label-7: 'Proveedor';">
          <caption id="moves-table-caption" style="display: none;">Kardex de movimientos de entrada</caption>
          <thead>
            <tr>
              <th style="width: 100px;">Fecha</th>
              <th style="width: 140px;">Comprobante</th>
              <th>Producto / Material</th>
              <th>Referencia SKU</th>
              <th class="text-center" style="width: 130px;">Cant. Ingresada</th>
              <th class="text-end" style="width: 130px;">Costo Unit.</th>
              <th class="text-end" style="width: 140px;">Total Entrada</th>
              <th>Proveedor</th>
              <th>Responsable</th>
              <th class="text-center" style="width: 100px;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${moves.length === 0
              ? `<tr>
                   <td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--o-text-muted);">
                     No hay movimientos de entrada registrados. Cada gasto guardado agregará automáticamente sus productos aquí.
                   </td>
                 </tr>`
              : moves.map((m) => `
                  <tr>
                    <td>${esc(m.date || '')}</td>
                    <td>
                      <span class="o_stock_movement_tag btn-link-expense" data-exp-id="${m.origin_id}" style="cursor: pointer;" title="Ver gasto asociado ${esc(m.origin_ref || '')}">
                        ${esc(m.origin_ref || `EXP #${m.origin_id}`)}
                      </span>
                    </td>
                    <th>${esc(m.product_name)}</th>
                    <td>${esc(m.product_code || '—')}</td>
                    <td class="text-center">
                      <span class="o_badge o_badge_success" style="font-weight: 700;">+ ${Number(m.quantity || 1)} ${esc(m.uom || 'Und')}</span>
                    </td>
                    <td class="text-end">${formatMoney(m.price_unit)}</td>
                    <td class="text-end"><strong>${formatMoney(m.total_value)}</strong></td>
                    <td>${esc(m.partner_name || 'Proveedor General')}</td>
                    <td>${esc(m.employee_name || 'Administrador')}</td>
                    <td class="text-center"><span class="o_badge o_badge_info">Ingresado</span></td>
                  </tr>
                `).join('')
            }
          </tbody>
        </table>
      </div>
    `;

    // Wire click on expense reference link with navStack trace
    container.querySelectorAll('.btn-link-expense').forEach((tag) => {
      tag.addEventListener('click', () => {
        const expId = Number(tag.getAttribute('data-exp-id'));
        openApp('expenses', {
          viewType: 'form',
          recordId: expId,
          returnTo: { app: 'inventory', submenu: 'moves', viewType: 'list' }
        });
      });
    });
  }

  function renderInventoryProductDetail(container) {
    const pid = Number(state.activeRecordId);
    const product = (state.data.products || []).find((p) => Number(p.id) === pid);

    if (!product) {
      state.viewType = 'list';
      renderInventoryStockSubmodule(container);
      return;
    }

    const moves = (state.data.inventory_moves || []).filter((m) => Number(m.product_id) === pid);
    const q = Number(product.qty_available || 0);
    const cost = Number(product.standard_price || 0);
    const val = q * cost;

    container.innerHTML = `
      <div class="o_form_view">
        <div class="o_form_sheet_bg">
          <div class="o_form_statusbar" style="justify-content: space-between;">
            <div class="o_statusbar_buttons">
              <button type="button" class="btn btn-secondary" id="btnInvBackToList">Volver a Existencias</button>
              <button type="button" class="btn btn-primary" id="btnInvBuyMore" style="display: inline-flex; align-items: center; gap: 6px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Registrar Compra / Entrada (Gasto)
              </button>
            </div>
            <div>
              ${stockBadge(q, product.uom)}
            </div>
          </div>

          <div class="o_form_sheet">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
              <div>
                <span class="o_badge o_badge_info" style="margin-bottom: 0.35rem; display: inline-block;">${esc(product.category || 'Materiales')}</span>
                <h2 style="font-size: 1.6rem; margin: 0 0 0.25rem;">${esc(product.name)}</h2>
                <div style="color: var(--o-muted); font-size: 0.9rem;">
                  Referencia SKU: <strong>${esc(product.default_code || '—')}</strong> · Unidad: <strong>${esc(product.uom || 'Unidad')}</strong>
                </div>
              </div>
            </div>

            <!-- KPI Cards of this product -->
            <div class="o_dashboard_banner" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 1.5rem;">
              <div class="o_stat_card">
                <span class="o_stat_label">Stock Actual en Almacén</span>
                <span class="o_stat_value" style="color: var(--o-primary);">${q.toLocaleString('es-CO')} ${esc(product.uom || 'Und')}</span>
                <span class="o_stat_sub">Existencias calculadas automáticamente</span>
              </div>
              <div class="o_stat_card">
                <span class="o_stat_label">Costo Promedio de Compra</span>
                <span class="o_stat_value">${formatMoney(cost)}</span>
                <span class="o_stat_sub">Valor unitario ponderado</span>
              </div>
              <div class="o_stat_card">
                <span class="o_stat_label">Valoración Total en Stock</span>
                <span class="o_stat_value" style="color: #059669;">${formatMoney(val)}</span>
                <span class="o_stat_sub">Costo total inmovilizado</span>
              </div>
            </div>

            <!-- Trazabilidad de entradas por gastos -->
            <div style="border-top: 1px solid var(--o-border); padding-top: 1rem;">
              <h3 style="font-size: 1.05rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--o-accent);"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                Historial de Entradas por Compras / Gastos (${moves.length})
              </h3>
              <p style="font-size: 0.85rem; color: var(--o-muted); margin-bottom: 0.85rem;">
                Cada factura o comprobante de gasto que contiene este producto registra su entrada aquí.
              </p>

              <div tabindex="0" role="region" aria-label="Historial de entradas del producto" class="table-wrapper">
                <table class="o_list_table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Comprobante</th>
                      <th class="text-center">Cantidad Entrada</th>
                      <th class="text-end">Costo Unitario</th>
                      <th class="text-end">Total</th>
                      <th>Proveedor</th>
                      <th>Responsable</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${moves.length === 0
                      ? `<tr>
                           <td colspan="7" style="text-align: center; padding: 2rem; color: var(--o-muted);">
                             Este producto aún no registra entradas de almacén por gastos.
                           </td>
                         </tr>`
                      : moves.map((m) => `
                          <tr>
                            <td>${esc(m.date || '')}</td>
                            <td>
                              <span class="o_stock_movement_tag btn-link-expense" data-exp-id="${m.origin_id}" style="cursor: pointer;">
                                ${esc(m.origin_ref || `EXP #${m.origin_id}`)}
                              </span>
                            </td>
                            <td class="text-center">
                              <span class="o_badge o_badge_success">+ ${Number(m.quantity || 1)} ${esc(m.uom || 'Und')}</span>
                            </td>
                            <td class="text-end">${formatMoney(m.price_unit)}</td>
                            <td class="text-end"><strong>${formatMoney(m.total_value)}</strong></td>
                            <td>${esc(m.partner_name || 'Proveedor General')}</td>
                            <td>${esc(m.employee_name || 'Administrador')}</td>
                          </tr>
                        `).join('')
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnInvBackToList')?.addEventListener('click', () => {
      state.activeRecordId = null;
      state.viewType = 'list';
      renderModuleWorkspace();
    });

    document.getElementById('btnInvBuyMore')?.addEventListener('click', () => {
      openApp('expenses', {
        viewType: 'form',
        recordId: 'new',
        draft: {
          name: product.name,
          product_id: product.id,
          price_unit: product.standard_price,
          items: [{ description: product.name, quantity: 1, price_unit: product.standard_price, subtotal: product.standard_price }]
        }
      });
    });

    container.querySelectorAll('.btn-link-expense').forEach((tag) => {
      tag.addEventListener('click', () => {
        const expId = Number(tag.getAttribute('data-exp-id'));
        openApp('expenses', {
          viewType: 'form',
          recordId: expId,
          returnTo: { app: 'inventory', submenu: 'stock', viewType: 'form', recordId: pid }
        });
      });
    });
  }
