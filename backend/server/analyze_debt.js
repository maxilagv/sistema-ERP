const { query } = require('./db/pg');

async function analyzeDebt() {
    try {
        console.log('--- DEBT COMPONENTS FOR CUSTOMER 1 ---');
        const res = await query(`
      WITH ventas_pendientes AS (
        SELECT
          v.id, v.neto, COALESCE(SUM(p.monto), 0) AS pagado, (v.neto - COALESCE(SUM(p.monto), 0)) AS saldo
        FROM ventas v
        LEFT JOIN pagos p ON p.venta_id = v.id
        WHERE v.cliente_id = 1 AND v.estado_pago <> 'cancelado'
        GROUP BY v.id
      ),
      pagos_genericos AS (
        SELECT id, monto, fecha, detalle FROM pagos WHERE cliente_id = 1 AND venta_id IS NULL
      )
      SELECT 'Ventas Pendientes' AS tipo, SUM(saldo) AS total FROM ventas_pendientes
      UNION ALL
      SELECT 'Pagos Genericos (Credito)' AS tipo, SUM(monto) AS total FROM pagos_genericos
    `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    }
}

analyzeDebt();
