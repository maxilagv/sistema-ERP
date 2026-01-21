
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { query, pool } = require('./db/pg');

async function apply() {
    try {
        console.log('Reading migration file...');
        const curDir = __dirname; // backend/server
        // We need to go to backend/database/migrations
        const migrationPath = path.resolve(curDir, '../database/migrations/V27__fix_vista_deudas_balance.sql');

        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Executing SQL...');
        await query(sql);
        console.log('Migration applied successfully.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        pool.end();
    }
}

apply();
