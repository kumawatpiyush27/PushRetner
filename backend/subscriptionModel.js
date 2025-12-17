const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const initTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS subscriptions (
            id SERIAL PRIMARY KEY,
            endpoint TEXT,
            expiration_time BIGINT,
            keys JSONB
        );
    `;
    try {
        await pool.query(query);
        console.log('✅ Subscriptions table ready');
    } catch (err) {
        console.error('❌ Error creating table:', err);
    }
};

initTable();

const SubscriptionModel = {
    create: async (data) => {
        const query = `
            INSERT INTO subscriptions (endpoint, expiration_time, keys)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        // Extract the correct fields from the subscription object
        const endpoint = data.endpoint;
        const expirationTime = data.expirationTime || null;
        // Ensure keys is stored as JSON
        const keys = typeof data.keys === 'string' ? data.keys : JSON.stringify(data.keys);
        
        const values = [endpoint, expirationTime, keys];
        const res = await pool.query(query, values);
        return {
            endpoint: res.rows[0].endpoint,
            expirationTime: res.rows[0].expiration_time,
            keys: typeof res.rows[0].keys === 'string' ? JSON.parse(res.rows[0].keys) : res.rows[0].keys,
            _id: res.rows[0].id
        };
    },

    find: async () => {
        const res = await pool.query('SELECT * FROM subscriptions');
        console.log(`📊 Database query returned ${res.rows.length} subscriptions`);
        
        const formatted = res.rows.map(row => {
            try {
                const keys = typeof row.keys === 'string' ? JSON.parse(row.keys) : row.keys;
                console.log(`✅ Subscription ${row.id}:`, {
                    endpoint: row.endpoint ? row.endpoint.substring(0, 50) + '...' : 'MISSING',
                    keys: keys ? 'valid' : 'MISSING',
                    hasP256dh: keys?.p256dh ? 'yes' : 'no',
                    hasAuth: keys?.auth ? 'yes' : 'no'
                });
                return {
                    endpoint: row.endpoint,
                    expirationTime: row.expiration_time,
                    keys: keys,
                    _id: row.id
                };
            } catch (err) {
                console.error(`❌ Error parsing subscription ${row.id}:`, err.message);
                return null;
            }
        }).filter(sub => sub !== null);
        
        return formatted;
    },

    deleteOne: async (filter) => {
        if (!filter._id) return;
        const query = 'DELETE FROM subscriptions WHERE id = $1';
        await pool.query(query, [filter._id]);
    }
};

module.exports = SubscriptionModel;
