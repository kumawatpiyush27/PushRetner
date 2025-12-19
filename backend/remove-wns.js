const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_Q2FL0BrtGfqY@ep-square-pine-a4iy909q-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function removeWNSSubscriptions() {
    try {
        console.log('🔍 Finding WNS subscriptions...\n');

        const res = await pool.query("SELECT * FROM subscriptions WHERE endpoint LIKE '%notify.windows.com%'");
        console.log(`📊 Found ${res.rows.length} WNS subscriptions\n`);

        if (res.rows.length > 0) {
            for (const row of res.rows) {
                console.log(`❌ WNS subscription ${row.id}:`);
                console.log(`   Store: ${row.store_name || row.store_id || 'unknown'}`);
                console.log(`   Endpoint: ${row.endpoint.substring(0, 60)}...\n`);
            }

            const deleteQuery = "DELETE FROM subscriptions WHERE endpoint LIKE '%notify.windows.com%'";
            const result = await pool.query(deleteQuery);
            console.log(`✅ Deleted ${result.rowCount} WNS subscriptions\n`);
        } else {
            console.log('✅ No WNS subscriptions found\n');
        }

        const finalRes = await pool.query('SELECT COUNT(*) FROM subscriptions');
        console.log(`📊 Remaining subscriptions: ${finalRes.rows[0].count}`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

removeWNSSubscriptions();
