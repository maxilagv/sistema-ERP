const { query } = require('../db/pg');
const { sendNotificationEmail } = require('../utils/mailer');

const runtimeSignals = {
  login_fallido: new Map(),
  error_5xx: new Map(),
};

let schedulerStarted = false;
let evalTimer = null;
let queueTimer = null;

function nowMs() {
  return Date.now();
}

function pruneSignalMap(map, windowMs) {
  const minTs = nowMs() - windowMs;
  for (const [key, arr] of map.entries()) {
    const filtered = arr.filter((ts) => ts >= minTs);
    if (!filtered.length) map.delete(key);
    else map.set(key, filtered);
  }
}

function pushSignal(map, key, windowMs) {
  const ts = nowMs();
  const arr = map.get(key) || [];
  arr.push(ts);
  map.set(key, arr.filter((v) => v >= ts - windowMs));
  return map.get(key)?.length || 0;
}

async function getRuleByType(type) {
  const { rows } = await query(
    `SELECT id, clave, tipo, severidad, umbral_num, ventana_minutos, canal, activo
       FROM alarmas_reglas
      WHERE tipo = $1
      LIMIT 1`,
    [type]
  );
  return rows[0] || null;
}

function normalizeChannel(canal) {
  const c = String(canal || 'email').toLowerCase();
  if (c === 'sms' || c === 'ambos' || c === 'email') return c;
  return 'email';
}

function channelsFromRuleAndRecipient(ruleChannel, preferred, hasEmail, hasPhone) {
  const rc = normalizeChannel(ruleChannel);
  const pref = normalizeChannel(preferred || 'email');

  const allowedByRule = rc === 'ambos' ? ['email', 'sms'] : [rc];
  const allowedByPref = pref === 'ambos' ? ['email', 'sms'] : [pref];

  const channels = allowedByRule.filter((c) => allowedByPref.includes(c));

  return channels.filter((c) => {
    if (c === 'email') return hasEmail;
    if (c === 'sms') return hasPhone;
    return false;
  });
}

async function enqueueNotifications(eventId, ruleChannel) {
  const { rows: recipients } = await query(
    `SELECT id, nombre, email, telefono, canal_preferido
       FROM alarmas_destinatarios
      WHERE activo = TRUE
      ORDER BY id ASC`
  );

  for (const r of recipients) {
    const channels = channelsFromRuleAndRecipient(
      ruleChannel,
      r.canal_preferido,
      Boolean(r.email),
      Boolean(r.telefono)
    );

    for (const channel of channels) {
      await query(
        `INSERT INTO alarmas_notificaciones(evento_id, destinatario_id, canal, estado, reintentos, max_reintentos, proximo_intento_en)
         VALUES ($1, $2, $3, 'pendiente', 0, 3, NOW())`,
        [eventId, r.id, channel]
      );
    }
  }
}

async function createOrReuseEvent({
  rule,
  tipo,
  severidad,
  titulo,
  descripcion,
  payload,
  dedupeKey,
}) {
  if (!rule || rule.activo !== true) return null;

  if (dedupeKey) {
    const { rows: openRows } = await query(
      `SELECT id
         FROM alarmas_eventos
        WHERE dedupe_key = $1
          AND estado IN ('abierta','ack')
        ORDER BY id DESC
        LIMIT 1`,
      [dedupeKey]
    );

    if (openRows.length) {
      const id = Number(openRows[0].id);
      await query(
        `UPDATE alarmas_eventos
            SET descripcion = $2,
                payload = $3::jsonb,
                actualizado_en = NOW()
          WHERE id = $1`,
        [id, descripcion || null, JSON.stringify(payload || {})]
      );
      return { id, reused: true };
    }
  }

  const { rows } = await query(
    `INSERT INTO alarmas_eventos(regla_id, tipo, severidad, titulo, descripcion, payload, dedupe_key, estado)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'abierta')
     RETURNING id`,
    [
      rule.id,
      tipo,
      severidad || rule.severidad || 'media',
      titulo,
      descripcion || null,
      JSON.stringify(payload || {}),
      dedupeKey || null,
    ]
  );

  const eventId = Number(rows[0].id);
  await enqueueNotifications(eventId, rule.canal);
  return { id: eventId, reused: false };
}

async function evaluateStockLow() {
  const rule = await getRuleByType('stock_bajo');
  if (!rule || rule.activo !== true) return 0;

  const { rows } = await query(
    `SELECT producto_id, codigo, nombre, cantidad_disponible, stock_minimo
       FROM vista_stock_bajo
      ORDER BY (stock_minimo - cantidad_disponible) DESC
      LIMIT 200`
  );

  let created = 0;
  for (const r of rows) {
    const dedupeKey = `stock:${r.producto_id}`;
    const res = await createOrReuseEvent({
      rule,
      tipo: 'stock_bajo',
      severidad: 'alta',
      titulo: `Stock bajo: ${r.nombre}`,
      descripcion: `Producto ${r.codigo || ''} con ${r.cantidad_disponible} unidades (minimo ${r.stock_minimo}).`,
      payload: {
        producto_id: Number(r.producto_id),
        codigo: r.codigo,
        nombre: r.nombre,
        cantidad_disponible: Number(r.cantidad_disponible || 0),
        stock_minimo: Number(r.stock_minimo || 0),
      },
      dedupeKey,
    });
    if (res && !res.reused) created += 1;
  }
  return created;
}

async function evaluateClientDebt90() {
  const rule = await getRuleByType('deuda_cliente_90');
  if (!rule || rule.activo !== true) return 0;

  const { rows } = await query(
    `SELECT d.cliente_id,
            c.nombre,
            COALESCE(c.apellido, '') AS apellido,
            COALESCE(d.deuda_mas_90, 0)::float AS deuda_mas_90,
            COALESCE(d.deuda_pendiente, 0)::float AS deuda_total
       FROM vista_deudas d
       JOIN clientes c ON c.id = d.cliente_id
      WHERE COALESCE(d.deuda_mas_90, 0) > 0
      ORDER BY d.deuda_mas_90 DESC
      LIMIT 500`
  );

  let created = 0;
  for (const r of rows) {
    const dedupeKey = `deuda_cliente:${r.cliente_id}`;
    const fullName = `${r.nombre}${r.apellido ? ` ${r.apellido}` : ''}`;
    const res = await createOrReuseEvent({
      rule,
      tipo: 'deuda_cliente_90',
      severidad: 'alta',
      titulo: `Deuda vencida cliente: ${fullName}`,
      descripcion: `Cliente con deuda > 90 dias por $${Number(r.deuda_mas_90 || 0).toFixed(2)}.`,
      payload: {
        cliente_id: Number(r.cliente_id),
        nombre: r.nombre,
        apellido: r.apellido,
        deuda_mas_90: Number(r.deuda_mas_90 || 0),
        deuda_total: Number(r.deuda_total || 0),
      },
      dedupeKey,
    });
    if (res && !res.reused) created += 1;
  }

  return created;
}

async function evaluateSupplierDebt90() {
  const rule = await getRuleByType('deuda_proveedor_90');
  if (!rule || rule.activo !== true) return 0;

  const { rows } = await query(
    `WITH compras_pendientes AS (
       SELECT
         c.id,
         c.proveedor_id,
         c.fecha::date AS fecha_compra,
         c.total_costo,
         COALESCE(SUM(pp.monto), 0)::DECIMAL(12,2) AS total_pagado,
         (c.total_costo - COALESCE(SUM(pp.monto), 0))::DECIMAL(12,2) AS saldo
       FROM compras c
       LEFT JOIN pagos_proveedores pp ON pp.compra_id = c.id
       WHERE c.estado <> 'cancelado'
       GROUP BY c.id, c.proveedor_id, c.fecha::date, c.total_costo
     ),
     cp AS (
       SELECT
         proveedor_id,
         saldo,
         GREATEST(0, (CURRENT_DATE - fecha_compra))::INT AS dias
       FROM compras_pendientes
       WHERE saldo > 0
     )
     SELECT
       pr.id AS proveedor_id,
       pr.nombre AS proveedor_nombre,
       COALESCE(SUM(CASE WHEN cp.dias > 90 THEN cp.saldo ELSE 0 END), 0)::float AS deuda_mas_90
     FROM proveedores pr
     LEFT JOIN cp ON cp.proveedor_id = pr.id
     GROUP BY pr.id, pr.nombre
     HAVING COALESCE(SUM(CASE WHEN cp.dias > 90 THEN cp.saldo ELSE 0 END), 0) > 0
     ORDER BY deuda_mas_90 DESC
     LIMIT 500`
  );

  let created = 0;
  for (const r of rows) {
    const dedupeKey = `deuda_proveedor:${r.proveedor_id}`;
    const res = await createOrReuseEvent({
      rule,
      tipo: 'deuda_proveedor_90',
      severidad: 'alta',
      titulo: `Deuda vencida proveedor: ${r.proveedor_nombre}`,
      descripcion: `Proveedor con deuda > 90 dias por $${Number(r.deuda_mas_90 || 0).toFixed(2)}.`,
      payload: {
        proveedor_id: Number(r.proveedor_id),
        proveedor_nombre: r.proveedor_nombre,
        deuda_mas_90: Number(r.deuda_mas_90 || 0),
      },
      dedupeKey,
    });
    if (res && !res.reused) created += 1;
  }

  return created;
}

async function evaluateBusinessRules() {
  const [a, b, c] = await Promise.all([
    evaluateStockLow(),
    evaluateClientDebt90(),
    evaluateSupplierDebt90(),
  ]);

  return {
    stock: a,
    deudasClientes: b,
    deudasProveedores: c,
    totalNuevas: a + b + c,
  };
}

async function sendSms(phone, message) {
  if (!phone) {
    throw new Error('Destinatario SMS sin telefono');
  }
  // Simulacion controlada. Si se configura proveedor externo se reemplaza aca.
  console.log(`[ALARM SMS] to=${phone} msg=${message}`);
}

async function processNotificationQueue(limit = 50) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 300);

  const { rows } = await query(
    `SELECT n.id,
            n.canal,
            n.reintentos,
            n.max_reintentos,
            n.destinatario_id,
            e.titulo,
            e.descripcion,
            e.severidad,
            d.nombre AS destinatario_nombre,
            d.email,
            d.telefono
       FROM alarmas_notificaciones n
       JOIN alarmas_eventos e ON e.id = n.evento_id
       LEFT JOIN alarmas_destinatarios d ON d.id = n.destinatario_id
      WHERE n.estado IN ('pendiente','fallida')
        AND n.reintentos < n.max_reintentos
        AND n.proximo_intento_en <= NOW()
      ORDER BY n.id ASC
      LIMIT $1`,
    [lim]
  );

  let sent = 0;
  let failed = 0;

  for (const n of rows) {
    try {
      const title = `[ALARMA ${String(n.severidad || '').toUpperCase()}] ${n.titulo}`;
      const body = n.descripcion || 'Evento de alarma detectado.';

      if (n.canal === 'email') {
        if (!n.email) {
          throw new Error('Destinatario sin email');
        }
        await sendNotificationEmail(n.email, title, body);
      } else if (n.canal === 'sms') {
        await sendSms(n.telefono, `${title}. ${body}`);
      } else {
        throw new Error('Canal de notificacion invalido');
      }

      await query(
        `UPDATE alarmas_notificaciones
            SET estado = 'enviada',
                enviado_en = NOW(),
                ultimo_error = NULL,
                actualizado_en = NOW()
          WHERE id = $1`,
        [n.id]
      );

      sent += 1;
    } catch (err) {
      const retries = Number(n.reintentos || 0) + 1;
      const backoffMinutes = Math.min(60, Math.pow(2, Math.max(0, retries - 1)) * 2);
      const exhausted = retries >= Number(n.max_reintentos || 3);
      await query(
        `UPDATE alarmas_notificaciones
            SET estado = CASE WHEN $2 THEN 'cancelada' ELSE 'fallida' END,
                reintentos = $1,
                ultimo_error = $3,
                proximo_intento_en = NOW() + ($4 || ' minutes')::interval,
                actualizado_en = NOW()
          WHERE id = $5`,
        [retries, exhausted, String(err.message || 'Error enviando notificacion'), String(backoffMinutes), n.id]
      );
      failed += 1;
    }
  }

  return { processed: rows.length, sent, failed };
}

async function registerThresholdSignal({ type, key, payload }) {
  const rule = await getRuleByType(type);
  if (!rule || rule.activo !== true) return null;

  const threshold = Math.max(1, Number(rule.umbral_num || 1));
  const windowMinutes = Math.max(1, Number(rule.ventana_minutos || 15));
  const windowMs = windowMinutes * 60 * 1000;

  const signalMap = runtimeSignals[type];
  if (!signalMap) return null;

  pruneSignalMap(signalMap, windowMs);
  const count = pushSignal(signalMap, key, windowMs);

  if (count < threshold) return null;

  if (type === 'login_fallido') {
    return createOrReuseEvent({
      rule,
      tipo: type,
      severidad: 'critica',
      titulo: `Intentos fallidos de login desde ${key}`,
      descripcion: `Se detectaron ${count} intentos fallidos en ${windowMinutes} minutos.`,
      payload: { ...payload, intentos: count, ventana_minutos: windowMinutes },
      dedupeKey: `login:${key}`,
    });
  }

  if (type === 'error_5xx') {
    return createOrReuseEvent({
      rule,
      tipo: type,
      severidad: 'critica',
      titulo: `Errores 5xx repetidos en ${key}`,
      descripcion: `Se detectaron ${count} errores 5xx en ${windowMinutes} minutos.`,
      payload: { ...payload, errores: count, ventana_minutos: windowMinutes },
      dedupeKey: `error5xx:${key}`,
    });
  }

  return null;
}

async function recordLoginFailure({ ip, email }) {
  if (!ip) return null;
  return registerThresholdSignal({
    type: 'login_fallido',
    key: ip,
    payload: { ip, email: email || null },
  });
}

async function recordServerError({ route, message }) {
  const key = route || 'unknown';
  return registerThresholdSignal({
    type: 'error_5xx',
    key,
    payload: { route: key, message: message || null },
  });
}

function startScheduler() {
  if (schedulerStarted) return;

  const evalMs = Math.max(30_000, Number(process.env.ALARM_EVAL_INTERVAL_MS || 300_000));
  const queueMs = Math.max(10_000, Number(process.env.ALARM_QUEUE_INTERVAL_MS || 30_000));

  evalTimer = setInterval(() => {
    evaluateBusinessRules().catch((err) => {
      console.error('[AlarmService] evaluateBusinessRules error:', err.message);
    });
  }, evalMs);

  queueTimer = setInterval(() => {
    processNotificationQueue().catch((err) => {
      console.error('[AlarmService] processNotificationQueue error:', err.message);
    });
  }, queueMs);

  // arranque en caliente
  evaluateBusinessRules().catch((err) => {
    console.error('[AlarmService] initial evaluate error:', err.message);
  });

  processNotificationQueue().catch((err) => {
    console.error('[AlarmService] initial queue error:', err.message);
  });

  schedulerStarted = true;
}

function stopScheduler() {
  if (evalTimer) clearInterval(evalTimer);
  if (queueTimer) clearInterval(queueTimer);
  evalTimer = null;
  queueTimer = null;
  schedulerStarted = false;
}

module.exports = {
  evaluateBusinessRules,
  processNotificationQueue,
  recordLoginFailure,
  recordServerError,
  startScheduler,
  stopScheduler,
};
