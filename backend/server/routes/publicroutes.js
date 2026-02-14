const express = require('express');
const router = express.Router();

// Checkout legacy desactivado: ahora el flujo oficial es cliente autenticado + carrito.
router.post('/checkout', (req, res) => {
  return res.status(410).json({
    error:
      'Checkout legacy deshabilitado. Usa /cliente/login y el carrito del portal de clientes.',
  });
});

module.exports = router;
