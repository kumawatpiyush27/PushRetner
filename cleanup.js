const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_Q2FL0BrtGfqY@ep-square-pine-a4iy909q-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('📌 Database URL:', databaseUrl.substring(0, 50) + '...');

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
        rejectUnauthorized: false
    }
});

async function cleanup() {
    try {
        console.log('🗑️ Deleting all subscriptions...');
        const result = await pool.query('DELETE FROM subscriptions');
        console.log('✅ Deleted', result.rowCount, 'subscriptions');
        
        const countResult = await pool.query('SELECT COUNT(*) FROM subscriptions');
        console.log('📊 Remaining subscriptions:', countResult.rows[0].count);
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

cleanup();
