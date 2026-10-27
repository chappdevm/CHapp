const fs = require('fs');
const path = require('path');

// Built-in zero-dependency .env loader
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '.env.local')
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (process.env[key] === undefined) {
              process.env[key] = val;
            }
          }
        }
      } catch (_) {}
    }
  }
}

loadEnv();

const tableAvailability = {
  res_partner: true,
  product_template: true,
  hr_expense: true,
  sale_order: true,
  sale_order_line: true,
  account_move: true,
  account_payment: null, // tested on first call
  res_config_settings: null // tested on first call
};

function cleanEnvVal(val) {
  if (!val) return '';
  let str = String(val).trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str;
}

function isServiceRoleKey(key) {
  if (!key) return false;
  const cleaned = cleanEnvVal(key);
  if (cleaned.startsWith('sb_secret_')) return true;
  try {
    const parts = cleaned.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      if (payload && payload.role === 'service_role') return true;
    }
  } catch (_) {}
  return false;
}

function getSupabaseConfig() {
  const rawUrl = cleanEnvVal(
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  );
  const url = rawUrl.replace(/\/+$/, '');

  let serviceKey = cleanEnvVal(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ''
  );

  let anonKey = cleanEnvVal(
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  );

  // If serviceKey was not set via explicit service alias, but anonKey / generic SUPABASE_KEY is a service_role key:
  if (!serviceKey && isServiceRoleKey(anonKey)) {
    serviceKey = anonKey;
  }

  // Prioritize serviceKey over anonKey
  const key = serviceKey || anonKey;
  const isServiceRole = Boolean(serviceKey);
  const isEnabled = Boolean(url && key);

  return {
    url,
    key,
    isServiceRole,
    enabled: isEnabled
  };
}

function isSupabaseConfigured() {
  return getSupabaseConfig().enabled;
}

async function callPostgrest(endpoint, options = {}) {
  const config = getSupabaseConfig();
  if (!config.enabled) {
    throw new Error('Supabase no está configurado (faltan SUPABASE_URL y llaves).');
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${config.url}/rest/v1${cleanEndpoint}`;

  const headers = {
    'apikey': config.key,
    'Authorization': `Bearer ${config.key}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const method = (options.method || 'GET').toUpperCase();
  const fetchOpts = {
    method,
    headers
  };

  if (options.body !== undefined) {
    fetchOpts.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timeoutMs = options.timeout || 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  fetchOpts.signal = controller.signal;

  try {
    const res = await fetch(fullUrl, fetchOpts);
    clearTimeout(timeoutId);

    if (res.status === 404) {
      return { status: 404, ok: false, data: null, error: 'Table or route not found' };
    }

    if (!res.ok) {
      const errText = await res.text();
      return { status: res.status, ok: false, error: errText, data: null };
    }

    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return { status: res.status, ok: true, data: null };
    }

    const text = await res.text();
    if (!text || !text.trim()) {
      return { status: res.status, ok: true, data: null };
    }

    let data = null;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = text;
    }
    return { status: res.status, ok: true, data };
  } catch (err) {
    clearTimeout(timeoutId);
    return { status: 0, ok: false, error: err.message || 'Error de conexión a Supabase', data: null };
  }
}

// ==================== MAPPERS ====================

function serializePartner(p) {
  return {
    id: Number(p.id),
    name: String(p.name || '').trim(),
    is_company: p.is_company !== undefined ? Boolean(p.is_company) : true,
    vat: p.vat ? String(p.vat).trim() : null,
    function: p.function ? String(p.function).trim() : null,
    street: p.street ? String(p.street).trim() : null,
    city: p.city ? String(p.city).trim() : 'Bogotá D.C.',
    state_name: p.state_name ? String(p.state_name).trim() : 'Cundinamarca',
    country: p.country ? String(p.country).trim() : 'Colombia',
    email: p.email ? String(p.email).trim() : null,
    phone: p.phone ? String(p.phone).trim() : null,
    mobile: p.mobile ? String(p.mobile).trim() : null,
    website: p.website ? String(p.website).trim() : null,
    customer_rank: Number(p.customer_rank ?? 1),
    supplier_rank: Number(p.supplier_rank ?? 0),
    category_ids: Array.isArray(p.category_ids) ? p.category_ids : ['Contacto'],
    payment_term: p.payment_term ? String(p.payment_term).trim() : '30 Días',
    notes: p.notes ? String(p.notes).trim() : null,
    active: p.active !== false
  };
}

function deserializePartner(r) {
  const id = Number(r.id);
  return {
    id,
    name: r.name,
    is_company: Boolean(r.is_company),
    company_name: r.is_company ? r.name : '',
    vat: r.vat || '',
    function: r.function || (r.is_company ? 'Empresa' : 'Contacto'),
    street: r.street || '',
    city: r.city || 'Bogotá D.C.',
    state_name: r.state_name || 'Cundinamarca',
    country: r.country || 'Colombia',
    email: r.email || '',
    phone: r.phone || '',
    mobile: r.mobile || '',
    website: r.website || '',
    customer_rank: Number(r.customer_rank || 0),
    supplier_rank: Number(r.supplier_rank || 0),
    category_ids: Array.isArray(r.category_ids) ? r.category_ids : ['Contacto'],
    payment_term: r.payment_term || '30 Días',
    color: (id % 11) + 1,
    notes: r.notes || '',
    active: r.active !== false,
    created_at: r.created_at || new Date().toISOString(),
    chatter: []
  };
}

function serializeProduct(p) {
  return {
    id: Number(p.id),
    name: String(p.name || '').trim(),
    default_code: p.default_code ? String(p.default_code).trim() : null,
    type: p.type || 'service',
    list_price: Number(p.list_price || 0),
    standard_price: Number(p.standard_price || 0),
    tax_rate: Number(p.tax_rate ?? 19),
    category: p.category ? String(p.category).trim() : 'General',
    can_be_sold: p.can_be_sold !== false,
    can_be_expensed: p.can_be_expensed !== false,
    uom: p.uom ? String(p.uom).trim() : 'Unidad'
  };
}

function deserializeProduct(r) {
  return {
    id: Number(r.id),
    name: r.name,
    default_code: r.default_code || '',
    type: r.type || 'service',
    list_price: Number(r.list_price || 0),
    standard_price: Number(r.standard_price || 0),
    tax_rate: Number(r.tax_rate ?? 19),
    category: r.category || 'General',
    can_be_sold: Boolean(r.can_be_sold),
    can_be_expensed: Boolean(r.can_be_expensed),
    uom: r.uom || 'Unidad'
  };
}

function serializeExpense(e) {
  return {
    id: Number(e.id),
    reference: String(e.reference || '').trim(),
    name: String(e.name || '').trim(),
    employee_name: String(e.employee_name || 'Empleado').trim(),
    department: e.department ? String(e.department).trim() : null,
    product_id: e.product_id ? Number(e.product_id) : null,
    date: e.date ? String(e.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    payment_mode: e.payment_mode || 'own_account',
    quantity: Number(e.quantity || 1),
    price_unit: Number(e.price_unit || 0),
    tax_rate: Number(e.tax_rate || 0),
    untaxed_amount: Number(e.untaxed_amount || 0),
    tax_amount: Number(e.tax_amount || 0),
    total_amount: Number(e.total_amount || 0),
    partner_id: e.partner_id ? Number(e.partner_id) : null,
    receipt_ref: e.receipt_ref ? String(e.receipt_ref).trim() : null,
    notes: e.notes ? String(e.notes).trim() : null,
    state: e.state || 'draft',
    move_id: e.move_id ? Number(e.move_id) : null
  };
}

function deserializeExpense(r) {
  return {
    id: Number(r.id),
    reference: r.reference,
    name: r.name,
    employee_name: r.employee_name,
    department: r.department || '',
    product_id: r.product_id ? Number(r.product_id) : null,
    product_name: '',
    date: String(r.date || '').slice(0, 10),
    payment_mode: r.payment_mode || 'own_account',
    quantity: Number(r.quantity),
    price_unit: Number(r.price_unit),
    tax_rate: Number(r.tax_rate || 0),
    untaxed_amount: Number(r.untaxed_amount),
    tax_amount: Number(r.tax_amount),
    total_amount: Number(r.total_amount),
    partner_id: r.partner_id ? Number(r.partner_id) : null,
    partner_name: '',
    receipt_ref: r.receipt_ref || '',
    notes: r.notes || '',
    state: r.state || 'draft',
    move_id: r.move_id ? Number(r.move_id) : null,
    payment_id: null,
    chatter: []
  };
}

function serializeSaleOrder(s) {
  return {
    id: Number(s.id),
    name: String(s.name || '').trim(),
    partner_id: s.partner_id ? Number(s.partner_id) : null,
    partner_name: String(s.partner_name || '').trim(),
    date_order: s.date_order ? String(s.date_order).slice(0, 10) : new Date().toISOString().slice(0, 10),
    validity_date: s.validity_date ? String(s.validity_date).slice(0, 10) : null,
    salesperson: s.salesperson ? String(s.salesperson).trim() : null,
    payment_term: s.payment_term ? String(s.payment_term).trim() : '30 Días',
    state: s.state || 'draft',
    invoice_status: s.invoice_status || 'no',
    amount_untaxed: Number(s.amount_untaxed || 0),
    amount_tax: Number(s.amount_tax || 0),
    amount_total: Number(s.amount_total || 0),
    notes: s.notes ? String(s.notes).trim() : null
  };
}

function serializeSaleOrderLine(l, orderId) {
  return {
    order_id: Number(orderId),
    product_id: l.product_id ? Number(l.product_id) : null,
    product_name: String(l.product_name || 'Producto').trim(),
    description: l.description ? String(l.description).trim() : null,
    quantity: Number(l.quantity || 1),
    price_unit: Number(l.price_unit || 0),
    discount: Number(l.discount || 0),
    tax_rate: Number(l.tax_rate || 0),
    subtotal: Number(l.subtotal || 0),
    tax_amount: Number(l.tax_amount || 0),
    total: Number(l.total || 0)
  };
}

function deserializeSaleOrder(r) {
  const lines = Array.isArray(r.sale_order_line)
    ? r.sale_order_line.map((l, i) => ({
        id: Number(l.id || i + 1),
        product_id: l.product_id ? Number(l.product_id) : null,
        product_name: l.product_name,
        description: l.description || l.product_name,
        quantity: Number(l.quantity),
        uom: 'Unidad',
        price_unit: Number(l.price_unit),
        discount: Number(l.discount || 0),
        tax_rate: Number(l.tax_rate || 0),
        subtotal: Number(l.subtotal),
        tax_amount: Number(l.tax_amount),
        total: Number(l.total)
      }))
    : [];

  return {
    id: Number(r.id),
    name: r.name,
    partner_id: r.partner_id ? Number(r.partner_id) : null,
    partner_name: r.partner_name,
    date_order: String(r.date_order || '').slice(0, 10),
    validity_date: r.validity_date ? String(r.validity_date).slice(0, 10) : null,
    salesperson: r.salesperson || '',
    payment_term: r.payment_term || '30 Días',
    state: r.state || 'draft',
    invoice_status: r.invoice_status || 'no',
    amount_untaxed: Number(r.amount_untaxed || 0),
    amount_tax: Number(r.amount_tax || 0),
    amount_total: Number(r.amount_total || 0),
    notes: r.notes || '',
    invoice_ids: [],
    lines,
    chatter: []
  };
}

function serializeAccountMove(m) {
  return {
    id: Number(m.id),
    name: String(m.name || 'Borrador').trim(),
    move_type: m.move_type || 'out_invoice',
    journal_code: m.journal_code || 'INV',
    partner_id: m.partner_id ? Number(m.partner_id) : null,
    partner_name: m.partner_name ? String(m.partner_name).trim() : null,
    invoice_date: m.invoice_date ? String(m.invoice_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    invoice_date_due: m.invoice_date_due ? String(m.invoice_date_due).slice(0, 10) : null,
    ref: m.ref ? String(m.ref).trim() : null,
    origin: m.origin ? String(m.origin).trim() : null,
    state: m.state || 'draft',
    payment_state: m.payment_state || 'not_paid',
    amount_untaxed: Number(m.amount_untaxed || 0),
    amount_tax: Number(m.amount_tax || 0),
    amount_total: Number(m.amount_total || 0),
    amount_residual: Number(m.amount_residual || 0)
  };
}

function deserializeAccountMove(r) {
  const moveType = r.move_type || 'out_invoice';
  const isOutInvoice = moveType === 'out_invoice';
  const isExpenseMove = r.journal_code === 'EXJ' || moveType === 'entry';
  const defaultAccountCode = isOutInvoice ? '413501' : isExpenseMove ? '510506' : '519530';
  const defaultAccountName = isOutInvoice
    ? 'Ingresos por Servicios de Software y Consultoría'
    : isExpenseMove
    ? 'Gastos de Viaje, Viáticos y Representación'
    : 'Gastos de Tecnología, Licencias y Suministros';

  const amountUntaxed = Number(r.amount_untaxed || 0);
  const amountTax = Number(r.amount_tax || 0);
  const amountTotal = Number(r.amount_total || 0);

  let journalItems = [];
  if (isOutInvoice) {
    journalItems = [
      { account_code: '130505', account_name: 'Clientes Nacionales (Cuentas por Cobrar)', label: r.partner_name || '', debit: amountTotal, credit: 0 },
      { account_code: '413501', account_name: 'Ingresos por Servicios de Software y Consultoría', label: 'Ingresos por facturación', debit: 0, credit: amountUntaxed },
      ...(amountTax > 0 ? [{ account_code: '240801', account_name: 'IVA Generado en Ventas (19%)', label: 'IVA Generado', debit: 0, credit: amountTax }] : [])
    ];
  } else if (isExpenseMove) {
    journalItems = [
      { account_code: '510506', account_name: 'Gastos de Viaje, Viáticos y Representación', label: r.ref || 'Gasto de empleado', debit: amountUntaxed, credit: 0 },
      ...(amountTax > 0 ? [{ account_code: '240802', account_name: 'IVA Descontable en Compras y Gastos (19%)', label: 'IVA Descontable', debit: amountTax, credit: 0 }] : []),
      { account_code: '233595', account_name: 'Costos y Gastos por Pagar / Reembolsos', label: r.partner_name || 'Empleado', debit: 0, credit: amountTotal }
    ];
  } else {
    journalItems = [
      { account_code: '519530', account_name: 'Gastos de Tecnología, Licencias y Suministros', label: 'Compras / Gastos', debit: amountUntaxed, credit: 0 },
      ...(amountTax > 0 ? [{ account_code: '240802', account_name: 'IVA Descontable en Compras y Gastos (19%)', label: 'IVA Descontable', debit: amountTax, credit: 0 }] : []),
      { account_code: '220505', account_name: 'Proveedores Nacionales (Cuentas por Pagar)', label: r.partner_name || '', debit: 0, credit: amountTotal }
    ];
  }

  return {
    id: Number(r.id),
    name: r.name,
    move_type: moveType,
    journal_id: r.journal_code === 'INV' ? 1 : r.journal_code === 'BILL' ? 2 : 5,
    journal_code: r.journal_code || 'INV',
    journal_name:
      r.journal_code === 'INV'
        ? 'Facturas de Clientes'
        : r.journal_code === 'BILL'
        ? 'Facturas de Proveedores'
        : 'Gastos de Empleados',
    partner_id: r.partner_id ? Number(r.partner_id) : null,
    partner_name: r.partner_name || '',
    invoice_date: String(r.invoice_date || '').slice(0, 10),
    invoice_date_due: r.invoice_date_due ? String(r.invoice_date_due).slice(0, 10) : '',
    ref: r.ref || '',
    origin: r.origin || '',
    state: r.state || 'draft',
    payment_state: r.payment_state || 'not_paid',
    amount_untaxed: amountUntaxed,
    amount_tax: amountTax,
    amount_total: amountTotal,
    amount_residual: Number(r.amount_residual || 0),
    lines: [
      {
        id: 1,
        product_id: null,
        name: r.ref || r.name || 'Concepto contable',
        account_code: defaultAccountCode,
        account_name: defaultAccountName,
        quantity: 1,
        price_unit: amountUntaxed,
        tax_rate: amountUntaxed > 0 ? Math.round((amountTax / amountUntaxed) * 100) : 0,
        subtotal: amountUntaxed,
        tax_amount: amountTax,
        total: amountTotal
      }
    ],
    journal_items: journalItems,
    chatter: []
  };
}

function serializePayment(p) {
  return {
    id: Number(p.id),
    name: String(p.name || '').trim(),
    payment_type: p.payment_type || 'inbound',
    partner_id: p.partner_id ? Number(p.partner_id) : null,
    partner_name: p.partner_name ? String(p.partner_name).trim() : null,
    amount: Number(p.amount || 0),
    date: p.date ? String(p.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    journal_code: p.journal_code || 'BNK1',
    journal_name: p.journal_name || 'Banco Bancolombia Cta Cte',
    ref: p.ref ? String(p.ref).trim() : null,
    move_id: p.move_id ? Number(p.move_id) : null,
    state: p.state || 'posted'
  };
}

function deserializePayment(r) {
  return {
    id: Number(r.id),
    name: r.name,
    payment_type: r.payment_type || 'inbound',
    partner_id: r.partner_id ? Number(r.partner_id) : null,
    partner_name: r.partner_name || '',
    amount: Number(r.amount || 0),
    date: String(r.date || '').slice(0, 10),
    journal_code: r.journal_code || 'BNK1',
    journal_name: r.journal_name || 'Banco Bancolombia Cta Cte',
    ref: r.ref || '',
    move_id: r.move_id ? Number(r.move_id) : null,
    state: r.state || 'posted'
  };
}

function serializeSettings(s) {
  return {
    id: 1,
    company_name: String(s.company_name || 'CHapp ERP S.A.S.').trim(),
    company_vat: s.company_vat ? String(s.company_vat).trim() : null,
    company_email: s.company_email ? String(s.company_email).trim() : 'chappdevm@gmail.com',
    company_phone: s.company_phone ? String(s.company_phone).trim() : null,
    company_city: s.company_city ? String(s.company_city).trim() : 'Bogotá D.C.',
    company_country: s.company_country ? String(s.company_country).trim() : 'Colombia',
    company_address: s.company_address ? String(s.company_address).trim() : null,
    currency: s.currency || 'COP',
    currency_symbol: s.currency_symbol || '$',
    theme: s.theme || 'dark',
    quotation_validity_days: Number(s.quotation_validity_days || 30),
    enable_line_discounts: s.enable_line_discounts !== false,
    default_sale_tax: Number(s.default_sale_tax ?? 19),
    default_purchase_tax: Number(s.default_purchase_tax ?? 19),
    fiscal_regime: s.fiscal_regime ? String(s.fiscal_regime).trim() : 'Responsable de IVA - Régimen Ordinario',
    expense_approval_required: s.expense_approval_required !== false,
    expense_default_journal: s.expense_default_journal || 'EXJ',
    default_bank_journal: s.default_bank_journal || 'BNK1',
    sale_terms: s.sale_terms ? String(s.sale_terms).trim() : 'Condiciones de pago y entrega según cotización.',
    active_user: s.active_user || null,
    users: s.users || null,
    updated_at: new Date().toISOString()
  };
}

function deserializeSettings(r, fallbackSettings = {}) {
  return {
    ...fallbackSettings,
    company_name: r.company_name || fallbackSettings.company_name || 'CHapp ERP S.A.S.',
    company_vat: r.company_vat || '',
    company_email: r.company_email || 'chappdevm@gmail.com',
    company_phone: r.company_phone || '',
    company_city: r.company_city || 'Bogotá D.C.',
    company_country: r.company_country || 'Colombia',
    company_address: r.company_address || '',
    currency: r.currency || 'COP',
    currency_symbol: r.currency_symbol || '$',
    theme: r.theme || 'dark',
    quotation_validity_days: Number(r.quotation_validity_days || 30),
    enable_line_discounts: r.enable_line_discounts !== false,
    default_sale_tax: Number(r.default_sale_tax ?? 19),
    default_purchase_tax: Number(r.default_purchase_tax ?? 19),
    fiscal_regime: r.fiscal_regime || 'Responsable de IVA - Régimen Ordinario',
    expense_approval_required: r.expense_approval_required !== false,
    expense_default_journal: r.expense_default_journal || 'EXJ',
    default_bank_journal: r.default_bank_journal || 'BNK1',
    sale_terms: r.sale_terms || 'Condiciones de pago y entrega según cotización.',
    active_user: r.active_user || fallbackSettings.active_user,
    users: r.users || fallbackSettings.users
  };
}

// ==================== DATABASE SYNC CLIENT ====================

class SupabasePersistence {
  constructor() {
    this.config = getSupabaseConfig();
    this.tableSupport = { ...tableAvailability };
  }

  isReady() {
    return this.config.enabled;
  }

  async loadAll(existingData = null) {
    if (!this.isReady()) return null;

    try {
      const [
        partnersRes,
        productsRes,
        expensesRes,
        salesRes,
        movesRes,
        paymentsRes,
        settingsRes
      ] = await Promise.all([
        callPostgrest('/res_partner?select=*&order=id.asc'),
        callPostgrest('/product_template?select=*&order=id.asc'),
        callPostgrest('/hr_expense?select=*&order=id.desc'),
        callPostgrest('/sale_order?select=*,sale_order_line(*)&order=id.desc'),
        callPostgrest('/account_move?select=*&order=id.desc'),
        this.tableSupport.account_payment !== false
          ? callPostgrest('/account_payment?select=*&order=id.desc')
          : Promise.resolve({ ok: false, status: 404 }),
        this.tableSupport.res_config_settings !== false
          ? callPostgrest('/res_config_settings?select=*&limit=1')
          : Promise.resolve({ ok: false, status: 404 })
      ]);

      if (paymentsRes.status === 404) {
        this.tableSupport.account_payment = false;
      }
      if (settingsRes.status === 404) {
        this.tableSupport.res_config_settings = false;
      }

      const hasQueryErrors = !partnersRes.ok || !productsRes.ok || !expensesRes.ok || !salesRes.ok || !movesRes.ok;
      if (hasQueryErrors) {
        console.warn('[Supabase] Una o más tablas retornaron error en loadAll. Preservando datos locales para evitar pérdida.');
      }

      const isService = this.config.isServiceRole;

      // Safe extractor: if query failed, or if anon/unauthorized key returned [] while local data exists, preserve local data!
      const extractSafe = (res, deserializer, localList) => {
        if (!res.ok || !Array.isArray(res.data)) {
          return Array.isArray(localList) ? localList : [];
        }
        // If anon key returned empty list [] but local data exists, protect against RLS SELECT wipeout
        if (res.data.length === 0 && !isService && Array.isArray(localList) && localList.length > 0) {
          console.warn('[Supabase] Lectura remota vacía [] con clave anon/no-servicio. Conservando datos locales para evitar borrado por RLS.');
          return localList;
        }
        return res.data.map(deserializer);
      };

      const contacts = extractSafe(partnersRes, deserializePartner, existingData ? existingData.contacts : []);
      const products = extractSafe(productsRes, deserializeProduct, existingData ? existingData.products : []);
      const expenses = extractSafe(expensesRes, deserializeExpense, existingData ? existingData.expenses : []);
      const sales = extractSafe(salesRes, deserializeSaleOrder, existingData ? existingData.sales : []);
      const moves = extractSafe(movesRes, deserializeAccountMove, existingData && existingData.accounting ? existingData.accounting.moves : []);
      const payments = extractSafe(paymentsRes, deserializePayment, existingData && existingData.accounting ? existingData.accounting.payments : []);

      let settings = existingData ? existingData.settings : null;
      if (settingsRes.ok && Array.isArray(settingsRes.data) && settingsRes.data[0]) {
        settings = deserializeSettings(settingsRes.data[0], settings || {});
      }

      // Re-link relationships (expenses product_name, partner_name; sales invoice_ids, bank balance)
      for (const e of expenses) {
        const prod = products.find((p) => Number(p.id) === Number(e.product_id));
        if (prod) e.product_name = prod.name;
        const part = contacts.find((c) => Number(c.id) === Number(e.partner_id));
        if (part) e.partner_name = part.name;
        const pay = payments.find((p) => p.ref === e.reference);
        if (pay) e.payment_id = pay.id;
      }

      for (const s of sales) {
        const linkedMoves = moves.filter((m) => m.origin === s.name || m.ref === s.name);
        s.invoice_ids = linkedMoves.map((m) => m.id);
      }

      return {
        contacts,
        products,
        expenses,
        sales,
        moves,
        payments,
        settings
      };
    } catch (err) {
      console.warn('[Supabase] Error cargando datos remotos, usando fallback local:', err.message);
      return null;
    }
  }

  async savePartner(partner) {
    if (!this.isReady()) return;
    const payload = serializePartner(partner);
    const res = await callPostgrest('/res_partner', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: payload
    });
    if (!res.ok) {
      const errMsg = `[Supabase] Error guardando contacto (HTTP ${res.status}): ${res.error}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
    return res.data;
  }

  async deletePartner(id) {
    if (!this.isReady()) return;
    const res = await callPostgrest(`/res_partner?id=eq.${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const errMsg = `[Supabase] Error eliminando contacto ${id} (HTTP ${res.status}): ${res.error}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
    return res.data;
  }

  async saveProduct(product) {
    if (!this.isReady()) return;
    const payload = serializeProduct(product);
    const res = await callPostgrest('/product_template', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: payload
    });
    if (!res.ok) {
      const errMsg = `[Supabase] Error guardando producto (HTTP ${res.status}): ${res.error}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
    return res.data;
  }

  async saveExpense(expense) {
    if (!this.isReady()) return;
    const payload = serializeExpense(expense);
    const res = await callPostgrest('/hr_expense', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: payload
    });
    if (!res.ok) {
      const errMsg = `[Supabase] Error guardando gasto (HTTP ${res.status}): ${res.error}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
    return res.data;
  }

  async saveSaleOrder(order) {
    if (!this.isReady()) return;
    const payload = serializeSaleOrder(order);
    const orderRes = await callPostgrest('/sale_order', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: payload
    });
    if (!orderRes.ok) {
      const errMsg = `[Supabase] Error guardando pedido de venta (HTTP ${orderRes.status}): ${orderRes.error}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }

    // Synchronize sale order lines
    const delRes = await callPostgrest(`/sale_order_line?order_id=eq.${order.id}`, { method: 'DELETE' });
    if (!delRes.ok && delRes.status !== 404) {
      const errMsg = `[Supabase] Error limpiando líneas del pedido ${order.id} (HTTP ${delRes.status}): ${delRes.error}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }

    if (Array.isArray(order.lines) && order.lines.length > 0) {
      const linePayloads = order.lines.map((l) => serializeSaleOrderLine(l, order.id));
      const lineRes = await callPostgrest('/sale_order_line', {
        method: 'POST',
        body: linePayloads
      });
      if (!lineRes.ok) {
        const errMsg = `[Supabase] Error guardando líneas del pedido (HTTP ${lineRes.status}): ${lineRes.error}`;
        console.error(errMsg);
        throw new Error(errMsg);
      }
    }
    return orderRes.data;
  }

  async saveAccountMove(move) {
    if (!this.isReady()) return;
    const payload = serializeAccountMove(move);
    const res = await callPostgrest('/account_move', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: payload
    });
    if (!res.ok) {
      const errMsg = `[Supabase] Error guardando documento contable (HTTP ${res.status}): ${res.error}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
    return res.data;
  }

  async savePayment(payment) {
    if (!this.isReady() || this.tableSupport.account_payment === false) return;
    const payload = serializePayment(payment);
    const res = await callPostgrest('/account_payment', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: payload
    });
    if (res.status === 404) {
      this.tableSupport.account_payment = false;
      return null;
    }
    if (!res.ok) {
      const errMsg = `[Supabase] Error guardando pago (HTTP ${res.status}): ${res.error}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
    return res.data;
  }

  async deletePaymentsByMoveId(moveId) {
    if (!this.isReady() || this.tableSupport.account_payment === false) return;
    const res = await callPostgrest(`/account_payment?move_id=eq.${moveId}`, { method: 'DELETE' });
    if (res.status === 404) {
      this.tableSupport.account_payment = false;
      return null;
    }
    if (!res.ok) {
      const errMsg = `[Supabase] Error eliminando pagos vinculados al asiento ${moveId} (HTTP ${res.status}): ${res.error}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
    return res.data;
  }

  async saveSettings(settings) {
    if (!this.isReady() || this.tableSupport.res_config_settings === false) return;
    const payload = serializeSettings(settings);
    const res = await callPostgrest('/res_config_settings', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: payload
    });
    if (res.status === 404) {
      this.tableSupport.res_config_settings = false;
      return null;
    }
    if (!res.ok) {
      const errMsg = `[Supabase] Error guardando ajustes (HTTP ${res.status}): ${res.error}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
    return res.data;
  }

  async resetData() {
    if (!this.isReady()) return;
    if (this.tableSupport.account_payment !== false) {
      const payRes = await callPostgrest('/account_payment?id=gt.0', { method: 'DELETE' });
      if (payRes.status === 404) this.tableSupport.account_payment = false;
    }
    await callPostgrest('/sale_order_line?id=gt.0', { method: 'DELETE' });
    await callPostgrest('/hr_expense?id=gt.0', { method: 'DELETE' });
    await callPostgrest('/sale_order?id=gt.0', { method: 'DELETE' });
    await callPostgrest('/account_move?id=gt.0', { method: 'DELETE' });
    await callPostgrest('/res_partner?id=gt.0', { method: 'DELETE' });
    await callPostgrest('/product_template?id=gt.0', { method: 'DELETE' });
  }
}

module.exports = {
  loadEnv,
  cleanEnvVal,
  isServiceRoleKey,
  getSupabaseConfig,
  isSupabaseConfigured,
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
};
