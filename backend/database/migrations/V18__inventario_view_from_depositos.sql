-- MultidepÃ³sito avanzado: inventario global como vista agregada

BEGIN;

-- Renombrar tabla inventario existente para preservar datos histÃ³ricos
ALTER TABLE IF EXISTS inventario RENAME TO inventario_base;

-- Crear vista inventario como suma por producto de inventario_depositos
CREATE OR REPLACE VIEW inventario AS
SELECT
  producto_id,
  SUM(cantidad_disponible) AS cantidad_disponible,
  SUM(cantidad_reservada) AS cantidad_reservada
FROM inventario_depositos
GROUP BY producto_id;

COMMIT;

