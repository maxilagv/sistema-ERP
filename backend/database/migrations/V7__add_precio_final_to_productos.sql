-- Añadir la columna precio_final a la tabla productos
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS precio_final DECIMAL(12,2) DEFAULT 0 CHECK (precio_final >= 0);

-- Opcional: Añadir un comentario en la columna para mayor claridad en la BBDD
COMMENT ON COLUMN productos.precio_final IS 'Precio de venta final fijado manualmente. Si es 0 o NULL, se usan los precios calculados.';
