const { query } = require('../../db/pg');

async function findActiveByKey(clave) {
  const { rows } = await query(
    `SELECT id, clave, descripcion, condicion, activo FROM reglas_aprobacion WHERE clave = $1 AND activo = TRUE LIMIT 1`,
    [clave]
  );
  return rows[0] || null;
}

async function list({ activo } = {}) {
  const params = [];
  const where = [];
  if (typeof activo === 'boolean') {
    params.push(activo);
    where.push(`activo = $${params.length}`);
  }
  const sql = `SELECT id, clave, descripcion, condicion, activo, creado_en, actualizado_en FROM reglas_aprobacion ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`;
  const { rows } = await query(sql, params);
  return rows;
}

async function create({ clave, descripcion, condicion, activo = true }) {
  const { rows } = await query(
    `INSERT INTO reglas_aprobacion(clave, descripcion, condicion, activo)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [clave, descripcion || null, condicion || null, Boolean(activo)]
  );
  return rows[0];
}

module.exports = { findActiveByKey, list, create };

