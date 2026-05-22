-- ============================================================================
--  Brisas Marinas — Esquema de Base de Datos
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Limpieza completa
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS v_low_stock_products CASCADE;
DROP VIEW IF EXISTS v_daily_sales_summary CASCADE;

DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS tables CASCADE;

DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP FUNCTION IF EXISTS trg_update_timestamp CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS sale_status CASCADE;
-- ----------------------------------------------------------------------------
--  Tabla: users
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50)  UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(120) UNIQUE,
    role            user_role    NOT NULL DEFAULT 'empleado',
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role     ON users(role);
CREATE INDEX idx_users_active   ON users(is_active);

-- ----------------------------------------------------------------------------
--  Tabla: categories
-- ----------------------------------------------------------------------------
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(80) UNIQUE NOT NULL,
    description TEXT,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- Tabla: tables
-- ----------------------------------------------------------------------------
CREATE TABLE tables (
    id              SERIAL PRIMARY KEY,
    label           VARCHAR(20) UNIQUE NOT NULL,
    capacity        INTEGER NOT NULL DEFAULT 4,
    is_occupied     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
--  Tabla: products
-- ----------------------------------------------------------------------------
CREATE TABLE products (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(40)  UNIQUE,
    name            VARCHAR(120) NOT NULL,
    description     TEXT,
    category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    price           NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    cost            NUMERIC(12, 2) DEFAULT 0 CHECK (cost >= 0),
    stock           INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
    min_stock       INTEGER       NOT NULL DEFAULT 5,
    unit            VARCHAR(20)   DEFAULT 'unidad',
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_category   ON products(category_id);
CREATE INDEX idx_products_active     ON products(is_active);
CREATE INDEX idx_products_name       ON products(name);

-- ----------------------------------------------------------------------------
-- Tabla: orders
-- ----------------------------------------------------------------------------
CREATE TABLE orders (
    id              SERIAL PRIMARY KEY,
    order_number    VARCHAR(30) UNIQUE NOT NULL,
    table_id        INTEGER NOT NULL REFERENCES tables(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
    total           NUMERIC(12,2) NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    notes           TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_table  ON orders(table_id);

-- ----------------------------------------------------------------------------
-- Tabla: order_items
-- ----------------------------------------------------------------------------
CREATE TABLE order_items (
    id              SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    product_name    VARCHAR(120) NOT NULL,
    quantity        INTEGER NOT NULL,
    unit_price      NUMERIC(12,2) NOT NULL,
    subtotal        NUMERIC(12,2) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ----------------------------------------------------------------------------
--  Tabla: sales (encabezado)
-- ----------------------------------------------------------------------------
CREATE TABLE sales (
    id              SERIAL PRIMARY KEY,
    sale_number     VARCHAR(20)  UNIQUE NOT NULL,
    user_id         INTEGER      NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    customer_name   VARCHAR(120),
    subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax             NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total           NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method  payment_method NOT NULL DEFAULT 'efectivo',
    amount_received NUMERIC(12, 2),
    change_given    NUMERIC(12, 2),
    status          sale_status    NOT NULL DEFAULT 'completada',
    notes           TEXT,
    order_id        INTEGER REFERENCES orders(id),
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    voided_at       TIMESTAMP,
    voided_by       INTEGER REFERENCES users(id)
);

CREATE INDEX idx_sales_user         ON sales(user_id);
CREATE INDEX idx_sales_created_at   ON sales(created_at);
CREATE INDEX idx_sales_status       ON sales(status);
CREATE INDEX idx_sales_payment      ON sales(payment_method);

-- ----------------------------------------------------------------------------
--  Tabla: sale_items (detalle)
-- ----------------------------------------------------------------------------
CREATE TABLE sale_items (
    id              SERIAL PRIMARY KEY,
    sale_id         INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name    VARCHAR(120) NOT NULL,   -- snapshot del nombre al momento de la venta
    quantity        INTEGER       NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal        NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sale_items_sale     ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product  ON sale_items(product_id);

-- ----------------------------------------------------------------------------
--  Función: actualizar updated_at automáticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

CREATE TRIGGER products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

-- ----------------------------------------------------------------------------
--  Vista: productos con bajo stock
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_low_stock_products AS
SELECT
    p.id,
    p.code,
    p.name,
    p.stock,
    p.min_stock,
    c.name AS category_name
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.is_active = TRUE
  AND p.stock <= p.min_stock
ORDER BY p.stock ASC;

-- ----------------------------------------------------------------------------
--  Vista: resumen diario de ventas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_daily_sales_summary AS
SELECT
    DATE(created_at)                          AS sale_date,
    COUNT(*)                                  AS total_sales,
    SUM(total)                                AS total_amount,
    AVG(total)                                AS average_ticket,
    SUM(CASE WHEN payment_method = 'efectivo'      THEN total ELSE 0 END) AS cash_total,
    SUM(CASE WHEN payment_method = 'transferencia' THEN total ELSE 0 END) AS transfer_total,
    SUM(CASE WHEN payment_method = 'tarjeta'       THEN total ELSE 0 END) AS card_total
FROM sales
WHERE status = 'completada'
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;
