const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_Q2FL0BrtGfqY@ep-square-pine-a4iy909q-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function cleanNullStoreSubscriptions() {
    try {
        console.log('🔍 Checking for orphan subscriptions (Active but no Store ID)...\n');

        const res = await pool.query("SELECT * FROM subscriptions WHERE store_id IS NULL");
        console.log(`📊 Found ${res.rows.length} orphan active subscriptions\n`);

        if (res.rows.length > 0) {
            const deleteQuery = "DELETE FROM subscriptions WHERE store_id IS NULL";
            const result = await pool.query(deleteQuery);
            console.log(`✅ Deleted ${result.rowCount} orphan subscriptions. Please re-subscribe to link them to Zyra Jewel.\n`);
        } else {
            console.log('✅ No orphan subscriptions found.\n');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

cleanNullStoreSubscriptions();
