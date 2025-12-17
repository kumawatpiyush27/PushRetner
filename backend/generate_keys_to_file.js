const webpush = require('web-push');
const fs = require('fs');

const keys = webpush.generateVAPIDKeys();

const content = `
PUBLIC_KEY=${keys.publicKey}
PRIVATE_KEY=${keys.privateKey}
`;

fs.writeFileSync('temp_keys.txt', content);
console.log('Keys written to temp_keys.txt');
