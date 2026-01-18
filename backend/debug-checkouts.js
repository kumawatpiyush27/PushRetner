require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log('🔍 Checking Last 5 Abandoned Checkouts...');
        const res = await pool.query('SELECT id, store_id, checkout_id, token, email, updated_at FROM abandoned_checkouts ORDER BY updated_at DESC LIMIT 5');
        console.log(res.rows);

        console.log('\n🔍 Checking Last 5 Subscriptions with Token...');
        const res2 = await pool.query('SELECT id, store_id, cart_token, created_at FROM subscriptions WHERE cart_token IS NOT NULL ORDER BY created_at DESC LIMIT 5');
        console.log(res2.rows);

        console.log('\n🔍 Checking Store Config for Abandoned...');
        const res3 = await pool.query('SELECT store_id, abandoned_enabled, abandoned_config FROM stores WHERE abandoned_enabled = true');
        console.log(res3.rows);

    } catch (e) { console.error(e); }
    pool.end();
}
check();
