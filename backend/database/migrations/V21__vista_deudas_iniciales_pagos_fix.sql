-- Vista de deudas con pagos de deudas iniciales (neto >= 0)
BEGIN;

DROP VIEW IF EXISTS vista_deudas;
CREATE VIEW vista_deudas AS
WITH ventas_pendientes AS (
  SELECT
    v.id           AS venta_id,
    v.cliente_id   AS cliente_id,
    v.fecha::date  AS fecha_venta,
    v.neto         AS neto,
    COALESCE(SUM(p.monto), 0)::DECIMAL(12,2) AS total_pagado,
    (v.neto - COALESCE(SUM(p.monto), 0))::DECIMAL(12,2) AS saldo
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
),
deudas_iniciales AS (
  SELECT
    d.cliente_id,
    d.monto::DECIMAL(12,2) AS saldo,
    GREATEST(0, (CURRENT_DATE - d.fecha::date))::INT AS dias
  FROM clientes_deudas_iniciales d
  WHERE d.monto > 0
),
pagos_deudas_iniciales AS (
  SELECT
    p.cliente_id,
    (p.monto * -1)::DECIMAL(12,2) AS saldo,
    GREATEST(0, (CURRENT_DATE - p.fecha::date))::INT AS dias
  FROM clientes_deudas_iniciales_pagos p
  WHERE p.monto > 0
),
todas_deudas AS (
  SELECT * FROM vp_con_dias
  UNION ALL
  SELECT * FROM deudas_iniciales
  UNION ALL
  SELECT * FROM pagos_deudas_iniciales
)
SELECT
  c.id AS cliente_id,
  GREATEST(COALESCE(SUM(td.saldo), 0), 0)::DECIMAL(12,2) AS deuda_pendiente,
  GREATEST(COALESCE(SUM(CASE WHEN td.dias BETWEEN 0 AND 30 THEN td.saldo ELSE 0 END), 0), 0)::DECIMAL(12,2) AS deuda_0_30,
  GREATEST(COALESCE(SUM(CASE WHEN td.dias BETWEEN 31 AND 60 THEN td.saldo ELSE 0 END), 0), 0)::DECIMAL(12,2) AS deuda_31_60,
  GREATEST(COALESCE(SUM(CASE WHEN td.dias BETWEEN 61 AND 90 THEN td.saldo ELSE 0 END), 0), 0)::DECIMAL(12,2) AS deuda_61_90,
  GREATEST(COALESCE(SUM(CASE WHEN td.dias > 90 THEN td.saldo ELSE 0 END), 0), 0)::DECIMAL(12,2) AS deuda_mas_90,
  CASE
    WHEN COUNT(CASE WHEN td.saldo > 0 THEN 1 END) > 0
      THEN ROUND(AVG(CASE WHEN td.saldo > 0 THEN td.dias::NUMERIC END), 2)
    ELSE NULL
  END AS dias_promedio_atraso
FROM clientes c
LEFT JOIN todas_deudas td ON td.cliente_id = c.id
GROUP BY c.id;

COMMIT;
