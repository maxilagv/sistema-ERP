-- Auth-related tables: refresh tokens and optional JWT blacklist
CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  jti          VARCHAR(64) NOT NULL,
  user_agent   TEXT,
  ip           VARCHAR(64),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_auth_rt_user ON auth_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS ix_auth_rt_expires ON auth_refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS jwt_blacklist (
  id           BIGSERIAL PRIMARY KEY,
  jti          VARCHAR(64) NOT NULL,
  token        TEXT NOT NULL,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_jwt_bl_jti ON jwt_blacklist(jti);
CREATE INDEX IF NOT EXISTS ix_jwt_bl_expires ON jwt_blacklist(expires_at);

