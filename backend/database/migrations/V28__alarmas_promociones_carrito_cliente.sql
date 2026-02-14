-- Fase 28: Alarmas operativas, promociones y carrito cliente
BEGIN;

CREATE TABLE IF NOT EXISTS alarmas_reglas (
  id               BIGSERIAL PRIMARY KEY,
  clave            VARCHAR(80) NOT NULL UNIQUE,
  nombre           VARCHAR(140) NOT NULL,
  descripcion      TEXT,
  tipo             VARCHAR(40) NOT NULL,
  severidad        VARCHAR(15) NOT NULL DEFAULT 'media' CHECK (severidad IN ('baja','media','alta','critica')),
  umbral_num       INTEGER NOT NULL DEFAULT 1 CHECK (umbral_num >= 1),
  ventana_minutos  INTEGER NOT NULL DEFAULT 15 CHECK (ventana_minutos >= 1),
  canal            VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (canal IN ('email','sms','ambos')),
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  parametros       JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_alarmas_reglas_activo ON alarmas_reglas(activo);

DROP TRIGGER IF EXISTS set_updated_at_alarmas_reglas ON alarmas_reglas;
CREATE TRIGGER set_updated_at_alarmas_reglas
BEFORE UPDATE ON alarmas_reglas
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE IF NOT EXISTS alarmas_destinatarios (
  id               BIGSERIAL PRIMARY KEY,
  nombre           VARCHAR(140) NOT NULL,
  email            VARCHAR(255),
  telefono         VARCHAR(80),
  canal_preferido  VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (canal_preferido IN ('email','sms','ambos')),
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (email IS NOT NULL OR telefono IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_alarmas_destinatarios_activo ON alarmas_destinatarios(activo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alarmas_destinatarios_email_ci
  ON alarmas_destinatarios (LOWER(email))
  WHERE email IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at_alarmas_destinatarios ON alarmas_destinatarios;
CREATE TRIGGER set_updated_at_alarmas_destinatarios
BEFORE UPDATE ON alarmas_destinatarios
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE IF NOT EXISTS alarmas_eventos (
  id                      BIGSERIAL PRIMARY KEY,
  regla_id                BIGINT REFERENCES alarmas_reglas(id) ON DELETE SET NULL,
  tipo                    VARCHAR(40) NOT NULL,
  severidad               VARCHAR(15) NOT NULL DEFAULT 'media' CHECK (severidad IN ('baja','media','alta','critica')),
  titulo                  VARCHAR(180) NOT NULL,
  descripcion             TEXT,
  payload                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key              VARCHAR(200),
  estado                  VARCHAR(20) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','ack','cerrada')),
  detectado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ack_por_usuario_id      BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  ack_en                  TIMESTAMPTZ,
  cerrado_por_usuario_id  BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  cerrado_en              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_alarmas_eventos_estado_fecha ON alarmas_eventos(estado, detectado_en DESC);
CREATE INDEX IF NOT EXISTS ix_alarmas_eventos_tipo ON alarmas_eventos(tipo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alarmas_eventos_dedupe_abierta
  ON alarmas_eventos(dedupe_key)
  WHERE dedupe_key IS NOT NULL AND estado IN ('abierta','ack');

DROP TRIGGER IF EXISTS set_updated_at_alarmas_eventos ON alarmas_eventos;
CREATE TRIGGER set_updated_at_alarmas_eventos
BEFORE UPDATE ON alarmas_eventos
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE IF NOT EXISTS alarmas_notificaciones (
  id                 BIGSERIAL PRIMARY KEY,
  evento_id          BIGINT NOT NULL REFERENCES alarmas_eventos(id) ON DELETE CASCADE,
  destinatario_id    BIGINT REFERENCES alarmas_destinatarios(id) ON DELETE SET NULL,
  canal              VARCHAR(20) NOT NULL CHECK (canal IN ('email','sms')),
  estado             VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','enviada','fallida','cancelada')),
  reintentos         INTEGER NOT NULL DEFAULT 0 CHECK (reintentos >= 0),
  max_reintentos     INTEGER NOT NULL DEFAULT 3 CHECK (max_reintentos >= 1),
  ultimo_error       TEXT,
  proximo_intento_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enviado_en         TIMESTAMPTZ,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_alarmas_notif_estado_intento ON alarmas_notificaciones(estado, proximo_intento_en);
CREATE INDEX IF NOT EXISTS ix_alarmas_notif_evento ON alarmas_notificaciones(evento_id);

DROP TRIGGER IF EXISTS set_updated_at_alarmas_notificaciones ON alarmas_notificaciones;
CREATE TRIGGER set_updated_at_alarmas_notificaciones
BEFORE UPDATE ON alarmas_notificaciones
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE IF NOT EXISTS promociones (
  id                    BIGSERIAL PRIMARY KEY,
  titulo                VARCHAR(160) NOT NULL,
  descripcion           TEXT,
  descuento_porcentaje  DECIMAL(5,2) CHECK (descuento_porcentaje IS NULL OR (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100)),
  codigo                VARCHAR(60),
  segmento              VARCHAR(100),
  fecha_inicio          DATE,
  fecha_fin             DATE,
  activo                BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por_usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS ix_promociones_activo_fechas ON promociones(activo, fecha_inicio, fecha_fin);

DROP TRIGGER IF EXISTS set_updated_at_promociones ON promociones;
CREATE TRIGGER set_updated_at_promociones
BEFORE UPDATE ON promociones
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE IF NOT EXISTS clientes_carritos (
  id             BIGSERIAL PRIMARY KEY,
  cliente_id     BIGINT NOT NULL UNIQUE REFERENCES clientes(id) ON DELETE CASCADE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_clientes_carritos ON clientes_carritos;
CREATE TRIGGER set_updated_at_clientes_carritos
BEFORE UPDATE ON clientes_carritos
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE IF NOT EXISTS clientes_carrito_items (
  id                      BIGSERIAL PRIMARY KEY,
  carrito_id              BIGINT NOT NULL REFERENCES clientes_carritos(id) ON DELETE CASCADE,
  producto_id             BIGINT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad                INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (precio_unitario_snapshot >= 0),
  agregado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (carrito_id, producto_id)
);

CREATE INDEX IF NOT EXISTS ix_clientes_carrito_items_carrito ON clientes_carrito_items(carrito_id);
CREATE INDEX IF NOT EXISTS ix_clientes_carrito_items_producto ON clientes_carrito_items(producto_id);

DROP TRIGGER IF EXISTS set_updated_at_clientes_carrito_items ON clientes_carrito_items;
CREATE TRIGGER set_updated_at_clientes_carrito_items
BEFORE UPDATE ON clientes_carrito_items
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

INSERT INTO alarmas_reglas (clave, nombre, descripcion, tipo, severidad, umbral_num, ventana_minutos, canal, activo, parametros)
VALUES
  ('stock_bajo_critico', 'Stock bajo critico', 'Detecta productos por debajo de stock minimo', 'stock_bajo', 'alta', 1, 60, 'email', TRUE, '{}'::jsonb),
  ('deuda_cliente_90', 'Deuda clientes > 90 dias', 'Detecta clientes con deuda de mas de 90 dias', 'deuda_cliente_90', 'alta', 1, 180, 'email', TRUE, '{}'::jsonb),
  ('deuda_proveedor_90', 'Deuda proveedores > 90 dias', 'Detecta deudas a proveedores vencidas', 'deuda_proveedor_90', 'alta', 1, 180, 'email', TRUE, '{}'::jsonb),
  ('login_fallidos', 'Intentos fallidos de login', 'Multiples intentos fallidos en ventana de tiempo', 'login_fallido', 'critica', 5, 15, 'sms', TRUE, '{}'::jsonb),
  ('errores_5xx_repetidos', 'Errores 5xx repetidos', 'Acumulacion de errores internos del servidor', 'error_5xx', 'critica', 5, 10, 'ambos', TRUE, '{}'::jsonb)
ON CONFLICT (clave) DO NOTHING;

COMMIT;
