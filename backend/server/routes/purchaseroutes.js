const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/purchasecontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.get('/compras', auth, ctrl.list);
router.post('/compras', auth, requireRole(['admin','gerente']), ctrl.create);
router.get('/compras/:id/detalle', auth, ctrl.detalle);
router.post('/compras/:id/recibir', auth, requireRole(['admin','gerente']), ctrl.recibir);

module.exports = router;
