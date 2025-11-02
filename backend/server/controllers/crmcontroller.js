const { check, validationResult } = require('express-validator');
const oppRepo = require('../db/repositories/crmOpportunityRepository');
const actRepo = require('../db/repositories/crmActivityRepository');

// Oportunidades
async function listOportunidades(req, res) {
  try {
    const { q, fase, cliente_id, owner_id, limit, offset } = req.query || {};
    const rows = await oppRepo.list({ q, fase, cliente_id, owner_id, limit, offset });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener las oportunidades' });
  }
}

const validateOpp = [
  check('cliente_id').isInt({ gt: 0 }).withMessage('cliente_id requerido'),
  check('titulo').trim().notEmpty().withMessage('titulo requerido'),
  check('fase').optional().isIn(['lead','contacto','propuesta','negociacion','ganado','perdido']),
  check('valor_estimado').optional().isFloat({ min: 0 }),
  check('probabilidad').optional().isInt({ min: 0, max: 100 }),
  check('fecha_cierre_estimada').optional().isISO8601(),
  check('owner_usuario_id').optional().isInt({ gt: 0 }),
];

async function crearOportunidad(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const r = await oppRepo.create(req.body);
    res.status(201).json({ id: r.id });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear la oportunidad' });
  }
}

async function actualizarOportunidad(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const r = await oppRepo.update(Number(req.params.id), req.body);
    if (!r) return res.status(404).json({ error: 'Oportunidad no encontrada' });
    res.json({ message: 'Oportunidad actualizada' });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar la oportunidad' });
  }
}

// Actividades
async function listActividades(req, res) {
  try {
    const { cliente_id, oportunidad_id, estado, limit, offset } = req.query || {};
    const rows = await actRepo.list({ cliente_id, oportunidad_id, estado, limit, offset });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener las actividades' });
  }
}

const validateAct = [
  check('tipo').isIn(['llamada','reunion','tarea']).withMessage('tipo inválido'),
  check('asunto').trim().notEmpty().withMessage('asunto requerido'),
  check('estado').optional().isIn(['pendiente','completado','cancelado']),
  check('fecha_hora').optional().isISO8601(),
  check('cliente_id').optional().isInt({ gt: 0 }),
  check('oportunidad_id').optional().isInt({ gt: 0 }),
  check('asignado_a_usuario_id').optional().isInt({ gt: 0 }),
];

async function crearActividad(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const r = await actRepo.create(req.body);
    res.status(201).json({ id: r.id });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear la actividad' });
  }
}

async function actualizarActividad(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const r = await actRepo.update(Number(req.params.id), req.body);
    if (!r) return res.status(404).json({ error: 'Actividad no encontrada' });
    res.json({ message: 'Actividad actualizada' });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar la actividad' });
  }
}

module.exports = {
  listOportunidades,
  crearOportunidad: [...validateOpp, crearOportunidad],
  actualizarOportunidad: [...validateOpp, actualizarOportunidad],
  listActividades,
  crearActividad: [...validateAct, crearActividad],
  actualizarActividad: [...validateAct, actualizarActividad],
};

