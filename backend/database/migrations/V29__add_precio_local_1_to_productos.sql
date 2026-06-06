-- Precio manual independiente para la lista Local 1
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS precio_local_1 DECIMAL(12,2) DEFAULT 0 CHECK (precio_local_1 >= 0);

COMMENT ON COLUMN productos.precio_local_1 IS 'Precio manual para Local 1. No reemplaza precios calculados ni precio final.';
