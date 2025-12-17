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
            ...row,
            _id: row.id,
            expirationTime: row.expiration_time // map back to snake_case if needed by logic, but original used camelCase in DB? 
            // Postgres columns are typically snake_case or lowercase. 
            // Code assumes 'expirationTime' in js objects.
            // Let's ensure consistency assuming API sends 'expirationTime'
        }));
    },

    deleteOne: async (filter) => {
        if (!filter._id) return;
        const query = 'DELETE FROM subscriptions WHERE id = $1';
        await pool.query(query, [filter._id]);
    }
};

module.exports = SubscriptionModel;
