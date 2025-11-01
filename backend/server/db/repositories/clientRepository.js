const { query } = require('../../db/pg');

async function list({ q, estado, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(`(LOWER(nombre) LIKE $${params.length} OR LOWER(apellido) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR LOWER(telefono) LIKE $${params.length} OR LOWER(cuit_cuil) LIKE $${params.length})`);
  }
  if (estado) {
    params.push(estado);
    where.push(`estado = $${params.length}`);
  }
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  params.push(lim);
  params.push(off);
  const sql = `SELECT id, nombre, apellido, telefono, email, direccion, cuit_cuil, fecha_registro, estado
                 FROM clientes
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY id DESC
                LIMIT $${params.length - 1}
               OFFSET $${params.length}`;
  const { rows } = await query(sql, params);
  return rows;
}

async function create({ nombre, apellido, telefono, email, direccion, cuit_cuil, estado = 'activo' }) {
  const { rows } = await query(
    `INSERT INTO clientes(nombre, apellido, telefono, email, direccion, cuit_cuil, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [nombre, apellido || null, telefono || null, email || null, direccion || null, cuit_cuil || null, estado]
  );
  return rows[0];
}

async function update(id, fields) {
  const sets = [];
  const params = [];
  let p = 1;
  for (const [key, col] of Object.entries({ nombre:'nombre', apellido:'apellido', telefono:'telefono', email:'email', direccion:'direccion', cuit_cuil:'cuit_cuil', estado:'estado' })) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${col} = $${p++}`);
      params.push(fields[key] ?? null);
    }
  }
  if (!sets.length) return { id };
  params.push(id);
  const { rows } = await query(`UPDATE clientes SET ${sets.join(', ')} WHERE id = $${p} RETURNING id`, params);
  return rows[0] || null;
}

module.exports = { list, create, update };

