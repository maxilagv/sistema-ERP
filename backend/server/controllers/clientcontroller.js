const { check, validationResult } = require('express-validator');
const repo = require('../db/repositories/clientRepository');

const validateCreateOrUpdate = [
  check('nombre').trim().notEmpty().withMessage('Nombre requerido'),
  check('apellido').optional().isString(),
  check('telefono').optional().isString(),
  check('email').optional().isEmail(),
  check('direccion').optional().isString(),
  check('cuit_cuil').optional().isString(),
  check('estado').optional().isIn(['activo', 'inactivo']),
];

async function list(req, res) {
  try {
    const { q, estado, limit, offset } = req.query || {};
    const rows = await repo.list({ q, estado, limit, offset });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener clientes' });
  }
}

async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const r = await repo.create(req.body);
    res.status(201).json({ id: r.id });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear el cliente' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const r = await repo.update(Number(id), req.body);
    if (!r) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ message: 'Cliente actualizado' });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar el cliente' });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return res.status(400).json({ error: 'ID de cliente inválido' });
  }

  try {
    const r = await repo.remove(idNum);
    if (!r) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json({ message: 'Cliente eliminado' });
  } catch (e) {
    const status = e.status || 500;
    const message = e.message || 'No se pudo eliminar el cliente';
    res.status(status).json({ error: message });
  }
}

module.exports = {
  list,
  create: [...validateCreateOrUpdate, create],
  update: [...validateCreateOrUpdate, update],
  remove,
};
