const { query } = require('../pg');

async function getNumericParam(key) {
  const { rows } = await query(
    'SELECT valor_num FROM parametros_sistema WHERE clave = $1 LIMIT 1',
    [key]
  );
  if (!rows.length) return null;
  const val = rows[0].valor_num;
  return val == null ? null : Number(val);
}

async function getTextParam(key) {
  const { rows } = await query(
    'SELECT valor_texto FROM parametros_sistema WHERE clave = $1 LIMIT 1',
    [key]
  );
  if (!rows.length) return null;
  const val = rows[0].valor_texto;
  return val == null ? null : String(val);
}

async function setNumericParam(key, value, usuarioId) {
  await query(
    `INSERT INTO parametros_sistema(clave, valor_num, usuario_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (clave) DO UPDATE
       SET valor_num = EXCLUDED.valor_num,
           usuario_id = EXCLUDED.usuario_id,
           actualizado_en = NOW()`,
    [key, value, usuarioId || null]
  );
}

async function setTextParam(key, value, usuarioId) {
  await query(
    `INSERT INTO parametros_sistema(clave, valor_texto, usuario_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (clave) DO UPDATE
       SET valor_texto = EXCLUDED.valor_texto,
           usuario_id = EXCLUDED.usuario_id,
           actualizado_en = NOW()`,
    [key, value, usuarioId || null]
  );
}

async function getDolarBlue() {
  return getNumericParam('dolar_blue');
}

async function setDolarBlue(valor, usuarioId) {
  return setNumericParam('dolar_blue', valor, usuarioId);
}

module.exports = {
  getNumericParam,
  getTextParam,
  setNumericParam,
  setTextParam,
  getDolarBlue,
  setDolarBlue,
};
