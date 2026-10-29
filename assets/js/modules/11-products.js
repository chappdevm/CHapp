/* ==========================================================================
   CH Aluminios ERP -- JS Module: 11-products.js
   Module 3 (Part 3): Cat--logo de Productos (product.template) -- List, Kanban & Form
   ========================================================================== */
'use strict';

  function renderProductsSubmodule(container) {
    let products = state.data.products || [];
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      products = products.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.default_code || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
      );
    }
    updatePager(products.length, (state.data.products || []).length);

    const bannerHtml = `
      <div class="o_dashboard_banner" style="margin-bottom: 1rem;">
        <div class="o_stat_card">
          <span class="o_stat_label">Catálogo de Productos</span>
          <span class="o_stat_value">${(state.data.products || []).length}</span>
          <span class="o_stat_sub">Productos registrados</span>
        </div>
      </div>
    `;

    if (state.viewType === 'kanban') {
      container.innerHTML =
        bannerHtml +
        `
        <div class="o_kanban_view">
          ${
            products.length === 0
              ? `<div style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; color: var(--o-text-muted);">
                   No hay productos registrados en el catálogo. Haz clic en <strong>Nuevo Producto</strong> para agregar uno.
                 </div>`
              : products
                  .map(
                    (p) => `
                <article class="o_kanban_record" data-product-id="${p.id}" style="cursor: pointer;">
                  <div class="o_kanban_details">
                    <div style="display: flex; justify-content: space-between; gap: 0.4rem;">
                      <span class="o_kanban_title">${esc(p.name)}</span>
                      <span class="o_badge o_badge_info">${esc(p.uom || 'Metro Cuadrado')}</span>
                    </div>
                    <div class="o_kanban_subtitle">SKU: ${esc(p.default_code || '—')} · ${esc(p.category || 'General')}</div>
                    <div class="o_kanban_subtitle">Precio: <strong>${formatMoney(p.list_price)}</strong></div>
                    <div class="o_kanban_footer">
                      <span class="o_badge o_badge_info">IVA ${Number(p.tax_rate ?? 19)}%</span>
                    </div>
                  </div>
                </article>
              `
                  )
                  .join('')
          }
        </div>
      `;
    } else {
      container.innerHTML =
        bannerHtml +
        `
        <div tabindex="0" role="region" aria-labelledby="products-table-caption" class="table-wrapper">
          <table class="o_list_table" style="--label-2: 'SKU'; --label-3: 'Categoría'; --label-4: 'Unidad'; --label-5: 'Precio Venta'; --label-6: 'IVA';">
            <caption id="products-table-caption">Catálogo de productos</caption>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Referencia SKU</th>
                <th>Categoría</th>
                <th>Unidad de Medida</th>
                <th class="text-end">Precio de Venta</th>
                <th>Impuesto</th>
              </tr>
            </thead>
            <tbody>
              ${
                products.length === 0
                  ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--o-text-muted);">
                    No hay productos registrados en el catálogo. Haz clic en <strong>Nuevo Producto</strong> para agregar uno.
                  </td>
                </tr>
              `
                  : products
                      .map(
                        (p) => `
                <tr data-product-id="${p.id}" style="cursor: pointer;" title="Haga clic para ver o modificar este producto">
                  <th>${esc(p.name)}</th>
                  <td>${esc(p.default_code || '—')}</td>
                  <td>${esc(p.category || 'General')}</td>
                  <td>${esc(p.uom || 'Metro Cuadrado')}</td>
                  <td class="text-end"><strong>${formatMoney(p.list_price)}</strong></td>
                  <td><span class="o_badge o_badge_info">IVA ${Number(p.tax_rate ?? 19)}%</span></td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      `;
    }

    container.querySelectorAll('[data-product-id]').forEach((el) => {
      el.addEventListener('click', () => {
        state.activeRecordId = Number(el.getAttribute('data-product-id'));
        state.viewType = 'form';
        renderModuleWorkspace();
      });
    });
  }

  function renderProductForm(container) {
    const isNew = state.activeRecordId === 'new';
    const products = state.data.products || [];
    const existing = isNew
      ? {
          name: '',
          default_code: '',
          category: 'General',
          type: 'consu',
          uom: '',
          list_price: 0,
          standard_price: 0,
          tax_rate: '',
          can_be_sold: true,
          can_be_expensed: false
        }
      : products.find((p) => Number(p.id) === Number(state.activeRecordId));

    if (!existing) {
      state.activeRecordId = null;
      state.viewType = 'list';
      return renderModuleWorkspace();
    }

    updatePager(0, products.length);

    container.innerHTML = `
      <div class="o_form_view">
        <div class="o_form_sheet_bg">
          <div class="o_form_statusbar">
            <div class="o_statusbar_buttons">
              <button type="button" class="btn btn-action" id="btnSaveProductForm">Guardar</button>
              <button type="button" class="btn btn-secondary" id="btnDiscardProductForm">Descartar</button>
            </div>
            <div class="o_statusbar_status">
              <span class="o_arrow_button is-current">${isNew ? 'Nuevo Producto' : esc(existing.default_code || 'Producto')}</span>
            </div>
          </div>

          <form id="productForm" class="o_form_sheet" onsubmit="return false;">
            <div class="o_button_box">
              <div class="o_stat_button oe_stat_button" style="cursor: default;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                <div class="o_stat_info">
                  <span class="o_stat_value">${formatMoney(existing.list_price || 0)}</span>
                  <span class="o_stat_text">Precio de Venta</span>
                </div>
              </div>
            </div>

            <div class="o_form_title_group">
              <label for="prodName" class="o_form_label_title">Nombre del Producto *</label>
              <input type="text" id="prodName" class="o_input_title" placeholder="Ej. Alfombra Modular..." value="${esc(existing.name || '')}" required />
            </div>

            <div class="o_notebook">
              <div class="o_notebook_headers">
                <button type="button" class="o_notebook_tab is-active">Información General</button>
              </div>

              <div class="o_notebook_content" style="padding-top: 1rem;">
                <div class="o_group o_prod_add_grid" style="align-items: end;">
                  <div class="o_field_row">
                    <label for="prodSku">Referencia Interna / SKU</label>
                    <input type="text" id="prodSku" class="o_input" placeholder="Ej. PRD-001" value="${esc(existing.default_code || '')}" />
                  </div>
                  <div class="o_field_row">
                    <label for="prodCategory">Categoría</label>
                    <input type="text" id="prodCategory" class="o_input" placeholder="Ej. Pisos, Revestimientos, General" value="${esc(existing.category || 'General')}" />
                  </div>
                  <div class="o_field_row">
                    <label for="prodUom">Unidad de Medida</label>
                    <select id="prodUom" class="o_select">
                      <option value="" ${!existing.uom ? 'selected disabled' : ''}>— Seleccione Unidad de Medida —</option>
                      <option value="Metro Cuadrado" ${existing.uom === 'Metro Cuadrado' ? 'selected' : ''}>Metro Cuadrado (m²)</option>
                      <option value="Metro Lineal" ${existing.uom === 'Metro Lineal' || existing.uom === 'Metro Liso' ? 'selected' : ''}>Metro Lineal</option>
                      <option value="Metro Liso" style="display: none;">Metro Liso</option>
                    </select>
                  </div>
                  <div class="o_field_row">
                    <label for="prodPrice">Precio de Venta (COP)</label>
                    <input type="number" id="prodPrice" class="o_input" min="0" step="any" value="${existing.list_price ?? 0}" />
                  </div>
                  <div class="o_field_row">
                    <label for="prodTax">Impuesto IVA (%)</label>
                    <select id="prodTax" class="o_select">
                      <option value="" ${existing.tax_rate === '' || existing.tax_rate === undefined || existing.tax_rate === null ? 'selected disabled' : ''}>— Seleccione IVA —</option>
                      <option value="19" ${existing.tax_rate !== '' && Number(existing.tax_rate) === 19 ? 'selected' : ''}>IVA 19%</option>
                      <option value="5" ${existing.tax_rate !== '' && Number(existing.tax_rate) === 5 ? 'selected' : ''}>IVA 5%</option>
                      <option value="0" ${existing.tax_rate !== '' && Number(existing.tax_rate) === 0 ? 'selected' : ''}>Exento 0%</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    const btnSaveProd = document.getElementById('btnSaveProductForm');
    if (btnSaveProd) {
      btnSaveProd.addEventListener('click', () => {
        withActionLock(btnSaveProd, async () => {
          const name = (document.getElementById('prodName').value || '').trim();
          if (!name) {
            showToast('El nombre del producto es obligatorio.', true);
            return;
          }
          const default_code = (document.getElementById('prodSku').value || '').trim();
          const category = (document.getElementById('prodCategory').value || 'General').trim();
          const uom = (document.getElementById('prodUom').value || '').trim();
          if (!uom) {
            showToast('Debe seleccionar una unidad de medida.', true);
            return;
          }
          const list_price = Number(document.getElementById('prodPrice').value || 0);
          const taxVal = document.getElementById('prodTax').value;
          if (taxVal === '') {
            showToast('Debe seleccionar la tarifa de IVA.', true);
            return;
          }
          const tax_rate = Number(taxVal);

          const payload = {
            name,
            default_code,
            category,
            type: existing.type || 'consu',
            uom,
            list_price,
            standard_price: existing.standard_price || 0,
            tax_rate,
            can_be_sold: true,
            can_be_expensed: existing.can_be_expensed !== undefined ? existing.can_be_expensed : false
          };
          if (!isNew) {
            payload.id = existing.id;
          }

          await apiCall('/api/products', 'POST', payload);
          showToast(isNew ? 'Producto creado en el catálogo.' : 'Producto actualizado exitosamente.');
          state.activeRecordId = null;
          state.viewType = 'list';
          renderModuleWorkspace();
        }).catch((err) => showToast(err.message, true));
      });
    }

    document.getElementById('btnDiscardProductForm').addEventListener('click', () => {
      state.activeRecordId = null;
      state.viewType = 'list';
      renderModuleWorkspace();
    });
  }

