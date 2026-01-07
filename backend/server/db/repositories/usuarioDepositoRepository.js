const { query } = require('../../db/pg');

async function getUserDepositoIds(usuarioId) {
  const { rows } = await query(
    'SELECT deposito_id FROM usuarios_depositos WHERE usuario_id = $1',
    [usuarioId]
  );
  return rows.map((r) => Number(r.deposito_id));
}

async function getUserDepositos(usuarioId) {
  const { rows } = await query(
    `SELECT d.id,
            d.nombre,
            d.codigo,
            d.direccion,
            d.activo,
            ud.rol_deposito
       FROM usuarios_depositos ud
       JOIN depositos d ON d.id = ud.deposito_id
      WHERE ud.usuario_id = $1
      ORDER BY d.nombre ASC`,
    [usuarioId]
  );
  return rows;
}

module.exports = {
  getUserDepositoIds,
  getUserDepositos,
};

