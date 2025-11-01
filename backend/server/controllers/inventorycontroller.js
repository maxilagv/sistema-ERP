const { query } = require('../db/pg');
const inv = require('../services/inventoryService');
const { body, validationResult } = require('express-validator');

async function list(req, res) {
  try {
    const { q, category_id, limit, offset } = req.query || {};
    const params = [];
    const where = [];
    if (q) { params.push(`%${q.toLowerCase()}%`); where.push(`(LOWER(p.nombre) LIKE $${params.length} OR LOWER(p.codigo) LIKE $${params.length})`); }
    if (category_id) { params.push(Number(category_id)); where.push(`p.categoria_id = $${params.length}`); }
    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const off = Math.max(parseInt(offset, 10) || 0, 0);
    params.push(lim); params.push(off);
    const sql = `
      SELECT p.id AS producto_id, p.codigo, p.nombre, p.categoria_id, c.nombre AS categoria,
             COALESCE(i.cantidad_disponible,0) AS cantidad_disponible,
             COALESCE(i.cantidad_reservada,0) AS cantidad_reservada,
             p.stock_minimo
        FROM productos p
        JOIN categorias c ON c.id = p.categoria_id
   LEFT JOIN inventario i ON i.producto_id = p.id
       WHERE p.activo = TRUE AND c.activo = TRUE ${where.length? 'AND ' + where.join(' AND ') : ''}
       ORDER BY p.id DESC
       LIMIT $${params.length-1} OFFSET $${params.length}`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener inventario' });
  }
}

async function movimientos(req, res) {
  try {
    const { producto_id, tipo, desde, hasta, limit, offset } = req.query || {};
    const where = [];
    const params = [];
    if (producto_id) { params.push(Number(producto_id)); where.push(`producto_id = $${params.length}`); }
    if (tipo) { params.push(tipo); where.push(`tipo = $${params.length}`); }
    if (desde) { params.push(new Date(desde)); where.push(`fecha >= $${params.length}`); }
    if (hasta) { params.push(new Date(hasta)); where.push(`fecha <= $${params.length}`); }
    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const off = Math.max(parseInt(offset, 10) || 0, 0);
    params.push(lim); params.push(off);
    const { rows } = await query(
      `SELECT id, producto_id, tipo, cantidad, motivo, referencia, fecha
         FROM movimientos_stock
        ${where.length? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY fecha DESC, id DESC
        LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener movimientos' });
  }
}

const validateAjuste = [
  body('producto_id').isInt({ gt: 0 }),
  body('cantidad').isInt().withMessage('cantidad puede ser positiva o negativa'),
  body('motivo').optional().isString(),
  body('referencia').optional().isString(),
];

async function ajuste(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { producto_id, cantidad, motivo, referencia } = req.body;
    await inv.adjustStock({ producto_id, cantidad, motivo, referencia, usuario_id: null });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'No se pudo ajustar stock' });
  }
}

const validateReserva = [
  body('producto_id').isInt({ gt: 0 }),
  body('cantidad').isInt({ gt: 0 }),
  body('referencia').optional().isString(),
];

async function reservar(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { producto_id, cantidad, referencia } = req.body;
    await inv.reserveStock({ producto_id, cantidad, referencia, usuario_id: null });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'No se pudo reservar stock' });
  }
}

async function liberar(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { producto_id, cantidad, referencia } = req.body;
    await inv.releaseReservation({ producto_id, cantidad, referencia, usuario_id: null });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'No se pudo liberar reserva' });
  }
}

module.exports = {
  list,
  movimientos,
  ajuste: [...validateAjuste, ajuste],
  reservar: [...validateReserva, reservar],
  liberar: [...validateReserva, liberar],
};

