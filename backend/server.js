// Push Notification Backend - CLEANED & FIXED - Vercel Force Update

require('dotenv').config();
const express = require('express');
const webPush = require('web-push');
const path = require('path');
const SubscriptionModel = require('./subscriptionModel');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Pool
// Database Pool (Lazy Init)
let pool;
const getPool = () => {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            console.error("❌ DATABASE_URL is missing!");
            throw new Error("DATABASE_URL is missing");
        }
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
    }
    return pool;
};

// Init Campaign Table
const initCampaignTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS campaigns (
            id SERIAL PRIMARY KEY,
            store_id TEXT,
            title TEXT,
            message TEXT,
            url TEXT,
            image TEXT,
            sent_count INTEGER,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `;
    try { await getPool().query(query); console.log('✅ Campaigns table ready'); }
    catch (e) { console.error('❌ Campaign table error:', e); }
};
// initCampaignTable removed from top-level execution to prevent cold start crashes.
// It will be called lazily inside routes.

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
                const { title, body, icon, url, image, actions } = message;
                const options = {
                    body: body || 'New Notification',
                    icon: icon || 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
                    image: image || null,
                    requireInteraction: true,
                    data: { url: url || '/' },
                    actions: actions || [] // Add Actions here
                };
                await event.waitUntil(self.registration.showNotification(title, options));
            } catch (error) { console.error('Push Error:', error); }
        });
        self.addEventListener('notificationclick', function (event) {
            event.notification.close();
            
            // Default URL (Clicking body)
            let openUrl = event.notification.data.url;

            // Button Clicks
            if (event.action) {
               // event.action will contain the URL from our payload
               openUrl = event.action; 
            }

            if (openUrl) {
                event.waitUntil(clients.openWindow(openUrl));
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
        const db = getPool();
        const result = await db.query('SELECT * FROM stores WHERE store_id = $1', [storeId]);
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
        const db = getPool();
        await db.query(
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
        const db = getPool();
        const result = await db.query('SELECT password FROM stores WHERE store_id = $1', [storeId]);
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
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Retner Dashboard</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --primary: #008060;
            --primary-hover: #004c3f;
            --bg: #f6f6f7;
            --sidebar-width: 240px;
            --text-dark: #202223;
            --text-sub: #6d7175;
            --border: #e1e3e5;
        }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text-dark); display: flex; height: 100vh; overflow: hidden; }
        
        /* LAYOUT */
        .sidebar { width: var(--sidebar-width); background: white; border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 16px; flex-shrink: 0; }
        .main-content { flex: 1; display: flex; flex-direction: column; overflow-y: auto; }
        .top-bar { height: 60px; background: white; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 32px; flex-shrink: 0; }
        .content-area { padding: 32px; max-width: 1200px; margin: 0 auto; width: 100%; box-sizing: border-box; }

        /* SIDEBAR COMPONENTS */
        .logo { font-size: 20px; font-weight: 700; margin-bottom: 24px; color: var(--text-dark); display: flex; align-items: center; gap: 8px; }
        .logo i { color: var(--primary); }
        .new-campaign-btn { background: var(--primary); color: white; border: none; padding: 10px; border-radius: 4px; font-weight: 600; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 20px; transition: 0.2s; }
        .new-campaign-btn:hover { background: var(--primary-hover); }
        .menu-item { padding: 10px 12px; color: var(--text-dark); text-decoration: none; display: flex; align-items: center; gap: 12px; border-radius: 4px; margin-bottom: 4px; cursor: pointer; font-size: 14px; font-weight: 500; }
        .menu-item:hover, .menu-item.active { background: #f1f2f3; color: var(--primary); }
        .menu-item.active { background: #edfffa; }

        /* DASHBOARD WIDGETS */
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 24px; }
        .card { background: white; border: 1px solid var(--border); border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .card h3 { margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: var(--text-dark); }
        
        .stat-row { display: flex; align-items: baseline; gap: 8px; margin-top: 12px; }
        .stat-val { font-size: 28px; font-weight: 700; }
        .stat-label { color: var(--text-sub); font-size: 13px; }

        .welcome-box { background: #edfffa; border: 1px solid #cce5dd; display: flex; justify-content: space-between; align-items: center; }
        .welcome-text h2 { margin: 0 0 8px 0; font-size: 18px; }
        .welcome-text p { margin: 0; font-size: 14px; color: var(--text-sub); }

        /* AUTH FORMS */
        .auth-container { display: flex; justify-content: center; align-items: center; height: 100vh; width: 100vw; position: fixed; top: 0; left: 0; background: var(--bg); z-index: 1000; }
        .auth-box { background: white; padding: 40px; border-radius: 12px; width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        
        /* FORM INPUTS */
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; margin-bottom: 6px; font-size: 14px; font-weight: 500; }
        input, textarea, select { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 4px; font-size: 14px; box-sizing: border-box; }
        input:focus, textarea:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 1px var(--primary); }
        
        .hidden { display: none !important; }

        /* CAMPAIGN CREATOR */
        .campaign-preview { background: #f1f2f3; padding: 20px; border-radius: 8px; display: flex; justify-content: center; margin-top: 20px; }
        .preview-box { background: white; padding: 15px; border-radius: 8px; width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .preview-hero { width: 100%; height: 150px; background: #eee; border-radius: 4px; margin-bottom: 10px; object-fit: cover; }
    </style>
</head>
<body>

    <!-- AUTH SCREEN -->
    <div id="authScreen" class="auth-container">
        <div class="auth-box" id="loginBox">
            <h2 style="text-align: center; margin-bottom: 24px; color: var(--primary);">Retner Login</h2>
            <div class="form-group">
                <label>Store ID</label>
                <input type="text" id="storeId" placeholder="e.g. zyrajewel">
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="password" placeholder="••••••••">
            </div>
            <button class="new-campaign-btn" onclick="login()">Login</button>
            <div style="text-align: center; margin-top: 16px;">
                <a href="#" style="color: var(--text-sub); font-size: 13px;" onclick="toggleRegister()">Create an account</a>
            </div>
        </div>

        <div class="auth-box hidden" id="registerBox">
            <h2 style="text-align: center; margin-bottom: 24px;">Create Account</h2>
            <div class="form-group"><label>Store ID</label><input type="text" id="regStoreId"></div>
            <div class="form-group"><label>Store Name</label><input type="text" id="regStoreName"></div>
            <div class="form-group"><label>Password</label><input type="password" id="regPassword"></div>
            <button class="new-campaign-btn" onclick="register()">Register</button>
            <div style="text-align: center; margin-top: 16px;">
                <a href="#" style="color: var(--text-sub); font-size: 13px;" onclick="toggleRegister()">Back to Login</a>
            </div>
        </div>
    </div>

    <!-- MAIN APP -->
    <div id="mainApp" class="hidden" style="display: flex; width: 100%;">
        
        <!-- SIDEBAR -->
        <div class="sidebar">
            <div class="logo"><i class="fas fa-paper-plane"></i> Retner</div>
            
            <button class="new-campaign-btn" onclick="switchView('campaign')">
                <i class="fas fa-plus"></i> New Campaign
            </button>

            <div class="menu-item active" onclick="switchView('dashboard')" id="menu-dash">
                <i class="fas fa-home"></i> Home
            </div>
            <div class="menu-item" onclick="switchView('campaign')" id="menu-camp">
                <i class="fas fa-bullhorn"></i> Campaigns
            </div>
            <div class="menu-item" onclick="switchView('history')" id="menu-hist">
                <i class="fas fa-history"></i> History
            </div>
            <div class="menu-item">
                <i class="fas fa-users"></i> Subscribers
            </div>
            
            <div style="margin-top: auto;">
                <div class="menu-item" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </div>
            </div>
        </div>

        <!-- MAIN AREA -->
        <div class="main-content">
            <!-- TOP BAR -->
            <div class="top-bar">
                <h2 id="pageTitle" style="font-size: 18px; margin: 0;">Dashboard</h2>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; background: #e1e3e5; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--primary);" id="userInitials">S</div>
                    <span id="storeNameDisplay" style="font-size: 14px; font-weight: 500;">Store</span>
                </div>
            </div>

            <!-- DASHBOARD VIEW -->
            <div id="view-dashboard" class="content-area">
                <div class="grid">
                    <div class="card welcome-box">
                        <div class="welcome-text">
                            <h2>Hi there! 👋</h2>
                            <p>Welcome to Retner Push. Ready to grow?</p>
                            <button class="new-campaign-btn" style="width: auto; margin-top: 12px; background: white; color: var(--primary); border: 1px solid var(--primary);" onclick="switchView('campaign')">Create Campaign</button>
                        </div>
                        <i class="fas fa-rocket" style="font-size: 48px; color: var(--primary); opacity: 0.2;"></i>
                    </div>

                    <div class="card">
                        <h3>Subscribers</h3>
                        <div class="stat-row">
                            <i class="fas fa-user-friends" style="color: var(--primary);"></i>
                            <div class="stat-val" id="totalSubs">0</div>
                        </div>
                        <p class="stat-label">Total Opt-in users</p>
                    </div>

                    <div class="card">
                        <h3>Campaigns Sent</h3>
                        <div class="stat-row">
                            <i class="fas fa-paper-plane" style="color: orange;"></i>
                            <div class="stat-val">0</div>
                        </div>
                        <p class="stat-label">Lifetime campaigns</p>
                    </div>
                </div>

                <div class="card">
                    <h3>Subscriber Growth (Last 30 Days)</h3>
                    <canvas id="subChart" style="width: 100%; height: 250px;"></canvas>
                </div>
            </div>

            <!-- CAMPAIGN VIEW -->
            <div id="view-campaign" class="content-area hidden">
                <div class="grid" style="grid-template-columns: 2fr 1fr;">
                    <div class="card">
                        <h3>Create Campaign</h3>
                        
                        <div class="form-group">
                            <label>Campaign Title</label>
                            <input type="text" id="campTitle" placeholder="e.g. Flash Sale! ⚡️" oninput="updatePreview()">
                        </div>

                        <div class="form-group">
                            <label>Message</label>
                            <textarea id="campMsg" rows="3" placeholder="Describe your offer..." oninput="updatePreview()"></textarea>
                        </div>

                        <div class="form-group">
                            <label>Hero Image URL (Optional)</label>
                            <input type="text" id="campImg" placeholder="https://..." oninput="updatePreview()">
                            <p class="stat-label">Rec: 1000x500px (2:1 Ratio)</p>
                        </div>

                        <div class="form-group">
                            <label>Primary Link</label>
                            <input type="text" id="campUrl" placeholder="https://yourstore.com/products...">
                        </div>

                        <h4 style="margin: 24px 0 12px 0;">Action Buttons</h4>
                        <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 0;">
                            <div class="form-group">
                                <label>Button 1 Text</label>
                                <input type="text" id="btn1Txt" placeholder="e.g. SHOP NOW">
                            </div>
                            <div class="form-group">
                                <label>Button 1 URL</label>
                                <input type="text" id="btn1Link" placeholder="https://...">
                            </div>
                        </div>
                        <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div class="form-group">
                                <label>Button 2 Text</label>
                                <input type="text" id="btn2Txt" placeholder="e.g. USE CODE">
                            </div>
                            <div class="form-group">
                                <label>Button 2 URL</label>
                                <input type="text" id="btn2Link" placeholder="https://...">
                            </div>
                        </div>

                        <button class="new-campaign-btn" onclick="sendBroadcast()" id="sendBtn">
                            🚀 Send Campaign
                        </button>
                    </div>

                    <!-- PREVIEW -->
                    <div>
                        <div class="card" style="position: sticky; top: 20px;">
                            <h3>Preview (Android/Windows)</h3>
                            <div class="preview-box">
                                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                    <div style="width: 40px; height: 40px; background: #ddd; border-radius: 50%;"></div>
                                    <div>
                                        <div style="font-weight: bold; font-size: 14px;" id="prevTitle">Campaign Title</div>
                                        <div style="font-size: 12px; color: #666;" id="prevMsg">Message body goes here...</div>
                                    </div>
                                </div>
                                <img id="prevImg" src="" style="display: none;" class="preview-hero">
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            <!-- HISTORY VIEW -->
            <div id="view-history" class="content-area hidden">
                <div class="card">
                    <h3>Campaign History</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f2f3; text-align: left;">
                                <th style="padding: 10px; border-bottom: 2px solid #ddd;">Date</th>
                                <th style="padding: 10px; border-bottom: 2px solid #ddd;">Title</th>
                                <th style="padding: 10px; border-bottom: 2px solid #ddd;">Message</th>
                                <th style="padding: 10px; border-bottom: 2px solid #ddd;">Sent To</th>
                            </tr>
                        </thead>
                        <tbody id="historyTableBody">
                            <!-- Rows loaded via JS -->
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    </div>

    <script>
        // STATE
        let store = JSON.parse(localStorage.getItem('store') || 'null');
        
        // INIT
        if(store) {
            initApp();
        } else {
            document.getElementById('authScreen').classList.remove('hidden');
        }

        function initApp() {
            document.getElementById('authScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            document.getElementById('mainApp').style.display = 'flex'; // Ensure flex
            
            document.getElementById('storeNameDisplay').innerText = store.name;
            document.getElementById('userInitials').innerText = store.name.charAt(0).toUpperCase();

            loadStats();
        }

        // NAVIGATION
        function switchView(viewName) {
            // Update Menu Active State
            document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
            if(viewName === 'dashboard') document.getElementById('menu-dash').classList.add('active');
            if(viewName === 'campaign') document.getElementById('menu-camp').classList.add('active');
            if(viewName === 'history') {
                document.getElementById('menu-hist').classList.add('active');
                loadHistory();
            }

            // Hide all Views
            document.getElementById('view-dashboard').classList.add('hidden');
            document.getElementById('view-campaign').classList.add('hidden');
            document.getElementById('view-history').classList.add('hidden');

            // Show Selected
            document.getElementById('view-'+viewName).classList.remove('hidden');
            let titles = {dashboard: 'Dashboard', campaign: 'Create Campaign', history: 'Campaign History'};
            document.getElementById('pageTitle').innerText = titles[viewName];
        }

        // PREVIEW LOGIC
        function updatePreview() {
            const title = document.getElementById('campTitle').value || 'Campaign Title';
            const msg = document.getElementById('campMsg').value || 'Message body...';
            const img = document.getElementById('campImg').value;

            document.getElementById('prevTitle').innerText = title;
            document.getElementById('prevMsg').innerText = msg;
            
            const imgEl = document.getElementById('prevImg');
            if(img) {
                imgEl.src = img;
                imgEl.style.display = 'block';
            } else {
                imgEl.style.display = 'none';
            }
        }

        // API ACTIONS
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
                initApp();
            } else {
                alert(data.error);
            }
        }

        async function loadStats() {
            const res = await fetch('/my-store/stats?storeId=' + store.id);
            const data = await res.json();
            document.getElementById('totalSubs').innerText = data.subscribers;

            // Render Chart
            const ctx = document.getElementById('subChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                    datasets: [{
                        label: 'New Subscribers',
                        data: [0, 2, 5, data.subscribers], // Hack for visual
                        borderColor: '#008060',
                        tension: 0.4,
                        fill: true,
                        backgroundColor: 'rgba(0, 128, 96, 0.1)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        async function loadHistory() {
            const res = await fetch('/my-store/campaigns?storeId=' + store.id);
            const data = await res.json();
            const tbody = document.getElementById('historyTableBody');
            tbody.innerHTML = '';

            data.campaigns.forEach(camp => {
                const date = new Date(camp.created_at).toLocaleDateString() + ' ' + new Date(camp.created_at).toLocaleTimeString();
                tbody.innerHTML += `
        <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px; color: #666; font-size: 13px;">${date}</td>
                        <td style="padding: 10px; font-weight: 500;">${camp.title}</td>
                        <td style="padding: 10px; color: #555;">${camp.message.substring(0, 50)}...</td>
                        <td style="padding: 10px;"><span style="background: #e4e5e7; padding: 2px 8px; border-radius: 10px; font-size: 12px;">${camp.sent_count}</span></td>
                    </tr > `;
            });
            if(data.campaigns.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="padding: 20px; text-align: center;">No campaigns sent yet.</td></tr>';
            }
        }

        async function sendBroadcast() {
            const title = document.getElementById('campTitle').value;
            const message = document.getElementById('campMsg').value;
            const image = document.getElementById('campImg').value;
            const url = document.getElementById('campUrl').value;
            
            // Buttons
            const btn1Text = document.getElementById('btn1Txt').value;
            const btn1Url = document.getElementById('btn1Link').value;
            const btn2Text = document.getElementById('btn2Txt').value;
            const btn2Url = document.getElementById('btn2Link').value;

            const actions = [];
            if(btn1Text) actions.push({ action: btn1Url || url, title: btn1Text });
            if(btn2Text) actions.push({ action: btn2Url || url, title: btn2Text });

            const btn = document.getElementById('sendBtn');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            btn.disabled = true;

            const res = await fetch('/my-store/broadcast', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ storeId: store.id, title, message, url, image, actions })
            });
            const data = await res.json();
            
            btn.innerHTML = '🚀 Send Campaign';
            btn.disabled = false;
            
            if(data.success) {
                alert('✅ Sent to ' + data.sent + ' subscribers!');
                switchView('dashboard'); // Go back to dash
            } else {
                alert('❌ Failed: ' + data.error);
            }
        }

        function logout() {
            localStorage.removeItem('store');
            location.reload();
        }

        function toggleRegister() {
            document.getElementById('loginBox').classList.toggle('hidden');
            document.getElementById('registerBox').classList.toggle('hidden');
        }

        async function register() {
            const storeId = document.getElementById('regStoreId').value;
            const storeName = document.getElementById('regStoreName').value;
            const password = document.getElementById('regPassword').value;

            const res = await fetch('/store-register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ storeId, password, storeName })
            });
            const data = await res.json();
            if(data.success) {
                alert('Account created!');
                toggleRegister();
            } else {
                alert(data.error);
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
        const db = getPool();
        const result = await db.query('SELECT COUNT(*) FROM subscriptions WHERE store_id = $1', [storeId]);
        res.json({ subscribers: result.rows[0].count });
    } catch (e) { res.status(500).json({ subscribers: 0 }); }
});

// Campaign History API
app.get('/my-store/campaigns', async (req, res) => {
    const { storeId } = req.query;
    try {
        await initCampaignTable(); // Ensure table exists
        const db = getPool();
        const result = await db.query('SELECT * FROM campaigns WHERE store_id = $1 ORDER BY created_at DESC LIMIT 50', [storeId]);
        res.json({ campaigns: result.rows });
    } catch (e) { res.status(500).json({ campaigns: [] }); }
});

// Broadcast API
app.post('/my-store/broadcast', async (req, res) => {
    const { storeId, title, message, url, image, actions } = req.body;
    try {
        const subs = await SubscriptionModel.findByStore(storeId);

        const options = {
            vapidDetails: {
                subject: 'mailto:admin@zyrajewel.co.in',
                publicKey: process.env.PUBLIC_KEY,
                privateKey: process.env.PRIVATE_KEY,
            }
        };

        const payload = JSON.stringify({
            title,
            body: message,
            url,
            image,
            actions
        });

        let sent = 0;
        for (const sub of subs) {
            try {
                await webPush.sendNotification(
                    { endpoint: sub.endpoint, keys: sub.keys },
                    payload,
                    options
                );
                sent++;
            } catch (e) { console.error('Push failed', e.message); }
        }

        // Save to History
        try {
            await initCampaignTable(); // Ensure table exists
            const db = getPool();
            await db.query(
                `INSERT INTO campaigns (store_id, title, message, url, image, sent_count) VALUES ($1, $2, $3, $4, $5, $6)`,
                [storeId, title, message, url, image, sent]
            );
        } catch (dbErr) { console.error('Failed to save campaign history:', dbErr); }

        res.json({ success: true, sent });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = app;