const { query } = require('../db/pg');

async function deudas(req, res) {
  try {
    const { cliente_id } = req.query || {};
    if (cliente_id) {
      const { rows } = await query('SELECT * FROM vista_deudas WHERE cliente_id = $1', [cliente_id]);
      return res.json(rows);
    }
    const { rows } = await query('SELECT * FROM vista_deudas');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener deudas' });
  }
}

async function gananciasMensuales(req, res) {
  try {
    const { rows } = await query('SELECT mes, total_ventas::float AS total_ventas, total_gastos::float AS total_gastos, ganancia_neta::float AS ganancia_neta FROM vista_ganancias_mensuales ORDER BY mes');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener ganancias mensuales' });
  }
}

async function stockBajo(req, res) {
  try {
    const { rows } = await query('SELECT * FROM vista_stock_bajo ORDER BY producto_id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener stock bajo' });
  }
}

async function topClientes(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 200);
    const { rows } = await query('SELECT * FROM vista_top_clientes ORDER BY total_comprado DESC LIMIT $1', [limit]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener top clientes' });
  }
}

module.exports = { deudas, gananciasMensuales, stockBajo, topClientes };

