-- Parametros de sistema y configuracion de dolar blue

CREATE TABLE IF NOT EXISTS parametros_sistema (
  clave          VARCHAR(100) PRIMARY KEY,
  valor_texto    TEXT,
  valor_num      DECIMAL(18,4),
  descripcion    TEXT,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuarios    BIGINT REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_parametros_sistema_usuario ON parametros_sistema(usuario_id);

