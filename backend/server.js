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
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); // Force no cache
    res.status(200).send(`
        console.log('🚀 Service Worker v2 (Image Support) Loaded');
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
                const { title, body, icon, url, image } = message;
                const options = {
                    body: body || 'New Notification',
                    icon: icon || 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
                    image: image || null,
                    requireInteraction: true, // New: Keeps notification visible
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

// Admin Redirect
app.get('/admin', (req, res) => {
    res.redirect('/store-admin');
});

// Subscribe Endpoint
app.post('/subscribe', async (req, res) => {
    try {
        console.log('🔔 Subscribe Request:', req.body.storeId);
        await SubscriptionModel.create(req.body);

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

app.post('/apps/push/subscribe', async (req, res) => {
    try {
        await SubscriptionModel.create(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 🔐 STORE AUTHENTICATION
// =====================================================

// Login
app.post('/store-login', async (req, res) => {
    const { storeId, password } = req.body;
    console.log(`🔐 Login attempt for: ${storeId}`);

    try {
        // Check DB
        const result = await pool.query('SELECT * FROM stores WHERE store_id = $1', [storeId]);
        const store = result.rows[0];

        // MASTER PASSWORD or DB PASSWORD
        if (password === 'admin123' || (store && store.password === password)) {
            console.log('✅ Login Successful!');
            return res.json({
                success: true,
                token: 'token-' + Date.now(),
                store: {
                    id: storeId,
                    name: store ? store.store_name : storeId,
                    domain: `${storeId}.myshopify.com`
                }
            });
        }
        res.status(401).json({ success: false, error: 'Invalid Store ID or Password' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Account (Register)
app.post('/store-register', async (req, res) => {
    const { storeId, password, storeName } = req.body;
    try {
        await pool.query(
            `INSERT INTO stores (store_id, password, store_name) VALUES ($1, $2, $3)
             ON CONFLICT (store_id) DO UPDATE SET password = $2, store_name = $3`,
            [storeId, password, storeName]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Forgot Password (Show Password)
app.post('/store-forgot', async (req, res) => {
    const { storeId } = req.body;
    try {
        const result = await pool.query('SELECT password FROM stores WHERE store_id = $1', [storeId]);
        if (result.rows.length > 0) {
            res.json({ success: true, password: result.rows[0].password });
        } else {
            res.json({ success: false, error: 'Store ID not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Store Admin Dashboard HTML
app.get('/store-admin', (req, res) => {
    // 🔥 FORCE NO CACHE prevent seeing old UI
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Store Admin</title>
    <style>
        body { font-family: -apple-system, sans-serif; background: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .container { background: white; padding: 40px; border-radius: 12px; width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        h2 { margin-top: 0; color: #1a1a1a; }
        input, textarea { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; font-size: 14px; }
        button { width: 100%; padding: 12px; background: #008060; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 600; margin-top: 10px; }
        button:hover { background: #004c3f; }
        .hidden { display: none; }
        .link { color: #008060; cursor: pointer; text-decoration: underline; font-size: 14px; display: block; margin-top: 10px; text-align: center; }
        .secondary-btn { background: #6c757d; }
        .secondary-btn:hover { background: #5a6268; }
        #forgotSection, #registerSection { border-top: 1px solid #eee; margin-top: 20px; padding-top: 20px; }
        .stats-box { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
        .stats-num { font-size: 24px; font-weight: bold; color: #008060; }
    </style>
</head>
<body>
    <!-- LOGIN FORM -->
    <div class="container" id="loginForm">
        <h2>🔐 Store Login</h2>
        <input type="text" id="storeId" placeholder="Store ID (e.g. zyrajewel)">
        <input type="password" id="password" placeholder="Password">
        <button onclick="login()">Login</button>
        
        <a class="link" onclick="toggleForgot()">Forgot Password?</a>
        <a class="link" onclick="toggleRegister()">Create New Account</a>

        <!-- FORGOT PASSWORD SECTION -->
        <div id="forgotSection" class="hidden">
            <h3>🔑 Recover Password</h3>
            <p style="font-size: 13px; color: #666;">Enter your Store ID to see your password.</p>
            <input type="text" id="forgotStoreId" placeholder="Enter Store ID">
            <button class="secondary-btn" onclick="recoverPassword()">Show Password</button>
            <p id="passwordDisplay" style="font-weight: bold; color: #d63031; text-align: center; margin-top: 10px;"></p>
        </div>

        <!-- REGISTER SECTION -->
        <div id="registerSection" class="hidden">
            <h3>📝 Create Account</h3>
            <input type="text" id="regStoreId" placeholder="Store ID (e.g. mybrand)">
            <input type="text" id="regStoreName" placeholder="Store Name (e.g. My Brand)">
            <input type="password" id="regPassword" placeholder="Set Password">
            <button class="secondary-btn" onclick="register()">Create Account</button>
        </div>
    </div>

    <!-- DASHBOARD -->
    <div class="container hidden" id="dashboard">
        <h2 id="dashTitle">Store Dashboard</h2>
        
        <div class="stats-box">
            <div>Total Subscribers</div>
            <div class="stats-num" id="subCount">0</div>
        </div>

        <h3>📢 Send Notification</h3>
        <input type="text" id="title" placeholder="Campaign Title">
        <textarea id="message" placeholder="Campaign Message"></textarea>
        <input type="text" id="image" placeholder="Image URL (Rec: 2:1 Ratio, e.g. 1000x500px)">
        <input type="text" id="url" placeholder="Link URL (Optional)">
        <button onclick="sendBroadcast()">🚀 Send Broadcast</button>
        
        <button onclick="logout()" style="background: #ccc; color: #333; margin-top: 20px;">Logout</button>
    </div>

    <script>
        // Check session
        let store = JSON.parse(localStorage.getItem('store') || 'null');
        if(store) showDashboard();

        // --- LOGIN ---
        async function login() {
            const storeId = document.getElementById('storeId').value;
            const password = document.getElementById('password').value;
            if(!storeId || !password) return alert('Please enter details');

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

        // --- DASHBOARD ---
        function showDashboard() {
            document.getElementById('loginForm').classList.add('hidden');
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
            const image = document.getElementById('image').value;
            const url = document.getElementById('url').value;
            
            const btn = document.querySelector('button[onclick="sendBroadcast()"]');
            btn.innerText = 'Sending...';
            btn.disabled = true;

            const res = await fetch('/my-store/broadcast', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ storeId: store.id, title, message, url, image })
            });
            const data = await res.json();
            
            btn.innerText = '🚀 Send Broadcast';
            btn.disabled = false;
            
            if(data.success) {
                alert('✅ Sent to ' + data.sent + ' subscribers!');
                document.getElementById('title').value = '';
                document.getElementById('message').value = '';
            } else {
                alert('❌ Failed: ' + data.error);
            }
        }

        function logout() {
            localStorage.removeItem('store');
            location.reload();
        }

        // --- EXTRAS ---
        function toggleForgot() {
            document.getElementById('registerSection').classList.add('hidden');
            document.getElementById('forgotSection').classList.toggle('hidden');
        }

        function toggleRegister() {
            document.getElementById('forgotSection').classList.add('hidden');
            document.getElementById('registerSection').classList.toggle('hidden');
        }

        async function register() {
            const storeId = document.getElementById('regStoreId').value;
            const password = document.getElementById('regPassword').value;
            const storeName = document.getElementById('regStoreName').value;

            const res = await fetch('/store-register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ storeId, password, storeName })
            });
            const data = await res.json();
            if(data.success) {
                alert('✅ Account Created! You can now login.');
                toggleRegister();
                document.getElementById('storeId').value = storeId;
                document.getElementById('password').value = password;
            } else {
                alert('Error: ' + data.error);
            }
        }

        async function recoverPassword() {
            const storeId = document.getElementById('forgotStoreId').value;
            if(!storeId) return alert('Enter Store ID');

            const res = await fetch('/store-forgot', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ storeId })
            });
            const data = await res.json();
            if(data.success) {
                document.getElementById('passwordDisplay').innerText = 'Your Password: ' + data.password;
            } else {
                document.getElementById('passwordDisplay').innerText = '❌ Store ID not found';
            }
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
    const { storeId, title, message, url, image } = req.body;
    try {
        const subs = await SubscriptionModel.findByStore(storeId);

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
                    JSON.stringify({ title, body: message, url, image }),
                    options
                );
                sent++;
            } catch (e) { console.error('Push failed', e.message); }
        }
        res.json({ success: true, sent });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = app;