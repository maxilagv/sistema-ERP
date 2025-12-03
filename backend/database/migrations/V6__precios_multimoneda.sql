-- Soporte de precios en dos monedas, márgenes y historial de productos

-- Nuevas columnas en productos para costos, márgenes y precios por segmento
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS precio_costo_pesos   DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (precio_costo_pesos >= 0),
  ADD COLUMN IF NOT EXISTS precio_costo_dolares DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (precio_costo_dolares >= 0),
  ADD COLUMN IF NOT EXISTS tipo_cambio          DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS margen_local         DECIMAL(5,2) NOT NULL DEFAULT 0.15 CHECK (margen_local >= 0),
  ADD COLUMN IF NOT EXISTS margen_distribuidor  DECIMAL(5,2) NOT NULL DEFAULT 0.45 CHECK (margen_distribuidor >= 0),
  ADD COLUMN IF NOT EXISTS precio_local         DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (precio_local >= 0),
  ADD COLUMN IF NOT EXISTS precio_distribuidor  DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (precio_distribuidor >= 0),
  ADD COLUMN IF NOT EXISTS proveedor_id         BIGINT REFERENCES proveedores(id) ON DELETE SET NULL;

-- Inicializar costo en pesos a partir de precio_costo existente cuando corresponda
UPDATE productos
   SET precio_costo_pesos = precio_costo
 WHERE precio_costo > 0
   AND (precio_costo_pesos = 0 OR precio_costo_pesos IS NULL);

-- Tabla de historial de precios y márgenes por producto
CREATE TABLE IF NOT EXISTS productos_historial (
  id                  BIGSERIAL PRIMARY KEY,
  producto_id         BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  proveedor_id        BIGINT REFERENCES proveedores(id) ON DELETE SET NULL,
  fecha               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  costo_pesos         DECIMAL(12,2) CHECK (costo_pesos >= 0),
  costo_dolares       DECIMAL(12,2) CHECK (costo_dolares >= 0),
  tipo_cambio         DECIMAL(12,4),
  margen_local        DECIMAL(5,2),
  margen_distribuidor DECIMAL(5,2),
  precio_local        DECIMAL(12,2),
  precio_distribuidor DECIMAL(12,2),
  usuario_id          BIGINT REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_productos_historial_producto ON productos_historial(producto_id);
CREATE INDEX IF NOT EXISTS ix_productos_historial_fecha ON productos_historial(fecha);

-- Moneda y tipo de cambio por ítem de compra
ALTER TABLE compras_detalle
  ADD COLUMN IF NOT EXISTS moneda      VARCHAR(3) CHECK (moneda IN ('ARS','USD','CNY')),
  ADD COLUMN IF NOT EXISTS tipo_cambio DECIMAL(12,4) CHECK (tipo_cambio IS NULL OR tipo_cambio > 0);

