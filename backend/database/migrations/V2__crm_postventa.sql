-- CRM: oportunidades y actividades; Postventa: tickets y eventos
-- Safe to run once via migrate.js

-- Oportunidades
CREATE TABLE IF NOT EXISTS crm_oportunidades (
  id                BIGSERIAL PRIMARY KEY,
  cliente_id        BIGINT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  titulo            VARCHAR(200) NOT NULL,
  fase              VARCHAR(30) NOT NULL DEFAULT 'lead' CHECK (fase IN ('lead','contacto','propuesta','negociacion','ganado','perdido')),
  valor_estimado    DECIMAL(12,2) DEFAULT 0 CHECK (valor_estimado >= 0),
  probabilidad      SMALLINT DEFAULT 0 CHECK (probabilidad BETWEEN 0 AND 100),
  fecha_cierre_estimada DATE,
  owner_usuario_id  BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  notas             TEXT,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_crm_op_cliente ON crm_oportunidades(cliente_id);
CREATE INDEX IF NOT EXISTS ix_crm_op_fase ON crm_oportunidades(fase);
CREATE INDEX IF NOT EXISTS ix_crm_op_owner ON crm_oportunidades(owner_usuario_id);

-- Trigger updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_crm_oportunidades'
  ) THEN
    CREATE TRIGGER set_updated_at_crm_oportunidades
    BEFORE UPDATE ON crm_oportunidades
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
  END IF;
END $$;

-- Actividades CRM
CREATE TABLE IF NOT EXISTS crm_actividades (
  id                 BIGSERIAL PRIMARY KEY,
  cliente_id         BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
  oportunidad_id     BIGINT REFERENCES crm_oportunidades(id) ON DELETE SET NULL,
  tipo               VARCHAR(20) NOT NULL CHECK (tipo IN ('llamada','reunion','tarea')),
  asunto             VARCHAR(200) NOT NULL,
  descripcion        TEXT,
  fecha_hora         TIMESTAMPTZ,
  estado             VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','completado','cancelado')),
  asignado_a_usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_crm_act_cliente ON crm_actividades(cliente_id);
CREATE INDEX IF NOT EXISTS ix_crm_act_oportunidad ON crm_actividades(oportunidad_id);
CREATE INDEX IF NOT EXISTS ix_crm_act_estado ON crm_actividades(estado);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_crm_actividades'
  ) THEN
    CREATE TRIGGER set_updated_at_crm_actividades
    BEFORE UPDATE ON crm_actividades
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
  END IF;
END $$;

-- Tickets Postventa
CREATE TABLE IF NOT EXISTS tickets (
  id                    BIGSERIAL PRIMARY KEY,
  cliente_id            BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
  asunto                VARCHAR(200) NOT NULL,
  descripcion           TEXT,
  estado                VARCHAR(20) NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','en_progreso','resuelto','cerrado')),
  prioridad             VARCHAR(10) NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja','media','alta','critica')),
  tipo                  VARCHAR(20) NOT NULL DEFAULT 'soporte' CHECK (tipo IN ('reclamo','garantia','devolucion','soporte')),
  asignado_a_usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  venta_id              BIGINT REFERENCES ventas(id) ON DELETE SET NULL,
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrado_en            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_tickets_cliente ON tickets(cliente_id);
CREATE INDEX IF NOT EXISTS ix_tickets_estado ON tickets(estado);
CREATE INDEX IF NOT EXISTS ix_tickets_prioridad ON tickets(prioridad);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_tickets'
  ) THEN
    CREATE TRIGGER set_updated_at_tickets
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
  END IF;
END $$;

-- Eventos de ticket (historial)
CREATE TABLE IF NOT EXISTS ticket_eventos (
  id          BIGSERIAL PRIMARY KEY,
  ticket_id   BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  usuario_id  BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo        VARCHAR(20) NOT NULL CHECK (tipo IN ('comentario','cambio_estado','asignacion','adjunto')),
  detalle     TEXT,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_ticket_eventos_ticket ON ticket_eventos(ticket_id);

