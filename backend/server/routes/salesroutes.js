const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/salescontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.get('/ventas', auth, ctrl.list);
router.post('/ventas', auth, requireRole(['admin','gerente','vendedor']), ctrl.create);
router.get('/ventas/:id/detalle', auth, ctrl.detalle);
router.post('/ventas/:id/entregar', auth, requireRole(['admin','gerente','vendedor']), ctrl.entregar);

module.exports = router;
