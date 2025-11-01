const { withTransaction, query } = require('../../db/pg');
const inv = require('../../services/inventoryService');

async function createCompra({ proveedor_id, fecha, moneda = 'USD', detalle = [] }) {
  return withTransaction(async (client) => {
    const prov = await client.query('SELECT id FROM proveedores WHERE id = $1', [proveedor_id]);
    if (!prov.rowCount) {
      const e = new Error('Proveedor no encontrado');
      e.status = 400;
      throw e;
    }
    let total = 0;
    for (const d of detalle) {
      const subtotal = (Number(d.costo_unitario) || 0) * (Number(d.cantidad) || 0) + (Number(d.costo_envio) || 0);
      total += subtotal;
    }
    const insCompra = await client.query(
      `INSERT INTO compras(proveedor_id, fecha, total_costo, moneda, estado)
       VALUES ($1, $2, $3, $4, 'pendiente') RETURNING id`,
      [proveedor_id, fecha || new Date(), total, moneda]
    );
    const compraId = insCompra.rows[0].id;

    for (const d of detalle) {
      const subtotal = (Number(d.costo_unitario) || 0) * (Number(d.cantidad) || 0) + (Number(d.costo_envio) || 0);
      await client.query(
        `INSERT INTO compras_detalle(compra_id, producto_id, cantidad, costo_unitario, costo_envio, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [compraId, d.producto_id, d.cantidad, d.costo_unitario, d.costo_envio || 0, subtotal]
      );
    }
    return { id: compraId, total };
  });
}

async function listarCompras({ limit = 100, offset = 0 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const { rows } = await query(
    `SELECT c.id, c.proveedor_id, p.nombre AS proveedor_nombre, c.fecha, c.total_costo::float AS total_costo, c.moneda, c.estado
       FROM compras c
       JOIN proveedores p ON p.id = c.proveedor_id
      ORDER BY c.id DESC
      LIMIT $1 OFFSET $2`,
    [lim, off]
  );
  return rows;
}

async function getCompraDetalle(id) {
  const { rows } = await query(
    `SELECT d.id, d.producto_id, pr.nombre AS producto_nombre, d.cantidad, d.costo_unitario::float AS costo_unitario, d.costo_envio::float AS costo_envio, d.subtotal::float AS subtotal
       FROM compras_detalle d
       JOIN productos pr ON pr.id = d.producto_id
      WHERE d.compra_id = $1`,
    [id]
  );
  return rows;
}

async function recibirCompra({ compra_id, fecha_recepcion, observaciones }) {
  return withTransaction(async (client) => {
    const c = await client.query('SELECT id, estado FROM compras WHERE id = $1 FOR UPDATE', [compra_id]);
    if (!c.rowCount) {
      const e = new Error('Compra no encontrada');
      e.status = 404;
      throw e;
    }
    if (c.rows[0].estado === 'recibido') return { id: compra_id, already: true };

    const { rows: det } = await client.query('SELECT producto_id, cantidad FROM compras_detalle WHERE compra_id = $1', [compra_id]);
    // Insert recepcion
    await client.query(
      `INSERT INTO recepciones(compra_id, fecha_recepcion, observaciones) VALUES ($1, $2, $3)`,
      [compra_id, fecha_recepcion || new Date(), observaciones || null]
    );

    // Update stock and movimientos
    for (const d of det) {
      await inv.addStockTx(client, { producto_id: d.producto_id, cantidad: d.cantidad, motivo: 'compra', referencia: `COMPRA ${compra_id}` });
    }

    await client.query("UPDATE compras SET estado = 'recibido' WHERE id = $1", [compra_id]);
    return { id: compra_id };
  });
}

module.exports = { createCompra, listarCompras, getCompraDetalle, recibirCompra };
