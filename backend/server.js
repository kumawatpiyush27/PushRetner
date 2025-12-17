require('dotenv').config();
const express = require('express');
const webPush = require('web-push');
const SubscriptionModel = require('./subscriptionModel');
const cors = require('cors');

const app = express();
const port = 9000;

const path = require('path');

const fs = require('fs');

// Explicitly serve sw.js with Service-Worker-Allowed header (Matches /sw.js AND /apps/push/sw.js)
// Explicitly serve sw.js with Service-Worker-Allowed header
app.get('/sw.js', (req, res) => {
    console.log('📢 Request received for /sw.js');
    res.set('Service-Worker-Allowed', '/');
    res.set('Content-Type', 'application/javascript');

    // Return raw JS string to avoid any file system errors (500)
    res.status(200).send(`
        self.addEventListener('push', event => {
            const data = event.data ? event.data.json() : {};
            const options = {
                body: data.description || 'You have a new message',
                icon: data.image || 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
                data: { url: data.url || '/' }
            };
            event.waitUntil(
                self.registration.showNotification(data.title || 'Notification', options)
            );
        });

        self.addEventListener('notificationclick', event => {
            event.notification.close();
            event.waitUntil(
                clients.openWindow(event.notification.data.url)
            );
        });
    `);
});

// Serve static files
app.get('/', (req, res) => {
    res.send('Backend is running!');
});
app.use(express.static('public'));

// Subscribe Page Endpoint (Popup Window)
app.get('/subscribe-window', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Subscribe to Notifications</title>
                <style>
                    body { font-family: sans-serif; text-align: center; padding: 50px 20px; }
                    .loader { border: 4px solid #f3f3f3; border-radius: 50%; border-top: 4px solid #000; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <h3>Please Click "Allow" 🔔</h3>
                <p>To receive updates about your order and offers.</p>
                <div class="loader"></div>
                <p id="status" style="color:gray;">Requesting permission...</p>

                <script>
                    const PUBLIC_KEY = '${process.env.PUBLIC_KEY}';

                    async function subscribe() {
                        const status = document.getElementById('status');
                        
                        try {
                            const permission = await Notification.requestPermission();
                            if (permission !== 'granted') {
                                throw new Error('Permission denied. Please reset permissions and try again.');
                            }

                            status.textContent = 'Registering service worker...';
                            const registration = await navigator.serviceWorker.register('/sw.js');
                            
                            // Wait for service worker to be active
                            await navigator.serviceWorker.ready;

                            status.textContent = 'Subscribing...';
                            const subscription = await registration.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: PUBLIC_KEY
                            });

                            await fetch('/subscribe', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(subscription)
                            });

                            status.innerHTML = '<span style="color:green">✓ Success! Closing...</span>';
                            
                            if (window.opener) {
                                window.opener.postMessage({ type: 'PUSH_SUBSCRIBED', success: true }, '*');
                                setTimeout(() => window.close(), 1500);
                            }

                        } catch (error) {
                            console.error(error);
                            status.innerHTML = '<span style="color:red">' + error.message + '</span>';
                        }
                    }

                    // Auto-trigger on load
                    window.onload = subscribe;
                </script>
            </body>
        </html>
    `);
});

// Stats Endpoint
app.get('/stats', async (req, res) => {
    try {
        const subscriptions = await SubscriptionModel.find();
        res.json({ count: subscriptions.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin Page Endpoint (Send Notifications)
app.get('/admin', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Push Admin</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: -apple-system, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background: #f5f5f5; }
                    .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h2 { margin-top: 0; }
                    .form-group { margin-bottom: 15px; }
                    label { display: block; margin-bottom: 5px; font-weight: 600; }
                    input, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box; }
                    button { background: #000; color: white; border: none; padding: 12px 20px; border-radius: 6px; font-size: 16px; width: 100%; cursor: pointer; }
                    button:hover { opacity: 0.9; }
                    .status { margin-top: 20px; padding: 10px; border-radius: 6px; display: none; }
                    .success { background: #d4edda; color: #155724; }
                    .error { background: #f8d7da; color: #721c24; }
                    .stats { margin-bottom: 20px; padding: 10px; background: #e9ecef; border-radius: 6px; font-weight: bold; text-align: center; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>📢 Send Broadcast</h2>
                    <div id="stats" class="stats">Loading subscribers...</div>
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" id="title" placeholder="New Sale!" value="Big Sale Alert! 🚀">
                    </div>
                    <div class="form-group">
                        <label>Message</label>
                        <textarea id="message" rows="3" placeholder="Get 50% off today...">Get 20% off on all items! Limited time only.</textarea>
                    </div>
                    <div class="form-group">
                        <label>Link URL (Optional)</label>
                        <input type="text" id="url" placeholder="https://zyrajewel.co.in" value="https://zyrajewel.co.in">
                    </div>
                    <button onclick="sendPush()">Send Notification</button>
                    <div id="status" class="status"></div>
                </div>

                <script>
                    async function loadStats() {
                        try {
                            const res = await fetch('/stats');
                            const data = await res.json();
                            document.getElementById('stats').textContent = '👥 Total Subscribers: ' + data.count;
                        } catch (e) {
                            document.getElementById('stats').textContent = 'Could not load stats';
                        }
                    }
                    loadStats();

                    async function sendPush() {
                        const btn = document.querySelector('button');
                        const status = document.getElementById('status');
                        btn.disabled = true;
                        btn.textContent = 'Sending...';
                        status.style.display = 'none';

                        const data = {
                            title: document.getElementById('title').value,
                            message: document.getElementById('message').value,
                            url: document.getElementById('url').value,
                            icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png'
                        };

                        try {
                            const res = await fetch('/broadcast', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            
                            // Check if response is JSON, otherwise read text
                            let result;
                            const contentType = res.headers.get("content-type");
                            if (contentType && contentType.indexOf("application/json") !== -1) {
                                result = await res.json();
                            } else {
                                const text = await res.text();
                                throw new Error('Server returned non-JSON response: ' + text);
                            }

                            if (!res.ok) {
                                throw new Error(result.error || 'Server error');
                            }
                            
                            status.textContent = '✅ ' + (result.message || 'Notification Sent!');
                            status.className = 'status success';
                            status.style.display = 'block';
                        } catch (err) {
                            console.error(err);
                            status.textContent = '❌ Error: ' + err.message;
                            status.className = 'status error';
                            status.style.display = 'block';
                        }
                        btn.disabled = false;
                        btn.textContent = 'Send Notification';
                    }
                </script>
            </body>
        </html>
    `);
});

// CORS configuration - Add your Shopify domain here
app.use(cors({
    origin: '*', // For testing - replace with your Shopify domain in production
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Subscription endpoint - GET (for informational purposes)
app.get('/subscribe', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Subscribe to Push Notifications</title>
                <style>
                    body { font-family: sans-serif; text-align: center; padding: 50px 20px; max-width: 600px; margin: 0 auto; }
                    .container { background: #f0f0f0; padding: 30px; border-radius: 10px; margin-top: 50px; }
                    button { background: #000; color: white; border: none; padding: 12px 30px; border-radius: 6px; font-size: 16px; cursor: pointer; }
                    button:hover { opacity: 0.8; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>📬 Subscribe to Notifications</h2>
                    <p>Get updates about new products, offers, and your orders!</p>
                    <button onclick="subscribeWindow()">Enable Notifications</button>
                </div>
                <script>
                    function subscribeWindow() {
                        window.location.href = '/';
                    }
                </script>
            </body>
        </html>
    `);
});

// Subscription endpoint - POST (for programmatic subscription)
app.post('/subscribe', async (req, res) => {
    try {
        console.log('🔔 Received subscription request');
        const newSubscription = await SubscriptionModel.create({ ...req.body });
        console.log('✅ New User Subscribed & Stored in DB! ID:', newSubscription.id);

        if (!process.env.PUBLIC_KEY || !process.env.PRIVATE_KEY) {
            console.error('❌ Missing VAPID Keys in Environment Variables');
            return res.status(500).json({ error: 'Server misconfiguration: Missing Keys' });
        }

        const options = {
            vapidDetails: {
                subject: 'mailto:admin@zyrajewel.co.in', // Changed to look like a real domain
                publicKey: process.env.PUBLIC_KEY,
                privateKey: process.env.PRIVATE_KEY,
            },
        };

        console.log('📤 Sending welcome notification...');
        try {
            // Format subscription properly for webPush
            const subscription = {
                endpoint: newSubscription.endpoint,
                keys: newSubscription.keys
            };
            
            await webPush.sendNotification(
                subscription,
                JSON.stringify({
                    title: 'Welcome to Zyra Jewel!',
                    description: 'You will now receive updates about our latest collections.',
                    image: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
                }),
                options
            );
            console.log('✅ Welcome notification sent');
        } catch (pushError) {
            console.error('⚠️ Failed to send welcome notification (but subscription saved):', pushError);
            // Don't fail the request if just the notification fails, as subscription is saved
        }

        res.status(200).json({ success: true, message: 'Subscribed successfully' });
    } catch (error) {
        console.error('❌ Error in /subscribe:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// Broadcast notification to all subscribers
app.post('/broadcast', async (req, res) => {
    const { title, message, icon, url } = req.body;

    try {
        const subscriptions = await SubscriptionModel.find();

        if (subscriptions.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No subscribers found'
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
                // Format subscription properly for webPush
                const subscription = {
                    endpoint: sub.endpoint,
                    keys: sub.keys
                };
                
                await webPush.sendNotification(
                    subscription,
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
                console.log('Failed to send notification to', sub.endpoint, err.message);
                failCount++;
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await SubscriptionModel.deleteOne({ _id: sub._id });
                }
            }
        });

        await Promise.all(promises);

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

// Connect to MongoDB and start server
// Connect to MongoDB
// MongoDB connection removed - using Postgres via SubscriptionModel


// Export app for Vercel
module.exports = app;

// Only listen if run directly (Local Development)
if (require.main === module) {
    app.listen(port, () => console.log(`App running live on port ${port}`));
}
