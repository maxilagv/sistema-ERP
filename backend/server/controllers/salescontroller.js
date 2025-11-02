const { body, validationResult } = require('express-validator');
const repo = require('../db/repositories/salesRepository');

const validateCreate = [
  body('cliente_id').isInt({ gt: 0 }).withMessage('cliente_id requerido'),
  body('descuento').optional().isFloat({ min: 0 }),
  body('impuestos').optional().isFloat({ min: 0 }),
  body('items').isArray({ min: 1 }).withMessage('Debe enviar items'),
  body('items.*.producto_id').isInt({ gt: 0 }),
  body('items.*.cantidad').isInt({ gt: 0 }),
  body('items.*.precio_unitario').optional().isFloat({ gt: 0 })
];

async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { cliente_id, fecha, descuento, impuestos, items } = req.body;
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[ventas] create payload', { cliente_id, fecha, descuento, impuestos, items });
      }
    } catch {}
    const r = await repo.createVenta({ cliente_id, fecha, descuento, impuestos, items });
    res.status(201).json(r);
  } catch (e) {
    const code = e.status || 500;
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ventas] create error', e?.message || e);
    }
    res.status(code).json({ error: e.message || 'No se pudo crear la venta' });
  }
}

async function list(req, res) {
  try {
    const { limit, offset } = req.query || {};
    const rows = await repo.listarVentas({ limit, offset });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener las ventas' });
  }
}

async function detalle(req, res) {
  try {
    const rows = await repo.getVentaDetalle(Number(req.params.id));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el detalle de la venta' });
  }
}

module.exports = { create: [...validateCreate, create], list, detalle };
