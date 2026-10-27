const fs = require('fs');
const path = require('path');
const { SupabasePersistence, isSupabaseConfigured } = require('./supabase');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function nowISO() {
  return new Date().toISOString();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date((dateStr || todayStr()) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function round2(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function createInitialData() {
  return {
  "meta": {
    "version": "20.0.1.0",
    "based_on": "Odoo 20 Enterprise",
    "sequences": {
      "contact": 1,
      "product": 1,
      "expense": 1,
      "sale": 1,
      "move_inv": 1,
      "move_bill": 1,
      "move_misc": 1,
      "payment": 1,
      "account": 12,
      "tax": 5
    }
  },
  "settings": {
    "company_name": "GH Aluminios",
    "company_vat": "",
    "company_email": "chappdevm@gmail.com",
    "company_phone": "",
    "company_city": "Bogotá D.C.",
    "company_country": "Colombia",
    "company_address": "",
    "currency": "COP",
    "currency_symbol": "$",
    "theme": "dark",
    "quotation_validity_days": 30,
    "enable_line_discounts": true,
    "default_sale_tax": 19,
    "default_purchase_tax": 19,
    "fiscal_regime": "Responsable de IVA - Régimen Ordinario",
    "expense_approval_required": true,
    "expense_default_journal": "EXJ",
    "default_bank_journal": "BNK1",
    "sale_terms": "Condiciones de pago y entrega según cotización.",
    "active_user": {
      "id": 1,
      "name": "Administrador CHapp",
      "email": "chappdevm@gmail.com",
      "role": "Administrador General"
    },
    "users": [
      {
        "id": 1,
        "name": "Administrador CHapp",
        "email": "chappdevm@gmail.com",
        "role": "Administrador General",
        "active": true
      }
    ]
  },
  "contacts": [],
  "products": [],
  "expenses": [],
  "sales": [],
  "accounting": {
    "journals": [
      {
        "id": 1,
        "code": "INV",
        "name": "Facturas de Clientes",
        "type": "sale",
        "default_account": "413501"
      },
      {
        "id": 2,
        "code": "BILL",
        "name": "Facturas de Proveedores",
        "type": "purchase",
        "default_account": "519530"
      },
      {
        "id": 3,
        "code": "BNK1",
        "name": "Banco Bancolombia Cta Cte",
        "type": "bank",
        "default_account": "111005",
        "balance": 0
      },
      {
        "id": 4,
        "code": "CSH1",
        "name": "Caja General Efectivo",
        "type": "cash",
        "default_account": "110505",
        "balance": 0
      },
      {
        "id": 5,
        "code": "EXJ",
        "name": "Gastos de Empleados",
        "type": "purchase",
        "default_account": "510506"
      }
    ],
    "accounts": [
      {
        "id": 1,
        "code": "110505",
        "name": "Caja General",
        "type": "Activo Corriente / Liquidez",
        "reconcile": false
      },
      {
        "id": 2,
        "code": "111005",
        "name": "Bancos Nacionales - Moneda Funcional",
        "type": "Activo Corriente / Banco",
        "reconcile": false
      },
      {
        "id": 3,
        "code": "130505",
        "name": "Clientes Nacionales (Cuentas por Cobrar)",
        "type": "Por Cobrar",
        "reconcile": true
      },
      {
        "id": 4,
        "code": "220505",
        "name": "Proveedores Nacionales (Cuentas por Pagar)",
        "type": "Por Pagar",
        "reconcile": true
      },
      {
        "id": 5,
        "code": "233595",
        "name": "Costos y Gastos por Pagar / Reembolsos",
        "type": "Pasivo Corriente",
        "reconcile": true
      },
      {
        "id": 6,
        "code": "240801",
        "name": "IVA Generado en Ventas (19%)",
        "type": "Impuestos Pasivo",
        "reconcile": false
      },
      {
        "id": 7,
        "code": "240802",
        "name": "IVA Descontable en Compras y Gastos (19%)",
        "type": "Impuestos Activo",
        "reconcile": false
      },
      {
        "id": 8,
        "code": "310505",
        "name": "Capital Suscrito y Pagado",
        "type": "Patrimonio",
        "reconcile": false
      },
      {
        "id": 9,
        "code": "413501",
        "name": "Ingresos por Servicios de Software y Consultoría",
        "type": "Ingresos Operacionales",
        "reconcile": false
      },
      {
        "id": 10,
        "code": "510506",
        "name": "Gastos de Viaje, Viáticos y Representación",
        "type": "Gastos de Administración",
        "reconcile": false
      },
      {
        "id": 11,
        "code": "519530",
        "name": "Gastos de Tecnología, Licencias y Suministros",
        "type": "Gastos Operacionales",
        "reconcile": false
      }
    ],
    "taxes": [
      {
        "id": 1,
        "name": "IVA 19% Ventas",
        "amount": 19,
        "type_tax_use": "sale",
        "account_code": "240801",
        "active": true
      },
      {
        "id": 2,
        "name": "IVA 19% Compras",
        "amount": 19,
        "type_tax_use": "purchase",
        "account_code": "240802",
        "active": true
      },
      {
        "id": 3,
        "name": "IVA 5% Servicios Especiales",
        "amount": 5,
        "type_tax_use": "sale",
        "account_code": "240801",
        "active": true
      },
      {
        "id": 4,
        "name": "Exento / Excluido 0%",
        "amount": 0,
        "type_tax_use": "all",
        "account_code": "240801",
        "active": true
      }
    ],
    "moves": [],
    "payments": []
  }
};
}

class ERPStore {
  constructor(dbPath = DEFAULT_DB_PATH, options = {}) {
    this.dbPath = dbPath;
    this.options = options;
    const isTestPath = typeof dbPath === 'string' && dbPath.includes('chapp_erp_test_');
    const useSupabase = options.useSupabase !== undefined
      ? Boolean(options.useSupabase)
      : (process.env.NODE_ENV !== 'test' && !isTestPath && isSupabaseConfigured());
    this.supabase = useSupabase ? new SupabasePersistence() : null;
    this.data = null;
    this._hasSyncedOnce = false;
    this._lastSyncTime = 0;
    this._syncPromise = null;
    this.load();
    if (this.supabase && this.supabase.isReady() && !isTestPath && options.autoSync !== false) {
      this.ensureSynced(0).catch(() => {});
    }
  }

  load() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        this.data = JSON.parse(raw);
        this.updateSequencesFromData();
      } else {
        this.data = createInitialData();
        this.updateSequencesFromData();
        this.save();
      }
    } catch (err) {
      this.data = createInitialData();
      this.updateSequencesFromData();
      this.save();
    }
  }

  async ensureSynced(maxAgeMs = 0) {
    if (!this.supabase || !this.supabase.isReady()) return;
    const now = Date.now();
    const needsSync = !this._hasSyncedOnce || !this._lastSyncTime || maxAgeMs <= 0 || (now - this._lastSyncTime >= maxAgeMs);
    if (!needsSync) return;

    if (this._syncPromise) {
      return this._syncPromise;
    }
    this._syncPromise = (async () => {
      try {
        await this.syncFromSupabaseIfAvailable();
      } finally {
        this._syncPromise = null;
      }
    })();
    return this._syncPromise;
  }

  async syncFromSupabaseIfAvailable() {
    if (!this.supabase || !this.supabase.isReady()) return;
    try {
      const remote = await this.supabase.loadAll(this.data);
      if (remote) {
        const isServiceRole = Boolean(this.supabase.config && this.supabase.config.isServiceRole);

        // Helper to decide if local data should be preserved rather than wiped
        const shouldPreserveLocal = (remoteArr, localArr) => {
          if (!Array.isArray(remoteArr)) return true;
          // If remote is empty, but local has items, and it's not a verified service_role: protect against RLS wipe
          if (remoteArr.length === 0 && !isServiceRole && Array.isArray(localArr) && localArr.length > 0) {
            return true;
          }
          return false;
        };

        if (Array.isArray(remote.contacts) && !shouldPreserveLocal(remote.contacts, this.data.contacts)) {
          this.data.contacts = remote.contacts;
        }
        if (Array.isArray(remote.products) && !shouldPreserveLocal(remote.products, this.data.products)) {
          this.data.products = remote.products;
        }
        if (Array.isArray(remote.expenses) && !shouldPreserveLocal(remote.expenses, this.data.expenses)) {
          this.data.expenses = remote.expenses;
        }
        if (Array.isArray(remote.sales) && !shouldPreserveLocal(remote.sales, this.data.sales)) {
          this.data.sales = remote.sales;
        }
        if (this.data.accounting) {
          if (Array.isArray(remote.moves) && !shouldPreserveLocal(remote.moves, this.data.accounting.moves)) {
            this.data.accounting.moves = remote.moves;
          }
          if (Array.isArray(remote.payments) && !shouldPreserveLocal(remote.payments, this.data.accounting.payments)) {
            this.data.accounting.payments = remote.payments;
          }
        }
        if (remote.settings) {
          this.data.settings = remote.settings;
        }

        this.updateSequencesFromData();
        this.save();
      }
      this._hasSyncedOnce = true;
      this._lastSyncTime = Date.now();
    } catch (err) {
      console.warn('[Store] syncFromSupabase error:', err.message);
    }
  }

  updateSequencesFromData() {
    if (!this.data) return;
    if (!this.data.meta) this.data.meta = { sequences: {} };
    if (!this.data.meta.sequences) this.data.meta.sequences = {};
    const seq = this.data.meta.sequences;

    // Contacts
    const maxContact = (this.data.contacts || []).reduce((m, c) => Math.max(m, Number(c.id) || 0), 0);
    seq.contact = Math.max(seq.contact || 1, maxContact + 1);

    // Products
    const maxProduct = (this.data.products || []).reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
    seq.product = Math.max(seq.product || 1, maxProduct + 1);

    // Expenses: check ID and reference numbers (e.g. EXP/2026/0005)
    let maxExpense = (this.data.expenses || []).reduce((m, e) => Math.max(m, Number(e.id) || 0), 0);
    (this.data.expenses || []).forEach((e) => {
      const match = e.reference && String(e.reference).match(/(\d+)$/);
      if (match) maxExpense = Math.max(maxExpense, parseInt(match[1], 10));
    });
    seq.expense = Math.max(seq.expense || 1, maxExpense + 1);

    // Sales: check ID and order names (e.g. S00007)
    let maxSale = (this.data.sales || []).reduce((m, s) => Math.max(m, Number(s.id) || 0), 0);
    (this.data.sales || []).forEach((s) => {
      const match = s.name && String(s.name).match(/(\d+)$/);
      if (match) maxSale = Math.max(maxSale, parseInt(match[1], 10));
    });
    seq.sale = Math.max(seq.sale || 1, maxSale + 1);

    // Accounting moves & prefixes
    const moves = (this.data.accounting && this.data.accounting.moves) || [];
    let maxInv = moves.filter((m) => m.move_type === 'out_invoice').reduce((m, x) => Math.max(m, Number(x.id) || 0), 0);
    let maxBill = moves.filter((m) => m.move_type === 'in_invoice').reduce((m, x) => Math.max(m, Number(x.id) || 0), 0);
    let maxMisc = moves.filter((m) => m.move_type === 'entry').reduce((m, x) => Math.max(m, Number(x.id) || 0), 0);

    moves.forEach((m) => {
      const match = m.name && String(m.name).match(/(\d+)$/);
      const num = match ? parseInt(match[1], 10) : 0;
      const id = Number(m.id) || 0;
      const val = Math.max(num, id);
      if (m.move_type === 'out_invoice' || (m.name && m.name.startsWith('INV/'))) {
        maxInv = Math.max(maxInv, val);
      } else if (m.move_type === 'in_invoice' || (m.name && m.name.startsWith('BILL/'))) {
        maxBill = Math.max(maxBill, val);
      } else {
        maxMisc = Math.max(maxMisc, val);
      }
    });

    seq.move_inv = Math.max(seq.move_inv || 1, maxInv + 1);
    seq.move_bill = Math.max(seq.move_bill || 1, maxBill + 1);
    seq.move_misc = Math.max(seq.move_misc || 1, maxMisc + 1);

    // Payments: check ID and payment names (e.g. PAY/2026/0003)
    const payments = (this.data.accounting && this.data.accounting.payments) || [];
    let maxPay = payments.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
    payments.forEach((p) => {
      const match = p.name && String(p.name).match(/(\d+)$/);
      if (match) maxPay = Math.max(maxPay, parseInt(match[1], 10));
    });
    seq.payment = Math.max(seq.payment || 1, maxPay + 1);
  }

  save() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      if (err.code === 'EROFS' || err.code === 'EACCES' || err.code === 'EPERM') {
        // Read-only filesystem in serverless environments (e.g. Vercel)
      } else {
        console.warn('[Store] Local file write error:', err.message);
      }
    }
  }

  async reset() {
    this.data = createInitialData();
    this.save();
    if (this.supabase) {
      await this.supabase.resetData();
    }
    return this.getBootstrapState();
  }

  nextSeq(key) {
    if (!this.data.meta.sequences[key]) {
      this.data.meta.sequences[key] = 1;
    }
    const val = this.data.meta.sequences[key];
    this.data.meta.sequences[key] += 1;
    return val;
  }

  padSeq(num, len = 4) {
    return String(num).padStart(len, '0');
  }

  formatNowShort() {
    const d = new Date();
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }

  getActiveAuthor() {
    return (this.data.settings && this.data.settings.active_user && this.data.settings.active_user.name) || 'Administrador CHapp';
  }

  // Enriches contacts with Odoo smart-button statistics (linked sales, invoices, expenses)
  getEnrichedContacts() {
    return this.data.contacts.map((c) => {
      const sales = this.data.sales.filter((s) => Number(s.partner_id) === Number(c.id) && s.state !== 'cancel');
      const moves = this.data.accounting.moves.filter(
        (m) => Number(m.partner_id) === Number(c.id) && m.state === 'posted' && (m.move_type === 'out_invoice' || m.move_type === 'in_invoice')
      );
      const expenses = this.data.expenses.filter((e) => Number(e.partner_id) === Number(c.id));
      return {
        ...c,
        sales_count: sales.length,
        sales_total: round2(sales.reduce((acc, s) => acc + Number(s.amount_total || 0), 0)),
        invoices_count: moves.length,
        invoiced_total: round2(moves.reduce((acc, m) => acc + Number(m.amount_total || 0), 0)),
        expenses_count: expenses.length
      };
    });
  }

  getSummaryKPIs() {
    const salesConfirmed = this.data.sales.filter((s) => s.state === 'sale');
    const quotations = this.data.sales.filter((s) => s.state === 'draft' || s.state === 'sent');
    const expensesToSubmit = this.data.expenses.filter((e) => e.state === 'draft');
    const expensesSubmitted = this.data.expenses.filter((e) => e.state === 'submitted');
    const expensesApproved = this.data.expenses.filter((e) => e.state === 'approved');
    const expensesPosted = this.data.expenses.filter((e) => e.state === 'posted');
    const expensesPaid = this.data.expenses.filter((e) => e.state === 'paid');

    const outInvoices = this.data.accounting.moves.filter((m) => m.move_type === 'out_invoice' && m.state === 'posted');
    const inInvoices = this.data.accounting.moves.filter((m) => m.move_type === 'in_invoice' && m.state === 'posted');

    return {
      contacts_total: this.data.contacts.length,
      companies_total: this.data.contacts.filter((c) => c.is_company).length,
      customers_total: this.data.contacts.filter((c) => Number(c.customer_rank) > 0).length,
      suppliers_total: this.data.contacts.filter((c) => Number(c.supplier_rank) > 0).length,
      quotations_count: quotations.length,
      quotations_total: round2(quotations.reduce((s, o) => s + Number(o.amount_total || 0), 0)),
      sales_orders_count: salesConfirmed.length,
      sales_orders_total: round2(salesConfirmed.reduce((s, o) => s + Number(o.amount_total || 0), 0)),
      to_invoice_count: salesConfirmed.filter((s) => s.invoice_status === 'to invoice').length,
      expenses_draft_total: round2(expensesToSubmit.reduce((s, e) => s + Number(e.total_amount || 0), 0)),
      expenses_submitted_total: round2(expensesSubmitted.reduce((s, e) => s + Number(e.total_amount || 0), 0)),
      expenses_approved_total: round2(expensesApproved.reduce((s, e) => s + Number(e.total_amount || 0), 0)),
      expenses_reimburse_total: round2(expensesPosted.reduce((s, e) => s + Number(e.total_amount || 0), 0)),
      expenses_paid_total: round2(expensesPaid.reduce((s, e) => s + Number(e.total_amount || 0), 0)),
      receivables_residual: round2(outInvoices.reduce((s, m) => s + Number(m.amount_residual || 0), 0)),
      invoiced_revenue: round2(outInvoices.reduce((s, m) => s + Number(m.amount_total || 0), 0)),
      payables_residual: round2(inInvoices.reduce((s, m) => s + Number(m.amount_residual || 0), 0))
    };
  }

  getBootstrapState() {
    return {
      meta: this.data.meta,
      settings: this.data.settings,
      contacts: this.getEnrichedContacts(),
      products: this.data.products,
      expenses: this.data.expenses,
      sales: this.data.sales,
      accounting: this.data.accounting,
      kpis: this.getSummaryKPIs()
    };
  }

  // ==================== CONTACTOS (res.partner) ====================
  async saveContact(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Datos de contacto inválidos.');
    }
    const name = String(payload.name || '').trim();
    if (!name) {
      throw new Error('El nombre del contacto es obligatorio.');
    }

    const categories = Array.isArray(payload.category_ids)
      ? payload.category_ids.map((t) => String(t).trim()).filter(Boolean)
      : String(payload.category_ids || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);

    if (payload.id) {
      const idx = this.data.contacts.findIndex((c) => Number(c.id) === Number(payload.id));
      if (idx === -1) throw new Error('Contacto no encontrado.');
      const existing = this.data.contacts[idx];
      const isCompanyVal = payload.is_company !== undefined ? Boolean(payload.is_company) : existing.is_company;
      const updated = {
        ...existing,
        name,
        is_company: isCompanyVal,
        company_name: payload.company_name !== undefined ? String(payload.company_name).trim() : existing.company_name,
        doc_type: payload.doc_type !== undefined ? String(payload.doc_type).trim() : (existing.doc_type || (isCompanyVal ? 'NIT' : 'CC')),
        vat: payload.vat !== undefined ? String(payload.vat).trim() : existing.vat,
        function: payload.function !== undefined ? String(payload.function).trim() : existing.function,
        street: payload.street !== undefined ? String(payload.street).trim() : existing.street,
        city: payload.city !== undefined ? String(payload.city).trim() : existing.city,
        state_name: payload.state_name !== undefined ? String(payload.state_name).trim() : existing.state_name,
        country: payload.country !== undefined ? String(payload.country).trim() : existing.country,
        email: payload.email !== undefined ? String(payload.email).trim() : existing.email,
        phone: payload.phone !== undefined ? String(payload.phone).trim() : existing.phone,
        mobile: payload.mobile !== undefined ? String(payload.mobile).trim() : existing.mobile,
        website: payload.website !== undefined ? String(payload.website).trim() : existing.website,
        customer_rank: payload.customer_rank !== undefined ? Number(payload.customer_rank) : existing.customer_rank,
        supplier_rank: payload.supplier_rank !== undefined ? Number(payload.supplier_rank) : existing.supplier_rank,
        category_ids: payload.category_ids !== undefined ? categories : existing.category_ids,
        payment_term: payload.payment_term !== undefined ? String(payload.payment_term).trim() : existing.payment_term,
        notes: payload.notes !== undefined ? String(payload.notes).trim() : existing.notes
      };
      updated.chatter = [
        ...(existing.chatter || []),
        { id: Date.now(), author: this.getActiveAuthor(), date: this.formatNowShort(), text: 'Ficha de contacto actualizada.' }
      ];
      this.data.contacts[idx] = updated;
      this.save();
      if (this.supabase) {
        try {
          await this.supabase.savePartner(updated);
        } catch (err) {
          this.data.contacts[idx] = existing;
          this.save();
          throw err;
        }
      }
      return this.getEnrichedContacts().find((c) => Number(c.id) === Number(updated.id));
    }

    const id = this.nextSeq('contact');
    const isCompanyNew = payload.is_company !== undefined ? Boolean(payload.is_company) : true;
    const newContact = {
      id,
      name,
      is_company: isCompanyNew,
      company_name: String(payload.company_name || '').trim(),
      doc_type: String(payload.doc_type || (isCompanyNew ? 'NIT' : 'CC')).trim(),
      vat: String(payload.vat || '').trim(),
      function: String(payload.function || (isCompanyNew ? 'Empresa' : 'Contacto')).trim(),
      street: String(payload.street || '').trim(),
      city: String(payload.city || 'Pereira').trim(),
      state_name: String(payload.state_name || 'Risaralda').trim(),
      country: String(payload.country || 'Colombia').trim(),
      email: String(payload.email || '').trim(),
      phone: String(payload.phone || '').trim(),
      mobile: String(payload.mobile || '').trim(),
      website: String(payload.website || '').trim(),
      customer_rank: payload.customer_rank !== undefined ? Number(payload.customer_rank) : 1,
      supplier_rank: payload.supplier_rank !== undefined ? Number(payload.supplier_rank) : 0,
      category_ids: categories.length ? categories : ['Contacto'],
      payment_term: String(payload.payment_term || '30 Días').trim(),
      color: (id % 11) + 1,
      notes: String(payload.notes || '').trim(),
      active: true,
      created_at: nowISO(),
      chatter: [
        { id: Date.now(), author: this.getActiveAuthor(), date: this.formatNowShort(), text: 'Contacto creado en el directorio.' }
      ]
    };
    this.data.contacts.unshift(newContact);
    this.save();
    if (this.supabase) {
      try {
        await this.supabase.savePartner(newContact);
      } catch (err) {
        this.data.contacts.shift();
        this.save();
        throw err;
      }
    }
    return this.getEnrichedContacts().find((c) => Number(c.id) === Number(id));
  }

  async deleteContact(id) {
    const idx = this.data.contacts.findIndex((c) => Number(c.id) === Number(id));
    if (idx === -1) throw new Error('Contacto no encontrado.');
    const hasSales = this.data.sales.some((s) => Number(s.partner_id) === Number(id));
    const hasMoves = this.data.accounting.moves.some((m) => Number(m.partner_id) === Number(id));
    const hasExpenses = this.data.expenses.some((e) => Number(e.partner_id) === Number(id));
    if (hasSales || hasMoves || hasExpenses) {
      throw new Error('No se puede eliminar el contacto porque tiene ventas, facturas o gastos asociados.');
    }
    const removed = this.data.contacts.splice(idx, 1)[0];
    this.save();
    if (this.supabase) {
      try {
        await this.supabase.deletePartner(id);
      } catch (err) {
        this.data.contacts.splice(idx, 0, removed);
        this.save();
        throw err;
      }
    }
    return removed;
  }

  adjustJournalBalance(journalCode, delta) {
    const j = (this.data.accounting.journals || []).find((x) => x.code === journalCode);
    if (j && typeof j.balance === 'number') {
      j.balance = round2(j.balance + Number(delta || 0));
    }
  }

  recomputeSaleOrderInvoiceStatus(order) {
    if (!order || order.state !== 'sale') return;
    const validMoves = (order.invoice_ids || [])
      .map((mid) => this.data.accounting.moves.find((m) => Number(m.id) === Number(mid)))
      .filter((m) => m && m.state !== 'cancel');
    const invoicedTotal = round2(validMoves.reduce((sum, m) => sum + Number(m.amount_total || 0), 0));
    order.invoice_status = invoicedTotal >= round2(order.amount_total) && invoicedTotal > 0 ? 'invoiced' : 'to invoice';
  }

  // ==================== PRODUCTOS (product.template) ====================
  async saveProduct(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Datos de producto inválidos.');
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('El nombre del producto es obligatorio.');
    const listPrice = round2(payload.list_price ?? 0);
    const standardPrice = round2(payload.standard_price ?? 0);
    if (listPrice < 0 || standardPrice < 0) throw new Error('El precio y el costo no pueden ser negativos.');

    if (payload.id) {
      const idx = this.data.products.findIndex((p) => Number(p.id) === Number(payload.id));
      if (idx === -1) throw new Error('Producto no encontrado.');
      const oldProd = { ...this.data.products[idx] };
      this.data.products[idx] = {
        ...this.data.products[idx],
        name,
        default_code: String(payload.default_code ?? this.data.products[idx].default_code).trim(),
        type: payload.type || this.data.products[idx].type,
        list_price: listPrice,
        standard_price: standardPrice,
        tax_rate: Number(payload.tax_rate ?? this.data.products[idx].tax_rate),
        category: String(payload.category ?? this.data.products[idx].category).trim(),
        can_be_sold: payload.can_be_sold !== undefined ? Boolean(payload.can_be_sold) : this.data.products[idx].can_be_sold,
        can_be_expensed: payload.can_be_expensed !== undefined ? Boolean(payload.can_be_expensed) : this.data.products[idx].can_be_expensed,
        uom: String(payload.uom || this.data.products[idx].uom || 'Metro Cuadrado').trim()
      };
      this.save();
      if (this.supabase) {
        try {
          await this.supabase.saveProduct(this.data.products[idx]);
        } catch (err) {
          this.data.products[idx] = oldProd;
          this.save();
          throw err;
        }
      }
      return this.data.products[idx];
    }

    const id = this.nextSeq('product');
    const prod = {
      id,
      name,
      default_code: String(payload.default_code || `PRD-${this.padSeq(id, 3)}`).trim(),
      type: payload.type || 'service',
      list_price: listPrice,
      standard_price: standardPrice,
      tax_rate: Number(payload.tax_rate ?? this.data.settings.default_sale_tax ?? 19),
      category: String(payload.category || 'General').trim(),
      can_be_sold: payload.can_be_sold !== undefined ? Boolean(payload.can_be_sold) : true,
      can_be_expensed: payload.can_be_expensed !== undefined ? Boolean(payload.can_be_expensed) : true,
      uom: String(payload.uom || 'Metro Cuadrado').trim()
    };
    this.data.products.push(prod);
    this.save();
    if (this.supabase) {
      try {
        await this.supabase.saveProduct(prod);
      } catch (err) {
        this.data.products.pop();
        this.save();
        throw err;
      }
    }
    return prod;
  }

  async deleteProduct(id) {
    const idx = this.data.products.findIndex((p) => Number(p.id) === Number(id));
    if (idx === -1) throw new Error('Producto no encontrado.');
    const hasSalesLines = this.data.sales.some((s) => (s.lines || []).some((l) => Number(l.product_id) === Number(id)));
    const hasExpenses = this.data.expenses.some((e) => Number(e.product_id) === Number(id));
    if (hasSalesLines || hasExpenses) {
      throw new Error('No se puede eliminar el producto porque tiene ventas o gastos asociados.');
    }
    const removed = this.data.products.splice(idx, 1)[0];
    this.save();
    if (this.supabase) {
      try {
        await this.supabase.deleteProduct(id);
      } catch (err) {
        this.data.products.splice(idx, 0, removed);
        this.save();
        throw err;
      }
    }
    return removed;
  }

  // ==================== GASTOS (hr.expense) ====================
  async saveExpense(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Datos de gasto inválidos.');
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('La descripción del gasto es obligatoria.');

    const quantity = Number(payload.quantity ?? 1);
    const priceUnit = Number(payload.price_unit ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad debe ser mayor a 0.');
    if (!Number.isFinite(priceUnit) || priceUnit < 0) throw new Error('El valor unitario no puede ser negativo.');

    const taxRate = Number(payload.tax_rate ?? 0);
    const untaxed = round2(quantity * priceUnit);
    const taxAmount = round2(untaxed * (taxRate / 100));
    const totalAmount = round2(untaxed + taxAmount);

    const product = this.data.products.find((p) => Number(p.id) === Number(payload.product_id));
    const partner = this.data.contacts.find((c) => Number(c.id) === Number(payload.partner_id));

    if (payload.id) {
      const idx = this.data.expenses.findIndex((e) => Number(e.id) === Number(payload.id));
      if (idx === -1) throw new Error('Gasto no encontrado.');
      const existing = this.data.expenses[idx];
      const updated = {
        ...existing,
        name,
        employee_name: String(payload.employee_name || existing.employee_name).trim(),
        department: String(payload.department || existing.department).trim(),
        product_id: product ? product.id : existing.product_id,
        product_name: product ? product.name : String(payload.product_name || existing.product_name),
        date: payload.date || existing.date,
        payment_mode: payload.payment_mode || existing.payment_mode,
        quantity,
        price_unit: priceUnit,
        tax_rate: taxRate,
        untaxed_amount: untaxed,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        partner_id: partner ? partner.id : existing.partner_id,
        partner_name: partner ? partner.name : String(payload.partner_name || existing.partner_name || ''),
        analytic_account: String(payload.analytic_account ?? existing.analytic_account).trim(),
        receipt_ref: String(payload.receipt_ref ?? existing.receipt_ref).trim(),
        notes: String(payload.notes ?? existing.notes).trim()
      };
      updated.chatter = [
        ...(existing.chatter || []),
        { id: Date.now(), author: this.getActiveAuthor(), date: this.formatNowShort(), text: `Gasto actualizado ($ ${totalAmount.toLocaleString('es-CO')}).` }
      ];
      const oldExpense = { ...existing };
      this.data.expenses[idx] = updated;
      this.save();
      if (this.supabase) {
        try {
          await this.supabase.saveExpense(updated);
        } catch (err) {
          this.data.expenses[idx] = oldExpense;
          this.save();
          throw err;
        }
      }
      return updated;
    }

    const id = this.nextSeq('expense');
    const reference = `EXP/2026/${this.padSeq(id, 4)}`;
    const newExpense = {
      id,
      reference,
      name,
      employee_name: String(payload.employee_name || this.getActiveAuthor()).trim(),
      department: String(payload.department || 'Operaciones & Proyectos').trim(),
      product_id: product ? product.id : (payload.product_id ? Number(payload.product_id) : null),
      product_name: product ? product.name : String(payload.product_name || 'Viáticos y Alojamiento Corporativo'),
      date: payload.date || todayStr(),
      payment_mode: payload.payment_mode || 'own_account',
      quantity,
      price_unit: priceUnit,
      tax_rate: taxRate,
      untaxed_amount: untaxed,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      currency: this.data.settings.currency || 'COP',
      partner_id: partner ? partner.id : null,
      partner_name: partner ? partner.name : String(payload.partner_name || 'Proveedor General'),
      analytic_account: String(payload.analytic_account || 'General').trim(),
      receipt_ref: String(payload.receipt_ref || '').trim(),
      notes: String(payload.notes || '').trim(),
      state: 'draft',
      refuse_reason: '',
      move_id: null,
      payment_id: null,
      chatter: [
        { id: Date.now(), author: this.getActiveAuthor(), date: this.formatNowShort(), text: `Gasto ${reference} creado en estado Borrador.` }
      ]
    };
    this.data.expenses.unshift(newExpense);
    this.save();
    if (this.supabase) {
      try {
        await this.supabase.saveExpense(newExpense);
      } catch (err) {
        this.data.expenses.shift();
        this.save();
        throw err;
      }
    }
    return newExpense;
  }

  async transitionExpense(id, action, extra = {}) {
    const exp = this.data.expenses.find((e) => Number(e.id) === Number(id));
    if (!exp) throw new Error('Gasto no encontrado.');

    if (action === 'submit') {
      if (exp.state !== 'draft') throw new Error('Solo los gastos en borrador pueden enviarse.');
      exp.state = 'submitted';
      exp.chatter.push({
        id: Date.now(),
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: 'Reporte de gasto enviado a aprobación.'
      });
    } else if (action === 'approve') {
      if (exp.state !== 'submitted' && exp.state !== 'draft') {
        throw new Error('El gasto debe estar Enviado o en Borrador para aprobarse.');
      }
      exp.state = 'approved';
      exp.chatter.push({
        id: Date.now(),
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: 'Gasto aprobado por gerencia.'
      });
    } else if (action === 'post') {
      if (exp.state !== 'approved') {
        throw new Error('El gasto debe estar Aprobado antes de contabilizar el asiento.');
      }
      const seq = this.nextSeq('move_misc');
      const moveId = this.data.accounting.moves.reduce((m, x) => Math.max(m, Number(x.id)), 0) + 1;
      const moveName = `MISC/2026/${this.padSeq(seq, 4)}`;
      const creditAccount = exp.payment_mode === 'company_account'
        ? { code: '111005', name: 'Bancos Nacionales - Moneda Funcional' }
        : { code: '233595', name: 'Costos y Gastos por Pagar / Reembolsos' };

      const journalItems = [
        {
          account_code: '510506',
          account_name: 'Gastos de Viaje, Viáticos y Representación',
          label: `${exp.reference} - ${exp.name}`,
          debit: exp.untaxed_amount,
          credit: 0
        }
      ];
      if (exp.tax_amount > 0) {
        journalItems.push({
          account_code: '240802',
          account_name: 'IVA Descontable en Compras y Gastos (19%)',
          label: `IVA Gasto ${exp.reference}`,
          debit: exp.tax_amount,
          credit: 0
        });
      }
      journalItems.push({
        account_code: creditAccount.code,
        account_name: creditAccount.name,
        label: exp.payment_mode === 'company_account' ? `Pago compañía ${exp.reference}` : `Por reembolsar a ${exp.employee_name}`,
        debit: 0,
        credit: exp.total_amount
      });

      const move = {
        id: moveId,
        name: moveName,
        move_type: 'entry',
        journal_id: 5,
        journal_code: 'EXJ',
        journal_name: 'Gastos de Empleados',
        partner_id: exp.partner_id || null,
        partner_name: exp.partner_name || exp.employee_name,
        invoice_date: exp.date || todayStr(),
        invoice_date_due: exp.date || todayStr(),
        ref: exp.reference,
        origin: exp.reference,
        state: 'posted',
        payment_state: exp.payment_mode === 'company_account' ? 'paid' : 'not_paid',
        lines: [
          {
            id: 1,
            product_id: exp.product_id,
            name: exp.name,
            account_code: '510506',
            account_name: 'Gastos de Viaje, Viáticos y Representación',
            quantity: exp.quantity,
            price_unit: exp.price_unit,
            tax_rate: exp.tax_rate,
            subtotal: exp.untaxed_amount,
            tax_amount: exp.tax_amount,
            total: exp.total_amount
          }
        ],
        journal_items: journalItems,
        amount_untaxed: exp.untaxed_amount,
        amount_tax: exp.tax_amount,
        amount_total: exp.total_amount,
        amount_residual: exp.payment_mode === 'company_account' ? 0 : exp.total_amount,
        chatter: [
          { id: Date.now(), author: this.getActiveAuthor(), date: this.formatNowShort(), text: `Asiento contable generado desde Gasto ${exp.reference}.` }
        ]
      };
      this.data.accounting.moves.unshift(move);
      exp.move_id = move.id;
      if (exp.payment_mode === 'company_account') {
        this.adjustJournalBalance('BNK1', -exp.total_amount);
        exp.state = 'paid';
      } else {
        exp.state = 'posted';
      }
      exp.chatter.push({
        id: Date.now() + 1,
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: `Asiento contable ${moveName} publicado en Contabilidad.`
      });
    } else if (action === 'pay') {
      if (exp.state !== 'posted' && exp.state !== 'approved') {
        throw new Error('El gasto debe estar Publicado para registrar su reembolso.');
      }
      if (!exp.move_id) {
        await this.transitionExpense(id, 'post');
      }
      const paySeq = this.nextSeq('payment');
      const payId = this.data.accounting.payments.reduce((m, p) => Math.max(m, Number(p.id)), 0) + 1;
      const payName = `PAY/2026/${this.padSeq(paySeq, 4)}`;
      const jCode = extra.journal_code || 'BNK1';
      const payment = {
        id: payId,
        name: payName,
        payment_type: 'outbound',
        partner_id: exp.partner_id || null,
        partner_name: `${exp.employee_name} (Reembolso ${exp.reference})`,
        amount: exp.total_amount,
        date: todayStr(),
        journal_code: jCode,
        journal_name: jCode === 'CSH1' ? 'Caja General Efectivo' : 'Banco Bancolombia Cta Cte',
        ref: exp.reference,
        move_id: exp.move_id,
        state: 'posted'
      };
      this.data.accounting.payments.unshift(payment);
      this.adjustJournalBalance(jCode, -exp.total_amount);
      const linkedMove = this.data.accounting.moves.find((m) => Number(m.id) === Number(exp.move_id));
      if (linkedMove) {
        linkedMove.payment_state = 'paid';
        linkedMove.amount_residual = 0;
      }
      exp.payment_id = payment.id;
      exp.state = 'paid';
      exp.chatter.push({
        id: Date.now(),
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: `Reembolso pagado mediante comprobante ${payName}.`
      });
    } else if (action === 'refuse') {
      exp.state = 'refused';
      exp.refuse_reason = String(extra.reason || 'Rechazado por políticas de gasto').trim();
      exp.chatter.push({
        id: Date.now(),
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: `Gasto rechazado. Motivo: ${exp.refuse_reason}`
      });
    } else if (action === 'reset') {
      exp.state = 'draft';
      exp.refuse_reason = '';
      exp.chatter.push({
        id: Date.now(),
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: 'Gasto restablecido a Borrador.'
      });
    } else {
      throw new Error(`Acción de gasto no soportada: ${action}`);
    }

    this.save();
    if (this.supabase) {
      if (exp.move_id) {
        const move = this.data.accounting.moves.find((m) => Number(m.id) === Number(exp.move_id));
        if (move) await this.supabase.saveAccountMove(move);
      }
      if (exp.payment_id) {
        const pay = this.data.accounting.payments.find((p) => Number(p.id) === Number(exp.payment_id));
        if (pay) await this.supabase.savePayment(pay);
      }
      await this.supabase.saveExpense(exp);
    }
    return exp;
  }

  // ==================== VENTAS (sale.order) ====================
  normalizeOrderLines(rawLines) {
    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      throw new Error('El pedido debe tener al menos una línea de producto.');
    }
    return rawLines.map((line, idx) => {
      const product = this.data.products.find((p) => Number(p.id) === Number(line.product_id));
      const qty = Number(line.quantity ?? 1);
      const price = Number(line.price_unit ?? (product ? product.list_price : 0));
      const discount = Math.min(100, Math.max(0, Number(line.discount ?? 0)));
      const taxRate = Number(line.tax_rate ?? (product ? product.tax_rate : 19));

      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error(`La cantidad en la línea ${idx + 1} debe ser mayor a 0.`);
      }
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(`El precio unitario en la línea ${idx + 1} no puede ser negativo.`);
      }

      const gross = qty * price;
      const subtotal = round2(gross * (1 - discount / 100));
      const taxAmount = round2(subtotal * (taxRate / 100));
      const total = round2(subtotal + taxAmount);

      return {
        id: line.id || idx + 1,
        product_id: product ? product.id : (line.product_id ? Number(line.product_id) : null),
        product_name: product ? product.name : String(line.product_name || 'Servicio / Producto').trim(),
        description: String(line.description || (product ? product.name : 'Servicio')).trim(),
        quantity: qty,
        uom: String(line.uom || (product ? product.uom : 'Metro Cuadrado')),
        price_unit: price,
        discount,
        tax_rate: taxRate,
        subtotal,
        tax_amount: taxAmount,
        total
      };
    });
  }

  async saveSaleOrder(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Datos de pedido inválidos.');
    const partner = this.data.contacts.find((c) => Number(c.id) === Number(payload.partner_id));
    if (!partner && !payload.partner_name) {
      throw new Error('Debe seleccionar un cliente para la cotización/pedido.');
    }

    const lines = this.normalizeOrderLines(payload.lines);
    const amountUntaxed = round2(lines.reduce((s, l) => s + l.subtotal, 0));
    const amountTax = round2(lines.reduce((s, l) => s + l.tax_amount, 0));
    const amountTotal = round2(amountUntaxed + amountTax);

    if (payload.id) {
      const idx = this.data.sales.findIndex((s) => Number(s.id) === Number(payload.id));
      if (idx === -1) throw new Error('Pedido de venta no encontrado.');
      const existing = this.data.sales[idx];
      const updated = {
        ...existing,
        partner_id: partner ? partner.id : existing.partner_id,
        partner_name: partner ? partner.name : String(payload.partner_name || existing.partner_name),
        date_order: payload.date_order || existing.date_order,
        validity_date: payload.validity_date || existing.validity_date,
        salesperson: String(payload.salesperson || existing.salesperson).trim(),
        payment_term: String(payload.payment_term || existing.payment_term).trim(),
        lines,
        amount_untaxed: amountUntaxed,
        amount_tax: amountTax,
        amount_total: amountTotal,
        notes: String(payload.notes ?? existing.notes).trim()
      };
      this.recomputeSaleOrderInvoiceStatus(updated);
      updated.chatter = [
        ...(existing.chatter || []),
        { id: Date.now(), author: this.getActiveAuthor(), date: this.formatNowShort(), text: `Orden actualizada. Total: $ ${amountTotal.toLocaleString('es-CO')}.` }
      ];
      const oldOrder = { ...existing };
      this.data.sales[idx] = updated;
      this.save();
      if (this.supabase) {
        try {
          await this.supabase.saveSaleOrder(updated);
        } catch (err) {
          this.data.sales[idx] = oldOrder;
          this.save();
          throw err;
        }
      }
      return updated;
    }

    const id = this.nextSeq('sale');
    const name = `S${this.padSeq(id, 5)}`;
    const dateOrder = payload.date_order || todayStr();
    const validityDays = Number(this.data.settings.quotation_validity_days || 30);
    const newOrder = {
      id,
      name,
      partner_id: partner ? partner.id : null,
      partner_name: partner ? partner.name : String(payload.partner_name).trim(),
      date_order: dateOrder,
      validity_date: payload.validity_date || addDays(dateOrder, validityDays),
      salesperson: String(payload.salesperson || this.getActiveAuthor()).trim(),
      payment_term: String(payload.payment_term || (partner && partner.payment_term) || '30 Días').trim(),
      state: 'draft',
      invoice_status: 'no',
      lines,
      amount_untaxed: amountUntaxed,
      amount_tax: amountTax,
      amount_total: amountTotal,
      notes: String(payload.notes || this.data.settings.sale_terms || '').trim(),
      invoice_ids: [],
      chatter: [
        { id: Date.now(), author: this.getActiveAuthor(), date: this.formatNowShort(), text: `Cotización ${name} creada.` }
      ]
    };
    this.data.sales.unshift(newOrder);
    this.save();
    if (this.supabase) {
      try {
        await this.supabase.saveSaleOrder(newOrder);
      } catch (err) {
        this.data.sales.shift();
        this.save();
        throw err;
      }
    }
    return newOrder;
  }

  async transitionSaleOrder(id, action, params = {}) {
    const order = this.data.sales.find((s) => Number(s.id) === Number(id));
    if (!order) throw new Error('Pedido de venta no encontrado.');
    const oldOrderSnapshot = JSON.parse(JSON.stringify(order));
    const oldMovesSnapshot = this.data.accounting ? [...this.data.accounting.moves] : [];
    let invoice = null;

    if (action === 'send') {
      if (order.state !== 'draft') throw new Error('Solo las cotizaciones en borrador se marcan como enviadas.');
      order.state = 'sent';
      order.chatter.push({
        id: Date.now(),
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: 'Cotización enviada por correo electrónico al cliente.'
      });
    } else if (action === 'confirm' || action === 'action_confirm') {
      if (order.state !== 'draft' && order.state !== 'sent') {
        throw new Error('Solo las cotizaciones pueden confirmarse como Pedido de Venta.');
      }
      order.state = 'sale';
      this.recomputeSaleOrderInvoiceStatus(order);
      order.chatter.push({
        id: Date.now(),
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: `Cotización confirmada -> Pedido de Venta ${order.name}.`
      });
    } else if (action === 'create_invoice') {
      if (order.state !== 'sale') {
        throw new Error('Debe confirmar el pedido de venta antes de crear la factura.');
      }
      const existingInvoices = (order.invoice_ids || [])
        .map((mid) => this.data.accounting.moves.find((m) => Number(m.id) === Number(mid)))
        .filter((m) => m && m.state !== 'cancel');
      const invoicedUntaxed = round2(existingInvoices.reduce((s, m) => s + Number(m.amount_untaxed || 0), 0));
      const invoicedTax = round2(existingInvoices.reduce((s, m) => s + Number(m.amount_tax || 0), 0));
      const invoicedTotal = round2(existingInvoices.reduce((s, m) => s + Number(m.amount_total || 0), 0));

      const deltaUntaxed = round2(order.amount_untaxed - invoicedUntaxed);
      const deltaTax = round2(order.amount_tax - invoicedTax);
      const deltaTotal = round2(order.amount_total - invoicedTotal);

      if (deltaTotal <= 0) {
        throw new Error('Este pedido de venta ya fue facturado en su totalidad.');
      }

      const rawReq = params && (params.amount !== undefined ? params.amount : params.advance_amount);
      const reqAmount = rawReq !== undefined && rawReq !== null && String(rawReq).trim() !== ''
        ? round2(Number(rawReq))
        : null;

      let billTotal = deltaTotal;
      let isPartialInstallment = false;

      if (reqAmount !== null && Number.isFinite(reqAmount) && reqAmount > 0) {
        if (reqAmount > deltaTotal) {
          throw new Error(`El valor del abono (${reqAmount}) no puede superar el saldo pendiente de facturar (${deltaTotal}).`);
        }
        billTotal = reqAmount;
        if (billTotal < deltaTotal) {
          isPartialInstallment = true;
        }
      }

      let billUntaxed = 0;
      let billTax = 0;
      if (Math.abs(billTotal - deltaTotal) < 0.001) {
        billUntaxed = deltaUntaxed;
        billTax = deltaTax;
      } else {
        const orderTotal = round2(order.amount_total);
        const taxRatio = orderTotal > 0 ? (order.amount_tax / orderTotal) : 0;
        billTax = round2(billTotal * taxRatio);
        billUntaxed = round2(billTotal - billTax);
      }

      const pendingResidualAfterThis = round2(deltaTotal - billTotal);
      const installmentNum = existingInvoices.length + 1;
      const isAbono = isPartialInstallment || existingInvoices.length > 0;
      const isDeltaInvoice = existingInvoices.length > 0 && invoicedTotal > 0;

      const invSeq = this.nextSeq('move_inv');
      const moveId = this.data.accounting.moves.reduce((m, x) => Math.max(m, Number(x.id)), 0) + 1;
      const invName = `INV/2026/${this.padSeq(invSeq, 4)}`;
      const invDate = (params && params.invoice_date) ? String(params.invoice_date).trim() : todayStr();
      const dueDate = addDays(invDate, 30);

      const conceptNote = isAbono
        ? `Abono / Cuota #${installmentNum} a la orden ${order.name} (Saldo restante: $ ${pendingResidualAfterThis.toLocaleString('es-CO')})`
        : `Facturación orden ${order.name}`;

      const moveLines = (!isAbono && !isDeltaInvoice)
        ? order.lines.map((l, i) => ({
            id: i + 1,
            product_id: l.product_id,
            name: `${l.product_name}${l.description && l.description !== l.product_name ? ' - ' + l.description : ''}`,
            account_code: '413501',
            account_name: 'Ingresos por Servicios de Software y Consultoría',
            quantity: l.quantity,
            price_unit: round2(l.subtotal / l.quantity),
            tax_rate: l.tax_rate,
            subtotal: l.subtotal,
            tax_amount: l.tax_amount,
            total: l.total
          }))
        : [
            {
              id: 1,
              product_id: order.lines[0] ? order.lines[0].product_id : 1,
              name: conceptNote,
              account_code: '413501',
              account_name: 'Ingresos por Servicios de Software y Consultoría',
              quantity: 1,
              price_unit: billUntaxed,
              tax_rate: billUntaxed > 0 ? round2((billTax / billUntaxed) * 100) : 0,
              subtotal: billUntaxed,
              tax_amount: billTax,
              total: billTotal
            }
          ];

      const journalItems = [
        {
          account_code: '130505',
          account_name: 'Clientes Nacionales (Cuentas por Cobrar)',
          label: `${invName} - ${order.partner_name}`,
          debit: billTotal,
          credit: 0
        },
        {
          account_code: '413501',
          account_name: 'Ingresos por Servicios de Software y Consultoría',
          label: `${conceptNote}`,
          debit: 0,
          credit: billUntaxed
        }
      ];
      if (billTax > 0) {
        journalItems.push({
          account_code: '240801',
          account_name: 'IVA Generado en Ventas (19%)',
          label: `IVA Generado ${invName}`,
          debit: 0,
          credit: billTax
        });
      }

      invoice = {
        id: moveId,
        name: invName,
        move_type: 'out_invoice',
        journal_id: 1,
        journal_code: 'INV',
        journal_name: 'Facturas de Clientes',
        partner_id: order.partner_id,
        partner_name: order.partner_name,
        invoice_date: invDate,
        invoice_date_due: dueDate,
        ref: order.name,
        origin: order.name,
        state: 'posted',
        payment_state: 'not_paid',
        lines: moveLines,
        journal_items: journalItems,
        amount_untaxed: billUntaxed,
        amount_tax: billTax,
        amount_total: billTotal,
        amount_residual: billTotal,
        order_total: round2(order.amount_total),
        invoiced_prior: invoicedTotal,
        advance_amount: billTotal,
        order_residual: pendingResidualAfterThis,
        installment_number: installmentNum,
        is_installment: isAbono,
        chatter: [
          {
            id: Date.now(),
            author: this.getActiveAuthor(),
            date: this.formatNowShort(),
            text: isAbono
              ? `Factura ${invName} creada y publicada por concepto de Abono Cuota #${installmentNum} ($ ${billTotal.toLocaleString('es-CO')}). Saldo pendiente de la orden: $ ${pendingResidualAfterThis.toLocaleString('es-CO')}.`
              : `Factura ${invName} creada y publicada desde el pedido ${order.name}.`
          }
        ]
      };

      this.data.accounting.moves.unshift(invoice);
      order.invoice_ids = [...(order.invoice_ids || []), invoice.id];
      const newInvoicedTotal = round2(invoicedTotal + billTotal);
      order.invoice_status = newInvoicedTotal >= round2(order.amount_total) ? 'invoiced' : 'to invoice';
      order.chatter.push({
        id: Date.now() + 1,
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: isAbono
          ? `Factura de cliente ${invName} emitida por Abono Cuota #${installmentNum} de $ ${billTotal.toLocaleString('es-CO')}. Total facturado: $ ${newInvoicedTotal.toLocaleString('es-CO')}. Saldo restante: $ ${pendingResidualAfterThis.toLocaleString('es-CO')}.`
          : `Factura de cliente ${invName} creada en Contabilidad.`
      });
    } else if (action === 'cancel') {
      const hasPostedInvoices = (order.invoice_ids || []).some((mid) => {
        const m = this.data.accounting.moves.find((x) => Number(x.id) === Number(mid));
        return m && m.state === 'posted';
      });
      if (hasPostedInvoices) {
        throw new Error('No se puede cancelar un pedido con facturas publicadas. Cancele o restablezca la factura primero.');
      }
      order.state = 'cancel';
      order.invoice_status = 'no';
      order.chatter.push({
        id: Date.now(),
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: 'Orden cancelada.'
      });
    } else if (action === 'draft') {
      order.state = 'draft';
      order.invoice_status = 'no';
      order.chatter.push({
        id: Date.now(),
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: 'Orden restablecida a Cotización Borrador.'
      });
    } else {
      throw new Error(`Acción de ventas no soportada: ${action}`);
    }

    this.save();
    if (this.supabase) {
      try {
        await this.supabase.saveSaleOrder(order);
        if (action === 'create_invoice' && invoice) {
          await this.supabase.saveAccountMove(invoice);
        }
      } catch (err) {
        Object.assign(order, oldOrderSnapshot);
        if (this.data.accounting) {
          this.data.accounting.moves = oldMovesSnapshot;
        }
        this.save();
        throw err;
      }
    }
    return { order, ...(invoice ? { invoice } : {}) };
  }

  // ==================== CONTABILIDAD (account.move & account.payment) ====================
  async saveAccountMove(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Datos de documento contable inválidos.');
    const existingIdx = payload.id ? this.data.accounting.moves.findIndex((m) => Number(m.id) === Number(payload.id)) : -1;
    const existing = existingIdx !== -1 ? this.data.accounting.moves[existingIdx] : null;
    if (payload.id && !existing) {
      throw new Error('Documento contable no encontrado.');
    }
    if (existing && existing.state !== 'draft') {
      throw new Error('Solo se pueden editar documentos contables en estado Borrador.');
    }

    const moveType = payload.move_type || (existing ? existing.move_type : 'out_invoice');
    const partnerId = payload.partner_id !== undefined ? payload.partner_id : existing ? existing.partner_id : null;
    const partner = this.data.contacts.find((c) => Number(c.id) === Number(partnerId));
    const partnerName = partner
      ? partner.name
      : String(payload.partner_name || (existing && existing.partner_name) || 'Tercero General').trim();

    if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
      throw new Error('El documento contable debe incluir al menos una línea.');
    }

    const defaultAccountCode = moveType === 'out_invoice' ? '413501' : '519530';
    const defaultAccountName =
      moveType === 'out_invoice'
        ? 'Ingresos por Servicios de Software y Consultoría'
        : 'Gastos de Tecnología, Licencias y Suministros';

    const lines = payload.lines.map((l, idx) => {
      const qty = Number(l.quantity ?? 1);
      const price = Number(l.price_unit ?? 0);
      const taxRate = Number(l.tax_rate ?? 19);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Cantidad inválida en línea ${idx + 1}.`);
      if (!Number.isFinite(price) || price < 0) throw new Error(`Precio inválido en línea ${idx + 1}.`);
      const subtotal = round2(qty * price);
      const taxAmount = round2(subtotal * (taxRate / 100));
      const total = round2(subtotal + taxAmount);
      return {
        id: idx + 1,
        product_id: l.product_id ? Number(l.product_id) : null,
        name: String(l.name || 'Concepto contable').trim(),
        account_code: String(l.account_code || defaultAccountCode),
        account_name: String(l.account_name || defaultAccountName),
        quantity: qty,
        price_unit: price,
        tax_rate: taxRate,
        subtotal,
        tax_amount: taxAmount,
        total
      };
    });

    const amountUntaxed = round2(lines.reduce((s, l) => s + l.subtotal, 0));
    const amountTax = round2(lines.reduce((s, l) => s + l.tax_amount, 0));
    const amountTotal = round2(amountUntaxed + amountTax);

    const journal =
      moveType === 'out_invoice'
        ? { id: 1, code: 'INV', name: 'Facturas de Clientes' }
        : moveType === 'in_invoice'
        ? { id: 2, code: 'BILL', name: 'Facturas de Proveedores' }
        : { id: 5, code: 'EXJ', name: 'Operaciones Varias / Gastos' };

    const journalItems =
      moveType === 'out_invoice'
        ? [
            { account_code: '130505', account_name: 'Clientes Nacionales (Cuentas por Cobrar)', label: partnerName, debit: amountTotal, credit: 0 },
            { account_code: '413501', account_name: 'Ingresos por Servicios de Software y Consultoría', label: 'Ingresos por facturación', debit: 0, credit: amountUntaxed },
            ...(amountTax > 0 ? [{ account_code: '240801', account_name: 'IVA Generado en Ventas (19%)', label: 'IVA Generado', debit: 0, credit: amountTax }] : [])
          ]
        : [
            { account_code: '519530', account_name: 'Gastos de Tecnología, Licencias y Suministros', label: 'Compras / Gastos', debit: amountUntaxed, credit: 0 },
            ...(amountTax > 0 ? [{ account_code: '240802', account_name: 'IVA Descontable en Compras y Gastos (19%)', label: 'IVA Descontable', debit: amountTax, credit: 0 }] : []),
            { account_code: '220505', account_name: 'Proveedores Nacionales (Cuentas por Pagar)', label: partnerName, debit: 0, credit: amountTotal }
          ];

    const invDate = payload.invoice_date || (existing && existing.invoice_date) || todayStr();
    const dueDate = payload.invoice_date_due || (existing && existing.invoice_date_due) || addDays(invDate, 30);

    if (existing) {
      const updatedMove = {
        ...existing,
        move_type: moveType,
        journal_id: journal.id,
        journal_code: journal.code,
        journal_name: journal.name,
        partner_id: partner ? partner.id : existing.partner_id,
        partner_name: partnerName,
        invoice_date: invDate,
        invoice_date_due: dueDate,
        ref: payload.ref !== undefined ? String(payload.ref).trim() : existing.ref,
        lines,
        journal_items: journalItems,
        amount_untaxed: amountUntaxed,
        amount_tax: amountTax,
        amount_total: amountTotal,
        amount_residual: amountTotal,
        chatter: [
          ...(existing.chatter || []),
          { id: Date.now(), author: this.getActiveAuthor(), date: this.formatNowShort(), text: `Borrador actualizado ($ ${amountTotal.toLocaleString('es-CO')}).` }
        ]
      };
      const oldMove = { ...existing };
      this.data.accounting.moves[existingIdx] = updatedMove;
      if (payload.auto_post) {
        return this.transitionAccountMove(updatedMove.id, 'post');
      }
      this.save();
      if (this.supabase) {
        try {
          await this.supabase.saveAccountMove(updatedMove);
        } catch (err) {
          this.data.accounting.moves[existingIdx] = oldMove;
          this.save();
          throw err;
        }
      }
      return updatedMove;
    }

    const moveId = this.data.accounting.moves.reduce((m, x) => Math.max(m, Number(x.id)), 0) + 1;

    const newMove = {
      id: moveId,
      name: 'Borrador',
      move_type: moveType,
      journal_id: journal.id,
      journal_code: journal.code,
      journal_name: journal.name,
      partner_id: partner ? partner.id : null,
      partner_name: partnerName,
      invoice_date: invDate,
      invoice_date_due: dueDate,
      ref: String(payload.ref || '').trim(),
      origin: String(payload.origin || 'Manual').trim(),
      state: 'draft',
      payment_state: 'not_paid',
      lines,
      journal_items: journalItems,
      amount_untaxed: amountUntaxed,
      amount_tax: amountTax,
      amount_total: amountTotal,
      amount_residual: amountTotal,
      chatter: [
        { id: Date.now(), author: this.getActiveAuthor(), date: this.formatNowShort(), text: 'Documento contable creado en estado Borrador.' }
      ]
    };

    this.data.accounting.moves.unshift(newMove);
    if (payload.auto_post) {
      return this.transitionAccountMove(newMove.id, 'post');
    }
    this.save();
    if (this.supabase) {
      try {
        await this.supabase.saveAccountMove(newMove);
      } catch (err) {
        this.data.accounting.moves.shift();
        this.save();
        throw err;
      }
    }
    return newMove;
  }

  createResidualInstallmentInvoice(move, priorPaymentAmount, paymentDate) {
    const residualAmount = round2(move.amount_residual);
    if (residualAmount <= 0) return null;

    const nextSeq = this.nextSeq('move_inv');
    const nextId = this.data.accounting.moves.reduce((m, x) => Math.max(m, Number(x.id)), 0) + 1;
    const nextInvName = `INV/2026/${this.padSeq(nextSeq, 4)}`;
    const nextDate = paymentDate || todayStr();
    const nextDueDate = addDays(nextDate, 30);

    const taxRatio = (move.amount_total > 0 && move.amount_tax > 0) ? (move.amount_tax / move.amount_total) : (0.19 / 1.19);
    const nextTax = round2(residualAmount * taxRatio);
    const nextUntaxed = round2(residualAmount - nextTax);

    const nextInstallmentNum = (move.installment_number || 1) + 1;

    const nextInvoice = {
      id: nextId,
      name: nextInvName,
      move_type: move.move_type || 'out_invoice',
      journal_id: move.journal_id || 1,
      journal_code: move.journal_code || 'INV',
      journal_name: move.journal_name || 'Facturas de Clientes',
      partner_id: move.partner_id,
      partner_name: move.partner_name,
      invoice_date: nextDate,
      invoice_date_due: nextDueDate,
      ref: move.name,
      origin: move.origin || move.name,
      state: 'posted',
      payment_state: 'not_paid',
      lines: [
        {
          id: 1,
          product_id: (move.lines && move.lines[0] && move.lines[0].product_id) || 1,
          name: `Saldo Restante Cuota #${nextInstallmentNum} (tras Abono de $ ${Number(priorPaymentAmount || 0).toLocaleString('es-CO')} el ${nextDate} a ${move.name})`,
          account_code: '413501',
          account_name: 'Ingresos por Servicios de Software y Consultoría',
          quantity: 1,
          price_unit: nextUntaxed,
          tax_rate: nextUntaxed > 0 ? round2((nextTax / nextUntaxed) * 100) : 19,
          subtotal: nextUntaxed,
          tax_amount: nextTax,
          total: residualAmount
        }
      ],
      journal_items: [
        {
          account_code: '130505',
          account_name: 'Clientes Nacionales (Cuentas por Cobrar)',
          label: `${nextInvName} - ${move.partner_name} (Saldo Cuota #${nextInstallmentNum})`,
          debit: residualAmount,
          credit: 0
        },
        {
          account_code: '413501',
          account_name: 'Ingresos por Servicios de Software y Consultoría',
          label: `Saldo Restante tras Abono ${move.name}`,
          debit: 0,
          credit: nextUntaxed
        }
      ],
      amount_untaxed: nextUntaxed,
      amount_tax: nextTax,
      amount_total: residualAmount,
      amount_residual: residualAmount,
      order_total: move.order_total || move.amount_total,
      order_residual: residualAmount,
      installment_number: nextInstallmentNum,
      is_installment: true,
      prior_invoice_id: move.id,
      prior_invoice_name: move.name,
      prior_payment_amount: priorPaymentAmount,
      prior_payment_date: nextDate,
      payments_history: [],
      chatter: [
        {
          id: Date.now() + 2,
          author: this.getActiveAuthor(),
          date: this.formatNowShort(),
          text: `Factura ${nextInvName} generada automáticamente por saldo restante de $ ${residualAmount.toLocaleString('es-CO')} tras abono de $ ${Number(priorPaymentAmount || 0).toLocaleString('es-CO')} el ${nextDate} a la factura ${move.name}.`
        }
      ]
    };

    if (nextTax > 0) {
      nextInvoice.journal_items.push({
        account_code: '240801',
        account_name: 'IVA Generado en Ventas (19%)',
        label: `IVA Generado ${nextInvName}`,
        debit: 0,
        credit: nextTax
      });
    }

    this.data.accounting.moves.unshift(nextInvoice);

    const linkedSale = this.data.sales.find((s) => (s.invoice_ids || []).includes(move.id) || s.name === move.origin || s.name === move.ref);
    if (linkedSale && !(linkedSale.invoice_ids || []).includes(nextInvoice.id)) {
      linkedSale.invoice_ids = [...(linkedSale.invoice_ids || []), nextInvoice.id];
    }

    move.chatter.push({
      id: Date.now() + 3,
      author: this.getActiveAuthor(),
      date: this.formatNowShort(),
      text: `Siguiente factura por saldo restante emitida: ${nextInvName} ($ ${residualAmount.toLocaleString('es-CO')}).`
    });

    return nextInvoice;
  }

  async transitionAccountMove(id, action, extra = {}) {
    const move = this.data.accounting.moves.find((m) => Number(m.id) === Number(id));
    if (!move) throw new Error('Documento contable no encontrado.');

    let payment = null;
    let nextInvoice = null;

    const reverseLinkedPayments = () => {
      const linked = this.data.accounting.payments.filter((p) => Number(p.move_id) === Number(move.id));
      linked.forEach((p) => {
        const reversalDelta = p.payment_type === 'inbound' ? -p.amount : p.amount;
        this.adjustJournalBalance(p.journal_code, reversalDelta);
      });
      this.data.accounting.payments = this.data.accounting.payments.filter((p) => Number(p.move_id) !== Number(move.id));
    };

    if (action === 'post') {
      if (move.state === 'posted') return move;
      if (move.name === 'Borrador' || !move.name) {
        if (move.move_type === 'out_invoice') {
          move.name = `INV/2026/${this.padSeq(this.nextSeq('move_inv'), 4)}`;
        } else if (move.move_type === 'in_invoice') {
          move.name = `BILL/2026/${this.padSeq(this.nextSeq('move_bill'), 4)}`;
        } else {
          move.name = `MISC/2026/${this.padSeq(this.nextSeq('move_misc'), 4)}`;
        }
      }
      move.state = 'posted';
      move.amount_residual = move.amount_total;
      move.payment_state = 'not_paid';
      move.chatter.push({
        id: Date.now(),
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: `Asiento confirmado y publicado con consecutivo ${move.name}.`
      });
    } else if (action === 'register_payment') {
      if (move.state !== 'posted') {
        throw new Error('El documento debe estar Publicado antes de registrar un pago.');
      }
      const payAmount = round2(extra.amount ?? move.amount_residual);
      if (payAmount <= 0) throw new Error('El monto del pago debe ser mayor a 0.');
      if (payAmount > move.amount_residual) {
        throw new Error('El monto del pago no puede superar el saldo pendiente.');
      }

      const paySeq = this.nextSeq('payment');
      const payId = this.data.accounting.payments.reduce((m, p) => Math.max(m, Number(p.id)), 0) + 1;
      const payName = `PAY/2026/${this.padSeq(paySeq, 4)}`;
      const journalCode = extra.journal_code || 'BNK1';
      const journalName = journalCode === 'CSH1' ? 'Caja General Efectivo' : 'Banco Bancolombia Cta Cte';
      const paymentType = move.move_type === 'out_invoice' ? 'inbound' : 'outbound';

      payment = {
        id: payId,
        name: payName,
        payment_type: paymentType,
        partner_id: move.partner_id,
        partner_name: move.partner_name,
        amount: payAmount,
        date: extra.date || todayStr(),
        journal_code: journalCode,
        journal_name: journalName,
        ref: extra.ref || move.name,
        move_id: move.id,
        state: 'posted'
      };
      this.data.accounting.payments.unshift(payment);
      this.adjustJournalBalance(journalCode, paymentType === 'inbound' ? payAmount : -payAmount);

      move.payments_history = move.payments_history || [];
      const paymentItem = {
        id: payId,
        payment_id: payId,
        name: payName,
        amount: payAmount,
        date: extra.date || todayStr(),
        journal_code: journalCode,
        journal_name: journalName,
        residual_after: round2(move.amount_residual - payAmount)
      };
      move.payments_history.push(paymentItem);
      move.last_payment_date = extra.date || todayStr();
      move.last_payment_amount = payAmount;

      move.amount_residual = round2(move.amount_residual - payAmount);
      move.payment_state = move.amount_residual === 0 ? 'paid' : 'partial';
      move.chatter.push({
        id: Date.now(),
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: `Pago ${payName} registrado por $ ${payAmount.toLocaleString('es-CO')} en ${journalName}. Saldo pendiente: $ ${move.amount_residual.toLocaleString('es-CO')}.`
      });

      if (extra.generate_residual_invoice && move.amount_residual > 0 && move.move_type === 'out_invoice') {
        nextInvoice = this.createResidualInstallmentInvoice(move, payAmount, extra.date || todayStr());
      }
    } else if (action === 'generate_residual_invoice') {
      if (move.amount_residual <= 0) {
        throw new Error('Esta factura no tiene saldo pendiente por facturar en una nueva cuota.');
      }
      nextInvoice = this.createResidualInstallmentInvoice(move, move.last_payment_amount || 0, todayStr());
    } else if (action === 'cancel') {
      reverseLinkedPayments();
      move.state = 'cancel';
      move.payment_state = 'not_paid';
      move.amount_residual = 0;
      move.chatter.push({
        id: Date.now(),
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: 'Documento contable cancelado.'
      });
    } else if (action === 'draft') {
      reverseLinkedPayments();
      move.state = 'draft';
      move.payment_state = 'not_paid';
      move.amount_residual = move.amount_total;
      move.chatter.push({
        id: Date.now(),
        author: this.getActiveAuthor(),
        date: this.formatNowShort(),
        text: 'Restablecido a Borrador.'
      });
    } else {
      throw new Error(`Acción contable no soportada: ${action}`);
    }

    // Recompute linked sale order invoice status if applicable
    const linkedSale = this.data.sales.find((s) => (s.invoice_ids || []).includes(move.id));
    if (linkedSale) {
      this.recomputeSaleOrderInvoiceStatus(linkedSale);
    }

    this.save();
    if (this.supabase) {
      await this.supabase.saveAccountMove(move);
      if (nextInvoice) {
        await this.supabase.saveAccountMove(nextInvoice);
      }
      if (action === 'register_payment' && payment) {
        await this.supabase.savePayment(payment);
      } else if (action === 'cancel' || action === 'draft') {
        await this.supabase.deletePaymentsByMoveId(move.id);
      }
      if (linkedSale) {
        await this.supabase.saveSaleOrder(linkedSale);
      }
    }
    if (nextInvoice) {
      move.next_invoice = nextInvoice;
    }
    return move;
  }

  saveAccount(payload) {
    const code = String(payload.code || '').trim();
    const name = String(payload.name || '').trim();
    if (!code || !name) throw new Error('Código y nombre de la cuenta contable son obligatorios.');
    if (this.data.accounting.accounts.some((a) => a.code === code && Number(a.id) !== Number(payload.id))) {
      throw new Error(`Ya existe una cuenta con el código ${code}.`);
    }
    const id = this.nextSeq('account');
    const acc = {
      id,
      code,
      name,
      type: String(payload.type || 'Activo Corriente').trim(),
      reconcile: Boolean(payload.reconcile)
    };
    this.data.accounting.accounts.push(acc);
    this.data.accounting.accounts.sort((a, b) => a.code.localeCompare(b.code));
    this.save();
    return acc;
  }

  // ==================== AJUSTES (res.config.settings) ====================
  async saveSettings(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Parámetros de configuración inválidos.');
    const currencySymbols = { COP: '$', USD: 'US$', EUR: '€' };
    const nextCurrency = payload.currency || this.data.settings.currency;
    let activeUser = this.data.settings.active_user;
    if (payload.active_user_id) {
      const foundUser = (this.data.settings.users || []).find((u) => Number(u.id) === Number(payload.active_user_id));
      if (foundUser) {
        activeUser = { id: foundUser.id, name: foundUser.name, email: foundUser.email, role: foundUser.role };
      }
    }
    const oldSettings = { ...this.data.settings };
    this.data.settings = {
      ...this.data.settings,
      ...payload,
      active_user: activeUser,
      currency: nextCurrency,
      currency_symbol: currencySymbols[nextCurrency] || '$'
    };
    this.save();
    if (this.supabase) {
      try {
        await this.supabase.saveSettings(this.data.settings);
      } catch (err) {
        this.data.settings = oldSettings;
        this.save();
        throw err;
      }
    }
    return this.data.settings;
  }

  addChatterNote(model, id, text) {
    const clean = String(text || '').trim();
    if (!clean) throw new Error('El comentario no puede estar vacío.');
    let collection = null;
    if (model === 'contacts') collection = this.data.contacts;
    else if (model === 'expenses') collection = this.data.expenses;
    else if (model === 'sales') collection = this.data.sales;
    else if (model === 'moves') collection = this.data.accounting.moves;
    if (!collection) throw new Error('Modelo no válido para notas.');

    const record = collection.find((r) => Number(r.id) === Number(id));
    if (!record) throw new Error('Registro no encontrado.');
    record.chatter = record.chatter || [];
    const note = {
      id: Date.now(),
      author: this.getActiveAuthor(),
      date: this.formatNowShort(),
      text: clean
    };
    record.chatter.push(note);
    this.save();
    return record;
  }
}

module.exports = { ERPStore, createInitialData };
