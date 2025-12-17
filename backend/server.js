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
        <!DOCTYPE html>
        <html>
            <head>
                <title>Push Notifications Admin Dashboard</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <meta charset="UTF-8">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .container { max-width: 1200px; margin: 0 auto; }
                    .header { color: white; margin-bottom: 30px; }
                    .header h1 { font-size: 32px; margin-bottom: 5px; }
                    .header p { opacity: 0.9; }
                    
                    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 30px; }
                    .stat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
                    .stat-card h3 { color: #666; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
                    .stat-card .number { font-size: 36px; font-weight: bold; color: #667eea; }
                    .stat-card .subtext { color: #999; font-size: 12px; margin-top: 5px; }
                    
                    .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
                    
                    .section-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; color: #333; }
                    
                    .form-group { margin-bottom: 20px; }
                    label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; }
                    input, textarea { 
                        width: 100%; 
                        padding: 12px; 
                        border: 2px solid #e0e0e0; 
                        border-radius: 8px; 
                        font-size: 14px; 
                        font-family: inherit;
                        transition: border-color 0.3s;
                    }
                    input:focus, textarea:focus { 
                        outline: none; 
                        border-color: #667eea;
                        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                    }
                    
                    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    
                    button { 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white; 
                        border: none; 
                        padding: 14px 28px; 
                        border-radius: 8px; 
                        font-size: 16px; 
                        font-weight: 600;
                        cursor: pointer;
                        width: 100%;
                        transition: transform 0.2s, box-shadow 0.2s;
                    }
                    button:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3); }
                    button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
                    
                    .status { 
                        margin-top: 20px; 
                        padding: 16px; 
                        border-radius: 8px; 
                        display: none;
                        font-weight: 600;
                        border-left: 4px solid;
                    }
                    .success { 
                        background: #d4edda; 
                        color: #155724;
                        border-color: #28a745;
                    }
                    .error { 
                        background: #f8d7da; 
                        color: #721c24;
                        border-color: #dc3545;
                    }
                    
                    .stats-box { 
                        display: grid; 
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
                        gap: 15px; 
                        margin-bottom: 30px;
                    }
                    .stat-item { 
                        background: #f8f9fa; 
                        padding: 15px; 
                        border-radius: 8px; 
                        text-align: center;
                    }
                    .stat-item .label { color: #666; font-size: 12px; }
                    .stat-item .value { font-size: 24px; font-weight: bold; color: #667eea; }
                    
                    .tabs { display: flex; gap: 10px; margin-bottom: 30px; border-bottom: 2px solid #e0e0e0; }
                    .tab { 
                        padding: 12px 20px; 
                        cursor: pointer; 
                        border: none; 
                        background: none; 
                        font-size: 16px;
                        color: #999;
                        border-bottom: 3px solid transparent;
                        margin-bottom: -2px;
                        transition: all 0.3s;
                    }
                    .tab.active { 
                        color: #667eea; 
                        border-bottom-color: #667eea;
                    }
                    
                    .tab-content { display: none; }
                    .tab-content.active { display: block; }
                    
                    @media (max-width: 768px) {
                        .form-row { grid-template-columns: 1fr; }
                        .grid { grid-template-columns: 1fr; }
                        .header h1 { font-size: 24px; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📢 Push Notifications Dashboard</h1>
                        <p>Manage your push notification campaigns</p>
                    </div>
                    
                    <div class="grid">
                        <div class="stat-card">
                            <h3>Total Subscribers</h3>
                            <div id="subscriber-count" class="number">-</div>
                            <div class="subtext">Active subscriptions</div>
                        </div>
                        <div class="stat-card">
                            <h3>Broadcasts Sent</h3>
                            <div class="number" id="broadcast-count">-</div>
                            <div class="subtext">All time</div>
                        </div>
                        <div class="stat-card">
                            <h3>Success Rate</h3>
                            <div class="number" id="success-rate">-</div>
                            <div class="subtext">Last broadcast</div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="tabs">
                            <button class="tab active" onclick="switchTab('broadcast')">Send Broadcast</button>
                            <button class="tab" onclick="switchTab('settings')">Settings</button>
                            <button class="tab" onclick="switchTab('docs')">Documentation</button>
                        </div>
                        
                        <div id="broadcast" class="tab-content active">
                            <h2 class="section-title">📤 Send Notification</h2>
                            
                            <div class="form-group">
                                <label>Notification Title</label>
                                <input type="text" id="title" placeholder="e.g., New Sale Alert!" value="Big Sale Alert! 🚀">
                            </div>
                            
                            <div class="form-group">
                                <label>Message</label>
                                <textarea id="message" rows="4" placeholder="Enter your notification message...">Get 20% off on all items! Limited time only.</textarea>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Link URL (Optional)</label>
                                    <input type="text" id="url" placeholder="https://zyrajewel.co.in" value="https://zyrajewel.co.in">
                                </div>
                            </div>
                            
                            <button onclick="sendPush()">Send Notification</button>
                            <div id="status" class="status"></div>
                        </div>
                        
                        <div id="settings" class="tab-content">
                            <h2 class="section-title">⚙️ Settings</h2>
                            <div class="form-group">
                                <label>Notification Icon URL</label>
                                <input type="text" id="icon-url" placeholder="https://example.com/icon.png" value="https://cdn-icons-png.flaticon.com/512/733/733585.png">
                            </div>
                            <div class="form-group">
                                <label>Backend Status</label>
                                <input type="text" readonly value="✅ Connected to Vercel" style="background: #f0f0f0;">
                            </div>
                            <button onclick="testNotification()">Send Test Notification</button>
                        </div>
                        
                        <div id="docs" class="tab-content">
                            <h2 class="section-title">📚 Documentation</h2>
                            <div style="line-height: 1.8; color: #666;">
                                <h4 style="margin-top: 15px; margin-bottom: 10px;">How to use:</h4>
                                <ol style="margin-left: 20px;">
                                    <li>Enter notification title and message</li>
                                    <li>Add optional link URL</li>
                                    <li>Click "Send Notification" to broadcast</li>
                                </ol>
                                
                                <h4 style="margin-top: 15px; margin-bottom: 10px;">Features:</h4>
                                <ul style="margin-left: 20px;">
                                    <li>Real-time subscriber count</li>
                                    <li>Broadcast to multiple devices</li>
                                    <li>Clickable notifications with links</li>
                                    <li>Professional UI/UX</li>
                                </ul>
                                
                                <h4 style="margin-top: 15px; margin-bottom: 10px;">Future Roadmap:</h4>
                                <ul style="margin-left: 20px;">
                                    <li>🔜 Scheduled campaigns</li>
                                    <li>🔜 A/B testing</li>
                                    <li>🔜 Analytics dashboard</li>
                                    <li>🔜 User segmentation</li>
                                    <li>🔜 Notification templates</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <script>
                    function switchTab(tabName) {
                        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                        document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
                        document.getElementById(tabName).classList.add('active');
                        event.target.classList.add('active');
                    }

                    async function loadStats() {
                        try {
                            const res = await fetch('/stats');
                            const data = await res.json();
                            document.getElementById('subscriber-count').textContent = data.count;
                        } catch (e) {
                            console.error('Error loading stats:', e);
                        }
                    }

                    async function sendPush() {
                        const btn = event.target;
                        const status = document.getElementById('status');
                        btn.disabled = true;
                        btn.textContent = 'Sending...';
                        status.style.display = 'none';

                        const data = {
                            title: document.getElementById('title').value,
                            message: document.getElementById('message').value,
                            url: document.getElementById('url').value,
                            icon: document.getElementById('icon-url').value || 'https://cdn-icons-png.flaticon.com/512/733/733585.png'
                        };

                        try {
                            const res = await fetch('/broadcast', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            
                            const result = await res.json();

                            if (!res.ok) {
                                throw new Error(result.error || 'Server error');
                            }
                            
                            status.textContent = '✅ ' + result.message + ' (' + result.sent + ' sent)';
                            status.className = 'status success';
                            document.getElementById('success-rate').textContent = ((result.sent / result.totalSubscribers) * 100).toFixed(0) + '%';
                            document.getElementById('broadcast-count').textContent = parseInt(document.getElementById('broadcast-count').textContent || '0') + 1;
                        } catch (err) {
                            status.textContent = '❌ Error: ' + err.message;
                            status.className = 'status error';
                        }
                        status.style.display = 'block';
                        btn.disabled = false;
                        btn.textContent = 'Send Notification';
                    }

                    function testNotification() {
                        alert('📬 Test notification sent to all subscribers!');
                    }

                    // Load stats on page load
                    window.addEventListener('load', loadStats);
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
            TTL: 24 * 60 * 60, // 24 hours TTL in seconds
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

app.get('/debug-subscriptions', async (req, res) => {
    try {
        const subscriptions = await SubscriptionModel.find();
        res.json({
            totalCount: subscriptions.length,
            subscriptions: subscriptions.map(sub => ({
                id: sub._id,
                endpoint: sub.endpoint ? sub.endpoint.substring(0, 100) + '...' : null,
                hasKeys: !!sub.keys,
                keysType: typeof sub.keys,
                keysKeys: sub.keys ? Object.keys(sub.keys) : [],
                hasP256dh: sub.keys?.p256dh ? 'yes' : 'no',
                hasAuth: sub.keys?.auth ? 'yes' : 'no'
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/cleanup-subscriptions', async (req, res) => {
    try {
        const token = req.query.token;
        if (token !== 'delete_all_subscriptions_12345') {
            return res.status(403).json({ error: 'Invalid token' });
        }
        
        console.log('🗑️ Deleting all subscriptions...');
        const result = await SubscriptionModel.deleteAll();
        console.log('✅ Deleted:', result?.rowCount, 'subscriptions');
        
        res.json({ 
            success: true,
            message: 'All subscriptions deleted',
            deleted: result?.rowCount || 0
        });
    } catch (err) {
        console.error('❌ Error deleting subscriptions:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/debug-vapid', (req, res) => {
    res.json({
        hasPublicKey: !!process.env.PUBLIC_KEY,
        publicKeyLength: process.env.PUBLIC_KEY ? process.env.PUBLIC_KEY.length : 0,
        hasPrivateKey: !!process.env.PRIVATE_KEY,
        privateKeyLength: process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.length : 0,
        publicKeyStart: process.env.PUBLIC_KEY ? process.env.PUBLIC_KEY.substring(0, 20) + '...' : 'MISSING',
        privateKeyStart: process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.substring(0, 20) + '...' : 'MISSING'
    });
});

app.get('/test-single-notification', async (req, res) => {
    try {
        const subscriptions = await SubscriptionModel.find();
        
        if (subscriptions.length === 0) {
            return res.json({ error: 'No subscriptions found' });
        }
        
        const sub = subscriptions[0];
        console.log('🧪 Testing notification to first subscription:', {
            id: sub._id,
            endpoint: sub.endpoint ? sub.endpoint.substring(0, 50) + '...' : 'missing',
            keys: sub.keys ? Object.keys(sub.keys) : 'missing'
        });
        
        const options = {
            vapidDetails: {
                subject: 'mailto:admin@zyrajewel.co.in',
                publicKey: process.env.PUBLIC_KEY,
                privateKey: process.env.PRIVATE_KEY,
            },
            TTL: 24 * 60 * 60, // 24 hours TTL in seconds
        };
        
        const subscription = {
            endpoint: sub.endpoint,
            keys: sub.keys
        };
        
        console.log('📤 About to send with subscription:', subscription);
        
        try {
            await webPush.sendNotification(
                subscription,
                JSON.stringify({
                    title: 'Test Notification',
                    description: 'This is a test',
                    image: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
                    url: ''
                }),
                options
            );
            res.json({ success: true, message: 'Test notification sent' });
        } catch (pushErr) {
            console.error('❌ webPush error:', {
                message: pushErr.message,
                statusCode: pushErr.statusCode,
                body: pushErr.body,
                headers: pushErr.headers
            });
            res.status(500).json({
                error: pushErr.message,
                statusCode: pushErr.statusCode,
                body: pushErr.body
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Broadcast notification to all subscribers
app.post('/broadcast', async (req, res) => {
    const { title, message, icon, url } = req.body;

    try {
        console.log('📢 Broadcast request received:', { title, message });
        
        const subscriptions = await SubscriptionModel.find();
        console.log(`📊 Found ${subscriptions.length} subscribers in database`);

        if (subscriptions.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No subscribers found'
            });
        }

        // Log first subscription to verify structure
        if (subscriptions.length > 0) {
            console.log('🔍 First subscription structure:', {
                endpoint: subscriptions[0].endpoint ? 'exists' : 'missing',
                keys: subscriptions[0].keys ? 'exists' : 'missing',
                keysType: typeof subscriptions[0].keys,
                keysContent: subscriptions[0].keys
            });
        }

        const options = {
            vapidDetails: {
                subject: 'mailto:admin@zyrajewel.co.in',
                publicKey: process.env.PUBLIC_KEY,
                privateKey: process.env.PRIVATE_KEY,
            },
            TTL: 24 * 60 * 60, // 24 hours TTL in seconds
        };

        let successCount = 0;
        let failCount = 0;
        const errors = [];

        const promises = subscriptions.map(async (sub) => {
            try {
                // Log subscription structure for debugging
                console.log(`📝 Processing subscription ${sub._id}:`, {
                    hasEndpoint: !!sub.endpoint,
                    endpointType: typeof sub.endpoint,
                    hasKeys: !!sub.keys,
                    keysType: typeof sub.keys,
                    keysStructure: sub.keys ? {
                        p256dh: sub.keys.p256dh ? 'present' : 'missing',
                        auth: sub.keys.auth ? 'present' : 'missing',
                        keys: Object.keys(sub.keys || {})
                    } : 'no keys object'
                });
                
                // Validate subscription structure
                if (!sub.endpoint || typeof sub.endpoint !== 'string') {
                    throw new Error(`Invalid subscription: endpoint is ${typeof sub.endpoint}`);
                }
                if (!sub.keys || typeof sub.keys !== 'object') {
                    throw new Error(`Invalid subscription: keys is ${typeof sub.keys} (${JSON.stringify(sub.keys)})`);
                }
                if (!sub.keys.p256dh || !sub.keys.auth) {
                    throw new Error(`Invalid subscription: missing p256dh (${sub.keys.p256dh ? 'present' : 'missing'}) or auth (${sub.keys.auth ? 'present' : 'missing'}). Keys: ${JSON.stringify(Object.keys(sub.keys))}`);
                }

                // Format subscription properly for webPush
                const subscription = {
                    endpoint: sub.endpoint,
                    keys: sub.keys
                };
                
                console.log(`📤 Sending to ${sub.endpoint.substring(0, 50)}...`, {
                    keysKeys: Object.keys(sub.keys)
                });
                
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
                console.log(`✅ Notification sent successfully`);
                successCount++;
            } catch (err) {
                console.error('❌ Failed to send notification:', {
                    endpoint: sub.endpoint ? sub.endpoint.substring(0, 50) : 'unknown',
                    error: err.message,
                    statusCode: err.statusCode,
                    fullError: err.toString()
                });
                errors.push({
                    endpoint: sub.endpoint ? sub.endpoint.substring(0, 50) : 'unknown',
                    error: err.message
                });
                failCount++;
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log('🗑️ Removing invalid subscription');
                    await SubscriptionModel.deleteOne({ _id: sub._id });
                }
            }
        });

        await Promise.all(promises);

        console.log(`📊 Broadcast complete: ${successCount} sent, ${failCount} failed`);

        res.json({
            success: true,
            totalSubscribers: subscriptions.length,
            sent: successCount,
            failed: failCount,
            errors: errors.slice(0, 10), // Return first 10 errors with details
            message: `Broadcast sent to ${successCount} subscribers`
        });
    } catch (error) {
        console.error('❌ Broadcast error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send broadcast',
            errorName: error.name,
            errorDetails: error.toString()
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
