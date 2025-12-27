const { check, validationResult } = require('express-validator');
const { withTransaction } = require('../db/pg');
const configRepo = require('../db/repositories/configRepository');

async function getDolarBlue(req, res) {
  try {
    const valor = await configRepo.getDolarBlue();
    res.json({
      clave: 'dolar_blue',
      valor: valor != null ? valor : null,
    });
  } catch (e) {
    console.error('Error obteniendo dolar_blue:', e);
    res.status(500).json({ error: 'No se pudo obtener el valor de dólar blue' });
  }
}

const validateSetDolarBlue = [
  check('valor')
    .notEmpty()
    .withMessage('valor es requerido')
    .isFloat({ gt: 0 })
    .withMessage('valor debe ser un número mayor a 0'),
];

async function setDolarBlueHandler(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const valor = Number(req.body?.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return res.status(400).json({ error: 'Valor de dólar inválido' });
  }

  const usuarioId =
    req.user?.sub && Number.isFinite(Number(req.user.sub))
      ? Number(req.user.sub)
      : null;

  try {
    await withTransaction(async (client) => {
      // 1) Actualizar parámetro de sistema
      await client.query(
        `INSERT INTO parametros_sistema(clave, valor_num, usuario_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (clave) DO UPDATE
           SET valor_num = EXCLUDED.valor_num,
               usuario_id = EXCLUDED.usuario_id,
               actualizado_en = NOW()`,
        ['dolar_blue', valor, usuarioId || null]
      );

      // 2) Recalcular precios de todos los productos activos en base al costo en USD
      //    Solo para productos con costo en dólares > 0
      await client.query(
        `UPDATE productos
            SET tipo_cambio = $1,
                precio_costo = ROUND(precio_costo_dolares * $1, 2),
                precio_costo_pesos = ROUND(precio_costo_dolares * $1, 2),
                precio_local = ROUND(precio_costo_dolares * $1 * (1 + margen_local), 2),
                precio_distribuidor = ROUND(precio_costo_dolares * $1 * (1 + margen_distribuidor), 2),
                precio_venta = ROUND(precio_costo_dolares * $1 * (1 + margen_local), 2),
                actualizado_en = CURRENT_TIMESTAMP
          WHERE activo = TRUE
            AND precio_costo_dolares > 0`
        ,
        [valor]
      );

      // 3) Registrar historial de precios para trazabilidad
      await client.query(
        `INSERT INTO productos_historial(
           producto_id,
           proveedor_id,
           costo_pesos,
           costo_dolares,
           tipo_cambio,
           margen_local,
           margen_distribuidor,
           precio_local,
           precio_distribuidor,
           usuario_id
         )
         SELECT
           p.id,
           p.proveedor_id,
           ROUND(p.precio_costo_dolares * $1, 2) AS costo_pesos,
           p.precio_costo_dolares AS costo_dolares,
           $1 AS tipo_cambio,
           p.margen_local,
           p.margen_distribuidor,
           ROUND(p.precio_costo_dolares * $1 * (1 + p.margen_local), 2) AS precio_local,
           ROUND(p.precio_costo_dolares * $1 * (1 + p.margen_distribuidor), 2) AS precio_distribuidor,
           $2 AS usuario_id
         FROM productos p
         WHERE p.activo = TRUE
           AND p.precio_costo_dolares > 0`,
        [valor, usuarioId || null]
      );
    });

    res.json({
      clave: 'dolar_blue',
      valor,
      message: 'Dólar blue actualizado y precios recalculados',
    });
  } catch (e) {
    console.error('Error guardando dolar_blue y recalculando precios:', e);
    res
      .status(500)
      .json({ error: 'No se pudo guardar el valor de dólar blue ni recalcular precios' });
  }
}

module.exports = {
  getDolarBlue,
  setDolarBlue: [...validateSetDolarBlue, setDolarBlueHandler],
};
