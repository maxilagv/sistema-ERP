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
      const itemMoneda = d.moneda || moneda || 'USD';
      const itemTipoCambio = typeof d.tipo_cambio !== 'undefined' ? d.tipo_cambio : null;
      await client.query(
        `INSERT INTO compras_detalle(
           compra_id,
           producto_id,
           cantidad,
           costo_unitario,
           costo_envio,
           subtotal,
           moneda,
           tipo_cambio
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [compraId, d.producto_id, d.cantidad, d.costo_unitario, d.costo_envio || 0, subtotal, itemMoneda, itemTipoCambio]
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
    `SELECT d.id,
            d.producto_id,
            pr.nombre AS producto_nombre,
            d.cantidad,
            d.costo_unitario::float AS costo_unitario,
            d.costo_envio::float AS costo_envio,
            d.subtotal::float AS subtotal,
            d.moneda,
            d.tipo_cambio::float AS tipo_cambio
       FROM compras_detalle d
       JOIN productos pr ON pr.id = d.producto_id
      WHERE d.compra_id = $1`,
    [id]
  );
  return rows;
}

async function recibirCompra({ compra_id, fecha_recepcion, observaciones, usuario_id }) {
  return withTransaction(async (client) => {
    const c = await client.query(
      'SELECT id, estado, proveedor_id, moneda FROM compras WHERE id = $1 FOR UPDATE',
      [compra_id]
    );
    if (!c.rowCount) {
      const e = new Error('Compra no encontrada');
      e.status = 404;
      throw e;
    }
    if (c.rows[0].estado === 'recibido') return { id: compra_id, already: true };

    const { rows: det } = await client.query(
      `SELECT producto_id,
              cantidad,
              costo_unitario,
              moneda,
              tipo_cambio
         FROM compras_detalle
        WHERE compra_id = $1`,
      [compra_id]
    );
    // Insert recepcion
    await client.query(
      `INSERT INTO recepciones(compra_id, fecha_recepcion, observaciones) VALUES ($1, $2, $3)`,
      [compra_id, fecha_recepcion || new Date(), observaciones || null]
    );

    // Update stock, costos de producto y historial
    for (const d of det) {
      await inv.addStockTx(client, {
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        motivo: 'compra',
        referencia: `COMPRA ${compra_id}`,
      });

      const monedaDetalle = d.moneda || c.rows[0].moneda || 'USD';
      const tipoCambio = d.tipo_cambio ? Number(d.tipo_cambio) : null;
      const costoUnitario = Number(d.costo_unitario) || 0;

      let costoPesos = 0;
      let costoDolares = 0;

      if (monedaDetalle === 'ARS') {
        costoPesos = costoUnitario;
        if (tipoCambio && tipoCambio > 0) {
          costoDolares = costoUnitario / tipoCambio;
        }
      } else if (monedaDetalle === 'USD') {
        costoDolares = costoUnitario;
        if (tipoCambio && tipoCambio > 0) {
          costoPesos = costoUnitario * tipoCambio;
        }
      } else {
        // Para otras monedas (ej. CNY) dejamos costos en 0 y solo registramos el tipo de cambio si viene
        costoPesos = 0;
        costoDolares = 0;
      }

      const { rows: prodRows } = await client.query(
        'SELECT margen_local, margen_distribuidor FROM productos WHERE id = $1',
        [d.producto_id]
      );
      if (!prodRows.length) continue;
      const prod = prodRows[0];
      const margenLocal = Number(prod.margen_local) || 0.15;
      const margenDistribuidor = Number(prod.margen_distribuidor) || 0.45;

      const precioLocal =
        costoPesos > 0 ? costoPesos * (1 + margenLocal) : 0;
      const precioDistribuidor =
        costoPesos > 0 ? costoPesos * (1 + margenDistribuidor) : 0;

      await client.query(
        `UPDATE productos
            SET precio_costo = $1,
                precio_costo_pesos = $1,
                precio_costo_dolares = $2,
                tipo_cambio = $3,
                margen_local = $4,
                margen_distribuidor = $5,
                precio_venta = $6,
                precio_local = $7,
                precio_distribuidor = $8,
                proveedor_id = $9,
                actualizado_en = CURRENT_TIMESTAMP
          WHERE id = $10`,
        [
          costoPesos,
          costoDolares,
          tipoCambio,
          margenLocal,
          margenDistribuidor,
          precioLocal,
          precioLocal,
          precioDistribuidor,
          c.rows[0].proveedor_id,
          d.producto_id,
        ]
      );

      await client.query(
        `INSERT INTO productos_historial(
           producto_id,
           proveedor_id,
           costo_pesos,
           costo_dolares,
           tipo_cambio,
           margen_local,
           margen_distribuidor,
           precio_local,
           precio_distribuidor,
           usuario_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          d.producto_id,
          c.rows[0].proveedor_id,
          costoPesos || null,
          costoDolares || null,
          tipoCambio,
          margenLocal,
          margenDistribuidor,
          precioLocal || null,
          precioDistribuidor || null,
          usuario_id || null,
        ]
      );
    }

    await client.query("UPDATE compras SET estado = 'recibido' WHERE id = $1", [compra_id]);
    return { id: compra_id };
  });
}

module.exports = { createCompra, listarCompras, getCompraDetalle, recibirCompra };
