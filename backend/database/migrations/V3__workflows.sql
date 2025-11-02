-- Fase 3: Workflows de Aprobación
-- Tablas: reglas_aprobacion, aprobaciones, aprobaciones_historial

-- Reglas de aprobación
CREATE TABLE IF NOT EXISTS reglas_aprobacion (
  id            BIGSERIAL PRIMARY KEY,
  clave         VARCHAR(100) NOT NULL UNIQUE,
  descripcion   TEXT,
  condicion     JSONB,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_reglas_aprobacion'
  ) THEN
    CREATE TRIGGER set_updated_at_reglas_aprobacion
    BEFORE UPDATE ON reglas_aprobacion
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
  END IF;
END $$;

-- Aprobaciones
CREATE TABLE IF NOT EXISTS aprobaciones (
  id                          BIGSERIAL PRIMARY KEY,
  regla_id                    BIGINT NOT NULL REFERENCES reglas_aprobacion(id) ON DELETE RESTRICT,
  estado                      VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado')),
  solicitado_por_usuario_id   BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  aprobado_por_usuario_id     BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  entidad                     VARCHAR(50),
  entidad_id                  BIGINT,
  motivo                      TEXT,
  payload                     JSONB,
  creado_en                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelto_en                 TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_aprobaciones_estado ON aprobaciones(estado);
CREATE INDEX IF NOT EXISTS ix_aprobaciones_regla ON aprobaciones(regla_id);
CREATE INDEX IF NOT EXISTS ix_aprobaciones_entidad ON aprobaciones(entidad, entidad_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_aprobaciones'
  ) THEN
    CREATE TRIGGER set_updated_at_aprobaciones
    BEFORE UPDATE ON aprobaciones
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
  END IF;
END $$;

-- Historial de aprobaciones
CREATE TABLE IF NOT EXISTS aprobaciones_historial (
  id             BIGSERIAL PRIMARY KEY,
  aprobacion_id  BIGINT NOT NULL REFERENCES aprobaciones(id) ON DELETE CASCADE,
  usuario_id     BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  accion         VARCHAR(20) NOT NULL CHECK (accion IN ('creado','aprobado','rechazado','comentario')),
  notas          TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_aprob_hist_aprob ON aprobaciones_historial(aprobacion_id);

-- Regla de ejemplo: aprobación para cambios de precio de producto por encima del umbral
INSERT INTO reglas_aprobacion(clave, descripcion, condicion, activo)
VALUES ('product_price_update', 'Aprobar cambios de precio de producto que superen el umbral porcentual', '{"percent_threshold": 10}'::jsonb, TRUE)
ON CONFLICT (clave) DO NOTHING;

