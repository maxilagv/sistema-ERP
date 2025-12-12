const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/financecontroller');
const auth = require('../middlewares/authmiddleware');

// Finanzas: costos, ganancias y rentabilidad por producto
router.get('/finanzas/costos-productos', auth, ctrl.costosProductos);
router.get('/finanzas/ganancia-bruta', auth, ctrl.gananciaBruta);
router.get('/finanzas/ganancia-neta', auth, ctrl.gananciaNeta);
router.get('/finanzas/ganancia-por-producto', auth, ctrl.gananciaPorProducto);

module.exports = router;

