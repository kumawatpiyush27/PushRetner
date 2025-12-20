// Vercel Serverless Function Handler
let app;

// Export as Vercel serverless function
module.exports = async (req, res) => {
    try {
        // Lazy load the app to catch initialization errors
        if (!app) {
            app = require('../backend/server');
        }
        return await app(req, res);
    } catch (error) {
        console.error("CRITICAL SERVER ERROR:", error);
        res.status(500).send(`
            <h1>🔥 Server Boot Error</h1>
            <p>The application crashed while loading.</p>
            <pre style="background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto;">${error.stack || error.message}</pre>
            <hr>
            <p>Check Vercel Logs for more details.</p>
        `);
    }
};
