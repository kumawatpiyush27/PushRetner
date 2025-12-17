const webPush = require('web-push');
const fs = require('fs');

const vapidKeys = webPush.generateVAPIDKeys();

const output = `# VAPID Keys for Push Notifications

PUBLIC_KEY=${vapidKeys.publicKey}
PRIVATE_KEY=${vapidKeys.privateKey}

# Copy these to your .env file
`;

fs.writeFileSync('vapid-keys.txt', output);
console.log('VAPID keys generated and saved to vapid-keys.txt');
console.log('\nPublic Key:', vapidKeys.publicKey);
console.log('\nPrivate Key:', vapidKeys.privateKey);

