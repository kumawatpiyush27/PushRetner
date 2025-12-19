const webPush = require('web-push');

// Keys from your .env.example / push-notification-helper.js
const publicKey = 'BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04';
const privateKey = 'l_uWy8qBj22_JqzEAHlj6TvxTYM7xCqR2V7SFa_fmb4';

try {
    console.log('🧪 Verifying VAPID Key Pair...');
    console.log('Public Key:', publicKey);
    console.log('Private Key:', privateKey);

    // Try to set valid keys
    webPush.setVapidDetails(
        'mailto:test@example.com',
        publicKey,
        privateKey
    );
    console.log('✅ Key pair is valid format!');

    // There isn't a direct "validate pair" function in web-push without sending, 
    // but setting them without error is a good sign. 
    // The real mismatch happens if Vercel has DIFFERENT keys.

} catch (error) {
    console.error('❌ Keys are invalid:', error.message);
}
