// authroutes.js
const express = require('express');
const router = express.Router();
const authcontroller = require('../controllers/authcontroller');
const authMiddleware = require('../middlewares/authmiddleware');
const { authLimiter, refreshLimiter } = require('../middlewares/security');

// Limitar rutas de autenticacion
router.post('/login', authLimiter, authcontroller.login);
router.post('/login-step1', authLimiter, authcontroller.loginStep1);
router.post('/login-step2', authLimiter, authcontroller.loginStep2);
router.post('/refresh-token', refreshLimiter, authcontroller.refreshToken);
router.post('/logout', authMiddleware, authcontroller.logout);

module.exports = router;
