const { query } = require('../db/pg');
const alarmService = require('../services/alarmService');

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return null;
}

async function listRules(req, res) {
  try {
    const active = parseBool(req.query.activo);
    const params = [];
    let where = '';
    if (active != null) {
      params.push(active);
      where = `WHERE activo = $${params.length}`;
    }

    const { rows } = await query(
      `SELECT id, clave, nombre, descripcion, tipo, severidad, umbral_num, ventana_minutos, canal, activo, parametros, creado_en, actualizado_en
         FROM alarmas_reglas
         ${where}
        ORDER BY id ASC`,
      params
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener las reglas de alarmas' });
  }
}

async function createRule(req, res) {
  try {
    const body = req.body || {};
    const clave = String(body.clave || '').trim();
    const nombre = String(body.nombre || '').trim();
    const tipo = String(body.tipo || '').trim();
    const severidad = String(body.severidad || 'media').trim().toLowerCase();
    const canal = String(body.canal || 'email').trim().toLowerCase();
    const umbral = Math.max(1, Number(body.umbral_num || 1));
    const ventana = Math.max(1, Number(body.ventana_minutos || 15));

    if (!clave || !nombre || !tipo) {
      return res.status(400).json({ error: 'clave, nombre y tipo son obligatorios' });
    }

    if (!['baja', 'media', 'alta', 'critica'].includes(severidad)) {
      return res.status(400).json({ error: 'Severidad invalida' });
    }

    if (!['email', 'sms', 'ambos'].includes(canal)) {
      return res.status(400).json({ error: 'Canal invalido' });
    }

    const { rows } = await query(
      `INSERT INTO alarmas_reglas(clave, nombre, descripcion, tipo, severidad, umbral_num, ventana_minutos, canal, activo, parametros)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING id, clave, nombre, descripcion, tipo, severidad, umbral_num, ventana_minutos, canal, activo, parametros`,
      [
        clave,
        nombre,
        body.descripcion || null,
        tipo,
        severidad,
        umbral,
        ventana,
        canal,
        body.activo !== false,
        JSON.stringify(body.parametros || {}),
      ]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    if (String(e.message || '').toLowerCase().includes('duplicate')) {
      return res.status(409).json({ error: 'Ya existe una regla con esa clave' });
    }
    res.status(500).json({ error: 'No se pudo crear la regla de alarma' });
  }
}

async function updateRule(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const body = req.body || {};
    const sets = [];
    const params = [];
    let p = 1;

    const allowed = {
      nombre: 'nombre',
      descripcion: 'descripcion',
      tipo: 'tipo',
      severidad: 'severidad',
      umbral_num: 'umbral_num',
      ventana_minutos: 'ventana_minutos',
      canal: 'canal',
      activo: 'activo',
      parametros: 'parametros',
    };

    for (const [k, col] of Object.entries(allowed)) {
      if (!Object.prototype.hasOwnProperty.call(body, k)) continue;
      let value = body[k];

      if (k === 'severidad') {
        value = String(value || '').toLowerCase();
        if (!['baja', 'media', 'alta', 'critica'].includes(value)) {
          return res.status(400).json({ error: 'Severidad invalida' });
        }
      }

      if (k === 'canal') {
        value = String(value || '').toLowerCase();
        if (!['email', 'sms', 'ambos'].includes(value)) {
          return res.status(400).json({ error: 'Canal invalido' });
        }
      }

      if (k === 'umbral_num' || k === 'ventana_minutos') {
        value = Math.max(1, Number(value || 1));
      }

      if (k === 'parametros') {
        sets.push(`${col} = $${p++}::jsonb`);
        params.push(JSON.stringify(value || {}));
      } else {
        sets.push(`${col} = $${p++}`);
        params.push(value);
      }
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(id);
    const { rows } = await query(
      `UPDATE alarmas_reglas
          SET ${sets.join(', ')}, actualizado_en = NOW()
        WHERE id = $${p}
      RETURNING id, clave, nombre, descripcion, tipo, severidad, umbral_num, ventana_minutos, canal, activo, parametros`,
      params
    );

    if (!rows.length) return res.status(404).json({ error: 'Regla no encontrada' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar la regla de alarma' });
  }
}

async function listRecipients(req, res) {
  try {
    const { rows } = await query(
      `SELECT id, nombre, email, telefono, canal_preferido, activo, creado_en, actualizado_en
         FROM alarmas_destinatarios
        ORDER BY id ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener los destinatarios' });
  }
}

async function createRecipient(req, res) {
  try {
    const body = req.body || {};
    const nombre = String(body.nombre || '').trim();
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    const telefono = body.telefono ? String(body.telefono).trim() : null;
    const canal = String(body.canal_preferido || 'email').toLowerCase();

    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    if (!email && !telefono) {
      return res.status(400).json({ error: 'Debe informar email o telefono' });
    }
    if (!['email', 'sms', 'ambos'].includes(canal)) {
      return res.status(400).json({ error: 'Canal preferido invalido' });
    }

    const { rows } = await query(
      `INSERT INTO alarmas_destinatarios(nombre, email, telefono, canal_preferido, activo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, email, telefono, canal_preferido, activo`,
      [nombre, email, telefono, canal, body.activo !== false]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    if (String(e.message || '').toLowerCase().includes('uq_alarmas_destinatarios_email_ci')) {
      return res.status(409).json({ error: 'Ya existe un destinatario con ese email' });
    }
    res.status(500).json({ error: 'No se pudo crear el destinatario' });
  }
}

async function updateRecipient(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const body = req.body || {};
    const sets = [];
    const params = [];
    let p = 1;

    if (Object.prototype.hasOwnProperty.call(body, 'nombre')) {
      sets.push(`nombre = $${p++}`);
      params.push(String(body.nombre || '').trim());
    }

    if (Object.prototype.hasOwnProperty.call(body, 'email')) {
      sets.push(`email = $${p++}`);
      params.push(body.email ? String(body.email).trim().toLowerCase() : null);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'telefono')) {
      sets.push(`telefono = $${p++}`);
      params.push(body.telefono ? String(body.telefono).trim() : null);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'canal_preferido')) {
      const canal = String(body.canal_preferido || '').toLowerCase();
      if (!['email', 'sms', 'ambos'].includes(canal)) {
        return res.status(400).json({ error: 'Canal preferido invalido' });
      }
      sets.push(`canal_preferido = $${p++}`);
      params.push(canal);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'activo')) {
      sets.push(`activo = $${p++}`);
      params.push(Boolean(body.activo));
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(id);
    const { rows } = await query(
      `UPDATE alarmas_destinatarios
          SET ${sets.join(', ')}, actualizado_en = NOW()
        WHERE id = $${p}
        RETURNING id, nombre, email, telefono, canal_preferido, activo`,
      params
    );

    if (!rows.length) return res.status(404).json({ error: 'Destinatario no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar el destinatario' });
  }
}

async function listEvents(req, res) {
  try {
    const { estado, tipo, severidad, limit } = req.query || {};
    const params = [];
    const where = [];

    if (estado) {
      params.push(String(estado));
      where.push(`e.estado = $${params.length}`);
    }

    if (tipo) {
      params.push(String(tipo));
      where.push(`e.tipo = $${params.length}`);
    }

    if (severidad) {
      params.push(String(severidad));
      where.push(`e.severidad = $${params.length}`);
    }

    const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
    params.push(lim);

    const { rows } = await query(
      `SELECT e.id,
              e.regla_id,
              e.tipo,
              e.severidad,
              e.titulo,
              e.descripcion,
              e.payload,
              e.dedupe_key,
              e.estado,
              e.detectado_en,
              e.actualizado_en,
              e.ack_en,
              e.cerrado_en,
              r.clave AS regla_clave,
              r.nombre AS regla_nombre
         FROM alarmas_eventos e
         LEFT JOIN alarmas_reglas r ON r.id = e.regla_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY e.detectado_en DESC
        LIMIT $${params.length}`,
      params
    );

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener los eventos de alarmas' });
  }
}

async function ackEvent(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const userId = Number(req.user?.sub) || null;
    const { rows } = await query(
      `UPDATE alarmas_eventos
          SET estado = 'ack',
              ack_por_usuario_id = $2,
              ack_en = NOW(),
              actualizado_en = NOW()
        WHERE id = $1
          AND estado <> 'cerrada'
      RETURNING id, estado, ack_en`,
      [id, userId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Evento no encontrado o ya cerrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo confirmar la alarma' });
  }
}

async function closeEvent(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const userId = Number(req.user?.sub) || null;
    const { rows } = await query(
      `UPDATE alarmas_eventos
          SET estado = 'cerrada',
              cerrado_por_usuario_id = $2,
              cerrado_en = NOW(),
              actualizado_en = NOW()
        WHERE id = $1
          AND estado <> 'cerrada'
      RETURNING id, estado, cerrado_en`,
      [id, userId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Evento no encontrado o ya cerrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo cerrar la alarma' });
  }
}

async function listNotifications(req, res) {
  try {
    const { estado, limit } = req.query || {};
    const params = [];
    const where = [];

    if (estado) {
      params.push(String(estado));
      where.push(`n.estado = $${params.length}`);
    }

    const lim = Math.min(Math.max(Number(limit) || 200, 1), 1000);
    params.push(lim);

    const { rows } = await query(
      `SELECT n.id,
              n.evento_id,
              n.destinatario_id,
              n.canal,
              n.estado,
              n.reintentos,
              n.max_reintentos,
              n.ultimo_error,
              n.proximo_intento_en,
              n.enviado_en,
              n.creado_en,
              d.nombre AS destinatario_nombre,
              d.email,
              d.telefono,
              e.titulo AS evento_titulo,
              e.severidad AS evento_severidad
         FROM alarmas_notificaciones n
         LEFT JOIN alarmas_destinatarios d ON d.id = n.destinatario_id
         JOIN alarmas_eventos e ON e.id = n.evento_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY n.id DESC
        LIMIT $${params.length}`,
      params
    );

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener las notificaciones de alarmas' });
  }
}

async function triggerEvaluation(req, res) {
  try {
    const result = await alarmService.evaluateBusinessRules();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo ejecutar la evaluacion de alarmas' });
  }
}

async function triggerQueue(req, res) {
  try {
    const result = await alarmService.processNotificationQueue(Number(req.body?.limit || req.query?.limit || 50));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo procesar la cola de alarmas' });
  }
}

module.exports = {
  listRules,
  createRule,
  updateRule,
  listRecipients,
  createRecipient,
  updateRecipient,
  listEvents,
  ackEvent,
  closeEvent,
  listNotifications,
  triggerEvaluation,
  triggerQueue,
};
