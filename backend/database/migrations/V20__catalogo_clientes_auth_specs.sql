-- Catalogo + auth clientes + specs productos
BEGIN;

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS marca VARCHAR(120),
  ADD COLUMN IF NOT EXISTS modelo VARCHAR(120),
  ADD COLUMN IF NOT EXISTS procesador VARCHAR(120),
  ADD COLUMN IF NOT EXISTS ram_gb INTEGER,
  ADD COLUMN IF NOT EXISTS almacenamiento_gb INTEGER,
  ADD COLUMN IF NOT EXISTS pantalla_pulgadas DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS camara_mp INTEGER,
  ADD COLUMN IF NOT EXISTS bateria_mah INTEGER;

CREATE TABLE IF NOT EXISTS clientes_auth (
  id              BIGSERIAL PRIMARY KEY,
  cliente_id      BIGINT NOT NULL UNIQUE REFERENCES clientes(id) ON DELETE CASCADE,
  email           VARCHAR(255) NOT NULL,
  password_hash   TEXT NOT NULL,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  password_set_at TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_auth_email_ci ON clientes_auth (LOWER(email));
CREATE INDEX IF NOT EXISTS ix_clientes_auth_cliente ON clientes_auth (cliente_id);

DROP TRIGGER IF EXISTS set_updated_at_clientes_auth ON clientes_auth;
CREATE TRIGGER set_updated_at_clientes_auth
BEFORE UPDATE ON clientes_auth
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE IF NOT EXISTS clientes_refresh_tokens (
  id         BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  jti        VARCHAR(64) NOT NULL,
  user_agent TEXT,
  ip         VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_clientes_rt_cliente ON clientes_refresh_tokens(cliente_id);
CREATE INDEX IF NOT EXISTS ix_clientes_rt_expires ON clientes_refresh_tokens(expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_email_ci ON clientes (LOWER(email)) WHERE email IS NOT NULL;

COMMIT;
