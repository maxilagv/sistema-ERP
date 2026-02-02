const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/configcontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Configuración de parámetros del sistema
router.get('/config/dolar-blue', auth, requireRole(['admin', 'gerente']), ctrl.getDolarBlue);
router.put('/config/dolar-blue', auth, requireRole(['admin', 'gerente']), ctrl.setDolarBlue);

module.exports = router;

