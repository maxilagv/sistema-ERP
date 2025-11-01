const { body, validationResult } = require('express-validator');
const repo = require('../db/repositories/purchaseRepository');

const validateCreate = [
  body('proveedor_id').isInt({ gt: 0 }).withMessage('proveedor_id requerido'),
  body('moneda').optional().isIn(['ARS','USD','CNY']).withMessage('moneda inválida'),
  body('detalle').isArray({ min: 1 }).withMessage('detalle requerido'),
  body('detalle.*.producto_id').isInt({ gt: 0 }),
  body('detalle.*.cantidad').isInt({ gt: 0 }),
  body('detalle.*.costo_unitario').isFloat({ gt: 0 }),
  body('detalle.*.costo_envio').optional().isFloat({ min: 0 })
];

async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { proveedor_id, fecha, moneda, detalle } = req.body;
    const r = await repo.createCompra({ proveedor_id, fecha, moneda, detalle });
    res.status(201).json(r);
  } catch (e) {
    const code = e.status || 500;
    res.status(code).json({ error: e.message || 'No se pudo crear la compra' });
  }
}

async function list(req, res) {
  try {
    const { limit, offset } = req.query || {};
    const rows = await repo.listarCompras({ limit, offset });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener las compras' });
  }
}

async function detalle(req, res) {
  try {
    const rows = await repo.getCompraDetalle(Number(req.params.id));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el detalle' });
  }
}

const validateRecepcion = [
  body('fecha_recepcion').optional().isISO8601(),
  body('observaciones').optional().isString(),
];

async function recibir(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const compra_id = Number(req.params.id);
    const r = await repo.recibirCompra({ compra_id, fecha_recepcion: req.body.fecha_recepcion, observaciones: req.body.observaciones });
    res.json(r);
  } catch (e) {
    const code = e.status || 500;
    res.status(code).json({ error: e.message || 'No se pudo registrar la recepción' });
  }
}

module.exports = { create: [...validateCreate, create], list, detalle, recibir: [...validateRecepcion, recibir] };

