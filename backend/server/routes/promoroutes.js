const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const ctrl = require('../controllers/promotioncontroller');

router.get('/promociones', auth, requireRole(['admin', 'gerente', 'vendedor']), ctrl.list);
router.post('/promociones', auth, requireRole(['admin', 'gerente']), ctrl.create);
router.put('/promociones/:id', auth, requireRole(['admin', 'gerente']), ctrl.update);
router.delete('/promociones/:id', auth, requireRole(['admin', 'gerente']), ctrl.remove);

module.exports = router;
