/* ==========================================================================
   CH Aluminios ERP -- JS Module: 04-contacts.js
   Module 1: Contactos (res.partner) -- List, Kanban, Form & Quick Filters
   ========================================================================== */
'use strict';

  // ==================== MODULE 1: CONTACTOS (res.partner) ====================
  function getFilteredContacts() {
    let list = state.data.contacts || [];
    if (state.submenu === 'customers') list = list.filter((c) => Number(c.customer_rank) > 0);
    else if (state.submenu === 'suppliers') list = list.filter((c) => Number(c.supplier_rank) > 0);
    else if (state.submenu === 'companies') list = list.filter((c) => Boolean(c.is_company));

    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.vat || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.city || '').toLowerCase().includes(q) ||
          (c.category_ids || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }

  function renderContactsModule() {
    const container = document.getElementById('moduleContent');
    if (state.viewType === 'form') {
      renderContactForm(container);
      return;
    }

    const contacts = getFilteredContacts();
    updatePager(contacts.length, (state.data.contacts || []).length);

    const kpis = state.data.kpis || {};
    const bannerHtml = `
      <div class="o_dashboard_banner">
        <div class="o_stat_card" data-jump-sub="all">
          <span class="o_stat_label">Directorio Total</span>
          <span class="o_stat_value">${kpis.contacts_total || 0}</span>
          <span class="o_stat_sub">${kpis.companies_total || 0} compañías registradas</span>
        </div>
        <div class="o_stat_card" data-jump-sub="customers">
          <span class="o_stat_label">Clientes Activos</span>
          <span class="o_stat_value">${kpis.customers_total || 0}</span>
          <span class="o_stat_sub">Vinculados a Ventas y Facturación</span>
        </div>
        <div class="o_stat_card" data-jump-sub="suppliers">
          <span class="o_stat_label">Proveedores Homologados</span>
          <span class="o_stat_value">${kpis.suppliers_total || 0}</span>
          <span class="o_stat_sub">Vinculados a Compras y Gastos</span>
        </div>
      </div>
    `;

    if (state.viewType === 'kanban') {
      const contactCols = [
        {
          id: 'customers',
          title: 'Clientes',
          color: '#10b981',
          filter: (c) => Number(c.customer_rank) > 0 || (c.category_ids || []).includes('Cliente')
        },
        {
          id: 'suppliers',
          title: 'Proveedores',
          color: '#f59e0b',
          filter: (c) => (Number(c.supplier_rank) > 0 || (c.category_ids || []).includes('Proveedor')) && !(Number(c.customer_rank) > 0)
        },
        {
          id: 'others',
          title: 'Otros Contactos',
          color: '#3b82f6',
          filter: (c) => !(Number(c.customer_rank) > 0 || (c.category_ids || []).includes('Cliente')) && !(Number(c.supplier_rank) > 0 || (c.category_ids || []).includes('Proveedor'))
        }
      ];

      container.innerHTML =
        bannerHtml +
        `<div class="o_kanban_board">
          ${contactCols
            .map((col) => {
              const colContacts = contacts.filter(col.filter);
              return `
              <div class="o_kanban_column" style="--col-accent: ${col.color};">
                <div class="o_kanban_col_header">
                  <div class="o_kanban_col_title_wrap">
                    <span class="o_kanban_col_title">${esc(col.title)}</span>
                    <span class="o_badge o_badge_muted">${colContacts.length}</span>
                  </div>
                  <span class="o_kanban_col_sum">${colContacts.length} contacto(s)</span>
                </div>
                <div class="o_kanban_col_cards">
                  ${
                    colContacts.length === 0
                      ? `<div class="o_kanban_col_empty">Sin contactos en ${esc(col.title.toLowerCase())}</div>`
                      : colContacts
                          .map(
                            (c) => `
                        <article class="o_kanban_record" data-contact-id="${c.id}" style="cursor: pointer;">
                          <div class="o_kanban_avatar">${esc(initials(c.name))}</div>
                          <div class="o_kanban_details">
                            <div style="display: flex; justify-content: space-between; gap: 0.4rem;">
                              <span class="o_kanban_title">${esc(c.name)}</span>
                              <span class="o_badge ${c.is_company ? 'o_badge_info' : 'o_badge_muted'}">${c.is_company ? 'Compañía' : 'Individual'}</span>
                            </div>
                            <div class="o_kanban_subtitle">${esc(c.function || '')} ${c.vat ? '· ' + esc(c.doc_type || 'NIT') + ': ' + esc(c.vat) : ''}</div>
                            <div class="o_kanban_subtitle">📍 ${esc(c.city || 'Pereira')}, ${esc(c.country || 'Colombia')}</div>
                            <div class="o_kanban_subtitle">✉️ ${esc(c.email || 'Sin correo')} · 📞 ${esc(c.phone || c.mobile || '—')}</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.2rem;">
                              ${(c.category_ids || []).map((t) => `<span class="o_tag">${esc(t)}</span>`).join('')}
                            </div>
                            <div class="o_kanban_footer">
                              <span>🛒 ${c.sales_count || 0} Ventas (${formatMoney(c.sales_total || 0)})</span>
                              <span>🧾 ${c.invoices_count || 0} Facturas</span>
                            </div>
                          </div>
                        </article>
                      `
                          )
                          .join('')
                  }
                </div>
              </div>
            `;
            })
            .join('')}
        </div>`;

      container.querySelectorAll('.o_kanban_record').forEach((card) => {
        card.addEventListener('click', () => {
          state.activeRecordId = Number(card.getAttribute('data-contact-id'));
          state.viewType = 'form';
          renderModuleWorkspace();
        });
      });
    } else {
      // Responsive Table (follows modern-web-guidance `responsive-table`)
      container.innerHTML =
        bannerHtml +
        `
        <div tabindex="0" role="region" aria-labelledby="contacts-table-caption" class="table-wrapper">
          <table class="o_list_table" style="--label-2: 'NIT / Identificación'; --label-3: 'Tipo'; --label-4: 'Correo'; --label-5: 'Teléfono'; --label-6: 'Ciudad'; --label-7: 'Ventas';">
            <caption id="contacts-table-caption">Directorio de contactos de CHapp ERP</caption>
            <thead>
              <tr>
                <th>Nombre / Razón Social</th>
                <th>NIT / CC</th>
                <th>Tipo</th>
                <th>Correo Electrónico</th>
                <th>Teléfono</th>
                <th>Ciudad</th>
                <th class="text-end">Total Ventas</th>
              </tr>
            </thead>
            <tbody>
              ${contacts
                .map(
                  (c) => `
                  <tr data-contact-id="${c.id}">
                    <th>${esc(c.name)}</th>
                    <td>${c.vat ? esc((c.doc_type ? c.doc_type + ' ' : '') + c.vat) : '—'}</td>
                    <td><span class="o_badge ${c.is_company ? 'o_badge_info' : 'o_badge_muted'}">${c.is_company ? 'Compañía' : 'Individual'}</span></td>
                    <td>${esc(c.email || '—')}</td>
                    <td>${esc(c.phone || c.mobile || '—')}</td>
                    <td>${esc(c.city || '—')}</td>
                    <td class="text-end"><strong>${formatMoney(c.sales_total || 0)}</strong></td>
                  </tr>
                `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;

      container.querySelectorAll('tbody tr').forEach((row) => {
        row.addEventListener('click', () => {
          state.activeRecordId = Number(row.getAttribute('data-contact-id'));
          state.viewType = 'form';
          renderModuleWorkspace();
        });
      });
    }

    container.querySelectorAll('[data-jump-sub]').forEach((card) => {
      card.addEventListener('click', () => {
        state.submenu = card.getAttribute('data-jump-sub');
        renderSubmenus(APPS.find((a) => a.id === 'contacts'));
        renderModuleWorkspace();
      });
    });
  }

  const COLOMBIA_DOC_TYPES = [
    { code: 'NIT', label: 'NIT - Número de Identificación Tributaria' },
    { code: 'CC', label: 'CC - Cédula de Ciudadanía' },
    { code: 'CE', label: 'CE - Cédula de Extranjería' },
    { code: 'TI', label: 'TI - Tarjeta de Identidad' },
    { code: 'PP', label: 'PP - Pasaporte' },
    { code: 'RC', label: 'RC - Registro Civil' },
    { code: 'PEP', label: 'PEP - Permiso Especial de Permanencia' },
    { code: 'PPT', label: 'PPT - Permiso por Protección Temporal' },
    { code: 'DIE', label: 'DIE - Documento de Identificación Extranjero' }
  ];

  const COLOMBIA_CITIES = [
    'Apartadó',
    'Arauca',
    'Armenia',
    'Barrancabermeja',
    'Barranquilla',
    'Bello',
    'Bogotá D.C.',
    'Bucaramanga',
    'Buenaventura',
    'Buga',
    'Cali',
    'Cartagena',
    'Cartago',
    'Caucasia',
    'Chía',
    'Ciénaga',
    'Cúcuta',
    'Dosquebradas',
    'Duitama',
    'Envigado',
    'Espinal',
    'Facatativá',
    'Florencia',
    'Floridablanca',
    'Fusagasugá',
    'Girardot',
    'Girón',
    'Ibagué',
    'Inírida',
    'Ipiales',
    'Itagüí',
    'Jamundí',
    'La Dorada',
    'Leticia',
    'Magangué',
    'Maicao',
    'Malambo',
    'Manizales',
    'Medellín',
    'Mitú',
    'Mocoa',
    'Montería',
    'Mosquera',
    'Neiva',
    'Ocaña',
    'Palmira',
    'Pamplona',
    'Pasto',
    'Pereira',
    'Piedecuesta',
    'Pitalito',
    'Popayán',
    'Puerto Carreño',
    'Quibdó',
    'Riohacha',
    'Rionegro',
    'Sabanalarga',
    'Sabaneta',
    'San Andrés',
    'San Gil',
    'Santa Marta',
    'Santa Rosa de Cabal',
    'Sincelejo',
    'Soacha',
    'Sogamoso',
    'Soledad',
    'Tuluá',
    'Tumaco',
    'Tunja',
    'Turbo',
    'Uribia',
    'Valledupar',
    'Villavicencio',
    'Yopal',
    'Yumbo',
    'Zipaquirá'
  ];

  function renderContactForm(container) {
    const isNew = state.activeRecordId === 'new';
    const defaultIsSupplier = state.submenu === 'suppliers';
    const existing = isNew
      ? {
          name: '',
          is_company: true,
          company_name: '',
          doc_type: 'NIT',
          vat: '',
          function: defaultIsSupplier ? 'Proveedor Corporativo' : 'Cliente Corporativo',
          street: '',
          city: 'Pereira',
          state_name: 'Risaralda',
          country: 'Colombia',
          email: '',
          phone: '',
          mobile: '',
          website: '',
          customer_rank: defaultIsSupplier ? 0 : 1,
          supplier_rank: defaultIsSupplier ? 1 : 0,
          category_ids: [defaultIsSupplier ? 'Proveedor' : 'Cliente'],
          payment_term: '',
          notes: '',
          sales_count: 0,
          sales_total: 0,
          invoices_count: 0,
          invoiced_total: 0,
          expenses_count: 0,
          chatter: []
        }
      : (state.data.contacts || []).find((c) => Number(c.id) === Number(state.activeRecordId));

    if (!existing) {
      state.viewType = 'list';
      return renderModuleWorkspace();
    }

    const currentDocType = existing.doc_type || (existing.is_company ? 'NIT' : 'CC');
    const currentCity = existing.city || 'Pereira';
    const cityOptions = COLOMBIA_CITIES.includes(currentCity)
      ? COLOMBIA_CITIES
      : [currentCity, ...COLOMBIA_CITIES];
    const isSupplierSelected = Number(existing.supplier_rank || 0) > 0 && Number(existing.customer_rank || 0) === 0;

    container.innerHTML = `
      <div class="o_form_view">
        <div class="o_form_sheet_bg">
          <div class="o_form_statusbar">
            <div class="o_statusbar_buttons">
              <button type="button" class="btn btn-action" id="btnSaveContact">Guardar Contacto</button>
              ${
                !isNew
                  ? `<button type="button" class="btn btn-secondary" id="btnNewSaleFromContact">Nueva Cotización</button>
                     <button type="button" class="btn btn-danger btn-sm" id="btnDeleteContact">Eliminar</button>`
                  : ''
              }
            </div>
            <div class="o_statusbar_status">
              <span class="o_arrow_button is-current" id="contactTypeStatusPill">${existing.is_company ? 'Compañía' : 'Persona Individual'}</span>
            </div>
          </div>

          <form id="contactForm" class="o_form_sheet">
            ${
              !isNew
                ? `
              <div class="o_button_box">
                <button type="button" class="o_stat_button oe_stat_button" id="btnSmartSales">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                  <div class="o_stat_info">
                    <span class="o_stat_value">${existing.sales_count || 0} Ventas</span>
                    <span class="o_stat_text">${formatMoney(existing.sales_total || 0)}</span>
                  </div>
                </button>
                <button type="button" class="o_stat_button oe_stat_button" id="btnSmartInvoices">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                  <div class="o_stat_info">
                    <span class="o_stat_value">${existing.invoices_count || 0} Facturas</span>
                    <span class="o_stat_text">${formatMoney(existing.invoiced_total || 0)}</span>
                  </div>
                </button>
                <button type="button" class="o_stat_button oe_stat_button" id="btnSmartExpenses">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                  <div class="o_stat_info">
                    <span class="o_stat_value">${existing.expenses_count || 0} Gastos</span>
                    <span class="o_stat_text">Asociados</span>
                  </div>
                </button>
              </div>
            `
                : ''
            }

            <div style="display: flex; gap: 1.25rem; margin-bottom: 0.5rem;">
              <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                <input type="radio" name="is_company" value="true" ${existing.is_company ? 'checked' : ''} />
                <span>Compañía</span>
              </label>
              <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                <input type="radio" name="is_company" value="false" ${!existing.is_company ? 'checked' : ''} />
                <span>Individual</span>
              </label>
            </div>

            <div style="display: flex; gap: 1.25rem; margin-bottom: 0.75rem;">
              <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                <input type="radio" name="contact_role" value="customer" ${!isSupplierSelected ? 'checked' : ''} />
                <span>Cliente</span>
              </label>
              <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                <input type="radio" name="contact_role" value="supplier" ${isSupplierSelected ? 'checked' : ''} />
                <span>Proveedor</span>
              </label>
            </div>

            <div class="o_form_title_group">
              <label for="fContactName">Nombre o Razón Social *</label>
              <input type="text" id="fContactName" class="o_input_title" value="${esc(existing.name)}" placeholder="Ej. Grupo Empresarial Andino S.A.S." required />
            </div>

            <div class="o_group">
              <div class="o_field_row">
                <label for="fContactDocType">Tipo de Documento</label>
                <select id="fContactDocType" class="o_select">
                  ${COLOMBIA_DOC_TYPES.map(
                    (dt) => `<option value="${esc(dt.code)}" ${currentDocType === dt.code ? 'selected' : ''}>${esc(dt.label)}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fContactVat">Número de Documento</label>
                <input type="text" id="fContactVat" class="o_input" value="${esc(existing.vat)}" placeholder="Ej. 900.312.450-1" />
              </div>
              <div class="o_field_row">
                <label for="fContactFunction">Cargo / Actividad Económica</label>
                <input type="text" id="fContactFunction" class="o_input" value="${esc(existing.function)}" />
              </div>
              <div class="o_field_row">
                <label for="fContactEmail">Correo Electrónico</label>
                <input type="email" id="fContactEmail" class="o_input" value="${esc(existing.email)}" placeholder="correo@empresa.co" />
              </div>
              <div class="o_field_row">
                <label for="fContactPhone">Teléfono Fijo</label>
                <input type="text" id="fContactPhone" class="o_input" value="${esc(existing.phone)}" />
              </div>
              <div class="o_field_row">
                <label for="fContactMobile">Móvil / WhatsApp</label>
                <input type="text" id="fContactMobile" class="o_input" value="${esc(existing.mobile)}" />
              </div>
              <div class="o_field_row">
                <label for="fContactStreet">Dirección Fiscal</label>
                <input type="text" id="fContactStreet" class="o_input" value="${esc(existing.street)}" />
              </div>
              <div class="o_field_row">
                <label for="fContactCity">Ciudad</label>
                <select id="fContactCity" class="o_select">
                  ${cityOptions
                    .map((city) => `<option value="${esc(city)}" ${currentCity === city ? 'selected' : ''}>${esc(city)}</option>`)
                    .join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fContactPaymentTerm">Plazo de Pago Predeterminado</label>
                <select id="fContactPaymentTerm" class="o_select">
                  <option value="" ${!existing.payment_term ? 'selected disabled' : ''}>— Seleccione un plazo de pago —</option>
                  ${['Contado', '15 Días', '30 Días', '45 Días', '60 Días']
                    .map((t) => `<option value="${t}" ${existing.payment_term === t ? 'selected' : ''}>${t}</option>`)
                    .join('')}
                </select>
              </div>
              <div class="o_field_row">
                <label for="fContactTags">Etiquetas (separadas por coma)</label>
                <input type="text" id="fContactTags" class="o_input" value="${esc((existing.category_ids || []).join(', '))}" placeholder="VIP, Cliente, Proveedor" />
              </div>
            </div>

            <div class="o_field_row">
              <label for="fContactNotes">Notas Internas</label>
              <textarea id="fContactNotes" class="o_textarea" rows="3">${esc(existing.notes)}</textarea>
            </div>
          </form>
        </div>

        ${renderChatterHtml('contacts', existing)}
      </div>
    `;

    wireChatterEvents('contacts', existing.id);

    // Sync statusbar pill and default document type when toggling Compañía / Individual
    container.querySelectorAll('input[name="is_company"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const isComp = document.querySelector('input[name="is_company"]:checked').value === 'true';
        const pill = document.getElementById('contactTypeStatusPill');
        if (pill) pill.textContent = isComp ? 'Compañía' : 'Persona Individual';
        if (isNew) {
          const docSelect = document.getElementById('fContactDocType');
          if (docSelect && (docSelect.value === 'NIT' || docSelect.value === 'CC')) {
            docSelect.value = isComp ? 'NIT' : 'CC';
          }
        }
      });
    });

    // Sync default tags and function when toggling Cliente / Proveedor on a new contact
    container.querySelectorAll('input[name="contact_role"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!isNew) return;
        const role = document.querySelector('input[name="contact_role"]:checked').value;
        const tagsInput = document.getElementById('fContactTags');
        if (tagsInput && (tagsInput.value.trim() === 'Cliente' || tagsInput.value.trim() === 'Proveedor')) {
          tagsInput.value = role === 'supplier' ? 'Proveedor' : 'Cliente';
        }
        const fnInput = document.getElementById('fContactFunction');
        if (fnInput && (fnInput.value.trim() === 'Cliente Corporativo' || fnInput.value.trim() === 'Proveedor Corporativo')) {
          fnInput.value = role === 'supplier' ? 'Proveedor Corporativo' : 'Cliente Corporativo';
        }
      });
    });

    const btnSaveContactEl = document.getElementById('btnSaveContact');
    if (btnSaveContactEl) {
      btnSaveContactEl.addEventListener('click', () => {
        withActionLock(btnSaveContactEl, async () => {
          const isComp = document.querySelector('input[name="is_company"]:checked').value === 'true';
          const role = document.querySelector('input[name="contact_role"]:checked').value;
          const payload = {
            id: isNew ? undefined : existing.id,
            name: document.getElementById('fContactName').value,
            is_company: isComp,
            doc_type: document.getElementById('fContactDocType').value,
            vat: document.getElementById('fContactVat').value,
            function: document.getElementById('fContactFunction').value,
            email: document.getElementById('fContactEmail').value,
            phone: document.getElementById('fContactPhone').value,
            mobile: document.getElementById('fContactMobile').value,
            street: document.getElementById('fContactStreet').value,
            city: document.getElementById('fContactCity').value,
            payment_term: document.getElementById('fContactPaymentTerm').value,
            category_ids: document.getElementById('fContactTags').value,
            customer_rank: role === 'customer' ? 1 : 0,
            supplier_rank: role === 'supplier' ? 1 : 0,
            notes: document.getElementById('fContactNotes').value
          };
          if (!isNew && !hasContactDraftChanged(existing, payload)) {
            showToast('No hay cambios pendientes por guardar.');
            return;
          }
          const res = await apiCall('/api/contacts', 'POST', payload);
          if (isNew) {
            state.activeRecordId = null;
            state.viewType = 'list';
          } else {
            state.activeRecordId = res.contact.id;
          }
          showToast('Contacto guardado correctamente.');
          renderModuleWorkspace();
        }).catch((err) => showToast(err.message, true));
      });
    }

    const contactFormEl = document.getElementById('contactForm');
    if (contactFormEl) {
      contactFormEl.addEventListener('submit', (e) => {
        e.preventDefault();
        document.getElementById('btnSaveContact')?.click();
      });
    }

    const delContactBtn = document.getElementById('btnDeleteContact');
    if (delContactBtn) {
      delContactBtn.addEventListener('click', () => {
        withActionLock(delContactBtn, async () => {
          await apiCall(`/api/contacts/${existing.id}`, 'DELETE');
          showToast('Contacto eliminado.');
          state.activeRecordId = null;
          state.viewType = 'list';
          renderModuleWorkspace();
        }).catch((err) => showToast(err.message, true));
      });
    }

    const newSaleBtn = document.getElementById('btnNewSaleFromContact');
    if (newSaleBtn) {
      newSaleBtn.addEventListener('click', () => {
        state.formDraft = { partner_id: existing.id };
        openApp('sales', { submenu: 'all', viewType: 'form', recordId: 'new', returnTo: { app: 'contacts', submenu: state.submenu, viewType: 'form', recordId: existing.id } });
      });
    }

    const smartSales = document.getElementById('btnSmartSales');
    if (smartSales) {
      smartSales.addEventListener('click', () => {
        openApp('sales', {
          submenu: 'all',
          viewType: 'list',
          partnerFilter: { id: existing.id, name: existing.name }
        });
      });
    }

    const smartInvoices = document.getElementById('btnSmartInvoices');
    if (smartInvoices) {
      smartInvoices.addEventListener('click', () => {
        openApp('accounting', {
          submenu: 'out_invoice',
          viewType: 'list',
          partnerFilter: { id: existing.id, name: existing.name }
        });
      });
    }

    const smartExpenses = document.getElementById('btnSmartExpenses');
    if (smartExpenses) {
      smartExpenses.addEventListener('click', () => {
        openApp('expenses', {
          submenu: 'all',
          viewType: 'list',
          partnerFilter: { id: existing.id, name: existing.name }
        });
      });
    }
  }

