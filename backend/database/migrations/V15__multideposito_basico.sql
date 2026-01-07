-- Multidepósito básico: depósitos y stock por depósito
-- Versión inicial: solo registro de stock por depósito (sin integración aún con ventas/compras)

BEGIN;

-- 1) Tabla de depósitos
CREATE TABLE IF NOT EXISTS depositos (
  id             BIGSERIAL PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL UNIQUE,
  codigo         VARCHAR(50) UNIQUE,
  direccion      TEXT,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_depositos_activo ON depositos(activo);

-- 2) Tabla de inventario por depósito
CREATE TABLE IF NOT EXISTS inventario_depositos (
  id                   BIGSERIAL PRIMARY KEY,
  producto_id          BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  deposito_id          BIGINT NOT NULL REFERENCES depositos(id) ON DELETE RESTRICT,
  cantidad_disponible  INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
  cantidad_reservada   INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_reservada >= 0),
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inventario_depositos
  ADD CONSTRAINT uq_inventario_depositos_producto_deposito
  UNIQUE (producto_id, deposito_id);

CREATE INDEX IF NOT EXISTS ix_inv_dep_producto ON inventario_depositos(producto_id);
CREATE INDEX IF NOT EXISTS ix_inv_dep_deposito ON inventario_depositos(deposito_id);

COMMIT;

