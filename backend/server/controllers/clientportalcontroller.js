const { query, withTransaction } = require('../db/pg');
const salesRepo = require('../db/repositories/salesRepository');
const inv = require('../services/inventoryService');

function getClienteId(req) {
  const clienteId = Number(req.client?.id);
  if (!Number.isInteger(clienteId) || clienteId <= 0) return null;
  return clienteId;
}

async function ensureCart(db, clienteId) {
  const { rows } = await db.query(
    `INSERT INTO clientes_carritos(cliente_id)
     VALUES ($1)
     ON CONFLICT (cliente_id) DO UPDATE SET actualizado_en = NOW()
     RETURNING id`,
    [clienteId]
  );
  return Number(rows[0].id);
}

async function getCartPayload(clienteId) {
  const carritoId = await ensureCart({ query }, clienteId);
  const { rows } = await query(
    `SELECT ci.id AS item_id,
            ci.producto_id,
            ci.cantidad,
            ci.precio_unitario_snapshot::float AS precio_unitario,
            p.nombre AS producto_nombre,
            p.descripcion AS producto_descripcion,
            p.precio_venta::float AS precio_lista,
            p.precio_final::float AS precio_final,
            COALESCE(img.url, NULL) AS image_url
       FROM clientes_carrito_items ci
       JOIN productos p ON p.id = ci.producto_id
  LEFT JOIN LATERAL (
         SELECT url
           FROM producto_imagenes
          WHERE producto_id = p.id
          ORDER BY orden ASC, id ASC
          LIMIT 1
       ) img ON TRUE
      WHERE ci.carrito_id = $1
      ORDER BY ci.id ASC`,
    [carritoId]
  );

  const items = rows.map((r) => {
    const qty = Number(r.cantidad || 0);
    const unit = Number(r.precio_unitario || 0);
    return {
      item_id: Number(r.item_id),
      producto_id: Number(r.producto_id),
      cantidad: qty,
      precio_unitario: unit,
      subtotal: qty * unit,
      producto_nombre: r.producto_nombre,
      producto_descripcion: r.producto_descripcion,
      precio_lista: Number(r.precio_lista || 0),
      precio_final: r.precio_final != null ? Number(r.precio_final) : null,
      image_url: r.image_url || null,
    };
  });

  const total = items.reduce((acc, it) => acc + it.subtotal, 0);
  return {
    carrito_id: carritoId,
    items,
    total,
    total_items: items.reduce((acc, it) => acc + it.cantidad, 0),
  };
}

async function me(req, res) {
  const clienteId = getClienteId(req);
  if (!clienteId) {
    return res.status(401).json({ error: 'Cliente no autorizado' });
  }

  try {
    const { rows } = await query(
      `SELECT id,
              nombre,
              apellido,
              email,
              telefono,
              direccion,
              cuit_cuil,
              estado,
              fecha_registro,
              tipo_cliente,
              segmento,
              tags
         FROM clientes
        WHERE id = $1
        LIMIT 1`,
      [clienteId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el perfil del cliente' });
  }
}

async function updateCuenta(req, res) {
  const clienteId = getClienteId(req);
  if (!clienteId) {
    return res.status(401).json({ error: 'Cliente no autorizado' });
  }

  try {
    const body = req.body || {};
    const sets = [];
    const params = [];
    let p = 1;

    const allowed = {
      nombre: 'nombre',
      apellido: 'apellido',
      telefono: 'telefono',
      email: 'email',
      direccion: 'direccion',
    };

    for (const [k, col] of Object.entries(allowed)) {
      if (!Object.prototype.hasOwnProperty.call(body, k)) continue;
      sets.push(`${col} = $${p++}`);
      if (k === 'email') {
        params.push(body[k] ? String(body[k]).trim().toLowerCase() : null);
      } else {
        params.push(body[k] ?? null);
      }
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(clienteId);
    const { rows } = await query(
      `UPDATE clientes
          SET ${sets.join(', ')}
        WHERE id = $${p}
      RETURNING id, nombre, apellido, email, telefono, direccion, estado`,
      params
    );

    if (!rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    if (String(e.code) === '23505') {
      return res.status(409).json({ error: 'El email ya esta en uso por otro cliente' });
    }
    res.status(500).json({ error: 'No se pudo actualizar la cuenta del cliente' });
  }
}

async function deuda(req, res) {
  const clienteId = getClienteId(req);
  if (!clienteId) {
    return res.status(401).json({ error: 'Cliente no autorizado' });
  }

  try {
    const { rows: resumenRows } = await query(
      `SELECT
         cliente_id,
         deuda_pendiente::float AS deuda_total,
         deuda_0_30::float AS deuda_0_30,
         deuda_31_60::float AS deuda_31_60,
         deuda_61_90::float AS deuda_61_90,
         deuda_mas_90::float AS deuda_mas_90,
         COALESCE(saldo_total, 0)::float AS saldo_total,
         dias_promedio_atraso::float AS dias_promedio_atraso
       FROM vista_deudas
       WHERE cliente_id = $1`,
      [clienteId]
    );

    const resumen = resumenRows[0] || {
      cliente_id: clienteId,
      deuda_total: 0,
      deuda_0_30: 0,
      deuda_31_60: 0,
      deuda_61_90: 0,
      deuda_mas_90: 0,
      saldo_total: 0,
      dias_promedio_atraso: null,
    };

    const { rows: ventasRows } = await query(
      `WITH pagos_venta AS (
         SELECT venta_id, SUM(monto)::float AS total_pagado
         FROM pagos
         GROUP BY venta_id
       )
       SELECT
         v.id AS venta_id,
         v.fecha::date AS fecha,
         v.neto::float AS neto,
         COALESCE(p.total_pagado, 0)::float AS total_pagado,
         (v.neto - COALESCE(p.total_pagado, 0))::float AS saldo
       FROM ventas v
       LEFT JOIN pagos_venta p ON p.venta_id = v.id
       WHERE v.estado_pago <> 'cancelado'
         AND v.cliente_id = $1
         AND (v.neto - COALESCE(p.total_pagado, 0)) <> 0
       ORDER BY v.fecha::date DESC, v.id DESC`,
      [clienteId]
    );

    const { rows: deudasIni } = await query(
      `SELECT id, monto::float AS monto, fecha::date AS fecha, descripcion
         FROM clientes_deudas_iniciales
        WHERE cliente_id = $1
        ORDER BY fecha DESC`,
      [clienteId]
    );

    const { rows: pagosIni } = await query(
      `SELECT id, monto::float AS monto, fecha::date AS fecha, descripcion
         FROM clientes_deudas_iniciales_pagos
        WHERE cliente_id = $1
        ORDER BY fecha DESC`,
      [clienteId]
    );

    res.json({
      resumen,
      ventas: ventasRows,
      deudas_iniciales: deudasIni,
      pagos_deudas_iniciales: pagosIni,
    });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener la deuda del cliente' });
  }
}

async function compras(req, res) {
  const clienteId = getClienteId(req);
  if (!clienteId) {
    return res.status(401).json({ error: 'Cliente no autorizado' });
  }
  try {
    const rows = await salesRepo.listarVentas({ cliente_id: clienteId, limit: 200 });
    res.json(rows.filter((r) => !r.oculto));
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener las compras' });
  }
}

async function compraDetalle(req, res) {
  const clienteId = getClienteId(req);
  const ventaId = Number(req.params.id);
  if (!clienteId) {
    return res.status(401).json({ error: 'Cliente no autorizado' });
  }
  if (!Number.isInteger(ventaId) || ventaId <= 0) {
    return res.status(400).json({ error: 'ID de compra invalido' });
  }
  try {
    const { rows } = await query(
      `SELECT 1 FROM ventas WHERE id = $1 AND cliente_id = $2 LIMIT 1`,
      [ventaId, clienteId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }
    const detalle = await salesRepo.getVentaDetalle(ventaId);
    res.json(detalle);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el detalle de la compra' });
  }
}

async function promociones(req, res) {
  const clienteId = getClienteId(req);
  if (!clienteId) {
    return res.status(401).json({ error: 'Cliente no autorizado' });
  }

  try {
    const { rows: clienteRows } = await query(
      `SELECT segmento FROM clientes WHERE id = $1 LIMIT 1`,
      [clienteId]
    );
    const segmento = clienteRows[0]?.segmento || null;

    const { rows } = await query(
      `SELECT id,
              titulo,
              descripcion,
              descuento_porcentaje::float AS descuento_porcentaje,
              codigo,
              segmento,
              fecha_inicio::date AS fecha_inicio,
              fecha_fin::date AS fecha_fin,
              activo
         FROM promociones
        WHERE activo = TRUE
          AND (fecha_inicio IS NULL OR fecha_inicio <= CURRENT_DATE)
          AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
          AND (segmento IS NULL OR segmento = '' OR segmento = $1)
        ORDER BY id DESC`,
      [segmento]
    );

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener las promociones' });
  }
}

async function carrito(req, res) {
  const clienteId = getClienteId(req);
  if (!clienteId) return res.status(401).json({ error: 'Cliente no autorizado' });

  try {
    const payload = await getCartPayload(clienteId);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el carrito' });
  }
}

async function carritoAddItem(req, res) {
  const clienteId = getClienteId(req);
  if (!clienteId) return res.status(401).json({ error: 'Cliente no autorizado' });

  const productoId = Number(req.body?.producto_id);
  const cantidad = Number(req.body?.cantidad || 1);
  if (!Number.isInteger(productoId) || productoId <= 0) {
    return res.status(400).json({ error: 'producto_id invalido' });
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 1000) {
    return res.status(400).json({ error: 'cantidad invalida' });
  }

  try {
    const { rows: prodRows } = await query(
      `SELECT id,
              COALESCE(precio_final, precio_venta)::float AS precio
         FROM productos
        WHERE id = $1
          AND activo = TRUE
        LIMIT 1`,
      [productoId]
    );
    if (!prodRows.length) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const precio = Number(prodRows[0].precio || 0);
    const carritoId = await ensureCart({ query }, clienteId);

    await query(
      `INSERT INTO clientes_carrito_items(carrito_id, producto_id, cantidad, precio_unitario_snapshot)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (carrito_id, producto_id)
       DO UPDATE SET cantidad = clientes_carrito_items.cantidad + EXCLUDED.cantidad,
                     precio_unitario_snapshot = EXCLUDED.precio_unitario_snapshot,
                     actualizado_en = NOW()`,
      [carritoId, productoId, cantidad, precio]
    );

    const payload = await getCartPayload(clienteId);
    res.status(201).json(payload);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo agregar el item al carrito' });
  }
}

async function carritoUpdateItem(req, res) {
  const clienteId = getClienteId(req);
  if (!clienteId) return res.status(401).json({ error: 'Cliente no autorizado' });

  const itemId = Number(req.params.itemId);
  const cantidad = Number(req.body?.cantidad);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ error: 'itemId invalido' });
  }
  if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > 1000) {
    return res.status(400).json({ error: 'cantidad invalida' });
  }

  try {
    const carritoId = await ensureCart({ query }, clienteId);
    if (cantidad === 0) {
      await query(
        `DELETE FROM clientes_carrito_items
          WHERE id = $1
            AND carrito_id = $2`,
        [itemId, carritoId]
      );
    } else {
      await query(
        `UPDATE clientes_carrito_items
            SET cantidad = $1,
                actualizado_en = NOW()
          WHERE id = $2
            AND carrito_id = $3`,
        [cantidad, itemId, carritoId]
      );
    }

    const payload = await getCartPayload(clienteId);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar el carrito' });
  }
}

async function carritoRemoveItem(req, res) {
  const clienteId = getClienteId(req);
  if (!clienteId) return res.status(401).json({ error: 'Cliente no autorizado' });

  const itemId = Number(req.params.itemId);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ error: 'itemId invalido' });
  }

  try {
    const carritoId = await ensureCart({ query }, clienteId);
    await query(
      `DELETE FROM clientes_carrito_items
        WHERE id = $1
          AND carrito_id = $2`,
      [itemId, carritoId]
    );

    const payload = await getCartPayload(clienteId);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar el item del carrito' });
  }
}

async function carritoClear(req, res) {
  const clienteId = getClienteId(req);
  if (!clienteId) return res.status(401).json({ error: 'Cliente no autorizado' });

  try {
    const carritoId = await ensureCart({ query }, clienteId);
    await query(`DELETE FROM clientes_carrito_items WHERE carrito_id = $1`, [carritoId]);
    const payload = await getCartPayload(clienteId);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo vaciar el carrito' });
  }
}

async function carritoCheckout(req, res) {
  const clienteId = getClienteId(req);
  if (!clienteId) return res.status(401).json({ error: 'Cliente no autorizado' });

  try {
    const result = await withTransaction(async (client) => {
      const { rows: cliRows } = await client.query(
        `SELECT id, estado
           FROM clientes
          WHERE id = $1
          FOR UPDATE`,
        [clienteId]
      );
      if (!cliRows.length) {
        const err = new Error('Cliente no encontrado');
        err.status = 404;
        throw err;
      }
      if (cliRows[0].estado !== 'activo') {
        const err = new Error('Cliente inactivo');
        err.status = 400;
        throw err;
      }

      const carritoId = await ensureCart(client, clienteId);
      const { rows: itemsRows } = await client.query(
        `SELECT ci.id,
                ci.producto_id,
                ci.cantidad,
                COALESCE(NULLIF(ci.precio_unitario_snapshot, 0), COALESCE(p.precio_final, p.precio_venta, 0))::float AS precio_unitario,
                p.nombre AS producto_nombre
           FROM clientes_carrito_items ci
           JOIN productos p ON p.id = ci.producto_id
          WHERE ci.carrito_id = $1
            AND p.activo = TRUE
          ORDER BY ci.id ASC
          FOR UPDATE`,
        [carritoId]
      );

      if (!itemsRows.length) {
        const err = new Error('El carrito esta vacio');
        err.status = 400;
        throw err;
      }

      let total = 0;
      const items = itemsRows.map((r) => {
        const cantidad = Number(r.cantidad || 0);
        const precio = Number(r.precio_unitario || 0);
        const subtotal = cantidad * precio;
        total += subtotal;
        return {
          producto_id: Number(r.producto_id),
          cantidad,
          precio_unitario: precio,
          subtotal,
          producto_nombre: r.producto_nombre,
        };
      });

      const neto = total;
      const depositoId = await inv.resolveDepositoId(client, null);

      const { rows: ventaRows } = await client.query(
        `INSERT INTO ventas(
           cliente_id,
           fecha,
           total,
           descuento,
           impuestos,
           neto,
           estado_pago,
           estado_entrega,
           observaciones,
           deposito_id
         )
         VALUES ($1, NOW(), $2, 0, 0, $3, 'pendiente', 'pendiente', $4, $5)
         RETURNING id`,
        [clienteId, total, neto, 'Pedido generado desde portal cliente', depositoId]
      );

      const ventaId = Number(ventaRows[0].id);

      for (const item of items) {
        await client.query(
          `INSERT INTO ventas_detalle(venta_id, producto_id, cantidad, precio_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [ventaId, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal]
        );
      }

      await client.query(`DELETE FROM clientes_carrito_items WHERE carrito_id = $1`, [carritoId]);

      return {
        venta_id: ventaId,
        total,
        items,
      };
    });

    res.status(201).json(result);
  } catch (e) {
    const code = e.status || 500;
    res.status(code).json({ error: e.message || 'No se pudo procesar el checkout' });
  }
}

module.exports = {
  me,
  updateCuenta,
  deuda,
  compras,
  compraDetalle,
  promociones,
  carrito,
  carritoAddItem,
  carritoUpdateItem,
  carritoRemoveItem,
  carritoClear,
  carritoCheckout,
};
