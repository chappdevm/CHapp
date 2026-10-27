process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createAppServer } = require('../index');

describe('CHapp ERP (Odoo 20 Base) — End-to-End API & Workflow Suite', () => {
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

  it('serves the Odoo 20 Home Menu HTML, CSS, JS, and all 5 custom PNG module icons', async () => {
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
  });

  it('bootstraps clean Odoo 20 state with all 5 modules initialized', async () => {
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

  it('Module 2 (Gastos -> Contabilidad): runs full Odoo 20 expense workflow (draft -> submit -> approve -> post journal entry -> pay)', async () => {
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
    assert.ok(htmlText.includes('<title>GH Aluminios ERP</title>'), 'Browser tab title must be GH Aluminios ERP without Odoo 20');
    assert.ok(!htmlText.includes('ERP — Odoo 20'), 'HTML title must not contain Odoo 20');
    assert.ok(jsText.includes("state.activeRecordId = null;\n          state.viewType = 'kanban';"), 'Creating new contact must redirect back to kanban view');

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
    assert.ok(appJsContent.includes('GH Aluminios'), 'app.js PDF helper must include GH Aluminios branding');
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
});


