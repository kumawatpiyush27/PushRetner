const { Pool } = require('pg');
const webPush = require('web-push');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_Q2FL0BrtGfqY@ep-square-pine-a4iy909q-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

// Set VAPID details
webPush.setVapidDetails(
    'mailto:admin@zyrajewel.co.in',
    'BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04',
    'l_uWy8qBj22_JqzEAHlj6TvxTYM7xCqR2V7SFa_fmb4'
);

async function testSubscriptions() {
    const log = [];

    try {
        log.push('🧪 Testing all subscriptions...\n\n');

        const res = await pool.query('SELECT * FROM subscriptions');
        log.push(`📊 Total subscriptions: ${res.rows.length}\n\n`);

        let activeCount = 0;
        let expiredCount = 0;
        const expiredIds = [];

        for (const row of res.rows) {
            const subscription = {
                endpoint: row.endpoint,
                keys: row.keys
            };

            const testPayload = JSON.stringify({
                title: 'Test',
                body: 'Testing subscription validity',
                tag: 'test-' + Date.now()
            });

            try {
                await webPush.sendNotification(subscription, testPayload);
                activeCount++;
                log.push(`✅ ACTIVE subscription ${row.id}:\n`);
                log.push(`   Store: ${row.store_name || row.store_id || 'unknown'}\n`);
                log.push(`   Endpoint: ${row.endpoint.substring(0, 60)}...\n\n`);
            } catch (err) {
                expiredCount++;
                expiredIds.push(row.id);
                log.push(`❌ EXPIRED subscription ${row.id}:\n`);
                log.push(`   Store: ${row.store_name || row.store_id || 'unknown'}\n`);
                log.push(`   Error: ${err.message}\n`);
                log.push(`   Status Code: ${err.statusCode}\n`);
                log.push(`   Endpoint: ${row.endpoint.substring(0, 60)}...\n\n`);
            }
        }

        log.push(`\n📊 Summary:\n`);
        log.push(`   ✅ Active subscriptions: ${activeCount}\n`);
        log.push(`   ❌ Expired subscriptions: ${expiredCount}\n\n`);

        if (expiredCount > 0) {
            log.push(`🗑️  Deleting ${expiredCount} expired subscriptions...\n`);
            const deleteQuery = 'DELETE FROM subscriptions WHERE id = ANY($1::int[])';
            await pool.query(deleteQuery, [expiredIds]);
            log.push(`✅ Deleted ${expiredCount} expired subscriptions\n\n`);
        }

        const finalRes = await pool.query('SELECT COUNT(*) FROM subscriptions');
        log.push(`📊 Final active subscription count: ${finalRes.rows[0].count}\n`);

    } catch (err) {
        log.push(`❌ Error: ${err.message}\n${err.stack}\n`);
    } finally {
        await pool.end();

        const output = log.join('');
        fs.writeFileSync('test-report.txt', output);
        console.log(output);
        console.log('\n📄 Full report saved to test-report.txt');
    }
}

testSubscriptions();
