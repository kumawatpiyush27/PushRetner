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
        const values = [data.endpoint, data.expirationTime, data.keys];
        const res = await pool.query(query, values);
        return { ...res.rows[0], _id: res.rows[0].id };
    },

    find: async () => {
        const res = await pool.query('SELECT * FROM subscriptions');
        return res.rows.map(row => ({
            endpoint: row.endpoint,
            expirationTime: row.expiration_time,
            keys: typeof row.keys === 'string' ? JSON.parse(row.keys) : row.keys,
            _id: row.id
        }));
    },

    deleteOne: async (filter) => {
        if (!filter._id) return;
        const query = 'DELETE FROM subscriptions WHERE id = $1';
        await pool.query(query, [filter._id]);
    }
};

module.exports = SubscriptionModel;
