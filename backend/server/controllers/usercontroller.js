const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const users = require('../db/repositories/userRepository');
const userDeps = require('../db/repositories/usuarioDepositoRepository');

const validateCreate = [
  body('nombre').trim().notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('rol_id').isInt({ gt: 0 }),
  body('activo').optional().isBoolean(),
];

async function list(req, res) {
  try {
    const rows = await users.list({ q: req.query.q, activo: req.query.activo, limit: req.query.limit, offset: req.query.offset });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener usuarios' });
  }
}

async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
    const hash = await bcrypt.hash(req.body.password, rounds);
    const r = await users.create({ nombre: req.body.nombre, email: req.body.email, password_hash: hash, rol_id: req.body.rol_id, activo: req.body.activo !== false });
    res.status(201).json({ id: r.id });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear el usuario' });
  }
}

const validateUpdate = [
  body('nombre').optional().isString(),
  body('email').optional().isEmail(),
  body('rol_id').optional().isInt({ gt: 0 }),
  body('activo').optional().isBoolean(),
  body('password').optional().isLength({ min: 6 }),
];

async function update(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
  try {
    const fields = { ...req.body };
    delete fields.password;
    const r = await users.update(id, fields);
    if (!r) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (req.body.password) {
      const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
      const hash = await bcrypt.hash(req.body.password, rounds);
      await users.setPasswordHash(id, hash);
    }
    res.json({ message: 'Usuario actualizado' });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar el usuario' });
  }
}

async function roles(req, res) {
  try {
    const rows = await users.listRoles();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener roles' });
  }
}

async function getUserDepositos(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID invГЎlido' });
  }
  try {
    const rows = await userDeps.getUserDepositos(id);
    res.json(rows);
  } catch (e) {
    res
      .status(500)
      .json({ error: 'No se pudieron obtener los depГіsitos del usuario' });
  }
}

async function setUserDepositos(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID invГЎlido' });
  }
  const items = Array.isArray(req.body?.depositos) ? req.body.depositos : [];
  try {
    await userDeps.setUserDepositos(id, items);
    res.json({ ok: true });
  } catch (e) {
    res
      .status(500)
      .json({ error: 'No se pudieron actualizar los depГіsitos del usuario' });
  }
}

module.exports = {
  list,
  create: [...validateCreate, create],
  update: [...validateUpdate, update],
  roles,
  getUserDepositos,
  setUserDepositos,
};
