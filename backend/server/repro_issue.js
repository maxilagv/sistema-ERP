const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { query, pool } = require('./db/pg');

async function test() {
    try {
        console.log('--- STARTING TEST ---');

        await query("DELETE FROM clientes WHERE email = 'test@example.com'");

        // 1. Create a test client
        const clientRes = await query(`
      INSERT INTO clientes (nombre, email, estado)
      VALUES ('Test Client', 'test@example.com', 'activo')
      RETURNING id
    `);
        const clientId = clientRes.rows[0].id;
        console.log(`Created Client ID: ${clientId}`);

        // 2. Create a sale
        const saleRes = await query(`
      INSERT INTO ventas (cliente_id, fecha, neto, total, estado_pago)
      VALUES ($1, NOW(), 500, 500, 'pendiente')
      RETURNING id
    `, [clientId]);
        const saleId = saleRes.rows[0].id;
        console.log(`Created Sale ID: ${saleId} for 500`);

        // 3. Check debt (should be 500)
        let viewRes = await query('SELECT * FROM vista_deudas WHERE cliente_id = $1', [clientId]);
        if (viewRes.rows.length) {
            console.log('Step 3 (Unpaid):', viewRes.rows[0].saldo_total);
        } else {
            console.log('Step 3: No row (expected 500)');
        }

        // 4. Pay partial 200
        await query(`
      INSERT INTO pagos (cliente_id, venta_id, monto, metodo, fecha, detalle)
      VALUES ($1, $2, 200, 'efectivo', NOW(), 'Pago parcial')
    `, [clientId, saleId]);
        console.log(`Paid 200 on sale ${saleId}`);

        viewRes = await query('SELECT * FROM vista_deudas WHERE cliente_id = $1', [clientId]);
        if (viewRes.rows.length) {
            console.log('Step 4 (Partial 300 left):', viewRes.rows[0].saldo_total);
        }

        // 5. Pay remaining 300
        await query(`
      INSERT INTO pagos (cliente_id, venta_id, monto, metodo, fecha, detalle)
      VALUES ($1, $2, 300, 'efectivo', NOW(), 'Pago final')
    `, [clientId, saleId]);
        console.log(`Paid 300 on sale ${saleId}`);

        viewRes = await query('SELECT * FROM vista_deudas WHERE cliente_id = $1', [clientId]);
        if (viewRes.rows.length) {
            console.log('Step 5 (Paid 0):', viewRes.rows[0].saldo_total);
        } else {
            console.log('Step 5: No row (expected 0)');
        }

        // 6. Overpay 100 (Total paid 600 vs 500 sale)
        // Expectation: Balance should be 0 (Credit ignored)
        try {
            await query(`
        INSERT INTO pagos (cliente_id, venta_id, monto, metodo, fecha, detalle)
        VALUES ($1, $2, 100, 'efectivo', NOW(), 'Pago extra')
        `, [clientId, saleId]);
            console.log(`Paid extra 100 on sale ${saleId}`);

            viewRes = await query('SELECT * FROM vista_deudas WHERE cliente_id = $1', [clientId]);
            if (viewRes.rows.length) {
                console.log('Step 6 (Overpaid -100):', viewRes.rows[0].saldo_total);
                if (parseFloat(viewRes.rows[0].saldo_total) === 0) console.log('SUCCESS: Credit ignored (0).');
                else console.log('FAILURE: Credit visible (should be 0).');
            } else {
                console.log('Step 6: No row (expected 0)');
            }
        } catch (err) {
            console.log('Step 6 Failed:', err.message);
        }

        // 7. Create 2nd Sale (100)
        // Expectation: Balance should be 100 (Credit from Sale 1 does not offset Sale 2)
        const sale2Res = await query(`
      INSERT INTO ventas (cliente_id, fecha, neto, total, estado_pago)
      VALUES ($1, NOW(), 100, 100, 'pendiente')
      RETURNING id
    `, [clientId]);
        const sale2Id = sale2Res.rows[0].id;

        viewRes = await query('SELECT * FROM vista_deudas WHERE cliente_id = $1', [clientId]);
        if (viewRes.rows.length) {
            console.log('Step 7 (New Sale 100):', viewRes.rows[0].saldo_total);
            if (parseFloat(viewRes.rows[0].saldo_total) === 100) console.log('SUCCESS: New debt fully visible.');
            else console.log('FAILURE: Credits offsetting debt (should be 100).');
        }

        // 8. Clean up
        await query('DELETE FROM pagos WHERE cliente_id = $1', [clientId]);
        await query('DELETE FROM ventas WHERE cliente_id = $1', [clientId]);
        await query('DELETE FROM clientes WHERE id = $1', [clientId]);
        console.log('Cleaned up.');

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

test();
