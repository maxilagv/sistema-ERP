const { query } = require('./db/pg');

async function check() {
    try {
        const res = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='pagos' AND column_name='detalle';
    `);
        if (res.rows.length > 0) {
            console.log('COLUMN_ALREADY_EXISTS');
        } else {
            console.log('COLUMN_MISSING');
        }
    } catch (err) {
        console.error(err);
    }
}

check();
