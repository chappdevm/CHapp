/* ==========================================================================
   CH Aluminios ERP -- Application Entrypoint (app.js)
   Global Event Listeners, Keyboard Shortcuts & Bootstrapper (init)
   ========================================================================== */
'use strict';

  // ==================== GLOBAL EVENTS & INIT ====================
  async function init() {
    setupDialogFallbacks();

    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) {
        throw new Error(`Error HTTP ${res.status} (${res.statusText || 'Ruta no encontrada'})`);
      }
      const json = await res.json();
      state.data = json.data;
      updateSystray();
      const authenticated = typeof isUserAuthenticated === 'function' ? isUserAuthenticated() : true;
      if (authenticated) {
        openHomeMenu();
      } else {
        openLogin();
      }
    } catch (err) {
      showToast('Error cargando estado del ERP: ' + err.message, true);
    }

    // Top bar events
    document.getElementById('btnHomeMenuToggle').addEventListener('click', () => {
      if (state.currentApp) openHomeMenu();
      else if (APPS[0]) openApp(APPS[0].id);
    });

    document.getElementById('navbarBrand').addEventListener('click', (e) => {
      e.preventDefault();
      if (state.currentApp) openApp(state.currentApp);
    });

    document.getElementById('btnThemeToggle').addEventListener('click', async () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        await apiCall('/api/settings', 'POST', { theme: next });
      } catch (_) {}
    });

    document.getElementById('btnUserSettings').addEventListener('click', () => openApp('settings'));
    const navLogout = document.getElementById('btnNavLogout');
    if (navLogout) {
      navLogout.addEventListener('click', () => {
        if (typeof handleLogout === 'function') handleLogout();
      });
    }
    document.getElementById('btnPendingActivities')?.addEventListener('click', () => openApp('expenses', { submenu: 'to_approve' }));
    document.getElementById('btnCommandPalette').addEventListener('click', openCommandPalette);

    // Search inputs
    const homeInput = document.getElementById('homeSearchInput');
    homeInput.addEventListener('input', () => {
      state.homeSearchQuery = homeInput.value;
      state.homeFocusedIndex = 0;
      renderHomeMenuApps();
    });

    const cpSearch = document.getElementById('cpSearchInput');
    cpSearch.addEventListener('input', () => {
      state.searchQuery = cpSearch.value;
      renderModuleWorkspace();
    });

    // Payment Modal
    const payDialog = document.getElementById('paymentDialog');
    document.getElementById('btnClosePaymentDialog').addEventListener('click', () => payDialog.close());
    document.getElementById('btnCancelPaymentDialog').addEventListener('click', () => payDialog.close());
    const payForm = document.getElementById('paymentDialogForm');
    if (payForm) {
      payForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const submitBtn = payForm.querySelector('button[type="submit"]');
        withActionLock(submitBtn, async () => {
          const moveId = Number(document.getElementById('payMoveId').value);
          const journal_code = document.getElementById('payJournal').value;
          if (!journal_code) {
            showToast('Debe seleccionar un diario de pago.', true);
            return;
          }
          const amount = Number(document.getElementById('payAmount').value);
          const date = document.getElementById('payDate').value;
          const ref = document.getElementById('payRef').value;
          const chkGenResidual = document.getElementById('chkGenerateResidualInvoice');
          const genResidual = Boolean(chkGenResidual && chkGenResidual.checked);

          const res = await apiCall(`/api/accounting/moves/${moveId}/action`, 'POST', {
            action: 'register_payment',
            journal_code,
            amount,
            date,
            ref,
            generate_residual_invoice: genResidual
          });
          payDialog.close();
          const nextInv = res.next_invoice || (res.move && res.move.next_invoice);
          if (nextInv) {
            showToast(`Pago registrado y siguiente factura ${nextInv.name} generada por el saldo restante.`);
          } else {
            showToast('Pago registrado y conciliado exitosamente.');
          }
          renderModuleWorkspace();
        }).catch((err) => showToast(err.message, true));
      });
    }

    // Command Palette Modal
    const cmdDialog = document.getElementById('commandPaletteDialog');
    document.getElementById('btnCloseCommandPalette').addEventListener('click', () => cmdDialog.close());
    document.getElementById('commandPaletteInput').addEventListener('input', (e) => {
      renderCommandPaletteResults(e.target.value);
    });

    // Global Hotkeys (Ctrl+K, Alt+H, Esc, Arrow keys & Type-to-search on Home Menu)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        if (state.currentApp) openHomeMenu();
        else if (APPS[0]) openApp(APPS[0].id);
        return;
      }

      if (state.currentApp === null) {
        const activeTag = document.activeElement && document.activeElement.tagName;
        const filtered = APPS.filter((a) => a.name.toLowerCase().includes(state.homeSearchQuery.trim().toLowerCase()));
        if (e.key === 'Escape') {
          state.homeSearchQuery = '';
          homeInput.value = '';
          renderHomeMenuApps();
          return;
        }
        if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && filtered.length > 0) {
          e.preventDefault();
          state.homeFocusedIndex = (state.homeFocusedIndex + 1) % filtered.length;
          renderHomeMenuApps();
          return;
        }
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && filtered.length > 0) {
          e.preventDefault();
          state.homeFocusedIndex = (state.homeFocusedIndex - 1 + filtered.length) % filtered.length;
          renderHomeMenuApps();
          return;
        }
        if (e.key === 'Enter' && (state.homeSearchQuery.trim() || activeTag !== 'A')) {
          if (filtered[state.homeFocusedIndex]) {
            e.preventDefault();
            openApp(filtered[state.homeFocusedIndex].id);
          }
          return;
        }
        if (
          activeTag !== 'INPUT' &&
          activeTag !== 'TEXTAREA' &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          e.key.length === 1 &&
          /[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/.test(e.key)
        ) {
          homeInput.focus();
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
