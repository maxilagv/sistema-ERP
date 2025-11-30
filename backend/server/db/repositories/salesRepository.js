const { withTransaction, query } = require('../../db/pg');
const inv = require('../../services/inventoryService');

async function createVenta({ cliente_id, fecha, descuento = 0, impuestos = 0, items = [] }) {
  return withTransaction(async (client) => {
    // Validate cliente
    const c = await client.query('SELECT id FROM clientes WHERE id = $1', [cliente_id]);
    if (!c.rowCount) {
      const e = new Error('Cliente no encontrado');
      e.status = 400;
      throw e;
    }
    // Load and lock inventory for items
    const ids = items.map((i) => Number(i.producto_id));
    if (!ids.length) {
      const e = new Error('Debe incluir items');
      e.status = 400;
      throw e;
    }
    const { rows: products } = await client.query(
      `SELECT p.id, p.nombre, p.precio_venta::float AS price
         FROM productos p
        WHERE p.id = ANY($1::bigint[])`,
      [ids]
    );
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[ventas] productos solicitados', ids);
        console.debug('[ventas] productos encontrados', products.map((p) => p.id));
      }
    } catch {}
    const byId = new Map(products.map((p) => [Number(p.id), p]));

    // Calculate totals (validación de stock se hará al momento de entrega)
    let total = 0;
    for (const it of items) {
      const p = byId.get(Number(it.producto_id));
      if (!p) { const e = new Error(`Producto ${it.producto_id} inexistente`); e.status = 400; throw e; }
      const qty = Number(it.cantidad) || 0;
      const unitPrice = Number(it.precio_unitario) || p.price;
      total += unitPrice * qty;
    }
    const neto = total - (Number(descuento) || 0) + (Number(impuestos) || 0);

    const insVenta = await client.query(
      `INSERT INTO ventas(cliente_id, fecha, total, descuento, impuestos, neto, estado_pago)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente') RETURNING id`,
      [cliente_id, fecha || new Date(), total, descuento, impuestos, neto]
    );
    const ventaId = insVenta.rows[0].id;

    for (const it of items) {
      const p = byId.get(Number(it.producto_id));
      const qty = Number(it.cantidad) || 0;
      const unitPrice = Number(it.precio_unitario) || p.price;
      await client.query(
        `INSERT INTO ventas_detalle(venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [ventaId, Number(p.id), qty, unitPrice, unitPrice * qty]
      );
    }

    return { id: ventaId, total, neto };
  });
}

async function listarVentas({ limit = 100, offset = 0 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const { rows } = await query(
    `SELECT v.id, v.cliente_id, c.nombre AS cliente_nombre, v.fecha,
            v.total::float AS total, v.descuento::float AS descuento, v.impuestos::float AS impuestos,
            v.neto::float AS neto, v.estado_pago, v.estado_entrega, v.observaciones, v.oculto,
            COALESCE(p.total_pagado, 0)::float AS total_pagado,
            (v.neto - COALESCE(p.total_pagado, 0))::float AS saldo_pendiente
       FROM ventas v
       JOIN clientes c ON c.id = v.cliente_id
  LEFT JOIN (
            SELECT venta_id, SUM(monto) AS total_pagado
              FROM pagos
             GROUP BY venta_id
           ) p ON p.venta_id = v.id
      ORDER BY v.id DESC
      LIMIT $1 OFFSET $2`,
    [lim, off]
  );
  return rows;
}

async function getVentaDetalle(id) {
  const { rows } = await query(
    `SELECT d.id, d.producto_id, p.nombre AS producto_nombre, d.cantidad, d.precio_unitario::float AS precio_unitario, d.subtotal::float AS subtotal
       FROM ventas_detalle d
       JOIN productos p ON p.id = d.producto_id
      WHERE d.venta_id = $1`,
    [id]
  );
  return rows;
}

module.exports = { createVenta, listarVentas, getVentaDetalle };
 
async function entregarVenta(id) {
  return withTransaction(async (client) => {
    const v = await client.query('SELECT id, estado_entrega FROM ventas WHERE id = $1 FOR UPDATE', [id]);
    if (!v.rowCount) { const e = new Error('Venta no encontrada'); e.status = 404; throw e; }
    const venta = v.rows[0];
    if (venta.estado_entrega === 'entregado') { const e = new Error('La venta ya está entregada'); e.status = 400; throw e; }
    const { rows: items } = await client.query(
      `SELECT producto_id, cantidad, precio_unitario FROM ventas_detalle WHERE venta_id = $1 ORDER BY id ASC`,
      [id]
    );
    for (const it of items) {
      await inv.removeStockTx(client, { producto_id: Number(it.producto_id), cantidad: Number(it.cantidad), motivo: 'venta_entrega', referencia: `VENTA ${id}` });
    }
    await client.query("UPDATE ventas SET estado_entrega = 'entregado', fecha_entrega = NOW() WHERE id = $1", [id]);
    return { id, entregado: true };
  });
}

module.exports.entregarVenta = entregarVenta;

async function setOculto(id, oculto = true) {
  const { rows } = await query(
    'UPDATE ventas SET oculto = $2 WHERE id = $1 RETURNING id',
    [id, oculto]
  );
  return rows[0] || null;
}

module.exports.setOculto = setOculto;
