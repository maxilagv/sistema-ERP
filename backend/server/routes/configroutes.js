const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/configcontroller');
const auth = require('../middlewares/authmiddleware');

// Configuración de parámetros del sistema
router.get('/config/dolar-blue', auth, ctrl.getDolarBlue);
router.put('/config/dolar-blue', auth, ctrl.setDolarBlue);

module.exports = router;

