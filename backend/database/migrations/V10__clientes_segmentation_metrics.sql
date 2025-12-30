-- V10: Segmentación y métricas base de clientes

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_cliente VARCHAR(20) DEFAULT 'minorista' CHECK (tipo_cliente IN ('minorista','mayorista','distribuidor')),
  ADD COLUMN IF NOT EXISTS segmento VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tags TEXT;

