const { withTransaction } = require('../db/pg');
const audit = require('./auditService');

async function ensureInventory(client, productoId) {
  const r = await client.query('SELECT id FROM inventario WHERE producto_id = $1', [productoId]);
  if (!r.rowCount) {
    await client.query('INSERT INTO inventario(producto_id, cantidad_disponible, cantidad_reservada) VALUES ($1, 0, 0)', [productoId]);
  }
}

async function addStockTx(client, { producto_id, cantidad, motivo, referencia, usuario_id = null }) {
  await ensureInventory(client, producto_id);
  await client.query('UPDATE inventario SET cantidad_disponible = cantidad_disponible + $1 WHERE producto_id = $2', [cantidad, producto_id]);
  await client.query(
    `INSERT INTO movimientos_stock(producto_id, tipo, cantidad, motivo, referencia, usuario_id)
     VALUES ($1, 'entrada', $2, $3, $4, $5)`,
    [producto_id, cantidad, motivo || 'compra', referencia || null, usuario_id]
  );
  audit.log({ usuario_id, accion: 'entrada_stock', tabla_afectada: 'inventario', registro_id: producto_id, descripcion: `${cantidad} por ${motivo || 'N/A'} ref=${referencia || ''}` });
}

async function removeStockTx(client, { producto_id, cantidad, motivo, referencia, usuario_id = null }) {
  await ensureInventory(client, producto_id);
  const { rows } = await client.query('SELECT cantidad_disponible FROM inventario WHERE producto_id = $1 FOR UPDATE', [producto_id]);
  const available = rows[0]?.cantidad_disponible ?? 0;
  if (available < cantidad) {
    const e = new Error(`Stock insuficiente para producto ${producto_id}`);
    e.status = 409;
    throw e;
  }
  await client.query('UPDATE inventario SET cantidad_disponible = cantidad_disponible - $1 WHERE producto_id = $2', [cantidad, producto_id]);
  await client.query(
    `INSERT INTO movimientos_stock(producto_id, tipo, cantidad, motivo, referencia, usuario_id)
     VALUES ($1, 'salida', $2, $3, $4, $5)`,
    [producto_id, cantidad, motivo || 'venta', referencia || null, usuario_id]
  );
  audit.log({ usuario_id, accion: 'salida_stock', tabla_afectada: 'inventario', registro_id: producto_id, descripcion: `${cantidad} por ${motivo || 'N/A'} ref=${referencia || ''}` });
}

async function addStockBatch({ items, motivo, referencia, usuario_id = null }) {
  return withTransaction(async (client) => {
    for (const it of items) {
      await addStockTx(client, { ...it, motivo, referencia, usuario_id });
    }
  });
}

async function removeStockBatch({ items, motivo, referencia, usuario_id = null }) {
  return withTransaction(async (client) => {
    for (const it of items) {
      await removeStockTx(client, { ...it, motivo, referencia, usuario_id });
    }
  });
}

module.exports = {
  addStockTx,
  removeStockTx,
  addStockBatch,
  removeStockBatch,
};

// Ajustes manuales y reservas
async function adjustStock({ producto_id, cantidad, motivo, referencia, usuario_id = null }) {
  // cantidad puede ser positiva (entrada) o negativa (salida)
  return withTransaction(async (client) => {
    if (cantidad === 0) return;
    if (cantidad > 0) {
      await addStockTx(client, { producto_id, cantidad, motivo: `ajuste: ${motivo || ''}`.trim(), referencia, usuario_id });
    } else {
      await removeStockTx(client, { producto_id, cantidad: Math.abs(cantidad), motivo: `ajuste: ${motivo || ''}`.trim(), referencia, usuario_id });
    }
  });
}

async function reserveStock({ producto_id, cantidad, referencia, usuario_id = null }) {
  return withTransaction(async (client) => {
    await ensureInventory(client, producto_id);
    const { rows } = await client.query('SELECT cantidad_disponible, cantidad_reservada FROM inventario WHERE producto_id = $1 FOR UPDATE', [producto_id]);
    const disp = rows[0]?.cantidad_disponible ?? 0;
    if (disp < cantidad) { const e = new Error('Stock insuficiente para reservar'); e.status = 409; throw e; }
    await client.query('UPDATE inventario SET cantidad_disponible = cantidad_disponible - $1, cantidad_reservada = cantidad_reservada + $1 WHERE producto_id = $2', [cantidad, producto_id]);
    audit.log({ usuario_id, accion: 'reservar_stock', tabla_afectada: 'inventario', registro_id: producto_id, descripcion: `${cantidad} ref=${referencia || ''}` });
  });
}

async function releaseReservation({ producto_id, cantidad, referencia, usuario_id = null }) {
  return withTransaction(async (client) => {
    await ensureInventory(client, producto_id);
    const { rows } = await client.query('SELECT cantidad_disponible, cantidad_reservada FROM inventario WHERE producto_id = $1 FOR UPDATE', [producto_id]);
    const res = rows[0]?.cantidad_reservada ?? 0;
    if (res < cantidad) { const e = new Error('Cantidad a liberar mayor que reservada'); e.status = 409; throw e; }
    await client.query('UPDATE inventario SET cantidad_disponible = cantidad_disponible + $1, cantidad_reservada = cantidad_reservada - $1 WHERE producto_id = $2', [cantidad, producto_id]);
    audit.log({ usuario_id, accion: 'liberar_reserva', tabla_afectada: 'inventario', registro_id: producto_id, descripcion: `${cantidad} ref=${referencia || ''}` });
  });
}

module.exports.adjustStock = adjustStock;
module.exports.reserveStock = reserveStock;
module.exports.releaseReservation = releaseReservation;
