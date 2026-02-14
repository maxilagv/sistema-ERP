const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const ctrl = require('../controllers/alarmcontroller');

router.get('/alarmas/reglas', auth, requireRole(['admin', 'gerente']), ctrl.listRules);
router.post('/alarmas/reglas', auth, requireRole(['admin']), ctrl.createRule);
router.put('/alarmas/reglas/:id', auth, requireRole(['admin']), ctrl.updateRule);

router.get('/alarmas/destinatarios', auth, requireRole(['admin', 'gerente']), ctrl.listRecipients);
router.post('/alarmas/destinatarios', auth, requireRole(['admin']), ctrl.createRecipient);
router.put('/alarmas/destinatarios/:id', auth, requireRole(['admin']), ctrl.updateRecipient);

router.get('/alarmas/eventos', auth, requireRole(['admin', 'gerente']), ctrl.listEvents);
router.post('/alarmas/eventos/:id/ack', auth, requireRole(['admin', 'gerente']), ctrl.ackEvent);
router.post('/alarmas/eventos/:id/cerrar', auth, requireRole(['admin', 'gerente']), ctrl.closeEvent);

router.get('/alarmas/notificaciones', auth, requireRole(['admin', 'gerente']), ctrl.listNotifications);
router.post('/alarmas/evaluar', auth, requireRole(['admin', 'gerente']), ctrl.triggerEvaluation);
router.post('/alarmas/procesar-cola', auth, requireRole(['admin', 'gerente']), ctrl.triggerQueue);

module.exports = router;
