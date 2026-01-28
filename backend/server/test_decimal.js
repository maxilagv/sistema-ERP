
const { query } = require('./db/pg');

async function test() {
    try {
        // Create a temporary table with decimal
        await query(`CREATE TEMPORARY TABLE test_decimals (val DECIMAL(12,2))`);
        await query(`INSERT INTO test_decimals (val) VALUES (800000.00), (799999.99), (10.10)`);

        const { rows } = await query(`SELECT val, val::float as val_float FROM test_decimals`);
        console.log('Rows:', rows);
        console.log('Type of val:', typeof rows[0].val);
        console.log('Type of val_float:', typeof rows[0].val_float);
    } catch (e) {
        console.error(e);
    }
}

test();
