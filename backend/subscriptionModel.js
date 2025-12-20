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
            endpoint TEXT UNIQUE,
            expiration_time BIGINT,
            keys JSONB,
            store_id TEXT,
            store_name TEXT,
            store_domain TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        -- Migration for existing tables: add columns if they don't exist
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS store_id TEXT;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS store_name TEXT;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS store_domain TEXT;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
        
        CREATE INDEX IF NOT EXISTS idx_store_id ON subscriptions(store_id);
        CREATE INDEX IF NOT EXISTS idx_store_domain ON subscriptions(store_domain);
    `;
    try {
        await getPool().query(query);
        isInitialized = true;
        console.log('✅ Subscriptions table ready with multi-store support');
    } catch (err) {
        console.error('❌ Error creating/updating table:', err);
    }
};

const SubscriptionModel = {
    create: async (data) => {
        console.log('💾 Creating subscription with data:', {
            endpoint: data.endpoint ? data.endpoint.substring(0, 50) + '...' : 'MISSING',
            keys: data.keys ? 'present' : 'MISSING',
            storeId: data.storeId || 'not-provided',
            storeName: data.storeName || 'not-provided'
        });

        const query = `
            INSERT INTO subscriptions (
                endpoint, 
                expiration_time, 
                keys,
                store_id,
                store_name,
                store_domain
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (endpoint) 
            DO UPDATE SET 
                expiration_time = EXCLUDED.expiration_time,
                keys = EXCLUDED.keys,
                store_id = EXCLUDED.store_id,
                store_name = EXCLUDED.store_name,
                store_domain = EXCLUDED.store_domain
            RETURNING *;
        `;

        const endpoint = data.endpoint;
        const expirationTime = data.expirationTime || null;
        const keys = data.keys;
        const storeId = data.storeId || null;
        const storeName = data.storeName || null;
        const storeDomain = data.storeDomain || null;

        try {
            await initTable();
            const res = await getPool().query(query, [
                endpoint,
                expirationTime,
                keys,
                storeId,
                storeName,
                storeDomain
            ]);
            const row = res.rows[0];

            console.log('✅ Subscription created for store:', row.store_name || 'unknown');

            return {
                endpoint: row.endpoint,
                expirationTime: row.expiration_time,
                keys: row.keys,
                storeId: row.store_id,
                storeName: row.store_name,
                storeDomain: row.store_domain,
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

    // Find subscriptions by store
    findByStore: async (storeId) => {
        console.log(`🔍 Finding subscriptions for store: ${storeId}`);
        try {
            await initTable(); // Ensure table exists
            const query = 'SELECT * FROM subscriptions WHERE store_id = $1';
            const res = await getPool().query(query, [storeId]);

            const formatted = res.rows.map((row) => {
                const keys = row.keys;
                return {
                    endpoint: row.endpoint,
                    expirationTime: row.expiration_time,
                    keys: keys,
                    storeId: row.store_id,
                    storeName: row.store_name,
                    storeDomain: row.store_domain,
                    _id: row.id
                };
            });

            console.log(`✅ Found ${formatted.length} subscriptions for store: ${storeId}`);
            return formatted;
        } catch (err) {
            console.error('❌ Error in findByStore():', err.message);
            throw err;
        }
    },

    deleteAll: async () => {
        await initTable();
        const query = 'DELETE FROM subscriptions';
        const result = await getPool().query(query);
        return result;
    }
};

module.exports = SubscriptionModel;
