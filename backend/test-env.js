require('dotenv').config();

console.log('All ENV vars loaded:', Object.keys(process.env).filter(k => k.includes('DATABASE')));
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
