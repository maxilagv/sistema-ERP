const { query } = require('./db/pg');

async function checkRecentData() {
    try {
        console.log('--- RECENT VENTAS ---');
        const ventas = await query('SELECT id, cliente_id, neto, estado_pago, fecha FROM ventas ORDER BY id DESC LIMIT 5');
        console.table(ventas.rows);

        if (ventas.rows.length > 0) {
            console.log('--- PAGOS FOR THESE VENTAS ---');
            const ids = ventas.rows.map(v => v.id);
            const pagos = await query(`SELECT id, venta_id, cliente_id, monto, detalle FROM pagos WHERE venta_id IN (${ids.join(',')})`);
            console.table(pagos.rows);
        }

        console.log('--- RECENT PAGOS (General) ---');
        const generalPagos = await query('SELECT id, venta_id, cliente_id, monto, detalle FROM pagos ORDER BY id DESC LIMIT 5');
        console.table(generalPagos.rows);

    } catch (err) {
        console.error(err);
    }
}

checkRecentData();
