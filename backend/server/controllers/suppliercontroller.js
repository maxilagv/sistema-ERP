const { check, validationResult } = require('express-validator');
const repo = require('../db/repositories/supplierRepository');

const validateCreate = [
  check('nombre').trim().notEmpty().withMessage('Nombre requerido'),
  check('email').optional().isEmail(),
  check('telefono').optional().isString(),
  check('direccion').optional().isString(),
  check('cuit_cuil').optional().isString()
];

async function list(req, res) {
  try {
    const { q, limit, offset } = req.query || {};
    const rows = await repo.list({ q, limit, offset });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener proveedores' });
  }
}

async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const r = await repo.create(req.body);
    res.status(201).json({ id: r.id });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear el proveedor' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const r = await repo.update(Number(id), req.body);
    if (!r) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ message: 'Proveedor actualizado' });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar el proveedor' });
  }
}

module.exports = { list, create: [...validateCreate, create], update: [...validateCreate, update] };

