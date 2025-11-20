-- Ventas: estado de entrega (pendiente/entregado) y fecha_entrega
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS estado_entrega VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado_entrega IN ('pendiente','entregado')),
  ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_ventas_estado_entrega ON ventas(estado_entrega);

