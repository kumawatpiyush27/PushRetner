const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_Q2FL0BrtGfqY@ep-square-pine-a4iy909q-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function checkStoreIds() {
    try {
        const output = [];
        output.push('🔍 Checking all subscriptions in database...\n');

        const res = await pool.query("SELECT id, store_id, store_name, store_domain, created_at FROM subscriptions ORDER BY created_at DESC");

        output.push(`📊 Found ${res.rows.length} total subscriptions:\n`);
        output.push('ID | STORE_ID             | DOMAIN                       | CREATED_AT');
        output.push('---|----------------------|------------------------------|---------------------');

        res.rows.forEach(row => {
            const storeId = (row.store_id || 'NULL').padEnd(20);
            const domain = (row.store_domain || 'NULL').padEnd(28);
            const date = new Date(row.created_at).toLocaleString();
            output.push(`${row.id} | ${storeId} | ${domain} | ${date}`);
        });

        fs.writeFileSync('store-debug.txt', output.join('\n'));
        console.log('✅ Wrote report to store-debug.txt');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkStoreIds();
