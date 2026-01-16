const { query } = require('./db/pg');

async function checkDebt() {
    try {
        console.log('--- CHECK VISTA_DEUDAS CLIENTE 1 ---');
        const res = await query('SELECT * FROM vista_deudas WHERE cliente_id = 1');
        console.table(res.rows);

        console.log('--- CHECK VENTAS PENDIENTES RAW CALCULATION ---');
        const raw = await query(`
      SELECT
        v.id           AS venta_id,
        v.cliente_id   AS cliente_id,
        v.fecha::date  AS fecha_venta,
        v.neto         AS neto,
        COALESCE(SUM(p.monto), 0)::DECIMAL(12,2) AS total_pagado,
        (v.neto - COALESCE(SUM(p.monto), 0))::DECIMAL(12,2) AS saldo
      FROM ventas v
      LEFT JOIN pagos p ON p.venta_id = v.id
      WHERE v.estado_pago <> 'cancelado' AND v.cliente_id = 1
      GROUP BY v.id, v.cliente_id, v.fecha::date, v.neto
    `);
        console.table(raw.rows);

    } catch (err) {
        console.error(err);
    }
}

checkDebt();
