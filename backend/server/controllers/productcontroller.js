const { check, validationResult } = require('express-validator');
const repo = require('../db/repositories/productRepository');

async function getProducts(req, res) {
  try {
    const { q, category_id, limit, offset, sort, dir } = req.query || {};
    const rows = await repo.listProducts({ q, categoryId: category_id, limit, offset, sort, dir });
    // Ensure response shape compatibility (add missing keys if needed)
    const mapped = rows.map((r) => ({
      id: r.id,
      category_id: r.category_id,
      name: r.name,
      description: r.description,
      price: r.price,
      image_url: r.image_url || null,
      category_name: r.category_name,
      stock_quantity: r.stock_quantity,
      // Extended pricing fields (optional for compatibility)
      costo_pesos: r.costo_pesos,
      costo_dolares: r.costo_dolares,
      tipo_cambio: r.tipo_cambio,
      margen_local: r.margen_local,
      margen_distribuidor: r.margen_distribuidor,
      price_local: r.price_local,
      price_distribuidor: r.price_distribuidor,
      specifications: null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      deleted_at: r.deleted_at || null,
    }));
    res.json(mapped);
  } catch (err) {
    console.error('Error en getProducts:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

// Validation (payload en inglés para compatibilidad)
const validateProduct = [
  check('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Name must be 3-100 chars'),
  check('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 10, max: 500 }).withMessage('Description must be 10-500 chars'),
  check('price')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Price must be a positive number'),
  check('image_url')
    .trim()
    .notEmpty().withMessage('Image URL is required')
    .isString().withMessage('Image URL must be a string'),
  check('category_id')
    .notEmpty().withMessage('category_id is required')
    .isInt({ min: 1 }).withMessage('category_id must be an integer >= 1'),
  check('stock_quantity')
    .optional()
    .isInt({ min: 0 }).withMessage('stock_quantity must be an integer >= 0'),
  check('specifications')
    .optional()
    .isString().withMessage('specifications must be a string'),
  check('precio_costo_pesos')
    .optional()
    .isFloat({ min: 0 }).withMessage('precio_costo_pesos must be a positive number or zero'),
  check('precio_costo_dolares')
    .optional()
    .isFloat({ min: 0 }).withMessage('precio_costo_dolares must be a positive number or zero'),
  check('tipo_cambio')
    .optional({ nullable: true })
    .isFloat({ gt: 0 }).withMessage('tipo_cambio must be > 0'),
  check('margen_local')
    .optional()
    .isFloat({ min: 0 }).withMessage('margen_local must be >= 0'),
  check('margen_distribuidor')
    .optional()
    .isFloat({ min: 0 }).withMessage('margen_distribuidor must be >= 0'),
  check('proveedor_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('proveedor_id must be an integer >= 1'),
];

async function createProduct(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    name,
    description,
    price,
    image_url,
    category_id,
    stock_quantity,
    precio_costo_pesos,
    precio_costo_dolares,
    tipo_cambio,
    margen_local,
    margen_distribuidor,
    proveedor_id,
  } = req.body;

  try {
    const result = await repo.createProduct({
      name,
      description,
      price,
      image_url,
      category_id: Number(category_id),
      stock_quantity,
      precio_costo_pesos,
      precio_costo_dolares,
      tipo_cambio,
      margen_local,
      margen_distribuidor,
      proveedor_id,
    });
    res.status(201).json({ id: result.id });
  } catch (err) {
    const code = err.status || 500;
    if (code === 400) return res.status(400).json({ error: err.message });
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
}

async function updateProduct(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const {
    name,
    description,
    price,
    image_url,
    category_id,
    stock_quantity,
    precio_costo_pesos,
    precio_costo_dolares,
    tipo_cambio,
    margen_local,
    margen_distribuidor,
    proveedor_id,
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Product ID required for update' });
  }

  try {
    await repo.updateProduct(Number(id), {
      name,
      description,
      price,
      image_url,
      category_id: Number(category_id),
      stock_quantity,
      precio_costo_pesos,
      precio_costo_dolares,
      tipo_cambio,
      margen_local,
      margen_distribuidor,
      proveedor_id,
    });
    res.json({ message: 'Product updated successfully' });
  } catch (err) {
    const code = err.status || 500;
    if (code === 400) return res.status(400).json({ error: err.message });
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
}

async function deleteProduct(req, res) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Product ID required' });
  }

  try {
    const idNum = Number(id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    await repo.deactivateProduct(idNum);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
}

async function getProductHistory(req, res) {
  const { id } = req.params;
  const { limit, offset } = req.query || {};

  const productId = Number(id);
  if (!productId || !Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  try {
    const rows = await repo.getProductHistory(productId, { limit, offset });
    res.json(rows);
  } catch (err) {
    console.error('Error fetching product history:', err);
    res.status(500).json({ error: 'Failed to fetch product history' });
  }
}

module.exports = {
  getProducts,
  createProduct: [...validateProduct, createProduct],
  updateProduct: [...validateProduct, updateProduct],
  deleteProduct,
  getProductHistory,
};
