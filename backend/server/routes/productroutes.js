const express = require('express');
const router = express.Router();
const productController = require('../controllers/productcontroller.js');
const authMiddleware = require('../middlewares/authmiddleware.js');
const { requireRole } = require('../middlewares/roleMiddleware');

// Obtener productos (no requiere autenticación para GET)
router.get('/productos', productController.getProducts);

// Agregar producto (requiere autenticación + rol)
router.post('/productos', authMiddleware, requireRole(['admin', 'gerente']), productController.createProduct);

// Editar producto (requiere autenticación + rol)
router.put('/productos/:id', authMiddleware, requireRole(['admin', 'gerente']), productController.updateProduct);

// Eliminar producto (requiere autenticación + rol admin)
router.delete('/productos/:id', authMiddleware, requireRole(['admin']), productController.deleteProduct);

module.exports = router;

