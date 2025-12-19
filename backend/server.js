// Push Notification Backend - CLEANED & FIXED
require('dotenv').config();
const express = require('express');
const webPush = require('web-push');
const path = require('path');
const SubscriptionModel = require(path.join(__dirname, 'subscriptionModel'));
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Service Worker - Serve Directly
app.get('/sw.js', (req, res) => {
    res.set('Service-Worker-Allowed', '/');
    res.set('Content-Type', 'application/javascript');
    res.status(200).send(`
        console.log('🚀 Service Worker script loaded');
        self.addEventListener('install', function(event) {
            console.log('📦 Service Worker installing...');
            event.waitUntil(self.skipWaiting());
        });
        self.addEventListener('activate', function(event) {
            console.log('✅ Service Worker activating...');
            event.waitUntil(self.clients.claim());
        });
        self.addEventListener('push', async function (event) {
            try {
                const message = await event.data.json();
                const { title, body, icon, url } = message;
                const options = {
                    body: body || 'New Notification',
                    icon: icon || 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
                    data: { url: url || '/' }
                };
                await event.waitUntil(self.registration.showNotification(title, options));
            } catch (error) { console.error('Push Error:', error); }
        });
        self.addEventListener('notificationclick', function (event) {
            event.notification.close();
            if (event.notification.data && event.notification.data.url) {
                event.waitUntil(clients.openWindow(event.notification.data.url));
            }
        });
    `);
});

// Root
app.get('/', (req, res) => {
    res.json({ status: 'running', service: 'Push Notification API' });
});

// Subscribe Endpoint
app.post('/subscribe', async (req, res) => {
    try {
        console.log('🔔 Subscribe Request:', req.body.storeId);
        await SubscriptionModel.create(req.body);

        // Send Welcome Notification
        const options = {
            vapidDetails: {
                subject: 'mailto:admin@zyrajewel.co.in',
                publicKey: process.env.PUBLIC_KEY,
                privateKey: process.env.PRIVATE_KEY,
            }
        };
        try {
            await webPush.sendNotification(
                { endpoint: req.body.endpoint, keys: req.body.keys },
                JSON.stringify({ title: 'Welcome!', body: 'You are now subscribed!' }),
                options
            );
        } catch (e) { console.error('Welcome push failed:', e.message); }

        res.json({ success: true });
    } catch (error) {
        console.error('Subscribe Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Shopify App Proxy Subscribe (Alias)
app.post('/apps/push/subscribe', async (req, res) => {
    // Forward to main subscribe handler logic
    try {
        await SubscriptionModel.create(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 🔐 STORE LOGIN WITH MASTER PASSWORD
// =====================================================
app.post('/store-login', async (req, res) => {
    const { storeId, password } = req.body;
    console.log(`🔐 Login attempt for: ${storeId}`);

    // MASTER PASSWORD CHECK
    if (password === 'admin123' || password === 'zyra123') {
        console.log('✅ Master Password Accepted!');

        // Generate a fake but valid token
        return res.json({
            success: true,
            token: 'master-token-' + Date.now(),
            store: {
                id: storeId,
                name: storeId.charAt(0).toUpperCase() + storeId.slice(1), // Capitalize
                domain: `${storeId}.myshopify.com`
            }
        });
    }

    return res.status(401).json({ success: false, error: 'Invalid password' });
});

// Store Admin Dashboard HTML
app.get('/store-admin', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Store Admin</title>
    <style>
        body { font-family: sans-serif; background: #667eea; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { background: white; padding: 40px; border-radius: 10px; width: 400px; box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
        input, textarea { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
        button { width: 100%; padding: 10px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
        button:hover { background: #5a6fd6; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="container" id="loginForm">
        <h2>🔐 Login</h2>
        <input type="text" id="storeId" placeholder="Store ID (e.g. zyrajewel)">
        <input type="password" id="password" placeholder="Password">
        <button onclick="login()">Login</button>
    </div>

    <div class="container hidden" id="dashboard">
        <h2 id="dashTitle">Store Dashboard</h2>
        <p>Subscribers: <strong id="subCount">0</strong></p>
        <hr>
        <h3>Send Notification</h3>
        <input type="text" id="title" placeholder="Title">
        <textarea id="message" placeholder="Message"></textarea>
        <input type="text" id="url" placeholder="Link URL">
        <button onclick="sendBroadcast()">🚀 Send Broadcast</button>
        <br><br>
        <button onclick="logout()" style="background: #ccc; color: #333">Logout</button>
    </div>

    <script>
        let store = JSON.parse(localStorage.getItem('store') || 'null');

        if(store) showDashboard();

        async function login() {
            const storeId = document.getElementById('storeId').value;
            const password = document.getElementById('password').value;
            const res = await fetch('/store-login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ storeId, password })
            });
            const data = await res.json();
            if(data.success) {
                store = data.store;
                localStorage.setItem('store', JSON.stringify(store));
                showDashboard();
            } else {
                alert(data.error);
            }
        }

        function showDashboard() {
            document.getElementById('loginForm').class = 'hidden'; // Simply hide login
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('dashboard').classList.remove('hidden');
            document.getElementById('dashTitle').innerText = store.name;
            loadStats();
        }

        async function loadStats() {
            const res = await fetch('/my-store/stats?storeId=' + store.id);
            const data = await res.json();
            document.getElementById('subCount').innerText = data.subscribers;
        }

        async function sendBroadcast() {
            const title = document.getElementById('title').value;
            const message = document.getElementById('message').value;
            const url = document.getElementById('url').value;
            
            const res = await fetch('/my-store/broadcast', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ storeId: store.id, title, message, url })
            });
            const data = await res.json();
            alert(data.success ? '✅ Sent!' : '❌ Failed');
        }

        function logout() {
            localStorage.removeItem('store');
            location.reload();
        }
    </script>
</body>
</html>`);
});

// Stats API
app.get('/my-store/stats', async (req, res) => {
    const { storeId } = req.query;
    try {
        const result = await pool.query('SELECT COUNT(*) FROM subscriptions WHERE store_id = $1', [storeId]);
        res.json({ subscribers: result.rows[0].count });
    } catch (e) { res.status(500).json({ subscribers: 0 }); }
});

// Broadcast API
app.post('/my-store/broadcast', async (req, res) => {
    const { storeId, title, message, url } = req.body;
    try {
        const subs = await SubscriptionModel.findByStore(storeId);
        console.log(`🚀 Sending broadcast to ${subs.length} subs for store ${storeId}`);

        const options = {
            vapidDetails: {
                subject: 'mailto:admin@zyrajewel.co.in',
                publicKey: process.env.PUBLIC_KEY,
                privateKey: process.env.PRIVATE_KEY,
            }
        };

        let sent = 0;
        for (const sub of subs) {
            try {
                await webPush.sendNotification(
                    { endpoint: sub.endpoint, keys: sub.keys },
                    JSON.stringify({ title, body: message, url }),
                    options
                );
                sent++;
            } catch (e) { console.error('Push failed', e.message); }
        }
        res.json({ success: true, sent });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = app;