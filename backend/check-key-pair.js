const crypto = require('crypto');

// Keys from your code
const publicKey = 'BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04';
const privateKey = 'l_uWy8qBj22_JqzEAHlj6TvxTYM7xCqR2V7SFa_fmb4';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    return Buffer.from(base64, 'base64');
}

try {
    console.log('🧪 Checking Key Pair Validity...');

    // Create an ECDH curve object using the private key
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(urlBase64ToUint8Array(privateKey));

    // Derive the public key
    const derivedPublicKey = ecdh.getPublicKey('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    console.log('\n🔑 Keys in use:');
    console.log('Private Key:', privateKey);
    console.log('Public Key (Code):', publicKey);
    console.log('Public Key (Derived):', derivedPublicKey);

    if (publicKey === derivedPublicKey) {
        console.log('\n✅ SUCCESS: These keys are a perfect pair!');
    } else {
        console.log('\n❌ MISMATCH: The Public Key in your code does NOT belong to the Private Key!');
        console.log('You must update the Public Key in your code to match the Derived one.');
    }
} catch (err) {
    console.error('❌ Error checking keys:', err.message);
}
