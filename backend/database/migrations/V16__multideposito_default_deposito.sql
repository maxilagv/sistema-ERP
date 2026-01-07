-- Multidepósito: depósito por defecto y migración de datos de inventario

BEGIN;

-- 1) Crear depósito principal si no existe
INSERT INTO depositos (nombre, codigo, direccion, activo)
SELECT 'Depósito principal', 'MAIN', NULL, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM depositos WHERE codigo = 'MAIN'
);

-- 2) Registrar ID de depósito por defecto en parametros_sistema
INSERT INTO parametros_sistema (clave, valor_num, descripcion, usuario_id)
SELECT
  'deposito_default_id' AS clave,
  d.id                  AS valor_num,
  'ID de depósito por defecto para inventario' AS descripcion,
  NULL                  AS usuario_id
FROM depositos d
WHERE d.codigo = 'MAIN'
ON CONFLICT (clave) DO UPDATE
  SET valor_num    = EXCLUDED.valor_num,
      descripcion  = EXCLUDED.descripcion,
      actualizado_en = NOW();

-- 3) Copiar inventario global al depósito principal solo para productos que aún no tengan registro
INSERT INTO inventario_depositos (producto_id, deposito_id, cantidad_disponible, cantidad_reservada)
SELECT
  i.producto_id,
  d.id AS deposito_id,
  i.cantidad_disponible,
  i.cantidad_reservada
FROM inventario i
JOIN depositos d ON d.codigo = 'MAIN'
LEFT JOIN inventario_depositos idp
  ON idp.producto_id = i.producto_id
 AND idp.deposito_id = d.id
WHERE idp.id IS NULL;

COMMIT;

