// Vercel Serverless Function Handler
const app = require('../backend/server');

// Export as Vercel serverless function
module.exports = (req, res) => {
    return app(req, res);
};
