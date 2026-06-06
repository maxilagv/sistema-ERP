const express = require('express');
const router = express.Router();
const productController = require('../controllers/productcontroller.js');
const authMiddleware = require('../middlewares/authmiddleware.js');
const { requireRole } = require('../middlewares/roleMiddleware');
const { requireApproval, productPriceChangeEvaluator } = require('../middlewares/approvalMiddleware');

// Obtener productos (no requiere autenticación para GET)
router.get('/productos', productController.getProducts);
router.get(
  '/productos/:id/historial',
  authMiddleware,
  requireRole(['admin', 'gerente']),
  productController.getProductHistory
);

// Agregar producto (requiere autenticación + rol)
router.post('/productos', authMiddleware, requireRole(['admin', 'gerente']), productController.createProduct);

router.patch(
  '/productos/precios-local-1',
  authMiddleware,
  requireRole(['admin', 'gerente']),
  productController.updatePrecioLocal1Bulk
);

router.post(
  '/productos/precios-local-1/aplicar-multiplicadores',
  authMiddleware,
  requireRole(['admin', 'gerente']),
  productController.applyPrecioLocal1Multipliers
);

// Editar producto (requiere autenticación + rol)
router.put(
  '/productos/:id',
  authMiddleware,
  requireRole(['admin', 'gerente']),
  requireApproval('product_price_update', productPriceChangeEvaluator),
  productController.updateProduct
);

// Eliminar producto (requiere autenticación + rol admin)
router.delete('/productos/:id', authMiddleware, requireRole(['admin']), productController.deleteProduct);

module.exports = router;
