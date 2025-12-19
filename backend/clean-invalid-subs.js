const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_Q2FL0BrtGfqY@ep-square-pine-a4iy909q-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function cleanInvalidSubscriptions() {
    const log = [];

    try {
        log.push('🔍 Checking for invalid subscriptions...\n');

        const res = await pool.query('SELECT * FROM subscriptions');
        log.push(`📊 Total subscriptions in database: ${res.rows.length}\n`);

        let validCount = 0;
        let invalidCount = 0;
        const invalidIds = [];

        for (const row of res.rows) {
            const keys = row.keys;
            // Valid subscription must have:
            // 1. keys object
            // 2. p256dh and auth strings
            // 3. p256dh should be ~87 chars (base64 encoded 65 bytes)
            // 4. auth should be ~22 chars (base64 encoded 16 bytes)
            const isValid = keys &&
                typeof keys === 'object' &&
                keys.p256dh &&
                keys.auth &&
                typeof keys.p256dh === 'string' &&
                typeof keys.auth === 'string' &&
                keys.p256dh.length >= 80 &&  // Minimum length for valid p256dh
                keys.auth.length >= 20;       // Minimum length for valid auth

            if (isValid) {
                validCount++;
                log.push(`✅ Valid subscription ${row.id}: store=${row.store_name || row.store_id || 'unknown'}, p256dh=${keys.p256dh.length} chars, auth=${keys.auth.length} chars\n`);
            } else {
                invalidCount++;
                invalidIds.push(row.id);
                const reason = !keys ? 'no keys' :
                    !keys.p256dh ? 'no p256dh' :
                        !keys.auth ? 'no auth' :
                            keys.p256dh.length < 80 ? `p256dh too short (${keys.p256dh.length} chars)` :
                                keys.auth.length < 20 ? `auth too short (${keys.auth.length} chars)` : 'unknown';
                log.push(`❌ Invalid subscription ${row.id}: store=${row.store_name || row.store_id || 'unknown'}, reason=${reason}\n`);
            }
        }

        log.push(`\n📊 Summary:\n`);
        log.push(`   ✅ Valid subscriptions: ${validCount}\n`);
        log.push(`   ❌ Invalid subscriptions: ${invalidCount}\n`);

        if (invalidCount > 0) {
            log.push(`\n🗑️  Deleting ${invalidCount} invalid subscriptions...\n`);
            const deleteQuery = 'DELETE FROM subscriptions WHERE id = ANY($1::int[])';
            await pool.query(deleteQuery, [invalidIds]);
            log.push(`✅ Deleted ${invalidCount} invalid subscriptions\n`);
        } else {
            log.push(`\n✅ All subscriptions are valid!\n`);
        }

        // Show final count
        const finalRes = await pool.query('SELECT COUNT(*) FROM subscriptions');
        log.push(`\n📊 Final subscription count: ${finalRes.rows[0].count}\n`);

    } catch (err) {
        log.push(`❌ Error: ${err.message}\n${err.stack}\n`);
    } finally {
        await pool.end();

        // Write to file and console
        const output = log.join('');
        fs.writeFileSync('cleanup-report.txt', output);
        console.log(output);
        console.log('\n📄 Full report saved to cleanup-report.txt');
    }
}

cleanInvalidSubscriptions();
