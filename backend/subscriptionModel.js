const { Pool } = require('pg');
require('dotenv').config();

let pool;
let isInitialized = false;

const getPool = () => {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
    }
    return pool;
};

const initTable = async () => {
    if (isInitialized) return;

    const query = `
        CREATE TABLE IF NOT EXISTS subscriptions (
            id SERIAL PRIMARY KEY,
            endpoint TEXT,
            expiration_time BIGINT,
            keys JSONB
        );
    `;
    try {
        await getPool().query(query);
        console.log('✅ Subscriptions table ready');
        isInitialized = true;
    } catch (err) {
        console.error('❌ Error creating table:', err);
        throw err;
    }
};

const SubscriptionModel = {
    create: async (data) => {
        console.log('💾 Creating subscription with data:', {
            endpoint: data.endpoint ? data.endpoint.substring(0, 50) + '...' : 'MISSING',
            keys: data.keys ? 'present' : 'MISSING'
        });

        const query = `
            INSERT INTO subscriptions (endpoint, expiration_time, keys)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;

        const endpoint = data.endpoint;
        const expirationTime = data.expirationTime || null;
        // Store keys as JSONB - PostgreSQL will handle JSON serialization
        const keys = data.keys;

        try {
            await initTable();
            const res = await getPool().query(query, [endpoint, expirationTime, keys]);
            const row = res.rows[0];

            console.log('✅ Subscription created, returned keys type:', typeof row.keys);

            return {
                endpoint: row.endpoint,
                expirationTime: row.expiration_time,
                keys: row.keys, // PostgreSQL returns JSONB as object, not string
                _id: row.id
            };
        } catch (err) {
            console.error('❌ Error creating subscription:', err.message);
            throw err;
        }
    },

    find: async () => {
        try {
            await initTable();
            const res = await getPool().query('SELECT * FROM subscriptions');
            console.log(`📊 Database query returned ${res.rows.length} subscriptions`);

            const formatted = res.rows.map((row, idx) => {
                try {
                    // PostgreSQL returns JSONB as JavaScript object
                    const keys = row.keys;

                    console.log(`✅ Subscription ${idx + 1}:`, {
                        id: row.id,
                        endpoint: row.endpoint ? row.endpoint.substring(0, 50) + '...' : 'MISSING',
                        keys: keys ? (typeof keys === 'object' ? 'object' : 'string') : 'MISSING',
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
                    console.error(`❌ Error processing subscription ${row.id}:`, err.message);
                    return null;
                }
            }).filter(sub => sub !== null);

            console.log(`✅ Returning ${formatted.length} valid subscriptions`);
            return formatted;
        } catch (err) {
            console.error('❌ Error in find():', err.message);
            throw err;
        }
    },

    deleteOne: async (filter) => {
        if (!filter._id) return;
        await initTable();
        const query = 'DELETE FROM subscriptions WHERE id = $1';
        await getPool().query(query, [filter._id]);
    },

    deleteAll: async () => {
        await initTable();
        const query = 'DELETE FROM subscriptions';
        const result = await getPool().query(query);
        return result;
    }
};

module.exports = SubscriptionModel;
