-- Finanzas: cuentas por pagar, envejecimiento de deudas y presupuestos

-- Pagos a proveedores
CREATE TABLE IF NOT EXISTS pagos_proveedores (
  id            BIGSERIAL PRIMARY KEY,
  compra_id     BIGINT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  proveedor_id  BIGINT NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  monto         DECIMAL(12,2) NOT NULL CHECK (monto > 0),
  fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metodo        VARCHAR(20) NOT NULL DEFAULT 'transferencia' CHECK (metodo IN ('efectivo','transferencia','tarjeta','otro'))
);

CREATE INDEX IF NOT EXISTS ix_pagos_proveedores_compra ON pagos_proveedores(compra_id);
CREATE INDEX IF NOT EXISTS ix_pagos_proveedores_proveedor ON pagos_proveedores(proveedor_id);
CREATE INDEX IF NOT EXISTS ix_pagos_proveedores_fecha ON pagos_proveedores(fecha);

-- Presupuestos mensuales por tipo y categoría
CREATE TABLE IF NOT EXISTS presupuestos (
  id             BIGSERIAL PRIMARY KEY,
  anio           INTEGER NOT NULL CHECK (anio >= 2000),
  mes            INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  tipo           VARCHAR(20) NOT NULL CHECK (tipo IN ('ventas','gastos','otros')),
  categoria      VARCHAR(100) NOT NULL,
  monto          DECIMAL(14,2) NOT NULL CHECK (monto >= 0),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_presupuestos_mes ON presupuestos(anio, mes, tipo, categoria);

-- Drop trigger if exists to avoid error on re-run
DROP TRIGGER IF EXISTS set_updated_at_presupuestos ON presupuestos;

CREATE TRIGGER set_updated_at_presupuestos
BEFORE UPDATE ON presupuestos
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Reemplazar vista_deudas con columnas de envejecimiento y días promedio de atraso
DROP VIEW IF EXISTS vista_deudas;
CREATE VIEW vista_deudas AS
WITH ventas_pendientes AS (
  SELECT
    v.id           AS venta_id,
    v.cliente_id   AS cliente_id,
    v.fecha::date  AS fecha_venta,
    v.neto         AS neto,
    COALESCE(SUM(p.monto), 0) AS total_pagado,
    (v.neto - COALESCE(SUM(p.monto), 0)) AS saldo
  FROM ventas v
  LEFT JOIN pagos p ON p.venta_id = v.id
  WHERE v.estado_pago <> 'cancelado'
  GROUP BY v.id, v.cliente_id, v.fecha::date, v.neto
),
vp_con_dias AS (
  SELECT
    cliente_id,
    saldo,
    GREATEST(0, (CURRENT_DATE - fecha_venta))::INT AS dias
  FROM ventas_pendientes
  WHERE saldo > 0
)
SELECT
  c.id AS cliente_id,
  COALESCE(SUM(vp.saldo), 0) AS deuda_pendiente,
  COALESCE(SUM(CASE WHEN vp.dias BETWEEN 0 AND 30 THEN vp.saldo ELSE 0 END), 0) AS deuda_0_30,
  COALESCE(SUM(CASE WHEN vp.dias BETWEEN 31 AND 60 THEN vp.saldo ELSE 0 END), 0) AS deuda_31_60,
  COALESCE(SUM(CASE WHEN vp.dias BETWEEN 61 AND 90 THEN vp.saldo ELSE 0 END), 0) AS deuda_61_90,
  COALESCE(SUM(CASE WHEN vp.dias > 90 THEN vp.saldo ELSE 0 END), 0) AS deuda_mas_90,
  CASE
    WHEN COUNT(*) > 0 THEN ROUND(AVG(vp.dias::NUMERIC), 2)
    ELSE NULL
  END AS dias_promedio_atraso
FROM clientes c
LEFT JOIN vp_con_dias vp ON vp.cliente_id = c.id
GROUP BY c.id;

-- Nueva vista de deudas con proveedores (compras - pagos_proveedores)
CREATE OR REPLACE VIEW vista_deudas_proveedores AS
WITH compras_resumen AS (
  SELECT
    proveedor_id,
    SUM(total_costo) FILTER (WHERE estado <> 'cancelado') AS total_compras
  FROM compras
  GROUP BY proveedor_id
), pagos_resumen AS (
  SELECT
    proveedor_id,
    SUM(monto) AS total_pagos
  FROM pagos_proveedores
  GROUP BY proveedor_id
)
SELECT
  pr.id AS proveedor_id,
  COALESCE(c.total_compras, 0)::DECIMAL(12,2) - COALESCE(p.total_pagos, 0)::DECIMAL(12,2) AS deuda_pendiente
FROM proveedores pr
LEFT JOIN compras_resumen c ON c.proveedor_id = pr.id
LEFT JOIN pagos_resumen p ON p.proveedor_id = pr.id;
