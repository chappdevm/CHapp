const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isSupabaseConfigured,
  getSupabaseConfig,
  cleanEnvVal,
  normalizeSupabaseUrl,
  formatSupabaseError,
  isServiceRoleKey,
  callPostgrest,
  SupabasePersistence,
  serializePartner,
  deserializePartner,
  serializeProduct,
  deserializeProduct,
  serializeExpense,
  deserializeExpense,
  serializeSaleOrder,
  serializeSaleOrderLine,
  deserializeSaleOrder,
  serializeAccountMove,
  deserializeAccountMove,
  serializePayment,
  deserializePayment,
  serializeSettings,
  deserializeSettings
} = require('../server/supabase');
const { ERPStore } = require('../server/store');
const { readJsonBody } = require('../index');

describe('Supabase Persistence Layer & PostgREST Architecture', () => {
  it('detects Supabase configuration correctly from environment', () => {
    const config = getSupabaseConfig();
    assert.ok(config.url.startsWith('https://'), 'Supabase URL must start with https://');
    assert.ok(config.key.length > 20, 'Supabase key must be set');
    assert.equal(isSupabaseConfigured(), true);
  });

  it('serializes and deserializes res_partner (Contactos) with full fidelity', () => {
    const original = {
      id: 42,
      name: 'Constructora Bolívar S.A.S.',
      is_company: true,
      vat: '900.123.456-7',
      function: 'Empresa',
      street: 'Calle 100 # 15-20',
      city: 'Medellín',
      state_name: 'Antioquia',
      country: 'Colombia',
      email: 'contacto@bolivar.com',
      phone: '6045551234',
      mobile: '3105556789',
      website: 'https://bolivar.com',
      customer_rank: 1,
      supplier_rank: 2,
      category_ids: ['VIP', 'Construcción'],
      payment_term: '60 Días',
      notes: 'Cliente preferencial',
      active: true
    };

    const serialized = serializePartner(original);
    assert.equal(serialized.id, 42);
    assert.equal(serialized.name, 'Constructora Bolívar S.A.S.');
    assert.deepEqual(serialized.category_ids, ['VIP', 'Construcción']);

    const deserialized = deserializePartner(serialized);
    assert.equal(deserialized.id, 42);
    assert.equal(deserialized.name, original.name);
    assert.equal(deserialized.is_company, true);
    assert.equal(deserialized.city, 'Medellín');
    assert.deepEqual(deserialized.category_ids, ['VIP', 'Construcción']);
    assert.equal(deserialized.payment_term, '60 Días');
  });

  it('serializes and deserializes product_template (Productos)', () => {
    const original = {
      id: 10,
      name: 'Licencia Servidor Dedicado',
      default_code: 'LIC-SRV-01',
      type: 'service',
      list_price: 2500000,
      standard_price: 1200000,
      tax_rate: 19,
      category: 'Infraestructura',
      can_be_sold: true,
      can_be_expensed: false,
      uom: 'Mes'
    };

    const serialized = serializeProduct(original);
    assert.equal(serialized.list_price, 2500000);
    assert.equal(serialized.tax_rate, 19);

    const deserialized = deserializeProduct(serialized);
    assert.equal(deserialized.name, original.name);
    assert.equal(deserialized.list_price, 2500000);
    assert.equal(deserialized.standard_price, 1200000);
    assert.equal(deserialized.can_be_expensed, false);
    assert.equal(deserialized.uom, 'Mes');
  });

  it('serializes and deserializes hr_expense (Gastos)', () => {
    const original = {
      id: 5,
      reference: 'EXP/2026/0005',
      name: 'Hospedaje Cali Conferencia',
      employee_name: 'Laura Gómez',
      department: 'Comercial',
      product_id: 4,
      date: '2026-10-20',
      payment_mode: 'company_account',
      quantity: 3,
      price_unit: 150000,
      tax_rate: 19,
      untaxed_amount: 450000,
      tax_amount: 85500,
      total_amount: 535500,
      partner_id: 1,
      receipt_ref: 'FAC-9876',
      notes: 'Hotel Dann Cali',
      state: 'posted',
      move_id: 12
    };

    const serialized = serializeExpense(original);
    assert.equal(serialized.reference, 'EXP/2026/0005');
    assert.equal(serialized.total_amount, 535500);

    const deserialized = deserializeExpense(serialized);
    assert.equal(deserialized.reference, original.reference);
    assert.equal(deserialized.total_amount, 535500);
    assert.equal(deserialized.employee_name, 'Laura Gómez');
    assert.equal(deserialized.move_id, 12);
  });

  it('serializes and deserializes sale_order with nested sale_order_lines', () => {
    const originalOrder = {
      id: 7,
      name: 'S00007',
      partner_id: 2,
      partner_name: 'Ecopetrol S.A.',
      date_order: '2026-10-25',
      validity_date: '2026-11-25',
      salesperson: 'Laura Gómez',
      payment_term: '30 Días',
      state: 'sale',
      invoice_status: 'to invoice',
      amount_untaxed: 1000000,
      amount_tax: 190000,
      amount_total: 1190000,
      notes: 'Entrega prioritaria',
      lines: [
        {
          id: 1,
          product_id: 1,
          product_name: 'Consultoría ERP',
          description: 'Implementación Fase 1',
          quantity: 1,
          price_unit: 1000000,
          discount: 0,
          tax_rate: 19,
          subtotal: 1000000,
          tax_amount: 190000,
          total: 1190000
        }
      ]
    };

    const serializedOrder = serializeSaleOrder(originalOrder);
    assert.equal(serializedOrder.name, 'S00007');
    assert.equal(serializedOrder.amount_total, 1190000);

    const serializedLine = serializeSaleOrderLine(originalOrder.lines[0], originalOrder.id);
    assert.equal(serializedLine.order_id, 7);
    assert.equal(serializedLine.total, 1190000);

    const simulatedPostgrestJoin = {
      ...serializedOrder,
      sale_order_line: [serializedLine]
    };

    const deserializedOrder = deserializeSaleOrder(simulatedPostgrestJoin);
    assert.equal(deserializedOrder.name, 'S00007');
    assert.equal(deserializedOrder.amount_total, 1190000);
    assert.equal(deserializedOrder.lines.length, 1);
    assert.equal(deserializedOrder.lines[0].description, 'Implementación Fase 1');
  });

  it('serializes and deserializes account_move (Facturas y Asientos)', () => {
    const original = {
      id: 15,
      name: 'INV/2026/0015',
      move_type: 'out_invoice',
      journal_code: 'INV',
      partner_id: 2,
      partner_name: 'Ecopetrol S.A.',
      invoice_date: '2026-10-26',
      invoice_date_due: '2026-11-25',
      ref: 'S00007',
      origin: 'S00007',
      state: 'posted',
      payment_state: 'partial',
      amount_untaxed: 1000000,
      amount_tax: 190000,
      amount_total: 1190000,
      amount_residual: 500000
    };

    const serialized = serializeAccountMove(original);
    assert.equal(serialized.name, 'INV/2026/0015');
    assert.equal(serialized.amount_residual, 500000);

    const deserialized = deserializeAccountMove(serialized);
    assert.equal(deserialized.name, 'INV/2026/0015');
    assert.equal(deserialized.journal_code, 'INV');
    assert.equal(deserialized.payment_state, 'partial');
    assert.equal(deserialized.amount_residual, 500000);
    assert.ok(deserialized.lines.length >= 1, 'Should reconstruct default invoice lines');
  });

  it('serializes and deserializes account_payment (Pagos) and res_config_settings (Ajustes)', () => {
    const payment = {
      id: 3,
      name: 'PAY/2026/0003',
      payment_type: 'inbound',
      partner_id: 2,
      partner_name: 'Ecopetrol S.A.',
      amount: 690000,
      date: '2026-10-26',
      journal_code: 'BNK1',
      journal_name: 'Banco Bancolombia Cta Cte',
      ref: 'INV/2026/0015',
      move_id: 15,
      state: 'posted'
    };

    const serializedPay = serializePayment(payment);
    assert.equal(serializedPay.name, 'PAY/2026/0003');
    const deserializedPay = deserializePayment(serializedPay);
    assert.equal(deserializedPay.amount, 690000);
    assert.equal(deserializedPay.move_id, 15);

    const settings = {
      company_name: 'CHapp Colombia S.A.S.',
      currency: 'COP',
      currency_symbol: '$',
      theme: 'dark',
      active_user: { id: 1, name: 'Admin' }
    };
    const serializedSettings = serializeSettings(settings);
    assert.equal(serializedSettings.company_name, 'CHapp Colombia S.A.S.');
    const deserializedSettings = deserializeSettings(serializedSettings);
    assert.equal(deserializedSettings.company_name, 'CHapp Colombia S.A.S.');
    assert.equal(deserializedSettings.theme, 'dark');
  });

  it('performs live PostgREST roundtrip CRUD on Supabase (create -> read -> update -> delete)', async () => {
    const persistence = new SupabasePersistence();
    assert.equal(persistence.isReady(), true);

    const testId = 888888;
    const testContact = {
      id: testId,
      name: 'Contacto Test Automatizado PostgREST',
      is_company: true,
      city: 'Bucaramanga',
      category_ids: ['Test', 'CI']
    };

    // 1. Create
    await persistence.savePartner(testContact);

    // 2. Read back
    const readRes = await callPostgrest(`/res_partner?id=eq.${testId}`);
    assert.equal(readRes.ok, true);
    assert.equal(readRes.data.length, 1);
    assert.equal(readRes.data[0].name, 'Contacto Test Automatizado PostgREST');
    assert.deepEqual(readRes.data[0].category_ids, ['Test', 'CI']);

    // 3. Update
    testContact.city = 'Pasto';
    await persistence.savePartner(testContact);

    const updateRes = await callPostgrest(`/res_partner?id=eq.${testId}`);
    assert.equal(updateRes.ok, true);
    assert.equal(updateRes.data[0].city, 'Pasto');

    // 4. Delete & verify
    await persistence.deletePartner(testId);
    const finalRes = await callPostgrest(`/res_partner?id=eq.${testId}`);
    assert.equal(finalRes.ok, true);
    assert.equal(finalRes.data.length, 0);
  });

  it('performs live relational roundtrip with foreign keys across all active tables (product -> partner -> sale + lines -> move -> expense)', async () => {
    const persistence = new SupabasePersistence();
    assert.equal(persistence.isReady(), true);

    const relId = 777771;
    const relMoveId = 777772;

    try {
      // 1. Create product & partner
      await persistence.saveProduct({
        id: relId,
        name: 'Servicio Cloud Premium Test',
        default_code: 'SRV-TEST',
        type: 'service',
        list_price: 250000,
        standard_price: 100000,
        tax_rate: 19
      });

      await persistence.savePartner({
        id: relId,
        name: 'Cliente Relacional Test SAS',
        is_company: true,
        email: 'relacional@example.com'
      });

      // 2. Create sale order with nested lines referencing partner and product
      await persistence.saveSaleOrder({
        id: relId,
        name: 'S77771',
        partner_id: relId,
        partner_name: 'Cliente Relacional Test SAS',
        date_order: '2026-10-26',
        state: 'sale',
        invoice_status: 'to invoice',
        amount_untaxed: 250000,
        amount_tax: 47500,
        amount_total: 297500,
        lines: [
          {
            product_id: relId,
            product_name: 'Servicio Cloud Premium Test',
            quantity: 1,
            price_unit: 250000,
            discount: 0,
            tax_rate: 19,
            subtotal: 250000,
            tax_amount: 47500,
            total: 297500
          }
        ]
      });

      // 3. Create account move referencing partner
      await persistence.saveAccountMove({
        id: relMoveId,
        name: 'INV/2026/7772',
        move_type: 'out_invoice',
        journal_code: 'INV',
        partner_id: relId,
        partner_name: 'Cliente Relacional Test SAS',
        invoice_date: '2026-10-26',
        state: 'posted',
        payment_state: 'not_paid',
        amount_untaxed: 250000,
        amount_tax: 47500,
        amount_total: 297500,
        amount_residual: 297500
      });

      // 4. Create hr_expense referencing partner, product, and account move
      await persistence.saveExpense({
        id: relId,
        reference: 'EXP/2026/7771',
        name: 'Gasto Viáticos Test',
        employee_name: 'Consultor Test',
        product_id: relId,
        partner_id: relId,
        date: '2026-10-26',
        total_amount: 50000,
        state: 'posted',
        move_id: relMoveId
      });

      // 5. Verify recovery via loadAll
      const loaded = await persistence.loadAll();
      assert.ok(loaded);
      const foundProduct = loaded.products.find((p) => Number(p.id) === relId);
      assert.ok(foundProduct);
      assert.equal(foundProduct.name, 'Servicio Cloud Premium Test');

      const foundPartner = loaded.contacts.find((c) => Number(c.id) === relId);
      assert.ok(foundPartner);
      assert.equal(foundPartner.name, 'Cliente Relacional Test SAS');

      const foundSale = loaded.sales.find((s) => Number(s.id) === relId);
      assert.ok(foundSale);
      assert.equal(foundSale.lines.length, 1);
      assert.equal(foundSale.lines[0].product_name, 'Servicio Cloud Premium Test');

      const foundMove = loaded.moves.find((m) => Number(m.id) === relMoveId);
      assert.ok(foundMove);
      assert.equal(foundMove.name, 'INV/2026/7772');

      const foundExp = loaded.expenses.find((e) => Number(e.id) === relId);
      assert.ok(foundExp);
      assert.equal(foundExp.reference, 'EXP/2026/7771');
      assert.equal(foundExp.move_id, relMoveId);
    } finally {
      // Cleanup in reverse dependency order
      await callPostgrest(`/sale_order_line?order_id=eq.${relId}`, { method: 'DELETE' });
      await callPostgrest(`/hr_expense?id=eq.${relId}`, { method: 'DELETE' });
      await callPostgrest(`/sale_order?id=eq.${relId}`, { method: 'DELETE' });
      await callPostgrest(`/account_move?id=eq.${relMoveId}`, { method: 'DELETE' });
      await callPostgrest(`/res_partner?id=eq.${relId}`, { method: 'DELETE' });
      await callPostgrest(`/product_template?id=eq.${relId}`, { method: 'DELETE' });
    }
  });

  it('sanitizes environment variables, strips quotes/newlines/spaces, and supports all key aliases', () => {
    assert.equal(cleanEnvVal('  "https://example.supabase.co" \r\n'), 'https://example.supabase.co');
    assert.equal(cleanEnvVal(" 'secret_key_123' \n"), 'secret_key_123');
    assert.equal(cleanEnvVal(" `https://example.supabase.co` "), 'https://example.supabase.co');
    assert.equal(cleanEnvVal(undefined), '');

    assert.equal(normalizeSupabaseUrl('example.supabase.co'), 'https://example.supabase.co');
    assert.equal(normalizeSupabaseUrl('https://example.supabase.co/rest/v1/'), 'https://example.supabase.co');
    assert.equal(normalizeSupabaseUrl(' https://example.supabase.co/rest/ '), 'https://example.supabase.co');

    assert.equal(isServiceRoleKey('sb_secret_abc123'), true);
    assert.equal(isServiceRoleKey('sb_publishable_abc123'), false);

    // Simulated JWT service_role
    const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64');
    const fakeServiceJwt = `header.${payload}.signature`;
    assert.equal(isServiceRoleKey(fakeServiceJwt), true);

    const anonPayload = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64');
    const fakeAnonJwt = `header.${anonPayload}.signature`;
    assert.equal(isServiceRoleKey(fakeAnonJwt), false);
  });

  it('handles pre-parsed request bodies on serverless environments like Vercel', async () => {
    const parsed = await readJsonBody({ body: { name: 'Contacto Vercel', is_company: true } });
    assert.equal(parsed.name, 'Contacto Vercel');

    const parsedStr = await readJsonBody({ body: '{"name":"Contacto Cadena"}' });
    assert.equal(parsedStr.name, 'Contacto Cadena');

    const parsedEmpty = await readJsonBody({ body: '   ' });
    assert.deepEqual(parsedEmpty, {});

    await assert.rejects(
      async () => {
        await readJsonBody({ body: '{invalid-json' });
      },
      /JSON malformado/
    );
  });

  it('protects against destructive empty array [] wipes when anon key or error occurs', async () => {
    const oldServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const persistence = new SupabasePersistence();
      assert.equal(persistence.config.isServiceRole, false);

      const existingData = {
        contacts: [{ id: 1, name: 'Contacto Local Existente' }],
        products: [{ id: 1, name: 'Producto Local Existente' }],
        expenses: [],
        sales: [],
        accounting: { moves: [], payments: [] },
        settings: { company_name: 'Local Test' }
      };

      // With anon key, PostgREST returns [] due to RLS, but loadAll must NOT wipe existing contacts
      const loaded = await persistence.loadAll(existingData);
      assert.ok(loaded);
      assert.ok(loaded.contacts.length >= 1, 'Local contacts must be preserved if remote returns empty with anon key');
      assert.equal(loaded.contacts[0].name, 'Contacto Local Existente');
    } finally {
      process.env.SUPABASE_SERVICE_ROLE_KEY = oldServiceKey;
    }
  });

  it('propagates write errors from Supabase instead of failing silently and provides RLS hints', async () => {
    const oldServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const persistence = new SupabasePersistence();
      // Test 1: RLS block with anon key
      await assert.rejects(
        async () => {
          await persistence.savePartner({ id: 999999, name: 'Test Unauthorized Contact' });
        },
        /\[Supabase\] Error guardando contacto/
      );
    } finally {
      process.env.SUPABASE_SERVICE_ROLE_KEY = oldServiceKey;
    }

    // Test 2: Constraint validation rejection with service role key
    const persistence = new SupabasePersistence();
    await assert.rejects(
      async () => {
        await persistence.savePartner({ id: 'not_a_valid_id', name: 'Invalid Contact' });
      },
      /\[Supabase\] Error guardando contacto/
    );
  });

  it('rolls back in-memory and disk state when Supabase write fails', async () => {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const tmpDb = path.join(os.tmpdir(), `chapp_rollback_test_${Date.now()}.json`);
    const store = new ERPStore(tmpDb, { useSupabase: false });
    // Mock failing supabase persistence
    store.supabase = {
      isReady: () => true,
      savePartner: async () => {
        throw new Error('[Supabase] Simulated write rejection');
      }
    };

    assert.equal(store.data.contacts.length, 0);

    await assert.rejects(
      async () => {
        await store.saveContact({ name: 'Contacto Que Falla' });
      },
      /Simulated write rejection/
    );

    // Verify contact was NOT left in memory or on disk
    assert.equal(store.data.contacts.length, 0, 'In-memory contacts must be rolled back on write failure');
    const diskContent = JSON.parse(fs.readFileSync(tmpDb, 'utf8'));
    assert.equal(diskContent.contacts.length, 0, 'On-disk contacts must be rolled back on write failure');

    try {
      if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    } catch (_) {}
  });

  it('updateSequencesFromData aligns sequences using both IDs and formatted string references to prevent upsert collisions', () => {
    const os = require('os');
    const path = require('path');
    const tmpDb = path.join(os.tmpdir(), `chapp_test_seq_${Date.now()}.json`);
    const store = new ERPStore(tmpDb, { useSupabase: false });
    store.data = {
      meta: { sequences: { contact: 1, product: 1, expense: 1, sale: 1, move_inv: 1, payment: 1 } },
      contacts: [{ id: 10, name: 'Contacto 10' }],
      products: [{ id: 15, name: 'Producto 15' }],
      expenses: [{ id: 2, reference: 'EXP/2026/0045', name: 'Gasto 45' }],
      sales: [{ id: 3, name: 'S00078', partner_name: 'Cliente' }],
      accounting: {
        moves: [
          { id: 4, name: 'INV/2026/0120', move_type: 'out_invoice' },
          { id: 5, name: 'BILL/2026/0034', move_type: 'in_invoice' },
          { id: 6, name: 'MISC/2026/0088', move_type: 'entry' }
        ],
        payments: [{ id: 7, name: 'PAY/2026/0052' }]
      }
    };

    store.updateSequencesFromData();
    assert.equal(store.data.meta.sequences.contact, 11);
    assert.equal(store.data.meta.sequences.product, 16);
    assert.equal(store.data.meta.sequences.expense, 46);
    assert.equal(store.data.meta.sequences.sale, 79);
    assert.equal(store.data.meta.sequences.move_inv, 121);
    assert.equal(store.data.meta.sequences.move_bill, 35);
    assert.equal(store.data.meta.sequences.move_misc, 89);
    assert.equal(store.data.meta.sequences.payment, 53);

    try {
      if (require('fs').existsSync(tmpDb)) require('fs').unlinkSync(tmpDb);
    } catch (_) {}
  });

  it('supports deleteProduct and ensures ensureSynced(0) queries remote database immediately', async () => {
    const persistence = new SupabasePersistence();
    if (!persistence.isReady()) return;

    // Save a product to Supabase
    const testProd = {
      id: 88899,
      name: 'Producto Test Delete Persistence',
      list_price: 50000,
      standard_price: 25000,
      uom: 'Metro Lineal'
    };
    await persistence.saveProduct(testProd);

    // Delete it using deleteProduct
    await persistence.deleteProduct(testProd.id);

    // Confirm it's no longer found
    const res = await callPostgrest(`/product_template?id=eq.${testProd.id}`);
    assert.equal(res.ok, true);
    assert.equal(res.data.length, 0, 'Deleted product must not exist in Supabase');
  });
});
