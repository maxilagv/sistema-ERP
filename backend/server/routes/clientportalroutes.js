const express = require('express');
const router = express.Router();
const clientAuth = require('../middlewares/clientAuthMiddleware');
const ctrl = require('../controllers/clientportalcontroller');

router.get('/cliente/me', clientAuth, ctrl.me);
router.put('/cliente/cuenta', clientAuth, ctrl.updateCuenta);

router.get('/cliente/deuda', clientAuth, ctrl.deuda);
router.get('/cliente/compras', clientAuth, ctrl.compras);
router.get('/cliente/compras/:id', clientAuth, ctrl.compraDetalle);
router.get('/cliente/promociones', clientAuth, ctrl.promociones);

router.get('/cliente/carrito', clientAuth, ctrl.carrito);
router.post('/cliente/carrito/items', clientAuth, ctrl.carritoAddItem);
router.put('/cliente/carrito/items/:itemId', clientAuth, ctrl.carritoUpdateItem);
router.delete('/cliente/carrito/items/:itemId', clientAuth, ctrl.carritoRemoveItem);
router.delete('/cliente/carrito', clientAuth, ctrl.carritoClear);
router.post('/cliente/carrito/checkout', clientAuth, ctrl.carritoCheckout);

module.exports = router;
