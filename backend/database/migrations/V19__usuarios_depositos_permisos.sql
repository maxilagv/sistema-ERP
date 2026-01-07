-- Multidepósito: permisos por depósito

CREATE TABLE IF NOT EXISTS usuarios_depositos (
  usuario_id      BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  deposito_id     BIGINT NOT NULL REFERENCES depositos(id) ON DELETE CASCADE,
  rol_deposito    VARCHAR(20) NOT NULL DEFAULT 'operador'
                  CHECK (rol_deposito IN ('operador','visor','admin')),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, deposito_id)
);

CREATE INDEX IF NOT EXISTS ix_usuarios_depositos_deposito
  ON usuarios_depositos(deposito_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_usuarios_depositos'
  ) THEN
    CREATE TRIGGER set_updated_at_usuarios_depositos
    BEFORE UPDATE ON usuarios_depositos
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
  END IF;
END $$;

