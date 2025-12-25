const webPush = require('web-push');
const keys = webPush.generateVAPIDKeys();
const fs = require('fs');
fs.writeFileSync('keys.json', JSON.stringify(keys, null, 2));
console.log('Keys saved to keys.json');
