process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createAppServer } = require('../index');

describe('CHapp ERP — End-to-End API & Workflow Suite', () => {
  let server;
  let baseUrl;
  let tempDbPath;

  before(async () => {
    tempDbPath = path.join(os.tmpdir(), `chapp_erp_test_${Date.now()}.json`);
    server = createAppServer(tempDbPath);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (tempDbPath && fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  async function req(endpoint, method = 'GET', body = undefined) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const json = await res.json();
    return { status: res.status, json };
  }

  it('serves the Home Menu HTML, CSS, JS, and all 5 custom PNG module icons', async () => {
    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.match(html, /o_home_menu_background/);
    assert.match(html, /closedby="any"/);

    for (const icon of ['contacts.png', 'expenses.png', 'sales.png', 'accounting.png', 'settings.png']) {
      const iconRes = await fetch(`${baseUrl}/assets/icons/${icon}`);
      assert.equal(iconRes.status, 200, `Icon ${icon} should be served`);
      const buf = Buffer.from(await iconRes.arrayBuffer());
      assert.equal(buf[0], 0x89, `Icon ${icon} should be a valid PNG`);
      assert.equal(buf[1], 0x50);
    }

    // Verify frontend JavaScript files have zero syntax errors
    const vm = require('vm');
    const appJsContent = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');
    assert.doesNotThrow(() => {
      new vm.Script(appJsContent);
    }, 'assets/js/app.js must not contain any JavaScript syntax errors');
  });

  it('bootstraps clean state with all 5 modules initialized', async () => {
    const statusRes = await req('/api/status');
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.json.ok, true);
    assert.ok(statusRes.json.supabase);
    assert.equal(typeof statusRes.json.supabase.url, 'string');

    const healthRes = await req('/api/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.json.ok, true);

    const { status, json } = await req('/api/bootstrap');
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.ok(Array.isArray(json.data.contacts));
    assert.ok(Array.isArray(json.data.expenses));
    assert.ok(Array.isArray(json.data.sales));
    assert.ok(Array.isArray(json.data.accounting.moves));
    assert.equal(json.data.contacts.length, 0);
    assert.equal(json.data.expenses.length, 0);
    assert.equal(json.data.sales.length, 0);
    assert.equal(json.data.accounting.moves.length, 0);
    assert.equal(json.data.settings.theme, 'dark');
  });

  it('Module 1 (Contactos): creates, updates, validates edge cases, and deletes a partner', async () => {
    // Edge case: empty name rejected
    const bad = await req('/api/contacts', 'POST', { name: '   ' });
    assert.equal(bad.status, 400);
    assert.match(bad.json.error, /obligatorio/i);

    // Create new contact
    const created = await req('/api/contacts', 'POST', {
      name: 'Inversiones El Dorado S.A.S.',
      is_company: true,
      doc_type: 'NIT',
      vat: '901.555.888-0',
      city: 'Barranquilla',
      email: 'info@eldorado.co',
      category_ids: 'VIP, Costa'
    });
    assert.equal(created.status, 200);
    assert.equal(created.json.contact.name, 'Inversiones El Dorado S.A.S.');
    assert.equal(created.json.contact.doc_type, 'NIT');
    assert.deepEqual(created.json.contact.category_ids, ['VIP', 'Costa']);

    // Default city on new contact without city specified is Pereira
    const defaultCityContact = await req('/api/contacts', 'POST', {
      name: 'Comercializadora Risaralda S.A.S.'
    });
    assert.equal(defaultCityContact.status, 200);
    assert.equal(defaultCityContact.json.contact.city, 'Pereira');
    await req(`/api/contacts/${defaultCityContact.json.contact.id}`, 'DELETE');

    // Update contact
    const updated = await req('/api/contacts', 'POST', {
      id: created.json.contact.id,
      name: 'Inversiones El Dorado S.A.S. Actualizado',
      city: 'Cartagena'
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.contact.city, 'Cartagena');

    // Delete contact
    const del = await req(`/api/contacts/${created.json.contact.id}`, 'DELETE');
    assert.equal(del.status, 200);
    assert.equal(del.json.removed.id, created.json.contact.id);
  });

  it('Module 2 (Gastos -> Contabilidad): runs full expense workflow (draft -> submit -> approve -> post journal entry -> pay)', async () => {
    // Edge case: zero or negative quantity rejected
    const badExp = await req('/api/expenses', 'POST', {
      name: 'Gasto inválido',
      quantity: 0,
      price_unit: 100000
    });
    assert.equal(badExp.status, 400);

    // Create draft expense
    const created = await req('/api/expenses', 'POST', {
      name: 'Vuelo corporativo Cali',
      employee_name: 'Laura Gómez',
      department: 'Comercial',
      quantity: 2,
      price_unit: 300000,
      tax_rate: 19,
      payment_mode: 'own_account'
    });
    assert.equal(created.status, 200);
    const expId = created.json.expense.id;
    assert.equal(created.json.expense.state, 'draft');
    assert.equal(created.json.expense.untaxed_amount, 600000);
    assert.equal(created.json.expense.tax_amount, 114000);
    assert.equal(created.json.expense.total_amount, 714000);

    // Cannot post directly from draft
    const prematurePost = await req(`/api/expenses/${expId}/action`, 'POST', { action: 'post' });
    assert.equal(prematurePost.status, 400);

    // Submit -> Approve -> Post -> Pay
    const sub = await req(`/api/expenses/${expId}/action`, 'POST', { action: 'submit' });
    assert.equal(sub.json.expense.state, 'submitted');

    const app = await req(`/api/expenses/${expId}/action`, 'POST', { action: 'approve' });
    assert.equal(app.json.expense.state, 'approved');

    const post = await req(`/api/expenses/${expId}/action`, 'POST', { action: 'post' });
    assert.equal(post.json.expense.state, 'posted');
    assert.ok(post.json.expense.move_id, 'Should generate linked accounting move_id');

    const pay = await req(`/api/expenses/${expId}/action`, 'POST', { action: 'pay', journal_code: 'BNK1' });
    assert.equal(pay.json.expense.state, 'paid');
    assert.ok(pay.json.expense.payment_id, 'Should generate linked accounting payment_id');
  });

  it('Module 3 & 4 (Ventas -> Contabilidad): creates quotation, confirms sale order, creates customer invoice, and registers partial & full payment', async () => {
    // Create test customer
    const cust = await req('/api/contacts', 'POST', { name: 'Cliente Ventas Corporativas S.A.S.' });
    assert.equal(cust.status, 200);
    const partnerId = cust.json.contact.id;

    // Edge case: empty lines rejected
    const emptyLines = await req('/api/sales', 'POST', { partner_id: partnerId, lines: [] });
    assert.equal(emptyLines.status, 400);

    // Create Quotation
    const saleRes = await req('/api/sales', 'POST', {
      partner_id: partnerId,
      salesperson: 'Laura Gómez',
      lines: [
        {
          description: 'Licencia Corporativa',
          quantity: 2,
          price_unit: 1000000,
          discount: 10,
          tax_rate: 19
        }
      ]
    });
    assert.equal(saleRes.status, 200);
    const order = saleRes.json.order;
    assert.equal(order.state, 'draft');
    assert.equal(order.amount_untaxed, 1800000); // 2 * 1,000,000 * 0.9
    assert.equal(order.amount_tax, 342000); // 19% of 1,800,000
    assert.equal(order.amount_total, 2142000);

    // Confirm Order
    const conf = await req(`/api/sales/${order.id}/action`, 'POST', { action: 'confirm' });
    assert.equal(conf.status, 200);
    assert.equal(conf.json.order.state, 'sale');
    assert.equal(conf.json.order.invoice_status, 'to invoice');

    // Create Invoice from Sale Order
    const invRes = await req(`/api/sales/${order.id}/action`, 'POST', { action: 'create_invoice' });
    assert.equal(invRes.status, 200);
    assert.equal(invRes.json.order.invoice_status, 'invoiced');
    const invoice = invRes.json.invoice;
    assert.ok(invoice);
    assert.equal(invoice.state, 'posted');
    assert.equal(invoice.amount_total, 2142000);
    assert.equal(invoice.amount_residual, 2142000);

    // Partial payment on invoice
    const partPay = await req(`/api/accounting/moves/${invoice.id}/action`, 'POST', {
      action: 'register_payment',
      amount: 1000000,
      journal_code: 'BNK1'
    });
    assert.equal(partPay.status, 200);
    assert.equal(partPay.json.move.payment_state, 'partial');
    assert.equal(partPay.json.move.amount_residual, 1142000);

    // Overpayment rejected
    const overPay = await req(`/api/accounting/moves/${invoice.id}/action`, 'POST', {
      action: 'register_payment',
      amount: 5000000,
      journal_code: 'BNK1'
    });
    assert.equal(overPay.status, 400);

    // Final payment settles invoice
    const fullPay = await req(`/api/accounting/moves/${invoice.id}/action`, 'POST', {
      action: 'register_payment',
      amount: 1142000,
      journal_code: 'BNK1'
    });
    assert.equal(fullPay.status, 200);
    assert.equal(fullPay.json.move.payment_state, 'paid');
    assert.equal(fullPay.json.move.amount_residual, 0);
  });

  it('Module 5 (Ajustes) & Chatter: updates company settings and logs chatter notes', async () => {
    const setRes = await req('/api/settings', 'POST', {
      company_name: 'CHapp Colombia S.A.S.',
      currency: 'USD',
      theme: 'light'
    });
    assert.equal(setRes.status, 200);
    assert.equal(setRes.json.settings.company_name, 'CHapp Colombia S.A.S.');
    assert.equal(setRes.json.settings.currency_symbol, 'US$');

    const contactForChat = await req('/api/contacts', 'POST', { name: 'Contacto Para Chatter S.A.S.' });
    assert.equal(contactForChat.status, 200);
    const chatId = contactForChat.json.contact.id;

    const chatRes = await req('/api/chatter', 'POST', {
      model: 'contacts',
      id: chatId,
      text: 'Llamada de seguimiento realizada con éxito.'
    });
    assert.equal(chatRes.status, 200);
    assert.ok(chatRes.json.record.chatter.some((m) => m.text.includes('Llamada de seguimiento')));
  });

  it('enforces referential integrity when attempting to delete a contact with linked records', async () => {
    const linkedContact = await req('/api/contacts', 'POST', { name: 'Contacto Con Ventas S.A.S.' });
    assert.equal(linkedContact.status, 200);
    const linkedId = linkedContact.json.contact.id;

    await req('/api/sales', 'POST', {
      partner_id: linkedId,
      lines: [{ description: 'Servicio vinculado', quantity: 1, price_unit: 100000, tax_rate: 19 }]
    });

    const delLinked = await req(`/api/contacts/${linkedId}`, 'DELETE');
    assert.equal(delLinked.status, 400);
    assert.match(delLinked.json.error, /No se puede eliminar/i);
  });

  it('prevents duplicate invoicing, supports delta invoicing on amended orders, and blocks cancelling orders with posted invoices', async () => {
    const cust = await req('/api/contacts', 'POST', { name: 'Cliente Factura Delta S.A.S.' });
    assert.equal(cust.status, 200);
    const partnerId = cust.json.contact.id;

    const saleRes = await req('/api/sales', 'POST', {
      partner_id: partnerId,
      salesperson: 'Carlos Mendoza',
      lines: [
        {
          description: 'Licencia Inicial',
          quantity: 1,
          price_unit: 1000000,
          discount: 0,
          tax_rate: 19
        }
      ]
    });
    assert.equal(saleRes.status, 200);
    const orderId = saleRes.json.order.id;

    await req(`/api/sales/${orderId}/action`, 'POST', { action: 'confirm' });
    const firstInv = await req(`/api/sales/${orderId}/action`, 'POST', { action: 'create_invoice' });
    assert.equal(firstInv.status, 200);
    assert.equal(firstInv.json.order.invoice_status, 'invoiced');
    assert.equal(firstInv.json.invoice.amount_total, 1190000);

    // Duplicate invoice attempt on already fully-invoiced order is rejected
    const dupInv = await req(`/api/sales/${orderId}/action`, 'POST', { action: 'create_invoice' });
    assert.equal(dupInv.status, 400);
    assert.match(dupInv.json.error, /facturad[oa]|pendiente/i);

    // Cancelling an order with a posted invoice is blocked
    const cancelBlocked = await req(`/api/sales/${orderId}/action`, 'POST', { action: 'cancel' });
    assert.equal(cancelBlocked.status, 400);
    assert.match(cancelBlocked.json.error, /facturas publicadas/i);

    // Amending the confirmed order to add a second unit flips invoice_status back to 'to invoice'
    const amended = await req('/api/sales', 'POST', {
      id: orderId,
      partner_id: partnerId,
      lines: [
        {
          description: 'Licencia Inicial Ampliada',
          quantity: 2,
          price_unit: 1000000,
          discount: 0,
          tax_rate: 19
        }
      ]
    });
    assert.equal(amended.status, 200);
    assert.equal(amended.json.order.amount_total, 2380000);
    assert.equal(amended.json.order.invoice_status, 'to invoice');

    // Creating an invoice now bills ONLY the uninvoiced delta (1,190,000)
    const deltaInv = await req(`/api/sales/${orderId}/action`, 'POST', { action: 'create_invoice' });
    assert.equal(deltaInv.status, 200);
    assert.equal(deltaInv.json.order.invoice_status, 'invoiced');
    assert.equal(deltaInv.json.invoice.amount_total, 1190000);
  });

  it('updates existing draft invoices in-place without duplicating, and rejects editing posted moves', async () => {
    const cust1 = await req('/api/contacts', 'POST', { name: 'Cliente Factura Borrador 1 S.A.S.' });
    assert.equal(cust1.status, 200);
    const partnerId1 = cust1.json.contact.id;

    const cust2 = await req('/api/contacts', 'POST', { name: 'Cliente Factura Borrador 2 S.A.S.' });
    assert.equal(cust2.status, 200);
    const partnerId2 = cust2.json.contact.id;

    // Create a draft invoice
    const created = await req('/api/accounting/moves', 'POST', {
      move_type: 'out_invoice',
      partner_id: partnerId1,
      ref: 'PO-DRAFT-1',
      lines: [
        { label: 'Servicio inicial', account_code: '413501', quantity: 1, price_unit: 500000, tax_rate: 19 }
      ]
    });
    assert.equal(created.status, 200);
    const moveId = created.json.move.id;
    assert.equal(created.json.move.state, 'draft');
    assert.equal(created.json.move.amount_total, 595000);

    // Update the draft invoice in-place and auto-post
    const updated = await req('/api/accounting/moves', 'POST', {
      id: moveId,
      move_type: 'out_invoice',
      partner_id: partnerId2,
      ref: 'PO-DRAFT-UPDATED',
      auto_post: true,
      lines: [
        { label: 'Servicio inicial', account_code: '413501', quantity: 2, price_unit: 500000, tax_rate: 19 },
        { label: 'Soporte adicional', account_code: '413501', quantity: 1, price_unit: 200000, tax_rate: 19 }
      ]
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.move.id, moveId);
    assert.equal(updated.json.move.partner_id, partnerId2);
    assert.equal(updated.json.move.ref, 'PO-DRAFT-UPDATED');
    assert.equal(updated.json.move.state, 'posted');
    assert.equal(updated.json.move.amount_total, 1428000);

    // Attempting to edit a posted move directly is rejected
    const editPosted = await req('/api/accounting/moves', 'POST', {
      id: moveId,
      partner_id: partnerId1,
      lines: [
        { label: 'Intento ilegal', account_code: '413501', quantity: 1, price_unit: 100000, tax_rate: 19 }
      ]
    });
    assert.equal(editPosted.status, 400);
    assert.match(editPosted.json.error, /borrador/i);
  });

  it('dynamically updates journal balances on payment/reimbursement and reverses payments when an invoice is reset to draft', async () => {
    const cust = await req('/api/contacts', 'POST', { name: 'Cliente Pago Banco S.A.S.' });
    assert.equal(cust.status, 200);
    const partnerId = cust.json.contact.id;

    const bootBefore = await req('/api/bootstrap');
    const bnkBefore = bootBefore.json.data.accounting.journals.find((j) => j.code === 'BNK1').balance;

    // Create & post a customer invoice for 1,000,000 (0% tax for simple math)
    const inv = await req('/api/accounting/moves', 'POST', {
      move_type: 'out_invoice',
      partner_id: partnerId,
      auto_post: true,
      lines: [
        { label: 'Consultoría exenta', account_code: '413501', quantity: 1, price_unit: 1000000, tax_rate: 0 }
      ]
    });
    const moveId = inv.json.move.id;

    // Register payment of 1,000,000 into BNK1 -> balance increases by 1,000,000
    const payRes = await req(`/api/accounting/moves/${moveId}/action`, 'POST', {
      action: 'register_payment',
      amount: 1000000,
      journal_code: 'BNK1'
    });
    assert.equal(payRes.status, 200);

    const bootAfterPay = await req('/api/bootstrap');
    const bnkAfterPay = bootAfterPay.json.data.accounting.journals.find((j) => j.code === 'BNK1').balance;
    assert.equal(bnkAfterPay, bnkBefore + 1000000);

    // Reset invoice to draft -> payment is reversed and removed, balance returns to bnkBefore
    const resetRes = await req(`/api/accounting/moves/${moveId}/action`, 'POST', {
      action: 'draft'
    });
    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.json.move.state, 'draft');
    assert.equal(resetRes.json.move.payment_state, 'not_paid');

    const bootAfterReset = await req('/api/bootstrap');
    const bnkAfterReset = bootAfterReset.json.data.accounting.journals.find((j) => j.code === 'BNK1').balance;
    assert.equal(bnkAfterReset, bnkBefore);
    assert.equal(
      bootAfterReset.json.data.accounting.payments.some((p) => p.move_id === moveId),
      false,
      'Linked payments should be removed when invoice is reset to draft'
    );
  });

  it('switches active user in Ajustes and verifies frontend/CSS regression contracts', async () => {
    await req('/api/settings', 'POST', {
      users: [
        { id: 1, name: 'Administrador CHapp', email: 'chappdevm@gmail.com', role: 'Administrador General', active: true },
        { id: 2, name: 'Laura Gómez', email: 'laura.gomez@chapperp.co', role: 'Ejecutiva Comercial', active: true }
      ]
    });
    const userRes = await req('/api/settings', 'POST', { active_user_id: 2 });
    assert.equal(userRes.status, 200);
    assert.equal(userRes.json.settings.active_user.id, 2);
    assert.equal(userRes.json.settings.active_user.name, 'Laura Gómez');

    // Verify CSS responsive table supports columns 8 and 9
    const cssText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'odoo20.css'), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(cssText.includes('td:nth-child(8)::before { content: var(--label-8'), 'CSS should support --label-8');
    assert.ok(cssText.includes('td:nth-child(9)::before { content: var(--label-9'), 'CSS should support --label-9');

    // Verify app.js contains header draft sync, dynamic bank balance, Alt+H, and 9-column labels
    const jsText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(!jsText.includes('formatMoney(48500000)'), 'Should not contain hardcoded 48500000 bank balance');
    assert.ok(jsText.includes('const syncSaleDraft = () =>'), 'Should include syncSaleDraft');
    assert.ok(jsText.includes("--label-9: 'Estado'"), 'Should include --label-9: Estado');
    assert.ok(jsText.includes("e.altKey && e.key.toLowerCase() === 'h'"), 'Should include Alt+H shortcut');
  });

  it('validates comprehensive responsiveness, tap target sizes (>= 44px), and multi-screen layouts (<600px, 600-1024px, >1200px)', () => {
    const cssText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'odoo20.css'), 'utf8').replace(/\r\n/g, '\n');
    const htmlText = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
    const jsText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8').replace(/\r\n/g, '\n');

    // 1. Viewport meta & Dynamic viewport units (100dvh)
    assert.ok(htmlText.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0"'), 'HTML must have responsive viewport meta');
    assert.ok(cssText.includes('100dvh'), 'CSS must use dynamic viewport units (100dvh) for mobile browser bars');
    assert.ok(cssText.includes('overflow-x: hidden'), 'CSS must prevent horizontal root scroll');

    // 2. Mobile Tap Targets (>= 44px)
    assert.ok(cssText.includes('min-height: 44px'), 'CSS must enforce >= 44px touch targets on mobile');
    assert.ok(cssText.includes('touch-action: manipulation'), 'CSS must optimize touch manipulation');

    // 3. Mobile Navbar (<768px / <600px): apps toggle, brand, submenus as scrollable pill strip, compact systray
    assert.ok(cssText.includes('.o_navbar_left {\n    display: contents;'), 'Navbar left should use display: contents on mobile to wrap submenus');
    assert.ok(cssText.includes('.o_menu_sections {\n    order: 4;'), 'Submenus must order into second responsive row on mobile');
    assert.ok(cssText.includes('#btnCommandPalette span:not(.o_systray_badge) {\n    display: none;'), 'Systray text must hide on mobile to fit icons');
    assert.ok(cssText.includes('#systrayCompany {\n    display: none;'), 'Company name must hide on mobile navbar');

    // 4. Control Panel responsive collapse on mobile (<600px)
    assert.ok(cssText.includes('.o_cp_center {\n    width: 100%;\n    max-width: 100%;'), 'Search container must take 100% width on mobile');
    assert.ok(cssText.includes('.o_cp_filter_pills {\n    display: flex;\n    overflow-x: auto;'), 'Filter pills must scroll horizontally on small screens');

    // 5. Responsive Data Tables: Container query + card layout
    assert.ok(cssText.includes('@container (width < 600px)'), 'CSS must include @container (width < 600px) for tables');
    assert.ok(cssText.includes('.table-wrapper {\n    max-block-size: min(560px, 72vh);\n  }'), 'Table wrapper must adapt to viewport on mobile');

    // 6. Responsive Forms, Totals box, and Smart Buttons on mobile (<600px)
    assert.ok(cssText.includes('.o_form_statusbar {\n    padding: 0.6rem 0.75rem;\n    flex-direction: column;\n    align-items: stretch;'), 'Form statusbar must stack on mobile');
    assert.ok(cssText.includes('.o_button_box {\n    display: grid;\n    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));'), 'Smart buttons must auto-fit on mobile');
    assert.ok(cssText.includes('.o_totals_box {\n    max-width: 100%;\n    margin-left: 0;'), 'Totals box must span 100% on mobile');

    // 7. Modals / Dialogs: light-dismiss + responsive dialog group
    assert.ok(htmlText.includes('class="o_group o_dialog_group"'), 'Payment dialog should use o_dialog_group');
    assert.ok(cssText.includes('.o_dialog_group {\n  grid-template-columns: 1fr 1fr;\n}'), 'Dialog group should be 2-column on desktop');
    assert.ok(cssText.includes('.o_dialog_group {\n    grid-template-columns: 1fr;\n  }'), 'Dialog group should be 1-column on mobile');
    assert.ok(cssText.includes('width: min(560px, calc(100vw - 1.5rem))'), 'Dialog must fit cleanly inside mobile viewports');

    // 8. Settings layout: horizontal swipeable tabs on screens < 840px
    assert.ok(cssText.includes('.o_settings_sidebar {\n    flex-direction: row;\n    overflow-x: auto;'), 'Settings sidebar must become horizontal scrollable bar on mobile');

    // 9. Quick add grids in Products & Accounts
    assert.ok(jsText.includes('class="o_group o_prod_add_grid"'), 'Product quick add should use o_prod_add_grid');
    assert.ok(jsText.includes('class="o_group o_acc_add_grid"'), 'Accounts quick add should use o_acc_add_grid');
    assert.ok(cssText.includes('.o_prod_add_grid'), 'CSS must define .o_prod_add_grid');
    assert.ok(cssText.includes('.o_acc_add_grid'), 'CSS must define .o_acc_add_grid');

    // 10. WCAG touch targets >= 44px on all mobile interactive elements
    assert.ok(cssText.includes('.o_filter_pill {\n    min-height: 44px;'), 'Filter pills must have min-height 44px on mobile');
    assert.ok(cssText.includes('.o_switch_btn {\n    min-height: 44px;'), 'Switch buttons must have min-height 44px on mobile');
    assert.ok(cssText.includes('.o_arrow_button {\n    min-height: 44px;'), 'Statusbar arrow buttons must have min-height 44px on mobile');
    assert.ok(cssText.includes('.btn-sm {\n    min-height: 44px;'), 'Small buttons must have min-height 44px on mobile');
    assert.ok(cssText.includes('.o_nav_entry {\n    min-height: 44px;'), 'Navbar entries must have min-height 44px on mobile');

    // 11. iOS Safari auto-zoom prevention (font-size: 16px on mobile inputs)
    assert.ok(cssText.includes('.o_searchview input {\n    font-size: 16px;'), 'Search input must have font-size 16px on mobile');
    assert.ok(cssText.includes('font-size: 16px;\n  }\n\n  .o_notebook_tab'), 'Form inputs must have font-size 16px on mobile');

    // 12. Top navbar compaction on mobile (theme label hidden) & Command palette
    assert.ok(cssText.includes('#btnThemeToggle .o_theme_label {\n    display: none;'), 'Theme label must be hidden on mobile');
    assert.ok(cssText.includes('.o_cmd_entry'), 'Command palette must have dedicated responsive class');
    assert.ok(jsText.includes('class="o_cmd_entry"'), 'JS command palette must use o_cmd_entry');
    assert.ok(cssText.includes('.o_badge {\n  display: inline-flex;\n  align-items: center;\n  gap: 0.25rem;\n  padding: 0.15rem 0.55rem;\n  font-size: 0.74rem;\n  font-weight: 600;\n  border-radius: 999px;\n  white-space: nowrap;\n  flex-shrink: 0;\n}'), 'Badges must have flex-shrink: 0');
  });

  it('Module 3 (Ventas -> Productos): ensures list view by default, form view on create/edit, product update in-place, and zero emojis in buttons across entire application', async () => {
    // 1. Create product via API
    const createRes = await req('/api/products', 'POST', {
      name: 'Consultoría Cloud ERP Dedicada',
      default_code: 'CLOUD-001',
      list_price: 2500000,
      standard_price: 1000000,
      category: 'Servicios Cloud',
      tax_rate: 19,
      type: 'service'
    });
    assert.equal(createRes.status, 200);
    assert.ok(createRes.json.ok);
    assert.ok(createRes.json.product.id > 0);
    assert.equal(createRes.json.product.name, 'Consultoría Cloud ERP Dedicada');
    assert.equal(createRes.json.product.list_price, 2500000);
    assert.equal(createRes.json.product.uom, 'Metro Cuadrado', 'Product UoM must default to Metro Cuadrado');

    const prodId = createRes.json.product.id;
    const initialCount = createRes.json.state.products.length;

    // 2. Update existing product via API with its id (including decimal pricing)
    const updateRes = await req('/api/products', 'POST', {
      id: prodId,
      name: 'Consultoría Cloud ERP Dedicada (Actualizada)',
      default_code: 'CLOUD-001-REV',
      list_price: 2800000.5,
      standard_price: 1100000.25,
      category: 'Infraestructura Cloud',
      tax_rate: 19,
      type: 'service',
      uom: 'Metro Liso'
    });
    assert.equal(updateRes.status, 200);
    assert.ok(updateRes.json.ok);
    assert.equal(updateRes.json.product.id, prodId);
    assert.equal(updateRes.json.product.name, 'Consultoría Cloud ERP Dedicada (Actualizada)');
    assert.equal(updateRes.json.product.list_price, 2800000.5);
    assert.equal(updateRes.json.product.standard_price, 1100000.25);
    assert.equal(updateRes.json.product.uom, 'Metro Liso', 'Product UoM must update to Metro Liso');
    assert.equal(updateRes.json.state.products.length, initialCount, 'Updating product in-place must not duplicate record');

    // 3. Verify frontend code contracts for Products list view vs detailed form card view
    const jsText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8').replace(/\r\n/g, '\n');
    const htmlText = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');

    assert.ok(jsText.includes('function renderProductsSubmodule(container)'), 'Must define renderProductsSubmodule');
    assert.ok(jsText.includes('function renderProductForm(container)'), 'Must define renderProductForm');
    assert.ok(jsText.includes("state.submenu === 'products'"), 'Must handle products submenu');
    assert.ok(jsText.includes("renderProductForm(container)"), 'Must route to renderProductForm on form view');
    assert.ok(jsText.includes("renderProductsSubmodule(container)"), 'Must route to renderProductsSubmodule on list view');
    assert.ok(jsText.includes("data-product-id"), 'Products table/cards must have data-product-id to open detailed card on click');
    assert.ok(jsText.includes("btnNewProductList"), 'Must provide New Product button in products catalog');
    assert.ok(jsText.includes("const isProductSubmenu = state.currentApp === 'sales' && state.submenu === 'products'"), 'Must handle product control panel');
    assert.ok(jsText.includes("const newRecordLabel = isProductSubmenu ? 'Nuevo Producto' : 'Nuevo'"), 'Control panel must use Nuevo Producto label');
    assert.ok(!jsText.includes('id="btnNewProductList">Nuevo Producto</button>'), 'Must remove duplicate creation button from product view body');
    assert.ok(!jsText.includes('<span class="o_stat_label">Almacenables / Consumibles</span>'), 'Must remove Almacenables card from banner');
    assert.ok(!jsText.includes('<span class="o_stat_label">Servicios</span>'), 'Must remove Servicios card from product banner');
    assert.ok(jsText.includes('<option value="Metro Cuadrado"'), 'Must support Metro Cuadrado in UoM');
    assert.ok(jsText.includes('<option value="Metro Liso"'), 'Must support Metro Liso in UoM');
    assert.ok(!jsText.includes('id="prodType"'), 'Must remove prodType input from form');
    assert.ok(!jsText.includes('id="prodCost"'), 'Must remove prodCost input from form');
    assert.ok(!jsText.includes('id="prodCanBeSold"'), 'Must remove prodCanBeSold checkbox from form');
    assert.ok(!jsText.includes('id="prodCanBeExpensed"'), 'Must remove prodCanBeExpensed checkbox from form');

    // Contact form regression checks: Colombian doc types, Colombian cities (default Pereira), Cliente/Proveedor radio, removed Website & numeric rank inputs
    assert.ok(jsText.includes('id="fContactDocType"'), 'Contact form must have Colombian document type select');
    assert.ok(jsText.includes("city: 'Pereira'"), 'New contact form must default city to Pereira');
    assert.ok(jsText.includes('<select id="fContactCity"'), 'Contact city field must be a dropdown select');
    assert.ok(jsText.includes('name="contact_role"'), 'Contact form must have Cliente / Proveedor role check');
    assert.ok(!jsText.includes('id="fContactWebsite"'), 'Contact form must not include Sitio Web field');
    assert.ok(!jsText.includes('id="fCustomerRank"'), 'Contact form must not include numeric Clasificación Cliente field');
    assert.ok(!jsText.includes('id="fSupplierRank"'), 'Contact form must not include numeric Clasificación Proveedor field');
    assert.ok(htmlText.includes('<title>CH Aluminios ERP</title>'), 'Browser tab title must be CH Aluminios ERP without Odoo 20');
    assert.ok(!htmlText.includes('ERP — Odoo 20'), 'HTML title must not contain Odoo 20');
    assert.ok(jsText.includes("state.activeRecordId = null;\n          state.viewType = 'list';"), 'Creating new contact must redirect back to main list view');

    // 4. Verify table column alignment and exact 6-column matching
    const cssContent = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'odoo20.css'), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(cssContent.includes('.o_list_table thead th {\n  padding: 0.65rem 0.85rem;') && cssContent.includes('text-align: start;'), 'Table header th must have text-align: start');
    assert.ok(cssContent.includes('.o_list_table thead th:first-child {\n  position: sticky;\n  inset-inline-start: 0;\n  z-index: 3;\n}'), 'First column header must have sticky inset-inline-start: 0');
    assert.ok(cssContent.includes('.o_list_table tbody th {\n  position: sticky;\n  inset-inline-start: 0;\n  z-index: 1;\n  background-color: var(--o-view-bg);\n  padding: 0.65rem 0.85rem;\n  font-weight: 600;\n  color: var(--o-text-main);\n  border-bottom: 1px solid var(--o-border-color);\n  white-space: nowrap;\n  text-align: start;\n}'), 'Table body th must have text-align: start');
    assert.ok(cssContent.includes('.o_list_table tbody td {\n  padding: 0.65rem 0.85rem;\n  border-bottom: 1px solid var(--o-border-color);\n  color: var(--o-gray-800);\n  vertical-align: middle;\n  text-align: start;\n}'), 'Table body td must have text-align: start');
    assert.ok(jsText.includes('<th>Producto</th>'), 'Products table must have Producto header');
    assert.ok(jsText.includes('<th>Referencia SKU</th>'), 'Products table must have Referencia SKU header');
    assert.ok(jsText.includes('<th>Categoría</th>'), 'Products table must have Categoría header');
    assert.ok(jsText.includes('<th>Unidad de Medida</th>'), 'Products table must have Unidad de Medida header');
    assert.ok(jsText.includes('<th class="text-end">Precio de Venta</th>'), 'Products table must have Precio de Venta header');
    assert.ok(jsText.includes('<th>Impuesto</th>'), 'Products table must have Impuesto header');

    // 5. Verify select menus across entire app have empty/placeholder options when unselected
    assert.ok(htmlText.includes('<option value="" disabled selected>— Seleccione un diario de pago —</option>'), 'Payment journal must have empty placeholder option');
    assert.ok(jsText.includes('<option value="" ${!existing.payment_term ? \'selected disabled\' : \'\'}>— Seleccione un plazo de pago —</option>'), 'Contact payment term select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${!existing.product_id ? \'selected disabled\' : \'\'}>— Seleccione Categoría de Gasto —</option>'), 'Expense product select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${!existing.partner_id ? \'selected disabled\' : \'\'}>— Seleccionar Proveedor —</option>'), 'Expense partner select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${existing.tax_rate === \'\' || existing.tax_rate === undefined || existing.tax_rate === null ? \'selected disabled\' : \'\'}>— Seleccione IVA —</option>'), 'Expense tax select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${!existing.payment_mode ? \'selected disabled\' : \'\'}>— Seleccione Forma de Pago —</option>'), 'Expense payment mode select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${!draft.partner_id ? \'selected disabled\' : \'\'}>— Seleccione un cliente —</option>'), 'Sale partner select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${!draft.payment_term ? \'selected disabled\' : \'\'}>— Seleccione plazo de pago —</option>'), 'Sale payment term select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${!l.product_id ? \'selected disabled\' : \'\'}>— Seleccione producto —</option>'), 'Sale line product select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${l.tax_rate === undefined || l.tax_rate === null || l.tax_rate === \'\' ? \'selected disabled\' : \'\'}>— IVA —</option>'), 'Sale line tax select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${!existing.uom ? \'selected disabled\' : \'\'}>— Seleccione Unidad de Medida —</option>'), 'Product UoM select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${existing.tax_rate === \'\' || existing.tax_rate === undefined || existing.tax_rate === null ? \'selected disabled\' : \'\'}>— Seleccione IVA —</option>'), 'Product tax select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" disabled selected>— Seleccione Naturaleza / Tipo —</option>'), 'PUC account type select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${!draft.partner_id ? \'selected disabled\' : \'\'}>— Seleccione Tercero / Contacto —</option>'), 'Accounting move partner select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${!s.currency ? \'selected disabled\' : \'\'}>— Seleccione Moneda —</option>'), 'Settings currency select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${!s.theme ? \'selected disabled\' : \'\'}>— Seleccione Tema —</option>'), 'Settings theme select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${s.default_sale_tax === \'\' || s.default_sale_tax === undefined || s.default_sale_tax === null ? \'selected disabled\' : \'\'}>— Seleccione IVA por Defecto —</option>'), 'Settings default sale tax select must have empty placeholder');
    assert.ok(jsText.includes('<option value="" ${!s.active_user || !s.active_user.id ? \'selected disabled\' : \'\'}>— Seleccione Usuario Activo —</option>'), 'Settings active user select must have empty placeholder');
    assert.ok(jsText.includes('Debe seleccionar la tarifa de IVA.'), 'Expense form must require selecting tax rate');
    assert.ok(jsText.includes('Debe seleccionar un producto en cada línea del pedido.'), 'Sale order form must validate products on order lines');

    // 6. Verify ZERO emojis and symbols inside <button> tags across index.html and app.js
    const emojiRegex = /[\p{Extended_Pictographic}\u2600-\u27BF\u2300-\u23FF\u2B50\u203C\u2049\u2139\u2194-\u21AA\u2702-\u27B0✕✓💾✉➕🔍]/u;
    const btnRegex = /<button[\s\S]*?<\/button>/gi;

    [htmlText, jsText].forEach((fileContent, idx) => {
      let match;
      while ((match = btnRegex.exec(fileContent)) !== null) {
        const btnHtml = match[0];
        assert.ok(
          !emojiRegex.test(btnHtml),
          `Button in ${idx === 0 ? 'index.html' : 'app.js'} must not contain emojis: ${btnHtml.replace(/\s+/g, ' ')}`
        );
        assert.ok(
          !btnHtml.includes('&times;'),
          `Button in ${idx === 0 ? 'index.html' : 'app.js'} must not contain &times; entity: ${btnHtml.replace(/\s+/g, ' ')}`
        );
      }
    });
  });

  it('supports installment/partial invoicing with consecutive invoices, residual tracking, partner autocomplete, and PDF preview branding', async () => {
    // 1. Create a partner with complete fiscal details
    const partnerRes = await req('/api/contacts', 'POST', {
      name: 'Constructora del Eje SAS',
      vat: '901.445.889-2',
      doc_type: 'NIT',
      street: 'Avenida Circunvalar # 14-20',
      city: 'Pereira',
      state_name: 'Risaralda',
      country_name: 'Colombia',
      phone: '6063345566',
      mobile: '3104567890',
      email: 'facturacion@constructoradeleje.com',
      payment_term: '30 Días',
      is_company: true
    });
    assert.equal(partnerRes.status, 200);
    const partnerId = partnerRes.json.contact.id;

    // 2. Create and confirm a sale order for $2,000,000 COP
    const saleRes = await req('/api/sales', 'POST', {
      partner_id: partnerId,
      lines: [
        {
          product_id: 1,
          name: 'Ventanería de Aluminio Perfil 744 - Metro Lineal',
          quantity: 20,
          price_unit: 100000,
          discount: 0,
          tax_rate: 0
        }
      ]
    });
    assert.equal(saleRes.status, 200);
    const orderId = saleRes.json.order.id;
    assert.equal(saleRes.json.order.amount_total, 2000000);

    const confirmRes = await req(`/api/sales/${orderId}/action`, 'POST', { action: 'action_confirm' });
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.json.order.state, 'sale');
    assert.equal(confirmRes.json.order.invoice_status, 'to invoice');

    // 3. Generate first installment invoice (Abono 1: $800,000)
    const inv1Res = await req(`/api/sales/${orderId}/action`, 'POST', {
      action: 'create_invoice',
      amount: 800000
    });
    assert.equal(inv1Res.status, 200);
    const inv1 = inv1Res.json.invoice;
    assert.ok(inv1, 'First installment invoice must be returned');
    assert.equal(inv1.amount_total, 800000);
    assert.equal(inv1.is_installment, true);
    assert.equal(inv1.installment_number, 1);
    assert.equal(inv1.order_residual, 1200000);
    assert.equal(inv1Res.json.order.invoice_status, 'to invoice', 'Order residual remains, so invoice_status must stay to invoice');
    assert.equal(inv1Res.json.order.invoice_ids.length, 1);

    // 4. Generate second installment invoice (Abono 2: $1,200,000)
    const inv2Res = await req(`/api/sales/${orderId}/action`, 'POST', {
      action: 'create_invoice',
      amount: 1200000
    });
    assert.equal(inv2Res.status, 200);
    const inv2 = inv2Res.json.invoice;
    assert.ok(inv2, 'Second installment invoice must be returned');
    assert.notEqual(inv1.name, inv2.name, 'Consecutive invoices must have unique names');
    assert.equal(inv2.amount_total, 1200000);
    assert.equal(inv2.is_installment, true);
    assert.equal(inv2.installment_number, 2);
    assert.equal(inv2.order_residual, 0);
    assert.equal(inv2Res.json.order.invoice_status, 'invoiced', 'Order is 100% billed, status must become invoiced');
    assert.equal(inv2Res.json.order.invoice_ids.length, 2);

    // 5. Attempting to invoice further must be rejected
    const inv3Res = await req(`/api/sales/${orderId}/action`, 'POST', {
      action: 'create_invoice',
      amount: 100000
    });
    assert.equal(inv3Res.status, 400);
    assert.match(inv3Res.json.error, /ya fue facturado en su totalidad/);

    // 6. Verify client autocomplete and PDF generation assets
    const appJsContent = fs.readFileSync(path.join(__dirname, '../assets/js/app.js'), 'utf8');
    const cssContent = fs.readFileSync(path.join(__dirname, '../assets/css/odoo20.css'), 'utf8');

    assert.ok(appJsContent.includes('renderSalePartnerDetailsHtml'), 'app.js must provide partner autocomplete details helper');
    assert.ok(appJsContent.includes('Cédula / NIT'), 'app.js partner details must include Cédula / NIT');
    assert.ok(appJsContent.includes('Celular / Teléfono'), 'app.js partner details must include Celular / Teléfono');
    assert.ok(appJsContent.includes('renderInvoicePdfSheetHtml'), 'app.js must provide invoice PDF rendering helper');
    assert.ok(appJsContent.includes('CH Aluminios'), 'app.js PDF helper must include CH Aluminios branding');
    assert.ok(appJsContent.includes('downloadInvoicePdf'), 'app.js must provide download / print invoice PDF function');
    assert.ok(appJsContent.includes('Metro Lineal'), 'app.js must offer Metro Lineal UoM');

    // Smart button styling (.oe_stat_button)
    assert.ok(cssContent.includes('.oe_stat_button'), 'CSS must define .oe_stat_button');
    assert.ok(cssContent.includes('min-height: 52px;'), 'Smart button min-height must be enlarged to 52px');

    // Verify dark mode sales icons exist
    const salesPng = fs.readFileSync(path.join(__dirname, '../assets/icons/sales.png'));
    const salesSvg = fs.readFileSync(path.join(__dirname, '../assets/icons/sales.svg'), 'utf8');
    assert.ok(salesPng.length > 5000, 'sales.png must be high resolution');
    assert.ok(salesSvg.includes('salesDropShadow') && salesSvg.includes('linearGradient') && salesSvg.includes('#E879F9'), 'sales.svg must feature luminous gradient and drop shadow for dark contrast');
  });

  it('enforces referential integrity on product deletion and handles multi-part installment abonos with precision', async () => {
    // 1. Create a standalone product and try to delete
    const prodRes = await req('/api/products', 'POST', {
      name: 'Perfil Aluminio Anonimizado 1x1',
      list_price: 35000,
      standard_price: 18000,
      uom: 'Metro Lineal'
    });
    assert.equal(prodRes.status, 200);
    const prodId = prodRes.json.product.id;

    // 2. Link this product to a sale order
    const partnerRes = await req('/api/contacts', 'POST', { name: 'Cliente Trazabilidad Cuotas SAS' });
    const partnerId = partnerRes.json.contact.id;

    const saleRes = await req('/api/sales', 'POST', {
      partner_id: partnerId,
      lines: [
        { product_id: prodId, description: 'Perfil 1x1', quantity: 10, price_unit: 100000, discount: 0, tax_rate: 19 }
      ]
    });
    const orderId = saleRes.json.order.id;
    const orderTotal = saleRes.json.order.amount_total; // 1,190,000

    // 3. Attempting to delete product linked to order must be rejected
    const delFailRes = await req(`/api/products/${prodId}`, 'DELETE');
    assert.equal(delFailRes.status, 400);
    assert.match(delFailRes.json.error, /asociados/);

    // 4. Confirm order
    await req(`/api/sales/${orderId}/action`, 'POST', { action: 'confirm' });

    // 5. Test 3 fractional installment payments
    // Part 1: $400,000 abono
    const abono1 = await req(`/api/sales/${orderId}/action`, 'POST', {
      action: 'create_invoice',
      amount: 400000
    });
    assert.equal(abono1.status, 200);
    assert.equal(abono1.json.invoice.amount_total, 400000);
    assert.equal(abono1.json.invoice.order_residual, 790000);
    assert.equal(abono1.json.order.invoice_status, 'to invoice');

    // Part 2: $390,000 abono
    const abono2 = await req(`/api/sales/${orderId}/action`, 'POST', {
      action: 'create_invoice',
      amount: 390000
    });
    assert.equal(abono2.status, 200);
    assert.equal(abono2.json.invoice.amount_total, 390000);
    assert.equal(abono2.json.invoice.order_residual, 400000);
    assert.equal(abono2.json.order.invoice_status, 'to invoice');

    // Part 3: final $400,000 abono to complete order
    const abono3 = await req(`/api/sales/${orderId}/action`, 'POST', {
      action: 'create_invoice',
      amount: 400000
    });
    assert.equal(abono3.status, 200);
    assert.equal(abono3.json.invoice.amount_total, 400000);
    assert.equal(abono3.json.invoice.order_residual, 0);
    assert.equal(abono3.json.order.invoice_status, 'invoiced');
    assert.equal(abono3.json.order.invoice_ids.length, 3);

    // 6. Create unlinked product and delete successfully
    const tempProdRes = await req('/api/products', 'POST', {
      name: 'Perfil Temporal Para Eliminar',
      list_price: 20000,
      uom: 'Metro Lineal'
    });
    const tempId = tempProdRes.json.product.id;
    const delOkRes = await req(`/api/products/${tempId}`, 'DELETE');
    assert.equal(delOkRes.status, 200);
    assert.ok(delOkRes.json.ok);
    assert.equal(delOkRes.json.removed.id, tempId);
  });

  it('Module 3 & 4 (UI Layout & Dinámica Contable): Kanban por etapas, filas vinculadas clickeables, split layout PDF y facturación dinámica en abonos', async () => {
    const htmlText = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const cssText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'odoo20.css'), 'utf8');
    const jsText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');

    // 1. Kanban con columnas por etapas (Cotización, Enviada, Pedido de Venta)
    assert.ok(cssText.includes('.o_kanban_board'), 'CSS must define .o_kanban_board for stage columns');
    assert.ok(cssText.includes('.o_kanban_column'), 'CSS must define .o_kanban_column');
    assert.ok(cssText.includes('.o_kanban_col_header'), 'CSS must define .o_kanban_col_header');
    assert.ok(jsText.includes("title: 'Cotización'"), 'Sales kanban must have Cotización stage');
    assert.ok(jsText.includes("title: 'Cotización Enviada'"), 'Sales kanban must have Cotización Enviada stage');
    assert.ok(jsText.includes("title: 'Pedido de Venta'"), 'Sales kanban must have Pedido de Venta stage');

    // 1b. Gastos y Contactos con tableros Kanban por etapas/columnas
    assert.ok(jsText.includes("title: 'Presentado'"), 'Expenses kanban must have Presentado stage');
    assert.ok(jsText.includes("title: 'Aprobado'"), 'Expenses kanban must have Aprobado stage');
    assert.ok(jsText.includes("title: 'Clientes'"), 'Contacts kanban must have Clientes column');
    assert.ok(jsText.includes("title: 'Proveedores'"), 'Contacts kanban must have Proveedores column');

    // 1c. Facturas: switcher deshabilitado, siempre lista por defecto
    assert.ok(jsText.includes("state.currentApp === 'accounting'"), 'Must check accounting app for list-only view');
    assert.ok(jsText.includes("switcher.innerHTML = '';"), 'Invoices must hide view switcher and force list view');

    // 2. Facturas vinculadas directamente clickeables en la fila
    assert.ok(cssText.includes('.o_invoice_link_row'), 'CSS must style .o_invoice_link_row for row click navigation');
    assert.ok(jsText.includes('class="o_invoice_link_row" data-invoice-id="'), 'Linked invoice rows must have data-invoice-id on <tr>');
    assert.ok(jsText.includes("container.querySelectorAll('.o_linked_invoices_panel tbody tr[data-invoice-id]')"), 'JS must attach click listener directly to linked invoice rows');

    // 3. Layout de Factura: Tarjeta de Historial y Auditoría debajo de la tarjeta de factura, y PDF ocupando el espacio derecho
    assert.ok(cssText.includes('.o_invoice_left_col'), 'CSS must define .o_invoice_left_col with flex column layout');
    assert.ok(jsText.includes('<div class="o_invoice_left_col">'), 'Invoice view must stack sheet and chatter vertically in o_invoice_left_col');
    assert.ok(cssText.includes('minmax(460px, 1.25fr)'), 'CSS must allocate wide flexible space for right-hand invoice PDF panel');

    // 4. Modal de pago con opción de generar automáticamente la factura por saldo restante
    assert.ok(htmlText.includes('id="chkGenerateResidualInvoice"'), 'Payment dialog must have chkGenerateResidualInvoice checkbox');
    assert.ok(htmlText.includes('id="payResidualOptionRow"'), 'Payment dialog must have payResidualOptionRow');

    // 5. Flujo Contable Dinámico: Pago parcial genera trazabilidad y siguiente factura por saldo restante
    const newMoveRes = await req('/api/accounting/moves', 'POST', {
      move_type: 'out_invoice',
      partner_id: 1,
      lines: [
        { name: 'Carpintería en Aluminio Arquitectónico', quantity: 1, price_unit: 1000000, tax_rate: 19 }
      ]
    });
    assert.equal(newMoveRes.status, 200);
    const originalMove = newMoveRes.json.move;

    // Confirmar y publicar factura ($1.190.000 total)
    const postRes = await req(`/api/accounting/moves/${originalMove.id}/action`, 'POST', { action: 'post' });
    assert.equal(postRes.status, 200);
    assert.equal(postRes.json.move.state, 'posted');
    assert.equal(postRes.json.move.amount_residual, 1190000);

    // Registrar abono parcial de $400.000 con generate_residual_invoice: true
    const payPartRes = await req(`/api/accounting/moves/${originalMove.id}/action`, 'POST', {
      action: 'register_payment',
      amount: 400000,
      journal_code: 'BNK1',
      date: '2026-10-27',
      generate_residual_invoice: true
    });
    assert.equal(payPartRes.status, 200);
    const updatedInv = payPartRes.json.move;
    assert.equal(updatedInv.payment_state, 'partial');
    assert.equal(updatedInv.amount_residual, 790000);
    assert.ok(Array.isArray(updatedInv.payments_history));
    assert.equal(updatedInv.payments_history.length, 1);
    assert.equal(updatedInv.payments_history[0].amount, 400000);
    assert.equal(updatedInv.payments_history[0].residual_after, 790000);

    // Siguiente factura por el saldo restante ($790.000) generada automáticamente
    const nextInvoice = payPartRes.json.next_invoice || updatedInv.next_invoice;
    assert.ok(nextInvoice, 'Should return generated next_invoice for residual');
    assert.equal(nextInvoice.amount_total, 790000);
    assert.equal(nextInvoice.amount_residual, 790000);
    assert.equal(nextInvoice.state, 'posted');
    assert.equal(nextInvoice.payment_state, 'not_paid');
    assert.equal(nextInvoice.prior_invoice_id, updatedInv.id);
    assert.equal(nextInvoice.prior_payment_amount, 400000);

    // El siguiente pago se realiza sobre la segunda factura por su saldo restante
    const payNextRes = await req(`/api/accounting/moves/${nextInvoice.id}/action`, 'POST', {
      action: 'register_payment',
      amount: 790000,
      journal_code: 'BNK1',
      date: '2026-10-28'
    });
    assert.equal(payNextRes.status, 200);
    assert.equal(payNextRes.json.move.payment_state, 'paid');
    assert.equal(payNextRes.json.move.amount_residual, 0);
  });

  it('Representación Gráfica Profesional de Facturas (Paleta CHapp ERP & Estándar Comercial): Logo, Colores de la App (#074073 / #14B5D9), Marcas de Agua, Sello de Estado, Total en Letras, Datos Bancarios, Firmas y Estilos @media print (Sin CUFE ni QR)', async () => {
    const cssText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'odoo20.css'), 'utf8');
    const jsText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');

    // 1. Verificación de reglas CSS para representación gráfica con la paleta de la app (#074073 y #14B5D9)
    assert.ok(cssText.includes('.o_pdf_sheet'), 'CSS debe definir contenedor .o_pdf_sheet');
    assert.ok(cssText.includes('.o_pdf_watermark'), 'CSS debe definir marcas de agua .o_pdf_watermark');
    assert.ok(cssText.includes('.o_pdf_watermark.is-paid'), 'CSS debe soportar marca de agua is-paid');
    assert.ok(cssText.includes('.o_pdf_watermark.is-draft'), 'CSS debe soportar marca de agua is-draft');
    assert.ok(cssText.includes('.o_pdf_watermark.is-cancel'), 'CSS debe soportar marca de agua is-cancel');
    assert.ok(cssText.includes('.o_pdf_watermark.is-partial'), 'CSS debe soportar marca de agua is-partial');
    assert.ok(cssText.includes('.o_pdf_watermark.is-overdue'), 'CSS debe soportar marca de agua is-overdue');
    assert.ok(cssText.includes('.o_pdf_stamp'), 'CSS debe definir sellos de estado .o_pdf_stamp');
    assert.ok(cssText.includes('.o_pdf_company_logo'), 'CSS debe definir estilos para el logo empresarial');
    assert.ok(cssText.includes('.o_pdf_resolution_bar'), 'CSS debe definir la barra de resolución');
    assert.ok(cssText.includes('.o_pdf_amount_words'), 'CSS debe definir contenedor de total en letras');
    assert.ok(cssText.includes('.o_pdf_bank_info'), 'CSS debe definir instrucciones bancarias');
    assert.ok(!cssText.includes('.o_pdf_qr_box'), 'CSS no debe incluir estilos de código QR');
    assert.ok(cssText.includes('.o_pdf_signatures_section'), 'CSS debe definir sección de firmas formales');
    assert.ok(cssText.includes('size: A4 portrait;'), 'CSS print debe configurar hoja A4 portrait');
    assert.ok(cssText.includes('print-color-adjust: exact'), 'CSS print debe forzar reproducción exacta de colores y marcas de agua');
    assert.ok(cssText.includes('table-header-group'), 'CSS print debe repetir thead en páginas sucesivas');
    assert.ok(cssText.includes('#074073'), 'CSS debe utilizar el color primario de la app (#074073)');
    assert.ok(cssText.includes('#14B5D9'), 'CSS debe utilizar el color acento de la app (#14B5D9)');

    // 2. Verificación de helpers técnicos en app.js y ausencia estricta de CUFE y QR
    assert.ok(jsText.includes('function round2'), 'app.js debe implementar helper de redondeo financiero round2');
    assert.ok(jsText.includes('function numberToWordsSpanish'), 'app.js debe implementar conversión de cifras a letras en español');
    assert.ok(!jsText.includes('function generateInvoiceCufe'), 'app.js no debe contener generador de CUFE');
    assert.ok(!jsText.includes('function renderInvoiceQrSvg'), 'app.js no debe contener generador de código QR');
    assert.ok(jsText.includes('Firma y Sello Emisor Autorizado'), 'app.js debe incluir bloque de firma emisor');
    assert.ok(jsText.includes('Firma y Aceptación de Recibido'), 'app.js debe incluir bloque de aceptación comprador');
    assert.ok(jsText.includes('Bancolombia Cuenta Corriente'), 'app.js debe proveer datos bancarios de consignación');

    // 3. Extracción y prueba funcional de los algoritmos de la factura
    const fnModule = {};
    const evalEnv = `
      const state = {
        data: {
          settings: {
            company_name: 'CH Aluminios',
            company_vat: '900.876.543-1',
            fiscal_regime: 'Responsable de IVA - Régimen Ordinario',
            company_address: 'Cra. 7 #18-45',
            company_city: 'Pereira',
            company_country: 'Colombia',
            company_email: 'chappdevm@gmail.com'
          },
          contacts: [
            { id: 10, name: 'Arquitectura y Vidrios SAS', doc_type: 'NIT', vat: '901.234.567-8', street: 'Calle 10 #15-20', city: 'Pereira', state_name: 'Risaralda', mobile: '3157778899', phone: '3201122', email: 'contabilidad@arqvidrios.com', payment_term: '30 Días' }
          ],
          sales: []
        }
      };
      function esc(str) { return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
      function formatMoney(amount, currency = '$') { const num = Number(amount) || 0; return currency + ' ' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
      
      ${jsText.substring(jsText.indexOf('function numberToWordsSpanish'), jsText.indexOf('function renderSaleOrderForm'))}
      
      module.exports = { numberToWordsSpanish, renderInvoicePdfSheetHtml };
    `;
    const vm = require('node:vm');
    const script = new vm.Script(evalEnv);
    const context = vm.createContext({ module: fnModule, console, Math, Array, String, Number, Boolean, encodeURIComponent });
    script.runInContext(context);
    const { numberToWordsSpanish, renderInvoicePdfSheetHtml } = fnModule.exports;

    // 3a. Conversión numérica a letras en español
    assert.equal(numberToWordsSpanish(1190000), 'UN MILLÓN CIENTO NOVENTA MIL PESOS M/CTE');
    assert.equal(numberToWordsSpanish(400000), 'CUATROCIENTOS MIL PESOS M/CTE');
    assert.equal(numberToWordsSpanish(790000), 'SETECIENTOS NOVENTA MIL PESOS M/CTE');
    assert.equal(numberToWordsSpanish(35000), 'TREINTA Y CINCO MIL PESOS M/CTE');
    assert.equal(numberToWordsSpanish(0), 'CERO PESOS M/CTE');
    assert.equal(numberToWordsSpanish(2000000000), 'DOS MIL MILLONES PESOS M/CTE');
    assert.equal(numberToWordsSpanish(1000000000), 'MIL MILLONES PESOS M/CTE');
    assert.equal(numberToWordsSpanish(150000.75), 'CIENTO CINCUENTA MIL PESOS CON 75/100 M/CTE');
    assert.equal(numberToWordsSpanish(1), 'UN PESO M/CTE');

    // 3b. Representación Gráfica Completa - Factura PAGADA (Sin CUFE ni QR)
    const mockInvoice = {
      id: 99,
      name: 'FE-00042',
      invoice_date: '2026-10-27',
      invoice_date_due: '2026-11-26',
      move_type: 'out_invoice',
      state: 'posted',
      payment_state: 'paid',
      partner_id: 10,
      amount_untaxed: 1000000,
      amount_tax: 190000,
      amount_total: 1190000,
      amount_residual: 0,
      lines: [
        { name: 'Perfil Ventana Serie 3825', quantity: 10, uom: 'Metro Lineal', price_unit: 100000, tax_rate: 19, subtotal: 1000000 }
      ]
    };

    const paidHtml = renderInvoicePdfSheetHtml(mockInvoice);
    assert.ok(paidHtml.includes('class="o_pdf_watermark is-paid">PAGADA</div>'), 'Debe incluir marca de agua PAGADA');
    assert.ok(paidHtml.includes('class="o_pdf_stamp is-paid"'), 'Debe incluir sello oficial PAGADA');
    assert.ok(paidHtml.includes('src="/assets/icons/logo.png"'), 'Debe mostrar el logo empresarial');
    assert.ok(paidHtml.includes('CH Aluminios'), 'Debe incluir el nombre de la empresa');
    assert.ok(paidHtml.includes('900.876.543-1'), 'Debe incluir NIT emisor');
    assert.ok(paidHtml.includes('Arquitectura y Vidrios SAS'), 'Debe incluir nombre del cliente');
    assert.ok(paidHtml.includes('901.234.567-8'), 'Debe incluir NIT receptor');
    assert.ok(paidHtml.includes('Metro Lineal'), 'Debe mostrar UoM Metro Lineal');
    assert.ok(paidHtml.includes('SON: UN MILLÓN CIENTO NOVENTA MIL PESOS M/CTE'), 'Debe incluir total en letras');
    assert.ok(paidHtml.includes('Bancolombia Cuenta Corriente'), 'Debe mostrar datos de pago');
    assert.ok(paidHtml.includes('Firma y Sello Emisor Autorizado'), 'Debe contener firma del emisor');
    assert.ok(paidHtml.includes('Firma y Aceptación de Recibido'), 'Debe contener firma del receptor');
    assert.ok(!paidHtml.includes('CUFE'), 'No debe contener referencias a CUFE');
    assert.ok(!paidHtml.includes('o_pdf_qr_box'), 'No debe contener caja de código QR');

    // 3c. Representación Gráfica - Factura BORRADOR
    const draftInvoice = { ...mockInvoice, state: 'draft', payment_state: 'not_paid', amount_residual: 1190000 };
    const draftHtml = renderInvoicePdfSheetHtml(draftInvoice);
    assert.ok(draftHtml.includes('class="o_pdf_watermark is-draft">BORRADOR</div>'), 'Debe incluir marca de agua BORRADOR');
    assert.ok(draftHtml.includes('class="o_pdf_stamp is-draft"'), 'Debe incluir sello BORRADOR');

    // 3d. Representación Gráfica - Factura CANCELADA
    const cancelInvoice = { ...mockInvoice, state: 'cancel', payment_state: 'paid', amount_residual: 0 };
    const cancelHtml = renderInvoicePdfSheetHtml(cancelInvoice);
    assert.ok(cancelHtml.includes('class="o_pdf_watermark is-cancel">CANCELADA</div>'), 'Debe incluir marca de agua CANCELADA');
    assert.ok(cancelHtml.includes('class="o_pdf_stamp is-cancel"'), 'Debe incluir sello ANULADA');
    assert.ok(!cancelHtml.includes('class="o_pdf_watermark is-paid">PAGADA</div>'), 'Factura anulada nunca debe mostrar marca PAGADA');
    assert.ok(cancelHtml.includes('ANULADA'), 'Fila de totales debe indicar documento ANULADA');

    // 3e. Representación Gráfica - Factura con PAGO PARCIAL
    const partialInvoice = { ...mockInvoice, state: 'posted', payment_state: 'partial', amount_residual: 400000 };
    const partialHtml = renderInvoicePdfSheetHtml(partialInvoice);
    assert.ok(partialHtml.includes('class="o_pdf_watermark is-partial">PAGO PARCIAL</div>'), 'Debe incluir marca de agua PAGO PARCIAL');
    assert.ok(partialHtml.includes('class="o_pdf_stamp is-partial"'), 'Debe incluir sello PAGO PARCIAL');
    assert.ok(partialHtml.includes('Saldo Pendiente:'), 'Debe indicar fila de saldo pendiente');

    // 3f. Representación Gráfica - Factura VENCIDA (Overdue)
    const overdueInvoice = { ...mockInvoice, state: 'posted', payment_state: 'not_paid', invoice_date_due: '2020-01-01', amount_residual: 1190000 };
    const overdueHtml = renderInvoicePdfSheetHtml(overdueInvoice);
    assert.ok(overdueHtml.includes('class="o_pdf_watermark is-overdue">VENCIDA</div>'), 'Debe incluir marca de agua VENCIDA');
    assert.ok(overdueHtml.includes('class="o_pdf_stamp is-overdue"'), 'Debe incluir sello VENCIDA');

    // 3g. Representación Gráfica - Descuentos en Líneas
    const discountedInvoice = {
      ...mockInvoice,
      lines: [
        { name: 'Perfil Ventana Serie 3825', quantity: 10, uom: 'Metro Lineal', price_unit: 100000, discount: 10, tax_rate: 19, subtotal: 900000 }
      ]
    };
    const discHtml = renderInvoicePdfSheetHtml(discountedInvoice);
    assert.ok(discHtml.includes('Dcto.'), 'Debe incluir columna Dcto. cuando hay descuento');
    assert.ok(discHtml.includes('-10%'), 'Debe reflejar el porcentaje de descuento en la línea');

    // 3h. Representación Gráfica - Discriminación de Retenciones en la Fuente (Retefuente 2.5% y ReteICA 0.414%)
    const retainedInvoice = {
      ...mockInvoice,
      amount_untaxed: 1000000,
      amount_tax: 190000,
      amount_total: 1190000,
      retention_source_rate: 2.5,
      retention_source_amount: 25000,
      retention_ica_rate: 0.414,
      retention_ica_amount: 4140,
      amount_net: 1160860
    };
    const retHtml = renderInvoicePdfSheetHtml(retainedInvoice);
    assert.ok(retHtml.includes('Retefuente (2.5%)'), 'Debe incluir fila de Retefuente 2.5%');
    assert.ok(retHtml.includes('25.000'), 'Debe reflejar el monto de la Retefuente');
    assert.ok(retHtml.includes('ReteICA (0.414%)'), 'Debe incluir fila de ReteICA 0.414%');
    assert.ok(retHtml.includes('4.140'), 'Debe reflejar el monto de ReteICA');
    assert.ok(retHtml.includes('NETO A PAGAR:'), 'Debe mostrar el valor NETO A PAGAR liquidado');
    assert.ok(retHtml.includes('1.160.860'), 'Debe reflejar el valor neto a pagar');
  });

  it('Module 2 (Gastos Simplificado & IA): creación directa de gasto manual, borrado de gasto, escaneo con IA y eliminación de pestañas/estados burocráticos', async () => {
    // 1. Direct manual expense creation
    const expRes = await req('/api/expenses', 'POST', {
      name: 'Compra de Perfiles de Aluminio Estructural',
      partner_name: 'Distribuidora Metálica SAS',
      receipt_ref: 'FAC-9912',
      quantity: 1,
      price_unit: 450000,
      total_amount: 450000,
      tax_rate: 0,
      payment_mode: 'company_account',
      notes: 'Factura física escaneada'
    });
    assert.equal(expRes.status, 200);
    assert.ok(expRes.json.ok);
    assert.equal(expRes.json.expense.name, 'Compra de Perfiles de Aluminio Estructural');
    assert.equal(expRes.json.expense.total_amount, 450000);
    assert.equal(expRes.json.expense.partner_name, 'Distribuidora Metálica SAS');
    const createdExpId = expRes.json.expense.id;

    // 2. Direct expense deletion
    const delRes = await req(`/api/expenses/${createdExpId}`, 'DELETE');
    assert.equal(delRes.status, 200);
    assert.ok(delRes.json.ok);
    assert.ok(!delRes.json.state.expenses.some((e) => Number(e.id) === Number(createdExpId)));

    // 3. AI Scan endpoint validation (handles missing image gracefully)
    const badScanRes = await req('/api/expenses/ai-scan', 'POST', {});
    assert.equal(badScanRes.status, 400);

    // 4. Frontend contract checks: APPS.expenses submenus are empty, camera modal exists, action buttons exist
    const jsText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');
    const htmlText = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    assert.ok(htmlText.includes('id="expenseAiCameraDialog"'), 'Camera AI modal must exist in HTML');
    assert.ok(htmlText.includes('id="cameraVideo"'), 'Camera modal must have video viewfinder');
    assert.ok(htmlText.includes('id="btnCapturePhoto"'), 'Camera modal must have capture button');
    assert.ok(htmlText.includes('id="cameraFileInput"'), 'Camera modal must have file upload fallback');
    assert.ok(jsText.includes('openExpenseCameraDialog'), 'JS must define openExpenseCameraDialog');
    assert.ok(jsText.includes('btnExpensesBannerNew'), 'Expenses banner must include New Manual Expense button');
    assert.ok(jsText.includes('btnExpensesBannerScan'), 'Expenses banner must include AI camera scan button');
  });

  it('Module 2 (Gastos & Proveedores IA): auto-creación de proveedor y fuzzy matching riguroso para variaciones de razón social (ej: Tuberia vs Tuberia SAS)', async () => {
    // 1. Gasto con nuevo proveedor "Tubería"
    const exp1 = await req('/api/expenses', 'POST', {
      name: 'Tubos estructurales 2 pulgadas',
      partner_name: 'Tubería',
      supplier_vat: '900.555.444-1',
      receipt_ref: 'FAC-001',
      total_amount: 320000,
      quantity: 1,
      price_unit: 320000
    });
    assert.equal(exp1.status, 200);
    assert.ok(exp1.json.ok);
    assert.ok(exp1.json.expense.partner_id > 0, 'Must link to auto-created contact');
    const partnerId = exp1.json.expense.partner_id;

    // Verificar que el proveedor fue creado en contactos con rol Proveedor
    const createdContact = exp1.json.state.contacts.find((c) => Number(c.id) === Number(partnerId));
    assert.ok(createdContact, 'Supplier must exist in contacts list');
    assert.equal(createdContact.supplier_rank, 1, 'Supplier must have supplier_rank = 1');
    assert.equal(createdContact.customer_rank, 0, 'Supplier must have customer_rank = 0');
    assert.equal(createdContact.is_company, true);
    assert.equal(createdContact.vat, '900.555.444-1');

    const contactCountBefore = exp1.json.state.contacts.length;

    // 2. Segundo gasto con variación "TUBERIA S.A.S." (misma empresa con sufijo comercial y mayúsculas)
    const exp2 = await req('/api/expenses', 'POST', {
      name: 'Codos y uniones PVC',
      partner_name: 'TUBERIA S.A.S.',
      receipt_ref: 'FAC-002',
      total_amount: 150000,
      quantity: 1,
      price_unit: 150000
    });
    assert.equal(exp2.status, 200);
    assert.ok(exp2.json.ok);
    assert.equal(exp2.json.expense.partner_id, partnerId, 'Fuzzy matching must recognize TUBERIA S.A.S. as existing Tubería');
    assert.equal(exp2.json.state.contacts.length, contactCountBefore, 'Must NOT create duplicate contact for TUBERIA S.A.S.');

    // 3. Tercer gasto con variación plural "Tuberías"
    const exp3 = await req('/api/expenses', 'POST', {
      name: 'Abrazaderas galvanizadas',
      partner_name: 'Tuberías',
      receipt_ref: 'FAC-003',
      total_amount: 80000,
      quantity: 1,
      price_unit: 80000
    });
    assert.equal(exp3.status, 200);
    assert.equal(exp3.json.expense.partner_id, partnerId, 'Must recognize Tuberías as existing Tubería');
    assert.equal(exp3.json.state.contacts.length, contactCountBefore, 'Must NOT create duplicate contact for Tuberías');

    // 4. Gasto con un proveedor verdaderamente distinto ("Ferretería El Tornillo")
    const exp4 = await req('/api/expenses', 'POST', {
      name: 'Tornillos autorroscantes',
      partner_name: 'Ferretería El Tornillo',
      receipt_ref: 'FAC-004',
      total_amount: 45000,
      quantity: 1,
      price_unit: 45000
    });
    assert.equal(exp4.status, 200);
    assert.notEqual(exp4.json.expense.partner_id, partnerId, 'Different supplier must get new partner_id');
    assert.equal(exp4.json.state.contacts.length, contactCountBefore + 1, 'Must create new contact for Ferretería El Tornillo');
  });
  it('Gastos & Contabilidad: auto-generación de factura proveedor (BILL) con tabla de artículos, NIT bajo proveedor, y tablero contable simplificado', async () => {
    // 1. Crear gasto con múltiples artículos en la tabla
    const expRes = await req('/api/expenses', 'POST', {
      name: 'Compra de Insumos Metalmecánicos',
      partner_name: 'Soluciones Industriales SAS',
      supplier_vat: '901.888.777-3',
      receipt_ref: 'FAC-7701',
      date: '2026-10-28',
      items: [
        { description: 'Platinas de Acero 1/4', quantity: 10, price_unit: 25000, subtotal: 250000 },
        { description: 'Electrodos 6013 1/8', quantity: 2, price_unit: 45000, subtotal: 90000 }
      ]
    });

    assert.equal(expRes.status, 200);
    assert.ok(expRes.json.ok);
    const exp = expRes.json.expense;
    assert.equal(exp.total_amount, 340000);
    assert.equal(exp.supplier_vat, '901.888.777-3');
    assert.equal(exp.items.length, 2);
    assert.ok(exp.move_id > 0, 'Expense must link to automatically generated vendor bill');

    // 2. Verificar que la factura de proveedor (BILL) existe, está publicada y pagada de una
    const bill = expRes.json.state.accounting.moves.find((m) => Number(m.id) === Number(exp.move_id));
    assert.ok(bill, 'Vendor bill must exist in accounting moves');
    assert.equal(bill.move_type, 'in_invoice', 'Vendor bill must be move_type in_invoice');
    assert.equal(bill.state, 'posted', 'Vendor bill must be auto-posted');
    assert.equal(bill.amount_total, 340000);
    assert.equal(bill.payment_state, 'paid', 'Vendor bill must be paid automatically since proveedores se paga de una');
    assert.equal(bill.amount_residual, 0, 'Vendor bill residual must be 0');
    assert.equal(bill.lines.length, 2, 'Vendor bill must have 2 lines from the items table');
    assert.equal(bill.lines[0].name, 'Platinas de Acero 1/4');
    assert.equal(bill.lines[0].quantity, 10);
    assert.equal(bill.lines[0].price_unit, 25000);

    // 3. Frontend checks
    const jsText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');
    assert.ok(jsText.includes("defaultSubmenu: 'dashboard'"), 'Contabilidad debe abrir por defecto en el tablero');
    assert.ok(jsText.includes('<span class="o_stat_label">Total de Ingresos</span>'), 'Tarjeta debe llamarse Total de Ingresos');
    assert.ok(!jsText.includes('<span class="o_stat_label">Cuentas por Pagar (Proveedores)</span>'), 'Tarjeta de Cuentas por Pagar debe eliminarse del banner');
    assert.ok(jsText.includes('id="fExpPartnerVat"'), 'NIT debe tener campo debajo de proveedor');
    assert.ok(jsText.includes('id="expenseItemsTable"'), 'Debe existir tabla estructurada de artículos del gasto');
    assert.ok(jsText.includes('btnAddExpenseItem'), 'Debe existir botón para agregar artículos');
  });
  it('Trazabilidad e Identificadores: navegación entre módulos conserva retorno y muestra códigos reales (EXP, INV, SO, etc.) en vez de #IDs', async () => {
    // 1. Verificar settings de la empresa
    const bootRes = await req('/api/bootstrap', 'GET');
    assert.equal(bootRes.status, 200);
    assert.ok(!bootRes.json.data.settings.company_name.includes('GH'), 'Company name must not contain GH');

    // 2. Frontend verification
    const jsText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');
    assert.ok(jsText.includes('function getRecordIdentifier(appId, submenu, recordId)'), 'Must define getRecordIdentifier');
    assert.ok(!jsText.includes("recLabel = state.activeRecordId === 'new' ? 'Nuevo' : `#${state.activeRecordId}`;"), 'Must not fallback to bare #id in breadcrumbs');
    assert.ok(jsText.includes('crumbTraceReturn'), 'Must provide crumbTraceReturn breadcrumb for navigation traceability');
    assert.ok(jsText.includes('state.navStack'), 'Must support state.navStack for returning to originating module');
    assert.ok(jsText.includes('btnGoToOriginDoc'), 'Must support jumping to origin document');
  });
  it('Persistencia y Trazabilidad del Chatter: los eventos se acumulan sin sobreescribirse ni borrarse tras sincronización y no hay botón Volver redundante en Gastos', async () => {
    // 1. Verificar que el botón "Volver" redundante al lado de Eliminar Gasto fue eliminado
    const jsText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');
    assert.ok(!jsText.includes('id="btnCancelExpense"'), 'El botón Volver redundante en el formulario de gastos debe ser eliminado');

    // 2. Crear una cotización de venta
    const partnerRes = await req('/api/contacts', 'POST', { name: 'Cliente Chatter Trazabilidad S.A.S.' });
    assert.equal(partnerRes.status, 200);
    const partnerId = partnerRes.json.contact.id;

    const saleRes = await req('/api/sales', 'POST', {
      partner_id: partnerId,
      lines: [{ description: 'Ventana Corrediza Aluminio', quantity: 2, price_unit: 150000, tax_rate: 19 }]
    });
    assert.equal(saleRes.status, 200);
    const saleId = saleRes.json.order.id;
    const saleName = saleRes.json.order.name;

    // Verificar mensaje inicial de creación
    assert.ok(saleRes.json.order.chatter.length >= 1, 'Debe registrar mensaje de creación');
    assert.ok(saleRes.json.order.chatter.some((m) => m.text.includes('creada')), 'Debe incluir texto de cotización creada');

    // 3. Marcar como enviada
    const sendRes = await req(`/api/sales/${saleId}/action`, 'POST', { action: 'send' });
    assert.equal(sendRes.status, 200);
    assert.ok(sendRes.json.order.chatter.length >= 2, 'Chatter debe conservar mensaje de creación y de envío');
    assert.ok(sendRes.json.order.chatter.some((m) => m.text.includes('creada')));
    assert.ok(sendRes.json.order.chatter.some((m) => m.text.includes('enviada')));

    // 4. Confirmar pedido (la acción crucial mencionada por el usuario)
    const confirmRes = await req(`/api/sales/${saleId}/action`, 'POST', { action: 'confirm' });
    assert.equal(confirmRes.status, 200);
    assert.ok(confirmRes.json.order.chatter.length >= 3, 'Chatter NO debe sobreescribirse al confirmar pedido');
    assert.ok(confirmRes.json.order.chatter.some((m) => m.text.includes('creada')));
    assert.ok(confirmRes.json.order.chatter.some((m) => m.text.includes('enviada')));
    assert.ok(confirmRes.json.order.chatter.some((m) => m.text.includes('confirmada')));

    // 5. Agregar una nota manual de seguimiento
    const noteRes = await req('/api/chatter', 'POST', {
      model: 'sales',
      id: saleId,
      text: 'Cliente solicitó entrega para el próximo viernes.'
    });
    assert.equal(noteRes.status, 200);
    assert.ok(noteRes.json.record.chatter.some((m) => m.text.includes('próximo viernes')));
    const chatterCountBeforeSync = noteRes.json.record.chatter.length;
    assert.ok(chatterCountBeforeSync >= 4, 'Chatter debe acumular la nota manual');

    // 6. Ejecutar sincronización (ensureSynced(0)) y verificar que el chatter persista sin borrarse
    if (server.store && server.store.ensureSynced) {
      await server.store.ensureSynced(0);
    }
    const stateAfterSync = server.store.getBootstrapState();
    const syncedSale = stateAfterSync.sales.find((s) => Number(s.id) === Number(saleId));
    assert.ok(syncedSale, 'El pedido debe existir en el estado sincronizado');
    assert.equal(syncedSale.chatter.length, chatterCountBeforeSync, 'El chatter debe persistir y no ser borrado a [] tras la sincronización');
    assert.ok(syncedSale.chatter.some((m) => m.text.includes('próximo viernes')));
    assert.ok(syncedSale.chatter.some((m) => m.text.includes('confirmada')));
    assert.ok(syncedSale.chatter.some((m) => m.text.includes('creada')));

    // 7. Crear factura desde el pedido y verificar trazabilidad en el pedido y en la factura
    const invRes = await req(`/api/sales/${saleId}/action`, 'POST', { action: 'create_invoice', amount: 357000 });
    assert.equal(invRes.status, 200);
    assert.ok(invRes.json.order.chatter.some((m) => m.text.includes('Factura de cliente')));
    assert.ok(invRes.json.invoice.chatter.some((m) => m.text.includes('creada')));
  });

  it('Module 4 (Contabilidad & Tesorería): Tablero financiero con recaudos reales, gastos, gráficas SVG, desglose por cuenta (Nequi, Daviplata, Efectivo) y gestión de diarios', async () => {
    // 1. Crear nuevo diario financiero vía API
    const journalRes = await req('/api/accounting/journals', 'POST', {
      code: 'DVP2',
      name: 'Daviplata Negocio Secundario',
      type: 'bank',
      balance: 500000
    });
    assert.equal(journalRes.status, 200);
    assert.equal(journalRes.json.journal.code, 'DVP2');
    assert.equal(journalRes.json.journal.balance, 500000);

    // 2. Verificar que aparezca en el bootstrap
    const bootRes = await req('/api/bootstrap', 'GET');
    assert.equal(bootRes.status, 200);
    const journals = bootRes.json.data.accounting.journals;
    const foundDvp2 = journals.find((j) => j.code === 'DVP2');
    assert.ok(foundDvp2, 'El diario DVP2 debe existir en bootstrap');

    // 3. Crear gasto pagado con DVP2
    const expRes = await req('/api/expenses', 'POST', {
      name: 'Compra de Perfiles de Aluminio',
      partner_name: 'Aluminios Pereira SAS',
      partner_vat: '900888777-1',
      total_amount: 150000,
      journal_code: 'DVP2',
      payment_mode: 'company_account',
      items: [{ description: 'Perfiles 2x1', quantity: 3, price_unit: 50000, subtotal: 150000 }]
    });
    assert.equal(expRes.status, 200);
    assert.equal(expRes.json.expense.journal_code, 'DVP2');

    // 4. Verificar que se descontó del saldo de DVP2
    const stateAfterExpense = server.store.getBootstrapState();
    const dvp2After = stateAfterExpense.accounting.journals.find((j) => j.code === 'DVP2');
    assert.equal(dvp2After.balance, 350000, 'Saldo de DVP2 debe descontarse de 500.000 a 350.000');

    // 5. Verificar KPIs financieros extendidos
    const kpis = stateAfterExpense.kpis;
    assert.ok(typeof kpis.collected_revenue === 'number', 'KPI collected_revenue debe ser numérico');
    assert.ok(typeof kpis.expenses_paid_total === 'number', 'KPI expenses_paid_total debe ser numérico');
    assert.ok(typeof kpis.net_cash_balance === 'number', 'KPI net_cash_balance debe ser numérico');
    assert.equal(kpis.net_cash_balance, Math.round((kpis.collected_revenue - kpis.expenses_paid_total) * 100) / 100);

    assert.ok(Array.isArray(kpis.accounts_summary), 'accounts_summary debe ser un arreglo');
    const dvpSummary = kpis.accounts_summary.find((a) => a.code === 'DVP2');
    assert.ok(dvpSummary, 'accounts_summary debe incluir DVP2');
    assert.equal(dvpSummary.outbound_total, 150000, 'DVP2 outbound_total debe reflejar el gasto');

    assert.ok(kpis.current_month_financials, 'current_month_financials debe existir');
    assert.ok(Array.isArray(kpis.monthly_financials), 'monthly_financials debe ser un arreglo');
    assert.equal(kpis.monthly_financials.length, 6, 'monthly_financials debe contener 6 meses');
    assert.ok(Array.isArray(kpis.inflow_by_account), 'inflow_by_account debe ser un arreglo');
    assert.ok(Array.isArray(kpis.expense_breakdown), 'expense_breakdown debe ser un arreglo');
    assert.ok(Array.isArray(kpis.recent_cash_flows), 'recent_cash_flows debe ser un arreglo');
    assert.ok(kpis.recent_cash_flows.some((f) => f.journal_code === 'DVP2' && f.amount === 150000));

    // 6. Verificación de frontend en app.js y odoo20.css
    const jsText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');
    const cssText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'odoo20.css'), 'utf8');

    assert.ok(jsText.includes('generateMonthBalanceSvg'), 'app.js debe definir generateMonthBalanceSvg');
    assert.ok(jsText.includes('generateTrendSvg'), 'app.js debe definir generateTrendSvg');
    assert.ok(jsText.includes('generateDonutSvg'), 'app.js debe definir generateDonutSvg');
    assert.ok(jsText.includes('Total Recaudado (Cobros Reales)'), 'app.js debe tener tarjeta de Total Recaudado');
    assert.ok(jsText.includes('Total Gastos / Compras'), 'app.js debe tener tarjeta de Total Gastos');
    assert.ok(jsText.includes('Balance Neto en Cajas y Bancos'), 'app.js debe tener tarjeta de Balance Neto');
    assert.ok(jsText.includes('o_financial_grid'), 'app.js debe renderizar o_financial_grid');
    assert.ok(jsText.includes('o_chart_card'), 'app.js debe renderizar o_chart_card');
    assert.ok(jsText.includes('id="btnAddJournal"'), 'app.js debe tener botón para agregar diarios financieros');

    assert.ok(cssText.includes('.o_financial_grid'), 'odoo20.css debe contener estilos para .o_financial_grid');
    assert.ok(cssText.includes('.o_chart_card'), 'odoo20.css debe contener estilos para .o_chart_card');
    assert.ok(cssText.includes('.o_chart_tabs'), 'odoo20.css debe contener estilos para .o_chart_tabs');
  });

  it('Module 3 (Ventas & Cotizaciones): Representación gráfica profesional en cotización con vista previa PDF en vivo, descargas y marcas de agua de cotización', async () => {
    const jsText = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');

    // 1. Verificación estática de funciones y layout en app.js
    assert.ok(jsText.includes('function renderSalePdfSheetHtml(sale)'), 'app.js debe definir renderSalePdfSheetHtml');
    assert.ok(jsText.includes('function downloadSalePdf(sale, autoPrint = false)'), 'app.js debe definir downloadSalePdf');
    assert.ok(jsText.includes('id="btnPrintSalePdf"'), 'Debe existir botón para imprimir cotización');
    assert.ok(jsText.includes('id="btnDownloadSalePdf"'), 'Debe existir botón para descargar cotización');
    assert.ok(jsText.includes('id="salePdfSheet"'), 'Debe existir contenedor salePdfSheet para la hoja');

    // 2. Ejecutar renderSalePdfSheetHtml en contexto VM
    const vm = require('node:vm');
    const fnModule = { exports: {} };
    const evalEnv = `
      const state = {
        data: {
          settings: {
            company_name: 'CH Aluminios',
            company_vat: '900.876.543-1',
            company_address: 'Cra. 7 #18-45',
            company_city: 'Pereira',
            company_country: 'Colombia',
            company_email: 'chappdevm@gmail.com',
            currency_symbol: '$'
          },
          contacts: [
            { id: 25, name: 'Constructora Risaralda SAS', doc_type: 'NIT', vat: '900.555.444-3', street: 'Av. Circunvalar #12-30', city: 'Pereira', state_name: 'Risaralda', mobile: '3109998877', phone: '3334455', email: 'compras@constructorarisaralda.com', payment_term: '30 Días' }
          ]
        }
      };
      function esc(str) { return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
      function formatMoney(amount, currency = '$') { const num = Number(amount) || 0; return currency + ' ' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
      
      ${jsText.substring(jsText.indexOf('function numberToWordsSpanish'), jsText.indexOf('function renderSaleOrderForm'))}
      
      module.exports = { numberToWordsSpanish, renderSalePdfSheetHtml };
    `;
    const script = new vm.Script(evalEnv);
    const context = vm.createContext({ module: fnModule, console, Math, Array, String, Number, Boolean, encodeURIComponent });
    script.runInContext(context);
    const { renderSalePdfSheetHtml } = fnModule.exports;

    // 3. Probar renderizado en estado Cotización (draft)
    const mockDraftQuote = {
      id: 50,
      name: 'COT/2026/0001',
      partner_id: 25,
      date_order: '2026-10-28',
      validity_date: '2026-11-28',
      salesperson: 'Laura Gómez',
      payment_term: '30 Días',
      state: 'draft',
      lines: [
        { name: 'Ventana Corrediza Serie 744', description: 'Aluminio blanco con vidrio 4mm', quantity: 2, price_unit: 450000, discount: 0, tax_rate: 19, subtotal: 900000 }
      ],
      amount_untaxed: 900000,
      amount_tax: 171000,
      amount_total: 1071000
    };

    const draftHtml = renderSalePdfSheetHtml(mockDraftQuote);
    assert.ok(draftHtml.includes('COTIZACIÓN'), 'Marca de agua o título debe incluir COTIZACIÓN');
    assert.ok(draftHtml.includes('Cotización'), 'Caja de documento debe decir Cotización');
    assert.ok(draftHtml.includes('COT/2026/0001'), 'Debe mostrar el número de la cotización');
    assert.ok(draftHtml.includes('Constructora Risaralda SAS'), 'Debe mostrar el cliente');
    assert.ok(draftHtml.includes('Ventana Corrediza Serie 744'), 'Debe mostrar el producto');
    assert.ok(draftHtml.includes('$ 1.071.000'), 'Debe mostrar el total calculado');
    assert.ok(draftHtml.includes('SON: UN MILLÓN SETENTA Y UN MIL PESOS M/CTE'), 'Debe mostrar el total en letras');
    assert.ok(draftHtml.includes('Esta cotización comercial es una propuesta informativa'), 'Debe tener pie legal de cotización');

    // 4. Probar renderizado en estado Confirmado (sale)
    const mockConfirmedOrder = {
      ...mockDraftQuote,
      name: 'SO-00042',
      state: 'sale'
    };
    const saleHtml = renderSalePdfSheetHtml(mockConfirmedOrder);
    assert.ok(saleHtml.includes('Pedido de Venta'), 'Debe decir Pedido de Venta cuando está confirmado');
    assert.ok(saleHtml.includes('PEDIDO CONFIRMADO'), 'Marca de agua debe decir PEDIDO CONFIRMADO');
  });
});
