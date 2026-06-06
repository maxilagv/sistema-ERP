const { check, validationResult } = require('express-validator');
const repo = require('../db/repositories/categoryRepository');

async function getCategorias(req, res) {
  try {
    const rows = await repo.getAllActive();
    res.json(rows);
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de la categoria ya existe' });
    }
    console.error('Error al obtener categorias:', err);
    res.status(500).json({ error: 'No se pudo obtener categorias' });
  }
}

const validateCategory = [
  check('name')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  check('image_url')
    .trim()
    .notEmpty().withMessage('La imagen es obligatoria'),
  check('description')
    .optional()
    .isLength({ max: 2000 }).withMessage('La descripcion es demasiado larga'),
  check('multiplicador_local_1')
    .optional()
    .isFloat({ gt: 0 }).withMessage('El multiplicador Local 1 debe ser mayor a 0'),
];

const validateCategoryUpdate = [
  check('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  check('image_url')
    .optional()
    .trim(),
  check('description')
    .optional()
    .isLength({ max: 2000 }).withMessage('La descripcion es demasiado larga'),
  check('multiplicador_local_1')
    .optional()
    .isFloat({ gt: 0 }).withMessage('El multiplicador Local 1 debe ser mayor a 0'),
];

async function createCategoria(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('Validacion fallida en createCategoria:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, image_url, description, multiplicador_local_1 } = req.body;

  try {
    const normName = String(name || '').trim();
    const imgUrlVal = String(image_url || '').trim() || null;
    const result = await repo.restoreOrInsert({
      name: normName,
      image_url: imgUrlVal,
      description,
      multiplicador_local_1,
    });
    if (result.restored) return res.status(200).json({ id: result.id, restored: true });
    return res.status(201).json({ id: result.id });
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de la categoria ya existe' });
    }
    console.error('Error al crear categoria:', err);
    res.status(500).json({ error: 'No se pudo crear la categoria' });
  }
}

async function updateCategoria(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('Validacion fallida en updateCategoria:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { name, image_url, description, multiplicador_local_1 } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: 'ID de la categoria requerido para actualizar' });
  }

  try {
    const idNum = Number(id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const updated = await repo.updateCategory(idNum, {
      name,
      image_url,
      description,
      multiplicador_local_1,
    });
    if (!updated) return res.status(404).json({ error: 'Categoria no encontrada' });
    res.json({ message: 'Categoria actualizada correctamente' });
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de la categoria ya existe' });
    }
    console.error('Error al actualizar categoria:', err);
    res.status(500).json({ error: 'No se pudo actualizar la categoria' });
  }
}

async function deleteCategoria(req, res) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'ID de la categoria requerido' });
  }

  try {
    const idNum = Number(id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'ID invalido' });
    }
    await repo.deactivateCascade(idNum);
    res.json({ message: 'Categoria eliminada correctamente' });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Categoria no encontrada' });
    console.error('Error al eliminar categoria:', err);
    res.status(500).json({ error: 'No se pudo eliminar la categoria' });
  }
}

module.exports = {
  getCategorias,
  createCategoria: [...validateCategory, createCategoria],
  updateCategoria: [...validateCategoryUpdate, updateCategoria],
  deleteCategoria,
};
