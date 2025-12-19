const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_Q2FL0BrtGfqY@ep-square-pine-a4iy909q-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const res = await pool.query("SELECT DISTINCT store_id FROM subscriptions");
        console.log("🔍 Unique store_ids in DB:");
        console.log(res.rows.map(r => r.store_id));

        const countRes = await pool.query("SELECT COUNT(*) FROM subscriptions WHERE store_id = 'zyrajewel'");
        console.log(`✅ Exact count for 'zyrajewel': ${countRes.rows[0].count}`);

        const countRes2 = await pool.query("SELECT COUNT(*) FROM subscriptions WHERE store_id IS NULL");
        console.log(`❓ Count for NULL store_id: ${countRes2.rows[0].count}`);

        const last = await pool.query("SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 5");
        console.log("� Last 5 Subscriptions:");
        last.rows.forEach(r => console.log(`${r.created_at} - ${r.store_id} - ${r.endpoint.substring(0, 30)}...`));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
