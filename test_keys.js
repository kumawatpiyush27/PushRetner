const webPush = require('web-push');

const publicKey = 'BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04';
const privateKey = 'l_uWy8qBj22_JqzEAHlj6TvxTYM7xCqR2V7SFa_fmb4';

try {
    webPush.setVapidDetails(
        'mailto:test@example.com',
        publicKey,
        privateKey
    );
    console.log('✅ Keys are Valid Format');

    // Simulate a notification to dummy endpoint (will fail network, but pass key check)
    // Actually, setVapidDetails doesn't validate pair matching. 
    // We need to generate headers or something.
    // But basic format check is good.

    console.log('Public Key Length:', publicKey.length);
    console.log('Private Key Length:', privateKey.length);

} catch (err) {
    console.error('❌ Key Error:', err.message);
}
