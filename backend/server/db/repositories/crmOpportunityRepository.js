const { query } = require('../../db/pg');

function clampInt(n, min, max, d) {
  const v = parseInt(n, 10);
  if (Number.isFinite(v)) return Math.min(Math.max(v, min), max);
  return d;
}

async function list({ q, fase, cliente_id, owner_id, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(`(LOWER(titulo) LIKE $${params.length} OR LOWER(notas) LIKE $${params.length})`);
  }
  if (fase) { params.push(fase); where.push(`fase = $${params.length}`); }
  if (cliente_id) { params.push(cliente_id); where.push(`cliente_id = $${params.length}`); }
  if (owner_id) { params.push(owner_id); where.push(`owner_usuario_id = $${params.length}`); }
  const lim = clampInt(limit, 1, 200, 50);
  const off = clampInt(offset, 0, 100000, 0);
  params.push(lim, off);
  const sql = `SELECT o.id, o.cliente_id, c.nombre AS cliente_nombre, o.titulo, o.fase,
                      o.valor_estimado::float AS valor_estimado, o.probabilidad, o.fecha_cierre_estimada,
                      o.owner_usuario_id, o.notas, o.creado_en, o.actualizado_en
                 FROM crm_oportunidades o
                 JOIN clientes c ON c.id = o.cliente_id
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY o.id DESC
                LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const { rows } = await query(sql, params);
  return rows;
}

async function create({ cliente_id, titulo, fase = 'lead', valor_estimado = 0, probabilidad = 0, fecha_cierre_estimada, owner_usuario_id, notas }) {
  const { rows } = await query(
    `INSERT INTO crm_oportunidades(cliente_id, titulo, fase, valor_estimado, probabilidad, fecha_cierre_estimada, owner_usuario_id, notas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [cliente_id, titulo, fase, valor_estimado, probabilidad, fecha_cierre_estimada || null, owner_usuario_id || null, notas || null]
  );
  return rows[0];
}

async function update(id, fields) {
  const sets = [];
  const params = [];
  let p = 1;
  for (const [key, col] of Object.entries({
    cliente_id: 'cliente_id',
    titulo: 'titulo',
    fase: 'fase',
    valor_estimado: 'valor_estimado',
    probabilidad: 'probabilidad',
    fecha_cierre_estimada: 'fecha_cierre_estimada',
    owner_usuario_id: 'owner_usuario_id',
    notas: 'notas',
  })) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${col} = $${p++}`);
      params.push(fields[key] ?? null);
    }
  }
  if (!sets.length) return { id };
  params.push(id);
  const { rows } = await query(`UPDATE crm_oportunidades SET ${sets.join(', ')} WHERE id = $${p} RETURNING id`, params);
  return rows[0] || null;
}

module.exports = { list, create, update };

