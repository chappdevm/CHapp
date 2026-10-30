/* ==========================================================================
   CH Aluminios ERP -- JS Module: 14-settings-chatter.js
   Module 5: Ajustes (res.config.settings), Audit Chatter & Command Palette (Ctrl+K)
   ========================================================================== */
'use strict';

  // ==================== MODULE 5: AJUSTES (res.config.settings) ====================
  function renderSettingsModule() {
    const container = document.getElementById('moduleContent');
    const s = state.data.settings || {};
    const activeTab = (state.submenu && state.submenu !== 'all') ? state.submenu : 'general';

    let contentHtml = '';

    if (activeTab === 'general') {
      contentHtml = `
        <div class="o_settings_block" data-section="general">
          <h3>Datos de la Compañía y Apariencia</h3>
          <div class="o_group">
            <div class="o_field_row">
              <label for="setCompanyName">Razón Social de la Empresa</label>
              <input type="text" id="setCompanyName" class="o_input" value="${esc(s.company_name)}" />
            </div>
            <div class="o_field_row">
              <label for="setCompanyVat">NIT Tributario</label>
              <input type="text" id="setCompanyVat" class="o_input" value="${esc(s.company_vat)}" />
            </div>
            <div class="o_field_row">
              <label for="setCompanyEmail">Correo Corporativo</label>
              <input type="email" id="setCompanyEmail" class="o_input" value="${esc(s.company_email)}" />
            </div>
            <div class="o_field_row">
              <label for="setCompanyPhone">Teléfono Principal</label>
              <input type="text" id="setCompanyPhone" class="o_input" value="${esc(s.company_phone)}" />
            </div>
            <div class="o_field_row">
              <label for="setCompanyCity">Ciudad</label>
              <input type="text" id="setCompanyCity" class="o_input" value="${esc(s.company_city || '')}" />
            </div>
            <div class="o_field_row">
              <label for="setCompanyAddress">Dirección</label>
              <input type="text" id="setCompanyAddress" class="o_input" value="${esc(s.company_address || '')}" />
            </div>
            <div class="o_field_row">
              <label for="setCurrency">Moneda Funcional</label>
              <select id="setCurrency" class="o_select">
                <option value="" ${!s.currency ? 'selected disabled' : ''}>— Seleccione Moneda —</option>
                <option value="COP" ${s.currency === 'COP' ? 'selected' : ''}>COP — Peso Colombiano ($)</option>
                <option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>USD — Dólar Estadounidense (US$)</option>
                <option value="EUR" ${s.currency === 'EUR' ? 'selected' : ''}>EUR — Euro (€)</option>
              </select>
            </div>
            <div class="o_field_row">
              <label for="setTheme">Tema Visual</label>
              <select id="setTheme" class="o_select">
                <option value="" ${!s.theme ? 'selected disabled' : ''}>— Seleccione Tema —</option>
                <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Modo Oscuro (Predeterminado)</option>
                <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Modo Claro</option>
              </select>
            </div>
          </div>
        </div>

        <div class="o_settings_block" data-section="general-whatsapp">
          <h3>Integración WhatsApp Empresarial (Baileys)</h3>
          <p style="font-size: 0.84rem; color: var(--o-text-muted); margin-bottom: 0.85rem;">
            Vinculación del número oficial de la empresa para el envío directo de cotizaciones y facturas en formato PDF a los clientes.
          </p>
          <div id="settingsWaStatusBox" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; background: var(--o-gray-100); padding: 1rem; border-radius: 8px; border: 1px solid var(--o-border-color);">
            <div>
              <div style="font-size: 0.78rem; color: var(--o-text-muted); text-transform: uppercase;">Estado de Conexión</div>
              <div id="settingsWaStatusText" style="font-size: 0.95rem; font-weight: 700; color: var(--o-primary);">Consultando estado...</div>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button type="button" class="btn btn-action" id="btnSettingsConnectWa" style="background: #25D366; border-color: #25D366; color: #fff;">Vincular Dispositivo (QR)</button>
              <button type="button" class="btn btn-secondary btn-sm" id="btnSettingsDisconnectWa">Desvincular</button>
            </div>
          </div>
        </div>
      `;
    } else if (activeTab === 'sales') {
      contentHtml = `
        <div class="o_settings_block" data-section="sales">
          <h3>Parámetros del Módulo de Ventas</h3>
          <div class="o_group">
            <div class="o_field_row">
              <label for="setValidityDays">Validez predeterminada de cotizaciones (días)</label>
              <input type="number" id="setValidityDays" class="o_input" value="${Number(s.quotation_validity_days || 30)}" min="1" />
            </div>
            <div class="o_field_row">
              <label for="setDefaultSaleTax">IVA de Ventas por Defecto (%)</label>
              <select id="setDefaultSaleTax" class="o_select">
                <option value="" ${s.default_sale_tax === '' || s.default_sale_tax === undefined || s.default_sale_tax === null ? 'selected disabled' : ''}>— Seleccione IVA por Defecto —</option>
                ${[19, 5, 0].map((t) => `<option value="${t}" ${s.default_sale_tax !== '' && Number(s.default_sale_tax) === t ? 'selected' : ''}>${t}%</option>`).join('')}
              </select>
            </div>
            <div class="o_field_row">
              <label for="setSaleTerms">Términos y Condiciones en Cotizaciones</label>
              <input type="text" id="setSaleTerms" class="o_input" value="${esc(s.sale_terms)}" />
            </div>
            <div class="o_field_row">
              <label for="setLineDiscounts">Descuentos por Línea en Cotizaciones</label>
              <select id="setLineDiscounts" class="o_select">
                <option value="true" ${s.enable_line_discounts !== false ? 'selected' : ''}>Habilitado (Permitir descuentos individuales por línea)</option>
                <option value="false" ${s.enable_line_discounts === false ? 'selected' : ''}>Deshabilitado</option>
              </select>
            </div>
          </div>
        </div>
      `;
    } else if (activeTab === 'accounting') {
      contentHtml = `
        <div class="o_settings_block" data-section="accounting">
          <h3>Parámetros Tributarios y Contables</h3>
          <div class="o_group">
            <div class="o_field_row">
              <label for="setFiscalRegime">Régimen Tributario</label>
              <input type="text" id="setFiscalRegime" class="o_input" value="${esc(s.fiscal_regime)}" />
            </div>
            <div class="o_field_row">
              <label for="setDefaultPurchaseTax">IVA de Compras por Defecto (%)</label>
              <select id="setDefaultPurchaseTax" class="o_select">
                ${[19, 5, 0].map((t) => `<option value="${t}" ${Number(s.default_purchase_tax ?? 19) === t ? 'selected' : ''}>${t}%</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="o_settings_block" id="blockSettingsAccounting" data-section="accounting-journals">
          <h3>Cuentas Financieras & Medios de Pago</h3>
          <p style="font-size: 0.84rem; color: var(--o-text-muted); margin-bottom: 0.85rem;">
            Configure sus cuentas bancarias, billeteras móviles (Nequi, Daviplata) y cajas en efectivo para recaudos y compras.
          </p>

          <div tabindex="0" role="region" aria-label="Cuentas financieras configuradas" class="table-wrapper" style="margin-bottom: 1.25rem;">
            <table class="o_list_table" style="--label-2: 'Código'; --label-3: 'Nombre'; --label-4: 'Tipo'; --label-5: 'Saldo';">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre de la Cuenta</th>
                  <th>Tipo</th>
                  <th class="text-end">Saldo Actual</th>
                </tr>
              </thead>
              <tbody>
                ${((state.data.accounting && state.data.accounting.journals) || [])
                  .filter((j) => (j.type === 'bank' || j.type === 'cash') && j.active !== false)
                  .map((j) => `
                    <tr>
                      <th><span class="o_badge ${j.code === 'NEQ' ? 'o_badge_info' : j.code === 'DVP' ? 'o_badge_danger' : 'o_badge_success'}">${esc(j.code)}</span></th>
                      <td><strong>${esc(j.name)}</strong></td>
                      <td>${j.type === 'bank' ? 'Banco / Billetera Digital' : 'Caja Efectivo'}</td>
                      <td class="text-end"><strong>${formatMoney(j.balance || 0)}</strong></td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>

          <div style="background: var(--o-gray-100); border-radius: 8px; padding: 1.15rem; border: 1px solid var(--o-border-color);">
            <h4 style="font-size: 0.95rem; margin: 0 0 0.75rem 0; font-weight: 600;">Agregar Nueva Cuenta Financiera</h4>
            <div class="o_group" style="margin-bottom: 0.75rem;">
              <div class="o_field_row">
                <label for="newJournalCode">Código Corto (ej. NEQ2, BBVA, CSH2) *</label>
                <input type="text" id="newJournalCode" class="o_input" placeholder="ej. BBVA" maxlength="6" />
              </div>
              <div class="o_field_row">
                <label for="newJournalName">Nombre de la Cuenta *</label>
                <input type="text" id="newJournalName" class="o_input" placeholder="ej. BBVA Cuenta Corriente" />
              </div>
              <div class="o_field_row">
                <label for="newJournalType">Tipo de Cuenta *</label>
                <select id="newJournalType" class="o_select">
                  <option value="bank">Banco / Billetera Digital (Nequi, Daviplata, etc.)</option>
                  <option value="cash">Caja Efectivo</option>
                </select>
              </div>
              <div class="o_field_row">
                <label for="newJournalBalance">Saldo Inicial ($)</label>
                <input type="number" id="newJournalBalance" class="o_input" value="0" min="0" step="1000" />
              </div>
            </div>
            <button type="button" class="btn btn-action" id="btnAddJournal">Guardar Cuenta Financiera</button>
          </div>
        </div>
      `;
    } else if (activeTab === 'expenses') {
      contentHtml = `
        <div class="o_settings_block" data-section="expenses">
          <h3>Políticas y Parámetros de Gastos</h3>
          <div class="o_group">
            <div class="o_field_row">
              <label for="setExpenseApproval">Aprobación Gerencial de Gastos</label>
              <select id="setExpenseApproval" class="o_select">
                <option value="true" ${s.expense_approval_required !== false ? 'selected' : ''}>Requerir aprobación antes de contabilizar o pagar</option>
                <option value="false" ${s.expense_approval_required === false ? 'selected' : ''}>Aprobación automática inmediata</option>
              </select>
            </div>
            <div class="o_field_row">
              <label for="setExpenseJournal">Diario Contable Predeterminado de Gastos</label>
              <input type="text" id="setExpenseJournal" class="o_input" value="${esc(s.expense_default_journal || 'EXJ')}" placeholder="EXJ" />
            </div>
          </div>
        </div>
      `;
    } else if (activeTab === 'users') {
      contentHtml = `
        <div class="o_settings_block" data-section="users">
          <h3>Usuarios Activos y Mantenimiento de Base de Datos</h3>
          <div class="o_group" style="margin-bottom: 0.85rem;">
            <div class="o_field_row">
              <label for="setActiveUser">Usuario Activo de Sesión</label>
              <select id="setActiveUser" class="o_select">
                <option value="" ${!s.active_user || !s.active_user.id ? 'selected disabled' : ''}>— Seleccione Usuario Activo —</option>
                ${(s.users || [])
                  .map(
                    (u) =>
                      `<option value="${u.id}" ${s.active_user && Number(s.active_user.id) === Number(u.id) ? 'selected' : ''}>${esc(u.name)} — ${esc(u.role)}</option>`
                  )
                  .join('')}
              </select>
            </div>
          </div>
          <p style="font-size: 0.84rem; color: var(--o-text-muted); margin-bottom: 0.85rem;">
            Usuarios configurados: ${(s.users || []).map((u) => `<strong>${esc(u.name)}</strong> (${esc(u.role)})`).join(' · ')}
          </p>
          <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary" id="btnExportDbJson">Exportar Respaldo JSON</button>
            <button type="button" class="btn btn-danger" id="btnResetDemoData">Restaurar Datos de Fábrica</button>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="o_settings_layout">
        <aside class="o_settings_sidebar" aria-label="Secciones de ajustes">
          <button type="button" class="o_settings_tab ${activeTab === 'general' ? 'is-active' : ''}" data-set-tab="general">
            <img src="/assets/icons/settings.png" alt="" />
            <span>Compañía y General</span>
          </button>
          <button type="button" class="o_settings_tab ${activeTab === 'sales' ? 'is-active' : ''}" data-set-tab="sales">
            <img src="/assets/icons/sales.png" alt="" />
            <span>Ventas</span>
          </button>
          <button type="button" class="o_settings_tab ${activeTab === 'accounting' ? 'is-active' : ''}" data-set-tab="accounting">
            <img src="/assets/icons/accounting.png" alt="" />
            <span>Contabilidad</span>
          </button>
          <button type="button" class="o_settings_tab ${activeTab === 'expenses' ? 'is-active' : ''}" data-set-tab="expenses">
            <img src="/assets/icons/expenses.png" alt="" />
            <span>Gastos</span>
          </button>
          <button type="button" class="o_settings_tab ${activeTab === 'users' ? 'is-active' : ''}" data-set-tab="users">
            <img src="/assets/icons/contacts.png" alt="" />
            <span>Usuarios y Sistema</span>
          </button>
        </aside>

        <div>
          <div class="o_form_statusbar" style="margin-bottom: 1rem;">
            <div class="o_statusbar_buttons">
              <button type="button" class="btn btn-action" id="btnSaveSettings">Guardar Ajustes</button>
              <button type="button" class="btn btn-secondary" id="btnBackHomeFromSettings">Volver al Panel Principal</button>
            </div>
          </div>

          ${contentHtml}
        </div>
      </div>
    `;

    container.querySelectorAll('[data-set-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        state.submenu = b.getAttribute('data-set-tab');
        renderSettingsModule();
      });
    });

    const btnBackHome = document.getElementById('btnBackHomeFromSettings');
    if (btnBackHome) {
      btnBackHome.addEventListener('click', openHomeMenu);
    }

    const btnSave = document.getElementById('btnSaveSettings');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        withActionLock(btnSave, async () => {
          const payload = {};
          const el = (id) => document.getElementById(id);

          if (el('setCompanyName')) payload.company_name = el('setCompanyName').value;
          if (el('setCompanyVat')) payload.company_vat = el('setCompanyVat').value;
          if (el('setCompanyEmail')) payload.company_email = el('setCompanyEmail').value;
          if (el('setCompanyPhone')) payload.company_phone = el('setCompanyPhone').value;
          if (el('setCompanyCity')) payload.company_city = el('setCompanyCity').value;
          if (el('setCompanyAddress')) payload.company_address = el('setCompanyAddress').value;
          if (el('setCurrency')) payload.currency = el('setCurrency').value;
          if (el('setTheme')) payload.theme = el('setTheme').value;

          if (el('setValidityDays')) payload.quotation_validity_days = Number(el('setValidityDays').value || 30);
          if (el('setDefaultSaleTax')) payload.default_sale_tax = Number(el('setDefaultSaleTax').value ?? 19);
          if (el('setSaleTerms')) payload.sale_terms = el('setSaleTerms').value;
          if (el('setLineDiscounts')) payload.enable_line_discounts = el('setLineDiscounts').value === 'true';

          if (el('setFiscalRegime')) payload.fiscal_regime = el('setFiscalRegime').value;
          if (el('setDefaultPurchaseTax')) payload.default_purchase_tax = Number(el('setDefaultPurchaseTax').value ?? 19);

          if (el('setExpenseApproval')) payload.expense_approval_required = el('setExpenseApproval').value === 'true';
          if (el('setExpenseJournal')) payload.expense_default_journal = el('setExpenseJournal').value;

          if (el('setActiveUser')) payload.active_user_id = Number(el('setActiveUser').value || 1);

          const res = await apiCall('/api/settings', 'POST', payload);
          state.data.settings = res.settings;
          updateSystray();
          showToast('Ajustes del sistema guardados.');
        }).catch((err) => showToast(err.message, true));
      });
    }

    const btnAddJournal = document.getElementById('btnAddJournal');
    if (btnAddJournal) {
      btnAddJournal.addEventListener('click', async () => {
        try {
          const codeInput = document.getElementById('newJournalCode');
          const nameInput = document.getElementById('newJournalName');
          const typeInput = document.getElementById('newJournalType');
          const balanceInput = document.getElementById('newJournalBalance');

          const code = (codeInput ? codeInput.value : '').trim().toUpperCase();
          const name = (nameInput ? nameInput.value : '').trim();
          const type = typeInput ? typeInput.value : 'bank';
          const balance = Number((balanceInput ? balanceInput.value : 0) || 0);

          if (!code || !name) {
            showToast('El código y el nombre de la cuenta son obligatorios.', true);
            return;
          }

          await apiCall('/api/accounting/journals', 'POST', { code, name, type, balance });
          showToast('Cuenta financiera guardada exitosamente.');
          const res = await fetch('/api/bootstrap');
          if (res.ok) {
            const json = await res.json();
            state.data = json.data;
          }
          renderSettingsModule();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    }

    const btnExport = document.getElementById('btnExportDbJson');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chapp_erp_backup.json';
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    const btnReset = document.getElementById('btnResetDemoData');
    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        try {
          await apiCall('/api/reset', 'POST');
          showToast('Datos de demostración restaurados.');
          renderSettingsModule();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    }

    const waStatusText = document.getElementById('settingsWaStatusText');
    const updateSettingsWaUi = async () => {
      if (!waStatusText) return;
      try {
        const res = await apiCall('/api/whatsapp/status', 'GET');
        if (res.status === 'CONECTADO') {
          waStatusText.innerHTML = `<span style="color: #10b981;">Conectado (+ ${res.connectedNumber || 'OK'})</span>`;
        } else if (res.status === 'ESPERANDO_QR') {
          waStatusText.innerHTML = `<span style="color: #f59e0b;">Esperando escaneo QR</span>`;
        } else if (res.status === 'CONECTANDO') {
          waStatusText.innerHTML = `<span style="color: #38bdf8;">Conectando...</span>`;
        } else {
          waStatusText.innerHTML = `<span style="color: #ef4444;">Desconectado</span>`;
        }
      } catch (e) {
        waStatusText.textContent = 'Error consultando estado';
      }
    };
    updateSettingsWaUi();

    const btnSetConnectWa = document.getElementById('btnSettingsConnectWa');
    if (btnSetConnectWa) {
      btnSetConnectWa.addEventListener('click', async () => {
        showWhatsAppQrModal(() => updateSettingsWaUi());
      });
    }

    const btnSetDisconnectWa = document.getElementById('btnSettingsDisconnectWa');
    if (btnSetDisconnectWa) {
      btnSetDisconnectWa.addEventListener('click', async () => {
        try {
          await apiCall('/api/whatsapp/disconnect', 'POST');
          showToast('WhatsApp desvinculado.');
          updateSettingsWaUi();
        } catch (e) {
          showToast(e.message, true);
        }
      });
    }
  }

  // ==================== CHATTER COMPONENT ====================
  function renderChatterHtml(model, record) {
    if (!record || !record.id) {
      return `
        <aside class="o_chatter">
          <div class="o_chatter_header">
            <span>Historial y Notas (Chatter)</span>
          </div>
          <p style="font-size: 0.82rem; color: var(--o-text-muted);">Guarda el registro para habilitar el historial de auditoría y notas.</p>
        </aside>
      `;
    }
    const msgs = (record.chatter || []).slice().reverse();
    const hasReceiptAttachment = Boolean(record.receipt_image);
    const anyMsgHasAttachment = msgs.some((m) => Boolean(m.attachment));
    const defaultAttName = `Factura_${String(record.receipt_ref || record.reference || record.name || 'Soporte').replace(/[\/\\]/g, '_')}.jpg`;
    return `
      <aside class="o_chatter" aria-label="Historial y notas del documento">
        <div class="o_chatter_header">
          <span>Historial y Auditoría ${record.reference || record.name ? `— <strong>${esc(record.reference || record.name)}</strong>` : ''}</span>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${hasReceiptAttachment ? `<span class="o_badge o_badge_info" title="Archivo adjunto registrado">📎 1 Adjunto</span>` : ''}
            <span class="o_badge o_badge_muted">${msgs.length} evento(s)</span>
          </div>
        </div>
        ${hasReceiptAttachment ? `
          <div class="o_chatter_attachments_box" style="margin-bottom: 0.75rem; padding: 0.65rem 0.85rem; background: var(--o-bg-subtle, rgba(37,99,235,0.06)); border: 1px solid var(--o-border); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <img src="${record.receipt_image}" alt="Adjunto factura" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 1px solid var(--o-border);" onclick="openImageLightbox(this.src, '${esc(defaultAttName)}')" />
              <div>
                <div style="font-size: 0.84rem; font-weight: 700;">${esc(defaultAttName)}</div>
                <div style="font-size: 0.75rem; color: var(--o-muted);">Archivo adjunto de factura registrada</div>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn btn-sm btn-secondary" onclick="openImageLightbox('${record.receipt_image}', '${esc(defaultAttName)}')">Ver</button>
              <a href="${record.receipt_image}" download="${esc(defaultAttName)}" class="btn btn-sm btn-secondary" style="text-decoration: none;">Descargar</a>
            </div>
          </div>
        ` : ''}
        <div class="o_chatter_composer">
          <textarea id="chatterInputText" class="o_textarea" rows="2" placeholder="Escribir una nota interna o seguimiento..."></textarea>
          <button type="button" class="btn btn-sm btn-secondary" id="btnSendChatterNote" style="align-self: flex-end;">Publicar Nota</button>
        </div>
        <div class="o_chatter_messages">
          ${msgs
            .map(
              (m, mIdx) => {
                const msgAttachment = m.attachment || (!anyMsgHasAttachment && hasReceiptAttachment && mIdx === msgs.length - 1 ? record.receipt_image : '');
                const msgAttName = m.attachment_name || defaultAttName;
                return `
              <div class="o_chatter_msg">
                <div class="o_chatter_msg_meta">
                  <strong>${esc(m.author)}</strong>
                  <span>${esc(m.date)}</span>
                </div>
                <div>${esc(m.text)}</div>
                ${msgAttachment ? `
                  <div class="o_chatter_msg_attachment" style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(15,23,42,0.25); border: 1px solid var(--o-border); border-radius: 6px; display: inline-flex; flex-direction: column; gap: 6px; max-width: 240px;">
                    <img src="${msgAttachment}" alt="${esc(msgAttName)}" style="max-width: 220px; max-height: 150px; object-fit: contain; border-radius: 4px; cursor: pointer;" onclick="openImageLightbox(this.src, '${esc(msgAttName)}')" title="Clic para ampliar foto registrada en el chatter" />
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.75rem;">
                      <span style="color: var(--o-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📎 ${esc(msgAttName)}</span>
                      <a href="${msgAttachment}" download="${esc(msgAttName)}" style="color: #38bdf8; font-weight: 600; text-decoration: none;">Descargar</a>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
              }
            )
            .join('')}
        </div>
      </aside>
    `;
  }

  function wireChatterEvents(model, recordId) {
    if (!recordId) return;
    const btn = document.getElementById('btnSendChatterNote');
    const input = document.getElementById('chatterInputText');
    if (btn && input) {
      btn.addEventListener('click', () => {
        withActionLock(btn, async () => {
          const text = input.value.trim();
          if (!text) return;
          input.value = '';
          await apiCall('/api/chatter', 'POST', { model, id: recordId, text });
          showToast('Nota registrada en el historial.');
          renderModuleWorkspace();
        }).catch((err) => showToast(err.message, true));
      });
    }
  }

  // ==================== COMMAND PALETTE (Ctrl+K) ====================
  function openCommandPalette() {
    const dialog = document.getElementById('commandPaletteDialog');
    const input = document.getElementById('commandPaletteInput');
    if (!dialog) return;
    input.value = '';
    renderCommandPaletteResults('');
    dialog.showModal();
    input.focus();
  }

  function renderCommandPaletteResults(query) {
    const resultsEl = document.getElementById('commandPaletteResults');
    if (!resultsEl || !state.data) return;
    const q = query.trim().toLowerCase();

    const items = [];
    APPS.forEach((a) => {
      if (!q || a.name.toLowerCase().includes(q)) {
        items.push({ type: 'Módulo', label: `Abrir módulo: ${a.name}`, action: () => openApp(a.id) });
      }
    });
    (state.data.contacts || []).forEach((c) => {
      if (q && (c.name.toLowerCase().includes(q) || (c.vat || '').toLowerCase().includes(q))) {
        items.push({ type: 'Contacto', label: `${c.name} (${c.vat || ''})`, action: () => openApp('contacts', { viewType: 'form', recordId: c.id }) });
      }
    });
    (state.data.expenses || []).forEach((e) => {
      if (
        q &&
        ((e.reference || '').toLowerCase().includes(q) ||
          (e.name || '').toLowerCase().includes(q) ||
          (e.employee_name || '').toLowerCase().includes(q))
      ) {
        items.push({
          type: 'Gasto',
          label: `${e.reference} — ${e.name} (${formatMoney(e.total_amount)})`,
          action: () => openApp('expenses', { viewType: 'form', recordId: e.id })
        });
      }
    });
    (state.data.sales || []).forEach((s) => {
      if (q && (s.name.toLowerCase().includes(q) || s.partner_name.toLowerCase().includes(q))) {
        items.push({ type: 'Venta', label: `${s.name} — ${s.partner_name} (${formatMoney(s.amount_total)})`, action: () => openApp('sales', { viewType: 'form', recordId: s.id }) });
      }
    });
    (state.data.products || []).forEach((p) => {
      if (q && ((p.name || '').toLowerCase().includes(q) || (p.default_code || '').toLowerCase().includes(q))) {
        items.push({
          type: 'Producto',
          label: `[${p.default_code}] ${p.name} (${formatMoney(p.list_price)})`,
          action: () => openApp('sales', { submenu: 'products', viewType: 'form', recordId: p.id })
        });
      }
    });
    (state.data.accounting.moves || []).forEach((m) => {
      if (q && (m.name.toLowerCase().includes(q) || m.partner_name.toLowerCase().includes(q))) {
        items.push({
          type: 'Contabilidad',
          label: `${m.name} — ${m.partner_name} (${formatMoney(m.amount_total)})`,
          action: () =>
            openApp('accounting', {
              submenu: m.move_type === 'in_invoice' ? 'in_invoice' : m.move_type === 'out_invoice' ? 'out_invoice' : 'entries',
              viewType: 'form',
              recordId: m.id
            })
        });
      }
    });

    resultsEl.innerHTML = items
      .slice(0, 12)
      .map(
        (it, i) => `
        <button type="button" class="o_cmd_entry" data-cmd-idx="${i}">
          <span class="o_cmd_label">${esc(it.label)}</span>
          <span class="o_badge o_badge_info">${esc(it.type)}</span>
        </button>
      `
      )
      .join('');

    resultsEl.querySelectorAll('[data-cmd-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-cmd-idx'));
        document.getElementById('commandPaletteDialog').close();
        items[idx].action();
      });
    });
  }

