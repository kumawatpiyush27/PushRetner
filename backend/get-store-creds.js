const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_Q2FL0BrtGfqY@ep-square-pine-a4iy909q-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function checkStores() {
    try {
        console.log('🔍 Checking stores table...\n');

        // Note: I'm selecting password just to help you recover it this one time. 
        // In a real app, passwords should be hashed!
        const res = await pool.query("SELECT * FROM stores WHERE store_id = 'abhushanjewellers123' OR store_id = 'zyrajewel'");

        if (res.rows.length === 0) {
            console.log('❌ No store found with ID: abhushanjewellers123');
            console.log('👉 You might need to REGISTER this store first!');
        } else {
            console.log('✅ Found Store:');
            console.log(JSON.stringify(res.rows, null, 2));
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkStores();
