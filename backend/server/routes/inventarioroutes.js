const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/inventorycontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.get('/inventario', auth, ctrl.list);
router.get('/inventario/movimientos', auth, ctrl.movimientos);
router.post('/inventario/ajustes', auth, requireRole(['admin','gerente']), ctrl.ajuste);
router.post('/inventario/reservar', auth, requireRole(['admin','gerente','vendedor']), ctrl.reservar);
router.post('/inventario/liberar', auth, requireRole(['admin','gerente','vendedor']), ctrl.liberar);

module.exports = router;
