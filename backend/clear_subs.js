require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL + "?sslmode=require",
    ssl: { rejectUnauthorized: false } // For Vercel/Neon
});

async function clearSubs() {
    try {
        console.log('Connecting to DB...');
        const res = await pool.query('DELETE FROM subscriptions');
        console.log(`✅ Deleted ${res.rowCount} corrupt subscriptions.`);
    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        pool.end();
    }
}

clearSubs();
