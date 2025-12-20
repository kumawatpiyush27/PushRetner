// Vercel Serverless Function Handler
const app = require('../backend/server');

// Export as Vercel serverless function
module.exports = async (req, res) => {
    try {
        return await app(req, res);
    } catch (error) {
        console.error("CRITICAL SERVER ERROR:", error);
        res.status(500).send(`
            <h1>🔥 Server Error</h1>
            <pre>${error.stack}</pre>
            <hr>
            <p>Check Vercel Logs for more details.</p>
        `);
    }
};
