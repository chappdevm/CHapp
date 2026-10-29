/* ==========================================================================
   CH Aluminios ERP -- JS Module: 09-whatsapp.js
   WhatsApp Baileys Client Integration -- QR Modal, PDF Base64 & Direct Send
   ========================================================================== */
'use strict';

  // ==================== BAILEYS WHATSAPP CLIENT INTEGRATION ====================
  let waPollInterval = null;

  function closeWhatsAppModal() {
    if (waPollInterval) {
      clearInterval(waPollInterval);
      waPollInterval = null;
    }
    const m = document.getElementById('modalWhatsAppBackdrop');
    if (m) m.remove();
  }

  async function showWhatsAppQrModal(onConnected, options = {}) {
    closeWhatsAppModal();

    const directPhone = options.directPhone || '';
    const directText = options.directText || '';
    let preloadedStatus = options.preloadedStatus || null;

    let cleanPhone = String(directPhone).replace(/\D/g, '');
    if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
      cleanPhone = '57' + cleanPhone;
    }

    const backdrop = document.createElement('div');
    backdrop.id = 'modalWhatsAppBackdrop';
    backdrop.className = 'o_modal_backdrop';
    backdrop.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.65); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 1rem;';

    backdrop.innerHTML = `
      <div class="o_modal_dialog" style="background: var(--o-view-bg, #1e293b); color: var(--o-text-color, #f8fafc); border-radius: 12px; width: 100%; max-width: 440px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); border: 1px solid var(--o-border-color, #334155); overflow: hidden;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid var(--o-border-color, #334155);">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2z"></path></svg>
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">Vincular WhatsApp de la Compañía</h3>
          </div>
          <button type="button" class="o_dialog_close" id="btnCloseWhatsAppModal" aria-label="Cerrar" style="background: none; border: none; color: var(--o-text-muted); cursor: pointer; display: flex; align-items: center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>
        <div style="padding: 1.5rem; text-align: center;">
          <p style="font-size: 0.88rem; color: var(--o-text-muted, #94a3b8); margin-bottom: 1.25rem; line-height: 1.4;">
            Abre WhatsApp en el celular de la empresa &gt; <strong>Dispositivos vinculados</strong> &gt; <strong>Vincular un dispositivo</strong> y escanea el código QR:
          </p>
          <div id="waQrContainer" style="display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 230px; background: #ffffff; border-radius: 10px; padding: 1rem; border: 1px solid var(--o-border-color, #334155); position: relative;">
            <div style="color: #64748b; font-size: 0.88rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
              <span>Generando código QR seguro...</span>
            </div>
          </div>
          <div id="waStatusText" style="margin-top: 1rem; font-size: 0.88rem; font-weight: 600; color: #38bdf8;">
            Iniciando conexión con WhatsApp...
          </div>
          <div style="margin-top: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem;">
            <button type="button" class="btn btn-sm btn-secondary" id="btnRefreshWaQr" style="align-self: center; font-size: 0.82rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 4px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
              Regenerar Código QR
            </button>
            ${
              cleanPhone
                ? `
              <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed var(--o-border-color, #334155); font-size: 0.8rem; color: var(--o-text-muted);">
                <span>¿Prefieres abrir directamente en WhatsApp Web o en tu celular?</span>
                <div style="margin-top: 0.5rem;">
                  <a href="https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(directText || 'Hola, adjunto el documento.')}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background: #25D366; color: #fff; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2z"></path></svg>
                    Abrir Chat en WhatsApp (+${cleanPhone})
                  </a>
                </div>
              </div>`
                : ''
            }
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    document.getElementById('btnCloseWhatsAppModal').addEventListener('click', closeWhatsAppModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeWhatsAppModal();
    });

    const updateQrFromStatus = (statusData) => {
      const container = document.getElementById('waQrContainer');
      const text = document.getElementById('waStatusText');
      if (!container || !text || !statusData) return;

      if (statusData.status === 'CONECTADO') {
        container.innerHTML = `
          <div style="color: #10b981; text-align: center;">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <div style="font-weight: 700; font-size: 1.05rem; margin-top: 0.5rem; color: #1e293b;">¡Dispositivo Vinculado!</div>
            <div style="font-size: 0.85rem; color: #64748b;">+${statusData.connectedNumber || ''}</div>
          </div>
        `;
        text.textContent = 'WhatsApp conectado con éxito.';
        text.style.color = '#10b981';

        setTimeout(() => {
          closeWhatsAppModal();
          if (typeof onConnected === 'function') onConnected();
        }, 1200);
        return;
      }

      if (statusData.tieneQr && statusData.qrDataUrl) {
        container.innerHTML = `
          <img src="${statusData.qrDataUrl}" alt="Código QR WhatsApp" style="width: 220px; height: 220px; display: block; border-radius: 4px;" />
          <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #64748b;">Válido durante 30 segundos</div>
        `;
        text.textContent = 'Esperando escaneo desde tu celular...';
        text.style.color = '#38bdf8';
      } else if (statusData.status === 'CONECTANDO') {
        text.textContent = 'Conectando con WhatsApp...';
        text.style.color = '#38bdf8';
      } else if (statusData.status === 'DESCONECTADO') {
        text.textContent = 'WhatsApp desconectado. Pulsa "Regenerar Código QR".';
        text.style.color = '#f59e0b';
      }
    };

    const triggerConnect = async () => {
      try {
        const text = document.getElementById('waStatusText');
        if (text) {
          text.textContent = 'Generando nuevo código QR...';
          text.style.color = '#38bdf8';
        }
        const res = await apiCall('/api/whatsapp/connect', 'POST');
        updateQrFromStatus(res);
      } catch (err) {
        const text = document.getElementById('waStatusText');
        if (text) {
          text.textContent = 'Aviso: ' + (err.message || 'No fue posible iniciar WhatsApp en el servidor.');
          text.style.color = '#ef4444';
        }
        const container = document.getElementById('waQrContainer');
        if (container) {
          container.innerHTML = `
            <div style="color: #ef4444; text-align: center; padding: 1rem 0.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.6rem;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <div style="font-weight: 600; font-size: 0.95rem; color: #1e293b;">Conexión directa recomendada</div>
              <div style="font-size: 0.8rem; color: #64748b; line-height: 1.35; max-width: 320px;">${escapeHtml(err.message || 'El servicio Baileys no está activo en este servidor.')}</div>
              ${cleanPhone ? `
                <div style="margin-top: 0.5rem;">
                  <a href="https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(directText || 'Hola, adjuntamos el documento.')}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background: #25D366; color: #fff; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 600; padding: 0.5rem 1rem; border-radius: 6px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2z"></path></svg>
                    Abrir Chat en WhatsApp (+${cleanPhone})
                  </a>
                </div>
              ` : ''}
            </div>
          `;
        }
      }
    };

    const btnRefresh = document.getElementById('btnRefreshWaQr');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        const container = document.getElementById('waQrContainer');
        if (container) {
          container.innerHTML = `
            <div style="color: #64748b; font-size: 0.88rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
              <span>Generando código QR seguro...</span>
            </div>
          `;
        }
        triggerConnect();
      });
    }

    if (preloadedStatus && preloadedStatus.tieneQr) {
      updateQrFromStatus(preloadedStatus);
    } else {
      triggerConnect();
    }

    let pollFailures = 0;
    const checkStatus = async () => {
      try {
        const res = await apiCall('/api/whatsapp/status', 'GET');
        pollFailures = 0;
        updateQrFromStatus(res);
        if (res.status === 'CONECTADO') {
          if (waPollInterval) clearInterval(waPollInterval);
        }
      } catch (err) {
        pollFailures++;
        if (pollFailures >= 3 && waPollInterval) {
          clearInterval(waPollInterval);
          waPollInterval = null;
        }
      }
    };

    waPollInterval = setInterval(checkStatus, 2500);
  }
  async function generateDocumentPdfBase64(type, record, containerSelector, filename) {
    if (typeof window === 'undefined' || typeof window.html2pdf !== 'function') {
      throw new Error('La librería html2pdf no está disponible para generar el archivo.');
    }

    let container = document.querySelector(containerSelector);
    let targetEl = null;

    if (container) {
      targetEl = container.cloneNode(true);
    } else {
      const offscreen = document.createElement('div');
      offscreen.style.position = 'fixed';
      offscreen.style.left = '-9999px';
      offscreen.style.top = '0';
      offscreen.style.width = '210mm';
      offscreen.innerHTML = type === 'sales'
        ? renderSalePdfSheetHtml(record)
        : renderInvoicePdfSheetHtml(record);
      document.body.appendChild(offscreen);
      targetEl = offscreen.firstElementChild || offscreen;
    }

    targetEl.style.width = '210mm';
    targetEl.style.margin = '0 auto';
    targetEl.style.boxShadow = 'none';
    targetEl.style.border = 'none';
    const logoData = typeof getLogoDataUrl === 'function' ? getLogoDataUrl() : '';
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
      filename: filename || `${record.name}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      let dataUri = await window.html2pdf().set(opt).from(targetEl).output('datauristring');
      if (typeof dataUri === 'string' && dataUri.includes(';base64,')) {
        dataUri = dataUri.split(';base64,').pop();
      }
      return dataUri;
    } finally {
      if (!container && targetEl && targetEl.parentElement === document.body) {
        document.body.removeChild(targetEl.parentElement);
      }
    }
  }

  async function sendDocumentViaWhatsApp({ model, record, containerSelector, filename, defaultCaption }) {
    if (!record || !record.id) {
      showToast('Debe guardar el documento antes de enviarlo por WhatsApp.', true);
      return;
    }

    const partner = (state.data.contacts || []).find((c) => Number(c.id) === Number(record.partner_id));
    const phone = partner ? (partner.mobile || partner.phone) : '';

    if (!phone || !phone.trim()) {
      showToast(`El cliente "${partner ? partner.name : 'sin contacto'}" no tiene un número celular registrado en la aplicación.`, true);
      return;
    }

    try {
      const st = await apiCall('/api/whatsapp/status', 'GET');
      if (st.status !== 'CONECTADO') {
        const docLabel = model === 'sales' ? (record.name || 'Cotización') : (record.name || 'Factura');
        const directText = `Hola ${partner ? partner.name : ''}, adjuntamos tu ${docLabel}.`;
        showWhatsAppQrModal(
          () => sendDocumentViaWhatsApp({ model, record, containerSelector, filename, defaultCaption }),
          { directPhone: phone, directText, preloadedStatus: st }
        );
        return;
      }
    } catch (err) {
      showToast('Error verificando estado de WhatsApp: ' + err.message, true);
      return;
    }

    showToast(`Generando PDF y enviando por WhatsApp a ${partner.name}...`);

    try {
      const pdfBase64 = await generateDocumentPdfBase64(model === 'sales' ? 'sales' : 'invoice', record, containerSelector, filename);
      if (!pdfBase64) {
        throw new Error('No se pudo generar el documento PDF.');
      }

      const res = await apiCall('/api/whatsapp/send', 'POST', {
        model,
        id: record.id,
        to: phone,
        pdfBase64,
        filename: filename || `${record.name}.pdf`,
        caption: defaultCaption
      });

      showToast(res.message || `Documento enviado con éxito por WhatsApp a +${phone}.`);

      const boot = await fetch('/api/bootstrap');
      if (boot.ok) {
        const json = await boot.json();
        state.data = json.data;
      }
      renderModuleWorkspace();
    } catch (err) {
      showToast(err.message, true);
    }
  }

