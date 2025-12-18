#!/usr/bin/env node

// Direct load of .env file
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

console.log('📄 Raw .env file content (first 200 chars):');
console.log(envContent.substring(0, 200));
console.log('\n✅ .env file loaded successfully');

// Parse manually
const lines = envContent.split('\n');
lines.forEach(line => {
    if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');
        if (key.includes('DATABASE')) {
            console.log(`Found: ${key}=${value.substring(0, 50)}...`);
        }
    }
});
