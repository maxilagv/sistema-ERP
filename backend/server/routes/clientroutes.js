const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/clientcontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.get('/clientes', auth, ctrl.list);
router.post('/clientes', auth, requireRole(['admin','gerente','vendedor']), ctrl.create);
router.put('/clientes/:id', auth, requireRole(['admin','gerente','vendedor']), ctrl.update);
router.delete('/clientes/:id', auth, requireRole(['admin']), ctrl.remove);

// Deudas iniciales de clientes (deuda anterior)
router.get('/clientes/:id/deudas-iniciales', auth, ctrl.listInitialDebts);
router.post(
  '/clientes/:id/deudas-iniciales',
  auth,
  requireRole(['admin', 'gerente', 'vendedor']),
  ctrl.addInitialDebt
);

router.get(
  '/clientes/:id/deudas-iniciales/pagos',
  auth,
  ctrl.listInitialDebtPayments
);
router.post(
  '/clientes/:id/deudas-iniciales/pagos',
  auth,
  requireRole(['admin', 'gerente', 'vendedor']),
  ctrl.addInitialDebtPayment
);

module.exports = router;
