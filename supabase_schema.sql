-- ============================================================================
-- CHapp ERP — Esquema Relacional Base (PostgreSQL / Supabase)
-- Esquema relacional de tablas principales:
--   res_partner (Contactos), product_template (Productos),
--   hr_expense (Gastos), sale_order & sale_order_line (Ventas),
--   account_move & account_payment (Contabilidad), res_config_settings (Ajustes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.res_partner (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  is_company BOOLEAN NOT NULL DEFAULT true,
  vat TEXT,
  function TEXT,
  street TEXT,
  city TEXT DEFAULT 'Bogotá D.C.',
  state_name TEXT DEFAULT 'Cundinamarca',
  country TEXT DEFAULT 'Colombia',
  email TEXT,
  phone TEXT,
  mobile TEXT,
  website TEXT,
  customer_rank INT NOT NULL DEFAULT 1,
  supplier_rank INT NOT NULL DEFAULT 0,
  category_ids TEXT[] DEFAULT ARRAY['Contacto'],
  payment_term TEXT DEFAULT '30 Días',
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_template (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  default_code TEXT,
  type TEXT NOT NULL DEFAULT 'service',
  list_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  standard_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 19,
  category TEXT DEFAULT 'General',
  can_be_sold BOOLEAN NOT NULL DEFAULT true,
  can_be_expensed BOOLEAN NOT NULL DEFAULT true,
  uom TEXT DEFAULT 'Unidad'
);

CREATE TABLE IF NOT EXISTS public.sale_order (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  partner_id BIGINT REFERENCES public.res_partner(id),
  partner_name TEXT NOT NULL,
  date_order DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_date DATE,
  salesperson TEXT,
  payment_term TEXT DEFAULT '30 Días',
  state TEXT NOT NULL DEFAULT 'draft', -- draft, sent, sale, cancel
  invoice_status TEXT NOT NULL DEFAULT 'no', -- no, to invoice, invoiced
  amount_untaxed NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_order_line (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.sale_order(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES public.product_template(id),
  product_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  price_unit NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 19,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.account_move (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  move_type TEXT NOT NULL DEFAULT 'out_invoice', -- out_invoice, in_invoice, entry
  journal_code TEXT NOT NULL DEFAULT 'INV',
  partner_id BIGINT REFERENCES public.res_partner(id),
  partner_name TEXT,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_date_due DATE,
  ref TEXT,
  origin TEXT,
  state TEXT NOT NULL DEFAULT 'draft', -- draft, posted, cancel
  payment_state TEXT NOT NULL DEFAULT 'not_paid', -- not_paid, partial, paid
  amount_untaxed NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_residual NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_expense (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  department TEXT,
  product_id BIGINT REFERENCES public.product_template(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT NOT NULL DEFAULT 'own_account', -- own_account, company_account
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  price_unit NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  untaxed_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  partner_id BIGINT REFERENCES public.res_partner(id),
  receipt_ref TEXT,
  notes TEXT,
  state TEXT NOT NULL DEFAULT 'draft', -- draft, submitted, approved, posted, paid, refused
  move_id BIGINT REFERENCES public.account_move(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.account_payment (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'inbound', -- inbound, outbound
  partner_id BIGINT REFERENCES public.res_partner(id),
  partner_name TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  journal_code TEXT NOT NULL DEFAULT 'BNK1',
  journal_name TEXT DEFAULT 'Banco Bancolombia Cta Cte',
  ref TEXT,
  move_id BIGINT REFERENCES public.account_move(id),
  state TEXT NOT NULL DEFAULT 'posted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.res_config_settings (
  id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT 'CHapp ERP S.A.S.',
  company_vat TEXT,
  company_email TEXT DEFAULT 'chappdevm@gmail.com',
  company_phone TEXT,
  company_city TEXT DEFAULT 'Bogotá D.C.',
  company_country TEXT DEFAULT 'Colombia',
  company_address TEXT,
  currency TEXT NOT NULL DEFAULT 'COP',
  currency_symbol TEXT NOT NULL DEFAULT '$',
  theme TEXT NOT NULL DEFAULT 'dark',
  quotation_validity_days INT NOT NULL DEFAULT 30,
  enable_line_discounts BOOLEAN NOT NULL DEFAULT true,
  default_sale_tax NUMERIC(5,2) NOT NULL DEFAULT 19,
  default_purchase_tax NUMERIC(5,2) NOT NULL DEFAULT 19,
  fiscal_regime TEXT DEFAULT 'Responsable de IVA - Régimen Ordinario',
  expense_approval_required BOOLEAN NOT NULL DEFAULT true,
  expense_default_journal TEXT DEFAULT 'EXJ',
  default_bank_journal TEXT DEFAULT 'BNK1',
  sale_terms TEXT DEFAULT 'Condiciones de pago y entrega según cotización.',
  active_user JSONB,
  users JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- POLÍTICAS ROW LEVEL SECURITY (RLS)
-- Permite lectura y escritura completa tanto con service_role como con anon
-- para evitar errores 401 Unauthorized y lecturas vacías [].
-- ============================================================================

-- 1. res_partner
ALTER TABLE public.res_partner ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated, anon, and service on res_partner" ON public.res_partner;
CREATE POLICY "Allow all for authenticated, anon, and service on res_partner"
  ON public.res_partner FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 2. product_template
ALTER TABLE public.product_template ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated, anon, and service on product_template" ON public.product_template;
CREATE POLICY "Allow all for authenticated, anon, and service on product_template"
  ON public.product_template FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 3. sale_order
ALTER TABLE public.sale_order ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated, anon, and service on sale_order" ON public.sale_order;
CREATE POLICY "Allow all for authenticated, anon, and service on sale_order"
  ON public.sale_order FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 4. sale_order_line
ALTER TABLE public.sale_order_line ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated, anon, and service on sale_order_line" ON public.sale_order_line;
CREATE POLICY "Allow all for authenticated, anon, and service on sale_order_line"
  ON public.sale_order_line FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 5. account_move
ALTER TABLE public.account_move ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated, anon, and service on account_move" ON public.account_move;
CREATE POLICY "Allow all for authenticated, anon, and service on account_move"
  ON public.account_move FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 6. hr_expense
ALTER TABLE public.hr_expense ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated, anon, and service on hr_expense" ON public.hr_expense;
CREATE POLICY "Allow all for authenticated, anon, and service on hr_expense"
  ON public.hr_expense FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 7. account_payment
ALTER TABLE public.account_payment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated, anon, and service on account_payment" ON public.account_payment;
CREATE POLICY "Allow all for authenticated, anon, and service on account_payment"
  ON public.account_payment FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 8. res_config_settings
ALTER TABLE public.res_config_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated, anon, and service on res_config_settings" ON public.res_config_settings;
CREATE POLICY "Allow all for authenticated, anon, and service on res_config_settings"
  ON public.res_config_settings FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Permisos explícitos a roles de API de Supabase
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

