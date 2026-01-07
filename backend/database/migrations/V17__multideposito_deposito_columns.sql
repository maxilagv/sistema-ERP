-- Multidepósito: columnas deposito_id en movimientos, recepciones y ventas

BEGIN;

-- 1) movimientos_stock.deposito_id
ALTER TABLE movimientos_stock
  ADD COLUMN IF NOT EXISTS deposito_id BIGINT REFERENCES depositos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_movimientos_deposito ON movimientos_stock(deposito_id);

-- 2) recepciones.deposito_id
ALTER TABLE recepciones
  ADD COLUMN IF NOT EXISTS deposito_id BIGINT REFERENCES depositos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_recepciones_deposito ON recepciones(deposito_id);

-- 3) ventas.deposito_id
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS deposito_id BIGINT REFERENCES depositos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_ventas_deposito ON ventas(deposito_id);

COMMIT;

