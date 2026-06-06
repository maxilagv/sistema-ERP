-- Multiplicador por categoria para calcular precios Local 1
ALTER TABLE categorias
  ADD COLUMN IF NOT EXISTS multiplicador_local_1 DECIMAL(8,4) NOT NULL DEFAULT 1 CHECK (multiplicador_local_1 > 0);

COMMENT ON COLUMN categorias.multiplicador_local_1 IS 'Multiplicador usado para calcular Local 1 desde el precio final efectivo del producto.';
