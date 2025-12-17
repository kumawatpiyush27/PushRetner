require('dotenv').config();
const express = require('express');
const webPush = require('web-push');
const cors = require('cors');

const app = express();
const port = 9000;

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// TEMPORARY: In-memory storage (replace with MongoDB later)
const subscriptions = [];

// Subscription endpoint
app.post('/subscribe', async (req, res) => {
    try {
        const newSubscription = req.body;
        subscriptions.push(newSubscription);
        console.log('New subscription added. Total subscribers:', subscriptions.length);

        const options = {
            vapidDetails: {
                subject: 'mailto:myemail@example.com',
                publicKey: process.env.PUBLIC_KEY,
                privateKey: process.env.PRIVATE_KEY,
            },
        };

        await webPush.sendNotification(
            newSubscription,
            JSON.stringify({
                title: 'Hello from server',
                description: 'This message is coming from the server',
                image: 'https://cdn2.vectorstock.com/i/thumb-large/94/66/emoji-smile-icon-symbol-smiley-face-vector-26119466.jpg',
            }),
            options
        );

        res.sendStatus(200);
    } catch (error) {
        console.log('Subscription error:', error);
        res.sendStatus(500);
    }
});

// Broadcast notification to all subscribers
app.post('/broadcast', async (req, res) => {
    const { title, message, icon, url } = req.body;

    try {
        if (subscriptions.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No subscribers found. Please subscribe first at http://localhost:3000'
            });
        }

        const options = {
            vapidDetails: {
                subject: 'mailto:myemail@example.com',
                publicKey: process.env.PUBLIC_KEY,
                privateKey: process.env.PRIVATE_KEY,
            },
        };

        let successCount = 0;
        let failCount = 0;

        const promises = subscriptions.map(async (sub) => {
            try {
                await webPush.sendNotification(
                    sub,
                    JSON.stringify({
                        title: title || 'Notification',
                        description: message || 'You have a new notification',
                        image: icon || 'https://cdn2.vectorstock.com/i/thumb-large/94/66/emoji-smile-icon-symbol-smiley-face-vector-26119466.jpg',
                        url: url || ''
                    }),
                    options
                );
                successCount++;
            } catch (err) {
                console.log('Failed to send notification:', err.message);
                failCount++;
            }
        });

        await Promise.all(promises);

        console.log(`Broadcast sent: ${successCount} success, ${failCount} failed`);

        res.json({
            success: true,
            totalSubscribers: subscriptions.length,
            sent: successCount,
            failed: failCount,
            message: `Broadcast sent to ${successCount} subscribers`
        });
    } catch (error) {
        console.log('Broadcast error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send broadcast'
        });
    }
});

// Get subscriber count
app.get('/subscribers/count', (req, res) => {
    res.json({
        count: subscriptions.length,
        message: `Currently ${subscriptions.length} subscriber(s)`
    });
});

// Start server (no MongoDB required)
app.listen(port, () => {
    console.log(`✅ App running live on port ${port}`);
    console.log(`📊 Current subscribers: ${subscriptions.length}`);
    console.log(`⚠️  Using in-memory storage (data will be lost on restart)`);
});
