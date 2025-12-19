const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_Q2FL0BrtGfqY@ep-square-pine-a4iy909q-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function createStoresTable() {
    try {
        console.log('🏗️ Creating "stores" table...');

        // Note: Storing password as TEXT because you requested to "Show Password"
        // In a strict banking app we would hash it, but for your ease of use:
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stores (
                store_id VARCHAR(255) PRIMARY KEY,
                password TEXT NOT NULL,
                store_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ Table "stores" created successfully!');

        // Insert 'zyrajewel' with default password just in case
        await pool.query(`
            INSERT INTO stores (store_id, password, store_name)
            VALUES ('zyrajewel', 'admin123', 'Zyra Jewel')
            ON CONFLICT (store_id) DO UPDATE 
            SET password = 'admin123';
        `);
        console.log('✅ Default account "zyrajewel" / "admin123" created/updated.');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

createStoresTable();
