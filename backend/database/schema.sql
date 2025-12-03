-- PostgreSQL schema for sistemas-de-gestion
-- Normalized relational model with referential integrity, auditing, and indexes

BEGIN;

-- Helper: updated_at trigger
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.1 Usuarios y roles
CREATE TABLE IF NOT EXISTS roles (
  id           BIGSERIAL PRIMARY KEY,
  nombre       VARCHAR(50) NOT NULL UNIQUE,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id             BIGSERIAL PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  password_hash  TEXT NOT NULL,
  rol_id         BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique email
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_email_ci ON usuarios (LOWER(email));
CREATE INDEX IF NOT EXISTS ix_usuarios_rol ON usuarios(rol_id);

CREATE TRIGGER set_updated_at_usuarios
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE IF NOT EXISTS logs (
  id              BIGSERIAL PRIMARY KEY,
  usuario_id      BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  accion          VARCHAR(50) NOT NULL,
  tabla_afectada  VARCHAR(100) NOT NULL,
  registro_id     BIGINT,
  descripcion     TEXT,
  fecha_hora      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_logs_usuario ON logs(usuario_id);
CREATE INDEX IF NOT EXISTS ix_logs_fecha ON logs(fecha_hora);

-- 2.2 Clientes y proveedores
CREATE TABLE IF NOT EXISTS clientes (
  id              BIGSERIAL PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  apellido        VARCHAR(100),
  telefono        VARCHAR(50),
  email           VARCHAR(255),
  direccion       TEXT,
  cuit_cuil       VARCHAR(20),
  fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado          VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo'))
);
CREATE INDEX IF NOT EXISTS ix_clientes_nombre ON clientes(nombre);
CREATE INDEX IF NOT EXISTS ix_clientes_apellido ON clientes(apellido);
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_cuit ON clientes(cuit_cuil) WHERE cuit_cuil IS NOT NULL;

CREATE TABLE IF NOT EXISTS proveedores (
  id              BIGSERIAL PRIMARY KEY,
  nombre          VARCHAR(150) NOT NULL,
  email           VARCHAR(255),
  telefono        VARCHAR(50),
  direccion       TEXT,
  cuit_cuil       VARCHAR(20),
  fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_proveedores_cuit ON proveedores(cuit_cuil) WHERE cuit_cuil IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_proveedores_nombre ON proveedores(nombre);

-- 2.3 Categorías de productos
CREATE TABLE IF NOT EXISTS categorias (
  id          BIGSERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  imagen_url  TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_categorias_activo ON categorias(activo);

-- 2.4 Productos e imágenes
CREATE TABLE IF NOT EXISTS productos (
  id             BIGSERIAL PRIMARY KEY,
  codigo         VARCHAR(50) NOT NULL,
  nombre         VARCHAR(200) NOT NULL,
  descripcion    TEXT,
  categoria_id   BIGINT NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  precio_costo   DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (precio_costo >= 0),
  precio_venta   DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
  precio_costo_pesos   DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (precio_costo_pesos >= 0),
  precio_costo_dolares DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (precio_costo_dolares >= 0),
  tipo_cambio          DECIMAL(12,4),
  margen_local         DECIMAL(5,2) NOT NULL DEFAULT 0.15 CHECK (margen_local >= 0),
  margen_distribuidor  DECIMAL(5,2) NOT NULL DEFAULT 0.45 CHECK (margen_distribuidor >= 0),
  precio_local         DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (precio_local >= 0),
  precio_distribuidor  DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (precio_distribuidor >= 0),
  proveedor_id         BIGINT REFERENCES proveedores(id) ON DELETE SET NULL,
  stock_minimo   INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  stock_maximo   INTEGER CHECK (stock_maximo IS NULL OR stock_maximo >= 0),
  reorden        INTEGER NOT NULL DEFAULT 0 CHECK (reorden >= 0),
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_productos_codigo ON productos(codigo);
CREATE INDEX IF NOT EXISTS ix_productos_nombre ON productos(nombre);
CREATE INDEX IF NOT EXISTS ix_productos_categoria ON productos(categoria_id);

CREATE TRIGGER set_updated_at_productos
BEFORE UPDATE ON productos
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE IF NOT EXISTS producto_imagenes (
  id           BIGSERIAL PRIMARY KEY,
  producto_id  BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  orden        INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_producto_imagenes_orden ON producto_imagenes(producto_id, orden);

CREATE TABLE IF NOT EXISTS productos_historial (
  id                  BIGSERIAL PRIMARY KEY,
  producto_id         BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  proveedor_id        BIGINT REFERENCES proveedores(id) ON DELETE SET NULL,
  fecha               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  costo_pesos         DECIMAL(12,2) CHECK (costo_pesos >= 0),
  costo_dolares       DECIMAL(12,2) CHECK (costo_dolares >= 0),
  tipo_cambio         DECIMAL(12,4),
  margen_local        DECIMAL(5,2),
  margen_distribuidor DECIMAL(5,2),
  precio_local        DECIMAL(12,2),
  precio_distribuidor DECIMAL(12,2),
  usuario_id          BIGINT REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_productos_historial_producto ON productos_historial(producto_id);
CREATE INDEX IF NOT EXISTS ix_productos_historial_fecha ON productos_historial(fecha);

-- 2.5 Inventario y movimientos de stock
CREATE TABLE IF NOT EXISTS inventario (
  id                   BIGSERIAL PRIMARY KEY,
  producto_id          BIGINT NOT NULL UNIQUE REFERENCES productos(id) ON DELETE CASCADE,
  cantidad_disponible  INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
  cantidad_reservada   INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_reservada >= 0),
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_inventario_producto ON inventario(producto_id);

CREATE TABLE IF NOT EXISTS movimientos_stock (
  id          BIGSERIAL PRIMARY KEY,
  producto_id BIGINT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  tipo        VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada','salida')),
  cantidad    INTEGER NOT NULL CHECK (cantidad > 0),
  motivo      VARCHAR(100) NOT NULL,
  referencia  VARCHAR(100),
  fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id  BIGINT REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_movimientos_producto ON movimientos_stock(producto_id);
CREATE INDEX IF NOT EXISTS ix_movimientos_fecha ON movimientos_stock(fecha);
CREATE INDEX IF NOT EXISTS ix_movimientos_tipo ON movimientos_stock(tipo);

CREATE TABLE IF NOT EXISTS stock_ajustes (
  id          BIGSERIAL PRIMARY KEY,
  producto_id BIGINT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad    INTEGER NOT NULL,
  motivo      TEXT NOT NULL,
  fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_ajustes_producto ON stock_ajustes(producto_id);
CREATE INDEX IF NOT EXISTS ix_ajustes_fecha ON stock_ajustes(fecha);

-- 2.6 Compras e importaciones
CREATE TABLE IF NOT EXISTS compras (
  id           BIGSERIAL PRIMARY KEY,
  proveedor_id BIGINT NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_costo  DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_costo >= 0),
  moneda       VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (moneda IN ('ARS','USD','CNY')),
  estado       VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','recibido','cancelado'))
);
CREATE INDEX IF NOT EXISTS ix_compras_fecha ON compras(fecha);
CREATE INDEX IF NOT EXISTS ix_compras_proveedor ON compras(proveedor_id);

CREATE TABLE IF NOT EXISTS compras_detalle (
  id             BIGSERIAL PRIMARY KEY,
  compra_id      BIGINT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id    BIGINT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad       INTEGER NOT NULL CHECK (cantidad > 0),
  costo_unitario DECIMAL(12,2) NOT NULL CHECK (costo_unitario >= 0),
  costo_envio    DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (costo_envio >= 0),
  subtotal       DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  moneda         VARCHAR(3) CHECK (moneda IN ('ARS','USD','CNY')),
  tipo_cambio    DECIMAL(12,4) CHECK (tipo_cambio IS NULL OR tipo_cambio > 0)
);
CREATE INDEX IF NOT EXISTS ix_compras_detalle_compra ON compras_detalle(compra_id);
CREATE INDEX IF NOT EXISTS ix_compras_detalle_producto ON compras_detalle(producto_id);

CREATE TABLE IF NOT EXISTS recepciones (
  id               BIGSERIAL PRIMARY KEY,
  compra_id        BIGINT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  fecha_recepcion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observaciones    TEXT
);
CREATE INDEX IF NOT EXISTS ix_recepciones_compra ON recepciones(compra_id);

-- 2.7 Ventas
CREATE TABLE IF NOT EXISTS ventas (
  id           BIGSERIAL PRIMARY KEY,
  cliente_id   BIGINT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total        DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  descuento    DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  impuestos    DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (impuestos >= 0),
  neto         DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (neto >= 0),
  estado_pago  VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente','pagada','cancelado')),
  estado_entrega VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado_entrega IN ('pendiente','entregado')),
  fecha_entrega TIMESTAMPTZ,
  observaciones TEXT
);
CREATE INDEX IF NOT EXISTS ix_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS ix_ventas_cliente ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS ix_ventas_estado_entrega ON ventas(estado_entrega);

CREATE TABLE IF NOT EXISTS ventas_detalle (
  id              BIGSERIAL PRIMARY KEY,
  venta_id        BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id     BIGINT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(12,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal        DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0)
);
CREATE INDEX IF NOT EXISTS ix_ventas_detalle_venta ON ventas_detalle(venta_id);
CREATE INDEX IF NOT EXISTS ix_ventas_detalle_producto ON ventas_detalle(producto_id);

CREATE TABLE IF NOT EXISTS pagos (
  id          BIGSERIAL PRIMARY KEY,
  venta_id    BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  cliente_id  BIGINT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  monto       DECIMAL(12,2) NOT NULL CHECK (monto > 0),
  fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metodo      VARCHAR(20) NOT NULL DEFAULT 'efectivo' CHECK (metodo IN ('efectivo','transferencia','tarjeta','otro'))
);
CREATE INDEX IF NOT EXISTS ix_pagos_venta ON pagos(venta_id);
CREATE INDEX IF NOT EXISTS ix_pagos_cliente ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS ix_pagos_fecha ON pagos(fecha);

CREATE TABLE IF NOT EXISTS facturas (
  id                  BIGSERIAL PRIMARY KEY,
  venta_id            BIGINT NOT NULL UNIQUE REFERENCES ventas(id) ON DELETE CASCADE,
  numero_factura      VARCHAR(50) NOT NULL UNIQUE,
  fecha_emision       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  comprobante_pdf_url TEXT
);

-- 2.9 Gastos e inversiones
CREATE TABLE IF NOT EXISTS gastos (
  id          BIGSERIAL PRIMARY KEY,
  descripcion TEXT NOT NULL,
  monto       DECIMAL(12,2) NOT NULL CHECK (monto >= 0),
  categoria   VARCHAR(100),
  fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_gastos_fecha ON gastos(fecha);

CREATE TABLE IF NOT EXISTS inversiones (
  id          BIGSERIAL PRIMARY KEY,
  descripcion TEXT NOT NULL,
  monto       DECIMAL(12,2) NOT NULL CHECK (monto >= 0),
  fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo        VARCHAR(50) NOT NULL DEFAULT 'capex'
);

-- 2.11 Configuración
CREATE TABLE IF NOT EXISTS configuracion (
  id     BIGSERIAL PRIMARY KEY,
  clave  VARCHAR(100) NOT NULL UNIQUE,
  valor  TEXT NOT NULL
);

-- Vistas (2.8, 2.10)
CREATE OR REPLACE VIEW vista_deudas AS
WITH v AS (
  SELECT cliente_id, SUM(neto) FILTER (WHERE estado_pago <> 'cancelado') AS total_ventas
  FROM ventas
  GROUP BY cliente_id
), p AS (
  SELECT cliente_id, SUM(monto) AS total_pagos
  FROM pagos
  GROUP BY cliente_id
)
SELECT c.id AS cliente_id,
       COALESCE(v.total_ventas, 0)::DECIMAL(12,2) - COALESCE(p.total_pagos, 0)::DECIMAL(12,2) AS deuda_pendiente
FROM clientes c
LEFT JOIN v ON v.cliente_id = c.id
LEFT JOIN p ON p.cliente_id = c.id;

CREATE OR REPLACE VIEW vista_stock_bajo AS
SELECT pr.id AS producto_id,
       pr.codigo,
       pr.nombre,
       i.cantidad_disponible,
       pr.stock_minimo
FROM productos pr
JOIN inventario i ON i.producto_id = pr.id
WHERE i.cantidad_disponible < pr.stock_minimo
  AND pr.activo = TRUE;

CREATE OR REPLACE VIEW vista_top_clientes AS
SELECT c.id AS cliente_id,
       c.nombre,
       c.apellido,
       SUM(v.neto) AS total_comprado
FROM clientes c
JOIN ventas v ON v.cliente_id = c.id AND v.estado_pago <> 'cancelado'
GROUP BY c.id, c.nombre, c.apellido
ORDER BY total_comprado DESC;

CREATE OR REPLACE VIEW vista_ganancias_mensuales AS
WITH ventas_m AS (
  SELECT date_trunc('month', fecha) AS mes, SUM(neto) AS total_ventas
  FROM ventas
  WHERE estado_pago <> 'cancelado'
  GROUP BY 1
), gastos_m AS (
  SELECT date_trunc('month', fecha) AS mes, SUM(monto) AS total_gastos
  FROM gastos
  GROUP BY 1
)
SELECT COALESCE(ventas_m.mes, gastos_m.mes) AS mes,
       COALESCE(ventas_m.total_ventas, 0)::DECIMAL(12,2) AS total_ventas,
       COALESCE(gastos_m.total_gastos, 0)::DECIMAL(12,2) AS total_gastos,
       (COALESCE(ventas_m.total_ventas, 0) - COALESCE(gastos_m.total_gastos, 0))::DECIMAL(12,2) AS ganancia_neta
FROM ventas_m
FULL OUTER JOIN gastos_m ON ventas_m.mes = gastos_m.mes
ORDER BY mes;

COMMIT;
