-- Agrega fecha límite opcional a pagos de clientes

ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS fecha_limite TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_pagos_fecha_limite ON pagos(fecha_limite);

