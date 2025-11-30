-- Ocultar oportunidades de CRM y ventas sin eliminarlas físicamente

-- CRM: oportunidades
ALTER TABLE crm_oportunidades
  ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ix_crm_op_oculto ON crm_oportunidades(oculto);

-- Ventas
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ix_ventas_oculto ON ventas(oculto);

