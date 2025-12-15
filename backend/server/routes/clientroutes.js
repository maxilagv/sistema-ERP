const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/clientcontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.get('/clientes', auth, ctrl.list);
router.post('/clientes', auth, requireRole(['admin','gerente','vendedor']), ctrl.create);
router.put('/clientes/:id', auth, requireRole(['admin','gerente','vendedor']), ctrl.update);
router.delete('/clientes/:id', auth, requireRole(['admin']), ctrl.remove);

module.exports = router;
