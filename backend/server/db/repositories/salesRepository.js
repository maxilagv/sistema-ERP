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
      `SELECT p.id, p.nombre, p.precio_venta::float AS price, COALESCE(i.cantidad_disponible,0) AS stock
         FROM productos p
    LEFT JOIN inventario i ON i.producto_id = p.id
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

    // Calculate totals and verify stock
    let total = 0;
    for (const it of items) {
      const p = byId.get(Number(it.producto_id));
      if (!p) { const e = new Error(`Producto ${it.producto_id} inexistente`); e.status = 400; throw e; }
      const qty = Number(it.cantidad) || 0;
      if (p.stock < qty) { const e = new Error(`Stock insuficiente para ${p.nombre}`); e.status = 409; throw e; }
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
      // update inventory and movements
      const invRow = await client.query('SELECT cantidad_disponible FROM inventario WHERE producto_id = $1 FOR UPDATE', [Number(p.id)]);
      const available = invRow.rows[0]?.cantidad_disponible ?? 0;
      if (available < qty) { const e = new Error(`Stock insuficiente para ${p.nombre}`); e.status = 409; throw e; }
      await inv.removeStockTx(client, { producto_id: Number(p.id), cantidad: qty, motivo: 'venta', referencia: `VENTA ${ventaId}` });
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
            v.neto::float AS neto, v.estado_pago, v.observaciones
       FROM ventas v
       JOIN clientes c ON c.id = v.cliente_id
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
