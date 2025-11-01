const { query } = require('../../db/pg');

async function findByEmail(email) {
  const { rows } = await query(
    `SELECT u.id, u.nombre, u.email, u.password_hash, u.rol_id, u.activo,
            r.nombre AS rol
       FROM usuarios u
  LEFT JOIN roles r ON r.id = u.rol_id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT u.id, u.nombre, u.email, u.rol_id, u.activo, r.nombre AS rol
       FROM usuarios u
  LEFT JOIN roles r ON r.id = u.rol_id
      WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function list({ q, activo, limit = 100, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (q) { params.push(`%${q.toLowerCase()}%`); where.push(`(LOWER(u.nombre) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`); }
  if (typeof activo !== 'undefined') { params.push(activo === 'true' ? true : false); where.push(`u.activo = $${params.length}`); }
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  params.push(lim); params.push(off);
  const { rows } = await query(
    `SELECT u.id, u.nombre, u.email, u.activo, r.nombre AS rol
       FROM usuarios u
  LEFT JOIN roles r ON r.id = u.rol_id
      ${where.length? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY u.id DESC
      LIMIT $${params.length-1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function create({ nombre, email, password_hash, rol_id, activo = true }) {
  const { rows } = await query(
    `INSERT INTO usuarios(nombre, email, password_hash, rol_id, activo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [nombre, email, password_hash, rol_id, !!activo]
  );
  return rows[0];
}

async function update(id, fields) {
  const sets = [];
  const params = [];
  let p = 1;
  for (const [key, col] of Object.entries({ nombre:'nombre', email:'email', rol_id:'rol_id', activo:'activo' })) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${col} = $${p++}`);
      params.push(fields[key]);
    }
  }
  if (!sets.length) return { id };
  params.push(id);
  const { rows } = await query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${p} RETURNING id`, params);
  return rows[0] || null;
}

async function setPasswordHash(id, password_hash) {
  const { rows } = await query(`UPDATE usuarios SET password_hash = $1 WHERE id = $2 RETURNING id`, [password_hash, id]);
  return rows[0] || null;
}

async function listRoles() {
  const { rows } = await query('SELECT id, nombre FROM roles ORDER BY id');
  return rows;
}

module.exports = { findByEmail, findById, list, create, update, setPasswordHash, listRoles };

