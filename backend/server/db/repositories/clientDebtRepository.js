const { query } = require('../../db/pg');

async function listByClient(clienteId) {
  const { rows } = await query(
    `SELECT id,
            cliente_id,
            monto::float AS monto,
            fecha,
            descripcion
       FROM clientes_deudas_iniciales
      WHERE cliente_id = $1
      ORDER BY fecha DESC, id DESC`,
    [clienteId]
  );
  return rows;
}

async function createForClient(clienteId, { monto, fecha, descripcion }) {
  const params = [clienteId, monto, fecha || new Date(), descripcion || null];
  const { rows } = await query(
    `INSERT INTO clientes_deudas_iniciales(cliente_id, monto, fecha, descripcion)
     VALUES ($1, $2, $3, $4)
     RETURNING id, cliente_id, monto::float AS monto, fecha, descripcion`,
    params
  );
  return rows[0];
}

async function listPaymentsByClient(clienteId) {
  const { rows } = await query(
    `SELECT id,
            cliente_id,
            monto::float AS monto,
            fecha,
            descripcion
       FROM clientes_deudas_iniciales_pagos
      WHERE cliente_id = $1
      ORDER BY fecha DESC, id DESC`,
    [clienteId]
  );
  return rows;
}

async function createPaymentForClient(clienteId, { monto, fecha, descripcion }) {
  const params = [clienteId, monto, fecha || new Date(), descripcion || null];
  const { rows } = await query(
    `INSERT INTO clientes_deudas_iniciales_pagos(cliente_id, monto, fecha, descripcion)
     VALUES ($1, $2, $3, $4)
     RETURNING id, cliente_id, monto::float AS monto, fecha, descripcion`,
    params
  );
  return rows[0];
}

module.exports = {
  listByClient,
  createForClient,
  listPaymentsByClient,
  createPaymentForClient,
};
