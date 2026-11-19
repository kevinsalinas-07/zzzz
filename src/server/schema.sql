CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  code VARCHAR(8) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL UNIQUE,
  address TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 0,
  full_name VARCHAR(160) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'CASHIER')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  full_name VARCHAR(160) NOT NULL,
  position VARCHAR(100) NOT NULL,
  monthly_salary NUMERIC(12,2) NOT NULL CHECK (monthly_salary > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingredients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(140) NOT NULL UNIQUE,
  unit VARCHAR(20) NOT NULL,
  minimum_stock NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(140) NOT NULL UNIQUE,
  category VARCHAR(60) NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price > 0),
  product_type VARCHAR(12) NOT NULL CHECK (product_type IN ('RECIPE', 'RESALE')),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS recipe_items (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (product_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS inventory_balances (
  id BIGSERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  ingredient_id INTEGER REFERENCES ingredients(id),
  product_id INTEGER REFERENCES products(id),
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((ingredient_id IS NOT NULL)::INTEGER + (product_id IS NOT NULL)::INTEGER = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_branch_ingredient_uq
  ON inventory_balances(branch_id, ingredient_id) WHERE ingredient_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_branch_product_uq
  ON inventory_balances(branch_id, product_id) WHERE product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL UNIQUE,
  tax_id VARCHAR(30) NOT NULL DEFAULT '',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS purchases (
  id BIGSERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  supplier_invoice VARCHAR(80) NOT NULL,
  purchased_at DATE NOT NULL DEFAULT CURRENT_DATE,
  due_at DATE NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  tax NUMERIC(12,2) NOT NULL CHECK (tax >= 0),
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, supplier_invoice)
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  ingredient_id INTEGER REFERENCES ingredients(id),
  product_id INTEGER REFERENCES products(id),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,4) NOT NULL CHECK (unit_cost >= 0),
  line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
  CHECK ((ingredient_id IS NOT NULL)::INTEGER + (product_id IS NOT NULL)::INTEGER = 1)
);

CREATE TABLE IF NOT EXISTS accounts_payable (
  id BIGSERIAL PRIMARY KEY,
  purchase_id BIGINT NOT NULL UNIQUE REFERENCES purchases(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  due_at DATE NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PARTIAL', 'PAID'))
);

CREATE TABLE IF NOT EXISTS cash_shifts (
  id BIGSERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  opened_by INTEGER NOT NULL REFERENCES users(id),
  closed_by INTEGER REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_amount NUMERIC(12,2) NOT NULL CHECK (opening_amount >= 0),
  counted_cash NUMERIC(12,2),
  counted_card NUMERIC(12,2),
  counted_bitcoin NUMERIC(12,2),
  counted_chivo NUMERIC(12,2),
  difference NUMERIC(12,2),
  cash_difference NUMERIC(12,2),
  card_difference NUMERIC(12,2),
  bitcoin_difference NUMERIC(12,2),
  chivo_difference NUMERIC(12,2),
  status VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED'))
);
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS cash_difference NUMERIC(12,2);
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS card_difference NUMERIC(12,2);
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS bitcoin_difference NUMERIC(12,2);
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS chivo_difference NUMERIC(12,2);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_cash_shift_per_branch
  ON cash_shifts(branch_id) WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS sales (
  id BIGSERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  cash_shift_id BIGINT NOT NULL REFERENCES cash_shifts(id),
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  payment_method VARCHAR(12) NOT NULL
    CHECK (payment_method IN ('CASH', 'CARD', 'BITCOIN', 'CHIVO')),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  tax NUMERIC(12,2) NOT NULL CHECK (tax >= 0),
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name VARCHAR(140) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price > 0),
  line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE IF NOT EXISTS invoice_counters (
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('CONSUMER_FINAL', 'CCF')),
  fiscal_year INTEGER NOT NULL,
  next_number INTEGER NOT NULL DEFAULT 1 CHECK (next_number > 0),
  PRIMARY KEY (branch_id, document_type, fiscal_year)
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT NOT NULL UNIQUE REFERENCES sales(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('CONSUMER_FINAL', 'CCF')),
  fiscal_year INTEGER NOT NULL,
  sequence_number INTEGER NOT NULL,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  subtotal NUMERIC(12,2) NOT NULL,
  tax NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, document_type, fiscal_year, sequence_number)
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id BIGSERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_end >= period_start)
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_branch_period_uq
  ON payroll_runs(branch_id, period_start, period_end);

CREATE TABLE IF NOT EXISTS payroll_lines (
  id BIGSERIAL PRIMARY KEY,
  payroll_run_id BIGINT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  employee_name VARCHAR(160) NOT NULL,
  monthly_salary NUMERIC(12,2) NOT NULL,
  gross NUMERIC(12,2) NOT NULL,
  isss NUMERIC(12,2) NOT NULL,
  afp NUMERIC(12,2) NOT NULL,
  taxable_income NUMERIC(12,2) NOT NULL,
  income_tax NUMERIC(12,2) NOT NULL,
  net NUMERIC(12,2) NOT NULL,
  UNIQUE (payroll_run_id, employee_id)
);

INSERT INTO branches (code, name, address)
VALUES
  ('SANSAL', 'Casa Matriz - San Salvador', 'San Salvador, El Salvador'),
  ('SANTA', 'Sucursal - Santa Tecla', 'Santa Tecla, La Libertad')
ON CONFLICT (code) DO NOTHING;

INSERT INTO ingredients (name, unit, minimum_stock)
VALUES
  ('Café de especialidad', 'g', 500),
  ('Leche entera', 'ml', 5000),
  ('Vaso 16 oz', 'unidad', 50),
  ('Tapadera 16 oz', 'unidad', 50),
  ('Viñeta', 'unidad', 50),
  ('Chocolate', 'g', 500),
  ('Jarabe de vainilla', 'ml', 500),
  ('Té negro', 'g', 300),
  ('Agua filtrada', 'ml', 10000),
  ('Azúcar', 'g', 500),
  ('Pan artesanal', 'unidad', 10),
  ('Queso', 'g', 500),
  ('Jamón', 'g', 500),
  ('Botella para cold brew', 'unidad', 20)
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (sku, name, category, price, product_type)
VALUES
  ('BEB-001', 'Espresso doble', 'Café', 2.25, 'RECIPE'),
  ('BEB-002', 'Americano', 'Café', 2.50, 'RECIPE'),
  ('BEB-003', 'Latte clásico grande', 'Café', 3.75, 'RECIPE'),
  ('BEB-004', 'Cappuccino', 'Café', 3.50, 'RECIPE'),
  ('BEB-005', 'Moca de la casa', 'Café', 4.00, 'RECIPE'),
  ('BEB-006', 'Latte de vainilla', 'Café', 4.00, 'RECIPE'),
  ('BEB-007', 'Cold brew', 'Café frío', 3.75, 'RECIPE'),
  ('BEB-008', 'Té chai latte', 'Té', 3.50, 'RECIPE'),
  ('BEB-009', 'Chocolate caliente', 'Chocolate', 3.25, 'RECIPE'),
  ('BEB-010', 'Té negro artesanal', 'Té', 2.50, 'RECIPE'),
  ('ALI-001', 'Sándwich de queso', 'Alimentos', 4.50, 'RECIPE'),
  ('ALI-002', 'Sándwich de jamón y queso', 'Alimentos', 5.25, 'RECIPE'),
  ('EMP-001', 'Café molido 340 g', 'Empacados', 12.00, 'RESALE'),
  ('EMP-002', 'Galletas artesanales', 'Empacados', 3.50, 'RESALE')
ON CONFLICT (sku) DO NOTHING;

INSERT INTO suppliers (name, tax_id, phone, email)
VALUES
  ('Finca Origen', '0614-000000-101-0', '+503 2200-0101', 'ventas@fincaorigen.example'),
  ('Empaques Centroamericanos', '0614-000000-102-0', '+503 2200-0102', 'pedidos@empaques.example'),
  ('Distribuidora La Central', '0614-000000-103-0', '+503 2200-0103', 'ventas@central.example')
ON CONFLICT (name) DO NOTHING;

INSERT INTO recipe_items (product_id, ingredient_id, quantity)
SELECT p.id, i.id, v.quantity FROM (VALUES
  ('BEB-001', 'Café de especialidad', 18::NUMERIC),
  ('BEB-002', 'Café de especialidad', 18::NUMERIC),
  ('BEB-002', 'Agua filtrada', 240::NUMERIC),
  ('BEB-003', 'Café de especialidad', 18::NUMERIC),
  ('BEB-003', 'Leche entera', 250::NUMERIC),
  ('BEB-003', 'Vaso 16 oz', 1::NUMERIC),
  ('BEB-003', 'Tapadera 16 oz', 1::NUMERIC),
  ('BEB-003', 'Viñeta', 1::NUMERIC),
  ('BEB-004', 'Café de especialidad', 18::NUMERIC),
  ('BEB-004', 'Leche entera', 180::NUMERIC),
  ('BEB-004', 'Vaso 16 oz', 1::NUMERIC),
  ('BEB-004', 'Tapadera 16 oz', 1::NUMERIC),
  ('BEB-004', 'Viñeta', 1::NUMERIC),
  ('BEB-005', 'Café de especialidad', 18::NUMERIC),
  ('BEB-005', 'Leche entera', 220::NUMERIC),
  ('BEB-005', 'Chocolate', 20::NUMERIC),
  ('BEB-005', 'Vaso 16 oz', 1::NUMERIC),
  ('BEB-005', 'Tapadera 16 oz', 1::NUMERIC),
  ('BEB-005', 'Viñeta', 1::NUMERIC),
  ('BEB-006', 'Café de especialidad', 18::NUMERIC),
  ('BEB-006', 'Leche entera', 250::NUMERIC),
  ('BEB-006', 'Jarabe de vainilla', 20::NUMERIC),
  ('BEB-006', 'Vaso 16 oz', 1::NUMERIC),
  ('BEB-006', 'Tapadera 16 oz', 1::NUMERIC),
  ('BEB-006', 'Viñeta', 1::NUMERIC),
  ('BEB-007', 'Café de especialidad', 25::NUMERIC),
  ('BEB-007', 'Agua filtrada', 300::NUMERIC),
  ('BEB-007', 'Botella para cold brew', 1::NUMERIC),
  ('BEB-007', 'Viñeta', 1::NUMERIC),
  ('BEB-008', 'Té negro', 8::NUMERIC),
  ('BEB-008', 'Leche entera', 220::NUMERIC),
  ('BEB-008', 'Jarabe de vainilla', 10::NUMERIC),
  ('BEB-008', 'Vaso 16 oz', 1::NUMERIC),
  ('BEB-008', 'Tapadera 16 oz', 1::NUMERIC),
  ('BEB-008', 'Viñeta', 1::NUMERIC),
  ('BEB-009', 'Chocolate', 30::NUMERIC),
  ('BEB-009', 'Leche entera', 250::NUMERIC),
  ('BEB-009', 'Vaso 16 oz', 1::NUMERIC),
  ('BEB-009', 'Tapadera 16 oz', 1::NUMERIC),
  ('BEB-009', 'Viñeta', 1::NUMERIC),
  ('BEB-010', 'Té negro', 8::NUMERIC),
  ('BEB-010', 'Agua filtrada', 250::NUMERIC),
  ('ALI-001', 'Pan artesanal', 1::NUMERIC),
  ('ALI-001', 'Queso', 60::NUMERIC),
  ('ALI-002', 'Pan artesanal', 1::NUMERIC),
  ('ALI-002', 'Queso', 40::NUMERIC),
  ('ALI-002', 'Jamón', 50::NUMERIC)
) AS v(sku, ingredient_name, quantity)
JOIN products p ON p.sku = v.sku
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (product_id, ingredient_id) DO NOTHING;

INSERT INTO inventory_balances (branch_id, ingredient_id, quantity)
SELECT b.id, i.id,
  CASE i.unit WHEN 'ml' THEN 30000 WHEN 'g' THEN 5000 ELSE 500 END
FROM branches b CROSS JOIN ingredients i
ON CONFLICT (branch_id, ingredient_id) WHERE ingredient_id IS NOT NULL DO NOTHING;

INSERT INTO inventory_balances (branch_id, product_id, quantity)
SELECT b.id, p.id, 50
FROM branches b CROSS JOIN products p
WHERE p.product_type = 'RESALE'
ON CONFLICT (branch_id, product_id) WHERE product_id IS NOT NULL DO NOTHING;
