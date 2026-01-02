const { withTransaction, query } = require('../../db/pg');

async function crearPago({ venta_id, cliente_id, monto, fecha, metodo = 'efectivo', fecha_limite = null }) {
  return withTransaction(async (client) => {
    const v = await client.query('SELECT id, neto, estado_pago FROM ventas WHERE id = $1 FOR UPDATE', [venta_id]);
    if (!v.rowCount) { const e = new Error('Venta no encontrada'); e.status = 404; throw e; }
    const venta = v.rows[0];
    // Insert pago
    await client.query(
      `INSERT INTO pagos(venta_id, cliente_id, monto, fecha, metodo, fecha_limite)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [venta_id, cliente_id, monto, fecha || new Date(), metodo, fecha_limite || null]
    );
    // Recalcular total pagado
    const { rows } = await client.query('SELECT COALESCE(SUM(monto),0)::float AS total FROM pagos WHERE venta_id = $1', [venta_id]);
    const totalPagado = rows[0].total;
    if (totalPagado >= Number(venta.neto)) {
      await client.query("UPDATE ventas SET estado_pago = 'pagada' WHERE id = $1", [venta_id]);
    }
    return { venta_id, total_pagado: totalPagado };
  });
}

async function listarPagos({ venta_id, cliente_id, limit = 100, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (venta_id) { params.push(venta_id); where.push(`venta_id = $${params.length}`); }
  if (cliente_id) { params.push(cliente_id); where.push(`cliente_id = $${params.length}`); }
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  params.push(lim); params.push(off);
  const { rows } = await query(
    `SELECT id, venta_id, cliente_id, monto::float AS monto, fecha, metodo, fecha_limite
       FROM pagos
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY id DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

module.exports = { crearPago, listarPagos };
