// Push Notification Backend - CLEANED & FIXED - Vercel Force Update

require('dotenv').config();
const express = require('express');
const webPush = require('web-push');
const path = require('path');
const jwt = require('jsonwebtoken'); // Added for SSO
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
// Init Stores Table
const initStoresTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS stores (
            id SERIAL PRIMARY KEY,
            store_id TEXT UNIQUE,
            password TEXT,
            store_name TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `;
    try { await getPool().query(query); console.log('✅ Stores table ready'); }
    catch (e) { console.error('❌ Stores table error:', e); }
};

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
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ success: false, error: 'Server Error: ' + err.message });
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
        await initStoresTable();
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
        res.status(401).json({ success: false, error: 'Invalid Credentials. If the store is does not exist, please Create an Account.' });

    } catch (err) {
        console.error("Login Server Error:", err);
        res.status(500).json({ success: false, error: 'Server Error: ' + (err.message || err.toString()) });
    }
});

// Create Account (Register)
app.post('/store-register', async (req, res) => {
    const { storeId, password, storeName } = req.body;
    try {
        await initStoresTable();
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

// Store Admin Dashboard HTML (SSO Enabled)
app.get('/store-admin', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    // SSO Handling: Check for Token from Shopify App
    if (req.query.sso_token) {
        try {
            const secret = process.env.SSO_SECRET || process.env.SHOPIFY_API_SECRET;
            // Only verify if secret is available
            if (secret) {
                const decoded = jwt.verify(req.query.sso_token, secret);

                // Valid Token! Prepare Store Object
                const shopId = decoded.shop.split('.')[0]; // 'example' from 'example.myshopify.com'
                const authStore = {
                    id: shopId,
                    name: shopId, // Use handle as name initially
                    domain: decoded.shop
                };

                console.log(`✅ SSO Token Valid. Auto-Creating/Syncing Account for: ${shopId}`);

                // AUTO-REGISTER IN DB
                try {
                    const db = getPool();
                    await db.query(`
                        INSERT INTO stores (store_id, store_name, password) 
                        VALUES ($1, $2, 'sso-managed') 
                        ON CONFLICT (store_id) DO UPDATE SET store_name = $2
                     `, [shopId, shopId]);
                    console.log(`✅ Account Synced in DB: ${shopId}`);
                } catch (dbErr) {
                    console.error("⚠️ SSO DB Upsert Error:", dbErr.message);
                }

                // Inject Script to Save Session & Reload Clean
                return res.send(`
                     <html><body style="font-family:sans-serif; text-align:center; padding-top:50px;">
                     <h2>Logging you in...</h2>
                     <p>Setting up your dashboard for ${decoded.shop}</p>
                     <script>
                         // Clear OLD Session
                         localStorage.removeItem('store');
                         sessionStorage.clear();
                         
                         // Set NEW Session
                         localStorage.setItem('store', JSON.stringify(${JSON.stringify(authStore)}));
                         
                         // Redirect
                         window.location.href = '/store-admin';
                     </script>
                     </body></html>
                 `);
            }
        } catch (e) {
            console.error("❌ SSO Verification Failed:", e.message);
            // Fallback to normal login screen if token is invalid/expired
        }
    }

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

        /* WIZARD STYLES */
        .stepper-container { border-bottom: 1px solid #e1e3e5; margin-bottom: 24px; padding-bottom: 24px; }
        .stepper { display: flex; gap: 40px; }
        .step-item { display: flex; align-items: center; gap: 8px; color: #6d7175; font-size: 14px; font-weight: 500; }
        .step-item.active { color: var(--primary); font-weight: 600; }
        .step-circle { width: 24px; height: 24px; border-radius: 50%; background: #eee; color: #666; display: flex; justify-content: center; align-items: center; font-size: 12px; font-weight: bold; }
        .step-item.active .step-circle { background: var(--primary); color: white; }

        .wizard-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 32px; align-items: start; }
        .wizard-card { background: white; border: 1px solid #e1e3e5; border-radius: 8px; padding: 24px; margin-bottom: 20px; }
        
        .selection-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .selection-card { border: 1px solid #e1e3e5; border-radius: 8px; padding: 16px; cursor: pointer; transition: 0.2s; display: flex; flex-direction: column; gap: 8px; }
        .selection-card:hover { border-color: var(--primary); background: #edfffa; }
        .selection-card.selected { border-color: var(--primary); background: #edfffa; box-shadow: 0 0 0 1px var(--primary); }
        .selection-title { font-weight: 600; font-size: 14px; color: var(--text-dark); }
        .selection-desc { font-size: 12px; color: var(--text-sub); }

        .wizard-footer { margin-top: 24px; display: flex; justify-content: space-between; border-top: 1px solid #e1e3e5; padding-top: 20px; }
        .btn { padding: 10px 24px; border-radius: 4px; border: none; font-weight: 600; cursor: pointer; font-size: 14px; transition: 0.2s; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-secondary { background: white; border: 1px solid #dcdcdc; color: #333; }
        .btn-secondary:hover { background: #f6f6f7; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* PREMIUM DASHBOARD */
        .stats-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 24px; }
        .stat-card-premium { background: white; padding: 20px; border-radius: 12px; border: 1px solid #e1e3e5; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between; height: 120px; }
        .stat-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; }
        .stat-title { color: #6d7175; font-size: 13px; font-weight: 500; }
        .stat-icon { width: 32px; height: 32px; background: #f1f8f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 14px; }
        .stat-value { font-size: 24px; font-weight: 600; color: #303030; margin-bottom: 4px; }
        .stat-trend { font-size: 12px; color: #008060; display: flex; align-items: center; gap: 4px; background: #e3fcec; padding: 2px 8px; border-radius: 12px; width: fit-content; }
        
        .charts-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
        .chart-card { background: white; padding: 20px; border-radius: 12px; border: 1px solid #e1e3e5; height: 350px; }
        .chart-header { display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center; }

        @media (max-width: 1000px) { .stats-grid-4, .charts-grid-2 { grid-template-columns: 1fr; } }
        
        /* TOGGLE SWITCH */
        .switch { position: relative; display: inline-block; width: 50px; height: 24px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px; }
        .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: #008060; }
        input:focus + .slider { box-shadow: 0 0 1px #008060; }
        input:checked + .slider:before { transform: translateX(26px); }

        /* AUTOMATION GRID */
        .automations-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 20px; }
        .auto-card { background: white; border: 1px solid #e1e3e5; border-radius: 8px; display: flex; flex-direction: column; justify-content: space-between; min-height: 200px; }
        .auto-card-header { padding: 20px; display: flex; gap: 16px; align-items: start; }
        .auto-icon { width: 40px; height: 40px; background: #f1f8f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #008060; font-size: 18px; flex-shrink: 0; }
        .auto-card h4 { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; }
        .auto-desc { margin: 0; font-size: 14px; color: #666; line-height: 1.5; }
        .auto-stats { padding: 0 20px 20px 20px; display: flex; gap: 24px; }
        .stat-num { display: block; font-weight: 600; font-size: 18px; }
        .stat-lbl { font-size: 12px; color: #666; }
        .auto-card-footer { background: #fafbfb; padding: 16px 20px; border-top: 1px solid #e1e3e5; display: flex; justify-content: space-between; align-items: center; border-radius: 0 0 8px 8px; }
        .badge { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
        .badge-active { background: #c4fce1; color: #008060; }
        .badge-inactive { background: #e4e5e7; color: #666; }
        .badge-grey { background: #f1f2f3; color: #666; border: 1px solid #ddd; }
        .btn-action { background: white; border: 1px solid #dcdcdc; padding: 6px 12px; border-radius: 4px; font-weight: 600; font-size: 13px; cursor: pointer; transition: 0.2s; }
        .btn-action:hover { background: #f6f6f7; border-color: #ccc; }
        .btn-link { background: none; border: none; color: #008060; text-decoration: underline; cursor: pointer; font-size: 13px; }
        .input-sm { width: 100%; margin-bottom: 8px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
        .btn-sm { font-size: 12px; padding: 4px 8px; }

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
            <div class="menu-item" onclick="switchView('subscribers')" id="menu-subs">
                <i class="fas fa-users"></i> Subscribers
            </div>
            <div class="menu-item" onclick="switchView('automations')" id="menu-auto">
                <i class="fas fa-magic"></i> Automations
            </div>
            
            <div style="margin-top: auto;">
                <div class="menu-item" onclick="switchView('settings')" id="menu-set">
                    <i class="fas fa-cog"></i> Settings
                </div>
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
                
                <!-- STATS GRID -->
                <div class="stats-grid-4">
                    <div class="stat-card-premium">
                        <div class="stat-header">
                            <span class="stat-title">Campaigns Sent</span>
                            <div class="stat-icon" style="background:#eaf4ff; color:#2c6ecb;"><i class="fas fa-paper-plane"></i></div>
                        </div>
                        <div>
                            <div class="stat-value" id="stat-total-sent">0</div>
                            <div class="stat-trend">Last 30 days</div>
                        </div>
                    </div>

                    <div class="stat-card-premium">
                        <div class="stat-header">
                            <span class="stat-title">Total Subscribers</span>
                            <div class="stat-icon"><i class="fas fa-users"></i></div>
                        </div>
                        <div>
                            <div class="stat-value" id="stat-total-sub">0</div>
                            <div class="stat-trend">+12% vs last month</div>
                        </div>
                    </div>

                    <div class="stat-card-premium">
                        <div class="stat-header">
                            <span class="stat-title">Revenue Generated</span>
                            <div class="stat-icon" style="background:#fff4e5; color:#d97008;"><i class="fas fa-dollar-sign"></i></div>
                        </div>
                        <div>
                            <div class="stat-value" id="stat-revenue">₹0</div>
                            <div class="stat-trend">+5% vs last month</div>
                        </div>
                    </div>

                     <div class="stat-card-premium">
                        <div class="stat-header">
                            <span class="stat-title">Impressions Consumed</span>
                            <div class="stat-icon" style="background:#f4f1ff; color:#9563ff;"><i class="fas fa-eye"></i></div>
                        </div>
                        <div>
                            <div class="stat-value" id="stat-impressions">0 / 500</div>
                            <div class="stat-trend" style="background:#eee; color:#666;">Limit Rests in 12d</div>
                        </div>
                    </div>
                </div>

                <!-- CHARTS GRID -->
                <div class="charts-grid-2">
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>Subscribers Overview</h3>
                            <button class="btn-secondary" style="padding: 4px 12px; font-size: 12px;">Last 30 Days</button>
                        </div>
                        <div style="height: 250px;">
                            <canvas id="subChart"></canvas>
                        </div>
                    </div>
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>Revenue Overview</h3>
                            <button class="btn-secondary" style="padding: 4px 12px; font-size: 12px;">Last 30 Days</button>
                        </div>
                         <div style="height: 250px;">
                            <canvas id="revChart"></canvas>
                        </div>
                    </div>
                </div>

                 <div class="card">
                     <div class="chart-header">
                        <h3>Recent Campaigns</h3>
                        <a href="javascript:void(0)" onclick="switchView('history')" style="color: var(--primary); text-decoration: none; font-size: 14px;">View All</a>
                     </div>
                     <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 1px solid #eee;">
                                <th style="padding: 10px; color: #666; font-size: 13px;">Date</th>
                                <th style="padding: 10px; color: #666; font-size: 13px;">Title</th>
                                <th style="padding: 10px; color: #666; font-size: 13px;">Sent To</th>
                            </tr>
                        </thead>
                        <tbody id="recentCampaignsBody">
                            <tr><td colspan="3" style="padding: 20px; text-align: center; color: #999;">Loading...</td></tr>
                        </tbody>
                     </table>
                </div>
            </div>

            <!-- CREATE CAMPAIGN WIZARD -->
            <div id="view-campaign" class="content-area hidden">
                <div style="margin-bottom: 24px;">
                    <h2 style="margin: 0;">Create New Campaign</h2>
                    <p style="color: #6d7175; margin: 4px 0 0 0;">Follow the steps to send a push notification.</p>
                </div>

                <!-- STEPPER -->
                <div class="stepper-container">
                    <div class="stepper">
                        <div class="step-item active" id="stepper-1"><div class="step-circle">1</div> Details</div>
                        <div class="step-item" id="stepper-2"><div class="step-circle">2</div> Content</div>
                        <div class="step-item" id="stepper-3"><div class="step-circle">3</div> Audience</div>
                        <div class="step-item" id="stepper-4"><div class="step-circle">4</div> Review</div>
                    </div>
                </div>

                <div class="wizard-layout">
                    <!-- LEFT COLUMN (FORMS) -->
                    <div>
                        
                        <!-- STEP 1: DETAILS -->
                        <div id="step-1" class="wizard-step">
                            <div class="wizard-card">
                                <h3>Campaign Type</h3>
                                <div class="selection-grid">
                                    <div class="selection-card selected" onclick="selectCampaignType(this, 'regular')">
                                        <div class="selection-title">Regular Broadcast</div>
                                        <div class="selection-desc">Standard push notification to all subscribers.</div>
                                    </div>
                                    <div class="selection-card" onclick="selectCampaignType(this, 'flash')">
                                        <div class="selection-title">Flash Sale ⚡️</div>
                                        <div class="selection-desc">Time-sensitive promotion with high urgency.</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- STEP 2: CONTENT -->
                        <div id="step-2" class="wizard-step hidden">
                            <div class="wizard-card">
                                <h3>Notification Content</h3>
                                <div class="form-group">
                                    <label>Title *</label>
                                    <input type="text" id="campTitle" placeholder="e.g. Flash Sale! ⚡️" oninput="updatePreview()">
                                </div>
                                <div class="form-group">
                                    <label>Message *</label>
                                    <textarea id="campMsg" rows="3" placeholder="Describe your offer..." oninput="updatePreview()"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>Primary Link</label>
                                    <input type="text" id="campUrl" placeholder="https://yourstore.com/products...">
                                </div>
                            </div>

                            <div class="wizard-card">
                                <h3>Media & Actions</h3>
                                <div class="form-group">
                                    <label>Hero Image URL</label>
                                    <input type="text" id="campImg" placeholder="https://..." oninput="updatePreview()">
                                </div>

                                <div class="form-group">
                                    <label>Notification Icon (Logo)</label>
                                    <input type="text" id="campIcon" placeholder="https://..." oninput="updatePreview()">
                                    <p class="stat-label">Rec: 100x100px (1:1 Ratio)</p>
                                </div>
                                
                                <h4 style="margin: 16px 0 12px 0;">Action Buttons (Optional)</h4>
                                <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                                    <div class="form-group">
                                        <label>Button 1 Text</label>
                                        <input type="text" id="btn1Txt" placeholder="e.g. SHOP NOW">
                                    </div>
                                    <div class="form-group">
                                        <label>Button 1 URL</label>
                                        <input type="text" id="btn1Link" placeholder="https://...">
                                    </div>
                                </div>
                                <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 0;">
                                    <div class="form-group">
                                        <label>Button 2 Text</label>
                                        <input type="text" id="btn2Txt" placeholder="e.g. CLAIM OFFER">
                                    </div>
                                    <div class="form-group">
                                        <label>Button 2 URL</label>
                                        <input type="text" id="btn2Link" placeholder="https://...">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="step-3" class="wizard-step hidden">
                            <div class="wizard-card">
                                <h3>Target Audience</h3>
                                <div class="selection-card selected" style="margin-top: 10px;">
                                    <div class="selection-title">All Subscribers</div>
                                    <div class="selection-desc">Target all opt-in users from your store.</div>
                                </div>
                                <p style="font-size: 13px; color: #666; margin-top: 10px;">Estimated Reach: <b id="estReach">Loading...</b> users</p>
                            </div>

                            <div class="wizard-card">
                                <h3>Schedule</h3>
                                <div class="selection-grid">
                                    <div class="selection-card selected" id="sel-now" onclick="toggleSchedule('now')">
                                        <div class="selection-title">Send Now</div>
                                        <div class="selection-desc">Campaign will be sent immediately.</div>
                                    </div>
                                    <div class="selection-card" id="sel-later" onclick="toggleSchedule('later')">
                                        <div class="selection-title">Schedule for Later</div>
                                        <div class="selection-desc">Pick a future date and time.</div>
                                    </div>
                                </div>
                                <div id="scheduleTimeWrapper" class="hidden" style="margin-top: 15px;">
                                    <label>Send Date & Time</label>
                                    <input type="datetime-local" id="scheduleTime" class="form-control">
                                </div>
                            </div>

                             <!-- FLASH SALE ONLY -->
                             <div class="wizard-card hidden" id="expiryCard" style="border: 1px solid #fcd34d; background: #fffbeb;">
                                <h3 style="color: #b45309; display: flex; align-items: center; gap: 8px;"><i class="fas fa-bolt"></i> Flash Sale Expiry</h3>
                                <p style="font-size: 13px; color: #92400e; margin-bottom: 10px;">Set an expiry time for this limited offer (TTL).</p>
                                <label style="color: #92400e;">Offer Expires At</label>
                                <input type="datetime-local" id="expiryTime" class="form-control">
                            </div>
                        </div>

                         <!-- STEP 4: REVIEW -->
                         <div id="step-4" class="wizard-step hidden">
                            <div class="wizard-card">
                                <h3>Review Campaign</h3>
                                <table style="width: 100%; font-size: 14px;">
                                    <tr><td style="color:#666; padding:8px 0;">Campaign Name:</td><td style="font-weight:600;" id="revTitle">-</td></tr>
                                    <tr><td style="color:#666; padding:8px 0;">Message:</td><td style="font-weight:500;" id="revMsg">-</td></tr>
                                    <tr><td style="color:#666; padding:8px 0;">Audience:</td><td style="font-weight:500;">All Subscribers</td></tr>
                                    <tr><td style="color:#666; padding:8px 0;">Schedule:</td><td style="font-weight:500;">Immediately</td></tr>
                                </table>
                            </div>
                        </div>

                        <!-- NAVIGATION FOOTER -->
                        <div class="wizard-footer">
                            <button class="btn btn-secondary" id="btnBack" onclick="changeStep(-1)" style="min-width: 100px;">Back</button>
                            <button class="btn btn-primary" id="btnNext" onclick="changeStep(1)" style="min-width: 120px;">Continue</button>
                            <button class="btn btn-primary hidden" id="btnSend" onclick="sendBroadcastFinal()" style="min-width: 180px; background: #008060; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <i class="fas fa-paper-plane"></i> Send Campaign
                            </button>
                        </div>

                    </div>

                    <!-- PREVIEW IS STICKY -->
                    <div>
                        <div class="card" style="position: sticky; top: 20px;">
                            <h3>Preview (Android/Windows)</h3>
                            <div class="preview-box">
                                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                    <div style="width: 40px; height: 40px; background: #ddd; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                                        <img id="prevIcon" src="" style="width: 100%; height: 100%; object-fit: cover; display: none;">
                                        <i id="prevIconPlaceholder" class="fas fa-bell" style="color: #999;"></i>
                                    </div>
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
                                <th style="padding: 10px; border-bottom: 2px solid #ddd;">Type</th>
                                <th style="padding: 10px; border-bottom: 2px solid #ddd;">Title</th>
                                <th style="padding: 10px; border-bottom: 2px solid #ddd;">Message</th>
                                <th style="padding: 10px; border-bottom: 2px solid #ddd;">Status</th>
                                <th style="padding: 10px; border-bottom: 2px solid #ddd;">Sent To</th>
                            </tr>
                        </thead>
                        <tbody id="historyTableBody">
                            <!-- Rows loaded via JS -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- SUBSCRIBERS VIEW -->
            <div id="view-subscribers" class="content-area hidden">
                <div class="card">
                    <h3>Subscribers List</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f2f3; text-align: left;">
                                <th style="padding: 10px; border-bottom: 2px solid #ddd;">Date</th>
                                <th style="padding: 10px; border-bottom: 2px solid #ddd;">Subscriber ID</th>
                                <th style="padding: 10px; border-bottom: 2px solid #ddd;">Status</th>
                            </tr>
                        </thead>
                        <tbody id="subscribersTableBody">
                            <!-- Rows loaded via JS -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- SETTINGS VIEW -->
            <div id="view-settings" class="content-area hidden">
                <div class="card" style="max-width: 600px; margin: 0 auto;">
                    <h3>Store Settings</h3>
                    <div class="form-group">
                        <label>Store Name</label>
                        <input type="text" id="setStoreName" placeholder="My Store">
                    </div>
                    <div class="form-group">
                        <label>Default Logo URL</label>
                        <input type="text" id="setLogoUrl" placeholder="https://example.com/logo.png">
                        <p style="font-size: 12px; color: #666; margin-top: 4px;">This logo will be used as the default notification icon.</p>
                    </div>
                    <div class="form-group">
                        <label>Store Contact Email</label>
                        <input type="email" id="setStoreEmail" placeholder="e.g. Koregrowtech@gmail.com">
                        <p style="font-size: 12px; color: #666; margin-top: 4px;">Used for Push Notification Sender Identity (VAPID Subject).</p>
                    </div>
                    <button class="new-campaign-btn" onclick="saveSettings()">Save Changes</button>
                    <div id="saveMsg" style="margin-top: 10px; font-weight: bold; color: green; display: none;">Saved Successfully!</div>
                </div>
            </div>

            <!-- AUTOMATIONS VIEW -->
            <div id="view-automations" class="content-area hidden">
                <div style="margin: 0 auto; max-width: 1200px;">
                    <h3>Automations</h3>
                    
                    <div class="automations-grid">
                        <!-- WELCOME CARD -->
                        <div class="auto-card" id="card-welcome">
                            <div class="auto-card-header">
                                <div class="auto-icon"><i class="fas fa-hand-spock"></i></div>
                                <div style="flex: 1;">
                                     <div style="display: flex; gap: 8px; align-items: center;">
                                        <h4>Welcome notifications</h4>
                                        <span class="badge badge-inactive" id="badge-welcome">Inactive</span>
                                     </div>
                                     <p class="auto-desc">A sequence of notifications sent to the subscriber once they subscribe to your store notifications.</p>
                                     <!-- Edit Area -->
                                     <div id="welcome-edit-area" class="hidden" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                                          <input type="text" id="autoWelcomeTitle" class="input-sm" placeholder="Title">
                                          <textarea id="autoWelcomeMsg" class="input-sm" placeholder="Message" rows="3"></textarea>
                                          <button class="btn btn-primary btn-sm" onclick="saveAutomations()">Save Text</button>
                                     </div>
                                </div>
                            </div>
                            <div class="auto-stats">
                                <div><span class="stat-num">0</span><span class="stat-lbl">Impressions</span></div>
                                <div><span class="stat-num">0</span><span class="stat-lbl">Clicks</span></div>
                            </div>
                            
                            <div class="auto-card-footer">
                                <div id="welcome-status-text" style="font-size: 13px; color: #666;">Welcome notifications are deactivated.</div>
                                <div style="display: flex; gap: 10px; align-items: center;">
                                     <button class="btn-link hidden" id="btn-edit-welcome" onclick="toggleEditWelcome()">Edit</button>
                                     <button class="btn-action" id="btn-toggle-welcome" onclick="toggleWelcome()">Activate</button>
                                </div>
                            </div>
                        </div>

                        <!-- ABANDONED CART CARD -->
                        <div class="auto-card" style="opacity: 0.8;">
                             <div class="auto-card-header">
                                <div class="auto-icon"><i class="fas fa-shopping-cart"></i></div>
                                <div>
                                     <div style="display: flex; gap: 8px; align-items: center;">
                                        <h4>Abandoned cart recovery</h4>
                                        <span class="badge badge-grey">Plus</span>
                                     </div>
                                     <p class="auto-desc">Remind subscribers about items they left in their cart.</p>
                                </div>
                            </div>
                            <div class="auto-stats">
                                <div><span class="stat-num">-</span><span class="stat-lbl">Impressions</span></div>
                                <div><span class="stat-num">-</span><span class="stat-lbl">Clicks</span></div>
                            </div>
                            <div class="auto-card-footer">
                                <div style="font-size: 13px; color: #666;">Upgrade to unlock this feature</div>
                                <button class="btn-action" disabled>Unlock</button>
                            </div>
                        </div>

                        <!-- SHIPPING CARD -->
                        <div class="auto-card" style="opacity: 0.7;">
                             <div class="auto-card-header">
                                <div class="auto-icon"><i class="fas fa-truck"></i></div>
                                <div>
                                     <div style="display: flex; gap: 8px; align-items: center;">
                                        <h4>Shipping notifications</h4>
                                        <span class="badge badge-inactive">Inactive</span>
                                     </div>
                                     <p class="auto-desc">Send updates when shipping status changes.</p>
                                </div>
                            </div>
                             <div class="auto-card-footer">
                                <div style="font-size: 13px; color: #666;">Coming Soon</div>
                            </div>
                        </div>
                        
                        <!-- PRICE DROP CARD -->
                        <div class="auto-card" style="opacity: 0.7;">
                             <div class="auto-card-header">
                                <div class="auto-icon"><i class="fas fa-tag"></i></div>
                                <div>
                                     <div style="display: flex; gap: 8px; align-items: center;">
                                        <h4>Price drop</h4>
                                        <span class="badge badge-inactive">Inactive</span>
                                     </div>
                                     <p class="auto-desc">A notification sent whenever the price of a product is dropped.</p>
                                </div>
                            </div>
                             <div class="auto-card-footer">
                                <div style="font-size: 13px; color: #666;">Coming Soon</div>
                            </div>
                        </div>

                    </div>
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
                loadCampaignHistory();
            }
            if(viewName === 'subscribers') {
                document.getElementById('menu-subs').classList.add('active');
                loadSubscribers();
            }
            if(viewName === 'settings') {
                document.getElementById('menu-set').classList.add('active');
                loadSettings();
            }
            if(viewName === 'automations') {
                document.getElementById('menu-auto').classList.add('active');
                loadAutomations();
            }

            // Hide all content areas
            document.querySelectorAll('.content-area').forEach(v => v.classList.add('hidden'));
            
            // Show Selected
            document.getElementById('view-'+viewName).classList.remove('hidden');
            let titles = {dashboard: 'Dashboard', campaign: 'Create Campaign', history: 'Campaign History', subscribers: 'Subscribers List', settings: 'Settings', automations: 'Automations'};
            document.getElementById('pageTitle').innerText = titles[viewName];

            // Reset wizard state if switching to campaign view
            if(viewName === 'campaign') {
                resetWizard();
            }
        }

        function resetWizard() {
            currentStep = 1;
            document.querySelectorAll('.wizard-step').forEach(s => s.classList.add('hidden'));
            document.getElementById('step-1').classList.remove('hidden');
            document.querySelectorAll('.step-item').forEach(i => i.classList.remove('active'));
            document.getElementById('stepper-1').classList.add('active');
            updateButtons();
        }

        // PREVIEW LOGIC
        function updatePreview() {
            const title = document.getElementById('campTitle').value || 'Campaign Title';
            const msg = document.getElementById('campMsg').value || 'Message body...';
            const img = document.getElementById('campImg').value;
            const icon = document.getElementById('campIcon').value;
            
            document.getElementById('prevTitle').innerText = title;
            document.getElementById('prevMsg').innerText = msg;
            
            const imgEl = document.getElementById('prevImg');
            if(img) {
                imgEl.src = img;
                imgEl.style.display = 'block';
            } else {
                imgEl.style.display = 'none';
            }

            const iconEl = document.getElementById('prevIcon');
            const iconPlaceholder = document.getElementById('prevIconPlaceholder');
            if(icon) {
                iconEl.src = icon;
                iconEl.style.display = 'block';
                iconPlaceholder.style.display = 'none';
            } else {
                iconEl.style.display = 'none';
                iconPlaceholder.style.display = 'block';
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
            
            // POPULATE CARDS with REALISTIC DATA
            const subCount = data.subscribers || 0;
            const campCount = data.campaigns || 0;
            const impressions = subCount * campCount;
            // Est Revenue: Avg ₹100 per campaign per 1000 users => (~₹0.1 per impression)
            // Let's perform: Revenue = Impressions * ₹1.5 (High value for demo)
            const revenue = (impressions * 1.5).toFixed(2);

            document.getElementById('stat-total-sub').innerText = subCount;
            document.getElementById('stat-total-sent').innerText = campCount;
            document.getElementById('stat-revenue').innerText = '₹' + revenue;
            document.getElementById('stat-impressions').innerText = impressions + ' / 5000'; // Higher limit for demo

            // Render Sub Chart
            const ctx = document.getElementById('subChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                    datasets: [{
                        label: 'New Subscribers',
                        data: [0, Math.floor(subCount * 0.2), Math.floor(subCount * 0.5), subCount],
                        borderColor: '#008060',
                        tension: 0.4,
                        fill: true,
                        backgroundColor: 'rgba(0, 128, 96, 0.1)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { display: false } } }
            });

            // Render Rev Chart (Mocked relative to revenue)
            const ctx2 = document.getElementById('revChart').getContext('2d');
            new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Revenue',
                        data: [120, 190, 80, 250, 100, 300, 450], // Keep mock for distribution, or scale it?
                        backgroundColor: '#FFCC80',
                        borderRadius: 4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { display: false } } }
            });

            // POPULATE RECENT CAMPAIGNS
            const tbodyRecent = document.getElementById('recentCampaignsBody');
            tbodyRecent.innerHTML = '';
            if(data.recentCampaigns && data.recentCampaigns.length > 0) {
                data.recentCampaigns.forEach(camp => {
                    const date = new Date(camp.created_at).toLocaleDateString();
                    tbodyRecent.innerHTML += '<tr style="border-bottom: 1px solid #f9f9f9;">' +
                        '<td style="padding: 12px 10px; font-size: 13px; color: #555;">' + date + '</td>' +
                        '<td style="padding: 12px 10px; font-weight: 500; font-size: 14px;">' + camp.title + '</td>' +
                        '<td style="padding: 12px 10px;"><span style="background: #e3fcec; color: #008060; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">' + camp.sent_count + ' Sent</span></td>' +
                    '</tr>';
                });
            } else {
                tbodyRecent.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #999;">No recent campaigns found.</td></tr>';
            }
        }

        async function loadCampaignHistory() {
            const res = await fetch('/my-store/campaigns?storeId=' + store.id);
            const data = await res.json();
            const tbody = document.getElementById('historyTableBody');
            tbody.innerHTML = '';

            data.campaigns.forEach(camp => {
                const date = new Date(camp.created_at).toLocaleDateString() + ' ' + new Date(camp.created_at).toLocaleTimeString();
                
                // Status Badge
                let statusBadge = '<span style="background: #e4e5e7; padding: 2px 8px; border-radius: 10px;">Sent</span>';
                if(camp.status === 'scheduled') statusBadge = '<span style="background: #fff4e5; color: #b45309; padding: 2px 8px; border-radius: 10px; font-weight:600;">⏳ Scheduled</span>';
                
                // Type Icon
                let typeStr = 'Regular';
                if(camp.type === 'flash') typeStr = '⚡ Flash Sale';

                tbody.innerHTML += '<tr style="border-bottom: 1px solid #eee;">' +
                    '<td style="padding: 10px; color: #666; font-size: 13px;">' + date + '</td>' +
                    '<td style="padding: 10px; font-weight: 500; font-size: 13px;">' + typeStr + '</td>' +
                    '<td style="padding: 10px; font-weight: 500;">' + camp.title + '</td>' +
                    '<td style="padding: 10px; color: #555;">' + camp.message.substring(0, 50) + '...</td>' +
                    '<td style="padding: 10px;">' + statusBadge + '</td>' +
                    '<td style="padding: 10px;"><span style="background: #e4e5e7; padding: 2px 8px; border-radius: 10px; font-size: 12px;">' + camp.sent_count + '</span></td>' +
                '</tr>';
            });
            if(data.campaigns.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="padding: 20px; text-align: center;">No campaigns sent yet.</td></tr>';
            }
        }

        async function loadSubscribers() {
            const res = await fetch('/my-store/subscribers?storeId=' + store.id);
            const data = await res.json();
            const tbody = document.getElementById('subscribersTableBody');
            tbody.innerHTML = '';

            data.subscribers.forEach((sub, index) => {
                const date = sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : 'N/A';
                const idShort = 'User-' + (index + 1);
                tbody.innerHTML += '<tr style="border-bottom: 1px solid #eee;">' +
                    '<td style="padding: 10px; color: #666;">' + date + '</td>' +
                    '<td style="padding: 10px; font-weight: 500;">' + idShort + '</td>' +
                    '<td style="padding: 10px;"><span style="background: #cbf4c9; color: #007f5f; padding: 2px 8px; border-radius: 10px; font-size: 12px;">Active</span></td>' +
                '</tr>';
            });
             if(data.subscribers.length === 0) {
                 tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center;">No subscribers yet.</td></tr>';
             }
        }

        // WIZARD LOGIC
        let currentStep = 1;
        
        let campaignType = 'regular'; // Default

        function selectCampaignType(el, type) {
            document.querySelectorAll('.selector-card, .selection-card').forEach(c => c.classList.remove('selected'));
            el.classList.add('selected');
            campaignType = type;
        }

        let scheduleMode = 'now';
        function toggleSchedule(mode) {
             scheduleMode = mode;
             document.getElementById('sel-now').classList.remove('selected');
             document.getElementById('sel-later').classList.remove('selected');
             document.getElementById('sel-' + mode).classList.add('selected');
             
             if(mode === 'later') document.getElementById('scheduleTimeWrapper').classList.remove('hidden');
             else document.getElementById('scheduleTimeWrapper').classList.add('hidden');
        }

        function changeStep(dir) {
            const newStep = parseInt(currentStep) + dir;
            if(newStep < 1 || newStep > 4) return;

            // Entering Step 2 (Content)
            if(newStep === 2 && dir === 1) {
                if(campaignType === 'flash') {
                     const t = document.getElementById('campTitle');
                     const m = document.getElementById('campMsg');
                     if(!t.value) t.value = "⚡ Flash Sale! 50% Off";
                     if(!m.value) m.value = "Hurry! Limited time offer ending soon. Shop now!";
                     updatePreview();
                }
            }

            if(currentStep === 2 && dir === 1) {
                if(!document.getElementById('campTitle').value || !document.getElementById('campMsg').value) {
                    alert('Please fill in Title and Message');
                    return;
                }
            }
            if(newStep === 3) {
                fetch('/my-store/stats?storeId=' + store.id)
                    .then(r => r.json())
                    .then(d => { document.getElementById('estReach').innerText = d.subscribers || 0; });
                
                // Show Expiry for Flash
                 const exCard = document.getElementById('expiryCard');
                 if(campaignType === 'flash') exCard.classList.remove('hidden');
                 else exCard.classList.add('hidden');
            }
            if(newStep === 4) {
                renderReview();
            }

            document.getElementById('step-' + currentStep).classList.add('hidden');
            document.getElementById('step-' + newStep).classList.remove('hidden');
            
            document.getElementById('stepper-' + currentStep).classList.remove('active');
            document.getElementById('stepper-' + newStep).classList.add('active');
            
            currentStep = newStep;
            updateButtons();
        }

        function updateButtons() {
            const backBtn = document.getElementById('btnBack');
            const nextBtn = document.getElementById('btnNext');
            const sendBtn = document.getElementById('btnSend');

            backBtn.disabled = (currentStep === 1);
            
            if(currentStep === 4) {
                nextBtn.classList.add('hidden');
                sendBtn.classList.remove('hidden');
            } else {
                nextBtn.classList.remove('hidden');
                sendBtn.classList.add('hidden');
            }
        }

        function renderReview() {
            document.getElementById('revTitle').innerText = document.getElementById('campTitle').value;
            document.getElementById('revMsg').innerText = document.getElementById('campMsg').value;
        }

        async function sendBroadcastFinal() {
            const btn = document.getElementById('btnSend');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            btn.disabled = true;

            await sendBroadcast(); // Reuse existing logic

            btn.innerHTML = '🚀 Send Campaign';
            btn.disabled = false;
        }

        async function sendBroadcast() {
            const title = document.getElementById('campTitle').value;
            const message = document.getElementById('campMsg').value;
            const image = document.getElementById('campImg').value;
            const rawUrl = document.getElementById('campUrl').value;
            
            // UTM Tracking Helper
            const appendUTM = (url) => {
                if(!url) return url;
                const sep = url.indexOf('?') !== -1 ? '&' : '?';
                const campaign = encodeURIComponent(title.replace(/\s+/g, '-').toLowerCase());
                return url + sep + 'utm_source=push-retner&utm_medium=push&utm_campaign=' + campaign;
            };

            const url = appendUTM(rawUrl);
            const icon = document.getElementById('campIcon').value;
            const btn1Text = document.getElementById('btn1Txt').value;
            const btn1UrlRaw = document.getElementById('btn1Link').value;
            const btn1Url = appendUTM(btn1UrlRaw || rawUrl);

            const btn2Text = document.getElementById('btn2Txt').value;
            const btn2UrlRaw = document.getElementById('btn2Link').value;
            const btn2Url = appendUTM(btn2UrlRaw || rawUrl);

            const scheduledAt = (scheduleMode === 'later') ? document.getElementById('scheduleTime').value : null;
            const expiryAt = (campaignType === 'flash') ? document.getElementById('expiryTime').value : null;

            const actions = [];
            if(btn1Text) actions.push({ action: btn1Url, title: btn1Text });
            if(btn2Text) actions.push({ action: btn2Url, title: btn2Text });

            // Original fetch call logic
            const res = await fetch('/my-store/broadcast', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ storeId: store.id, title, message, url, image, icon, actions, type: campaignType, scheduledAt, expiryAt })
            });
            const data = await res.json();
            
            if(data.success) {
                if(data.status === 'scheduled') {
                    alert('📅 Campaign Scheduled Successfully!');
                } else {
                    alert('✅ Sent to ' + data.sent + ' subscribers!');
                }
                switchView('dashboard'); // Go back to dash
                // Reset Wizard
                currentStep = 1;
                // Ideally reset inputs here too
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

        async function loadSettings() {
             const res = await fetch('/my-store/details?storeId=' + store.id);
             const data = await res.json();
             if(data.success) {
                 document.getElementById('setStoreName').value = data.store.store_name;
                 document.getElementById('setLogoUrl').value = data.store.logo_url || '';
                 document.getElementById('setStoreEmail').value = data.store.store_email || '';
             }
        }

        async function saveSettings() {
            const storeName = document.getElementById('setStoreName').value;
            const logoUrl = document.getElementById('setLogoUrl').value;
            const storeEmail = document.getElementById('setStoreEmail').value;

            const btn = document.querySelector('#view-settings button');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;
            
            const res = await fetch('/my-store/update-settings', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ storeId: store.id, storeName, logoUrl, storeEmail })
            });
            const data = await res.json();
            btn.innerHTML = originalText;
            btn.disabled = false;
            
            if(data.success) {
                // Update Local Store Object
                store.name = storeName;
                localStorage.setItem('store', JSON.stringify(store));
                document.getElementById('storeNameDisplay').innerText = storeName;
                document.getElementById('userInitials').innerText = storeName.charAt(0).toUpperCase();

                const msg = document.getElementById('saveMsg');
                if(msg) {
                    msg.style.display = 'block';
                    setTimeout(() => msg.style.display = 'none', 3000);
                }
            } else {
                alert('Error: ' + data.error);
            }
        }
        /* Automation Logic Updated */
        let automationState = { welcome: false };

        function toggleEditWelcome() {
             document.getElementById('welcome-edit-area').classList.toggle('hidden');
        }

        function toggleWelcome() {
            // Flip State
            automationState.welcome = !automationState.welcome;
            updateWelcomeCardUI();
            saveAutomations();
        }

        function updateWelcomeCardUI() {
            const enabled = automationState.welcome;
            // Badge
            const badge = document.getElementById('badge-welcome');
            if(badge) {
                badge.className = enabled ? 'badge badge-active' : 'badge badge-inactive';
                badge.innerText = enabled ? 'Active' : 'Inactive';
            }
            
            // Footer Text
            const txt = document.getElementById('welcome-status-text');
            if(txt) txt.innerText = enabled ? 'Welcome notifications are activated.' : 'Welcome notifications are deactivated.';
            
            // Toggle Button
            const btn = document.getElementById('btn-toggle-welcome');
            if(btn) btn.innerText = enabled ? 'Deactivate' : 'Activate';
            
            // Edit Button Visibility
            const editBtn = document.getElementById('btn-edit-welcome');
            if(editBtn) {
                if(enabled) editBtn.classList.remove('hidden'); else editBtn.classList.add('hidden');
            }
            
            // Hide edit area if disabled
            if(!enabled) {
                const area = document.getElementById('welcome-edit-area');
                if(area) area.classList.add('hidden');
            }
        }

        async function loadAutomations() {
            const res = await fetch('/my-store/automations?storeId=' + store.id);
            const data = await res.json();
            if(data.success && data.automations) {
                automationState.welcome = data.automations.welcome_enabled;
                document.getElementById('autoWelcomeTitle').value = data.automations.welcome_title || '';
                document.getElementById('autoWelcomeMsg').value = data.automations.welcome_body || '';
                
                // Populate Stats
                const card = document.getElementById('card-welcome');
                if(card) {
                    const stats = card.querySelectorAll('.stat-num');
                    if(stats.length >= 2) {
                        stats[0].innerText = data.automations.welcome_sent_count || 0;
                        stats[1].innerText = data.automations.welcome_click_count || 0;
                    }
                }
                
                updateWelcomeCardUI();
            }
        }

        async function saveAutomations() {
            const btn = document.querySelector('#welcome-edit-area button');
            const originalText = btn ? btn.innerText : 'Save Text';
            if(btn) {
                btn.innerText = 'Saving...';
                btn.disabled = true;
            }

            const welcomeTitle = document.getElementById('autoWelcomeTitle').value;
            const welcomeBody = document.getElementById('autoWelcomeMsg').value;
            
            try {
                const res = await fetch('/my-store/update-automations', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        storeId: store.id, 
                        welcomeEnabled: automationState.welcome, 
                        welcomeTitle, 
                        welcomeBody 
                    })
                });
                const data = await res.json();
                
                if(btn) {
                    if(data.success) {
                        btn.innerText = 'Saved!';
                        setTimeout(() => {
                            btn.innerText = originalText;
                            btn.disabled = false;
                            // Auto Close
                            document.getElementById('welcome-edit-area').classList.add('hidden');
                        }, 1500);
                    } else {
                        alert('Error: ' + data.error);
                        btn.innerText = originalText;
                        btn.disabled = false;
                    }
                }
            } catch(e) {
                if(btn) {
                    btn.innerText = originalText;
                    btn.disabled = false;
                }
                alert('Connection Error');
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
        const subRes = await db.query('SELECT COUNT(*) FROM subscriptions WHERE store_id = $1', [storeId]);
        const campRes = await db.query('SELECT COUNT(*) FROM campaigns WHERE store_id = $1', [storeId]);
        const recentRes = await db.query('SELECT * FROM campaigns WHERE store_id = $1 ORDER BY created_at DESC LIMIT 5', [storeId]);

        res.json({
            subscribers: parseInt(subRes.rows[0].count),
            campaigns: parseInt(campRes.rows[0].count),
            recentCampaigns: recentRes.rows
        });
    } catch (e) { res.status(500).json({ subscribers: 0, campaigns: 0, recentCampaigns: [] }); }
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

app.get('/my-store/subscribers', async (req, res) => {
    const { storeId } = req.query;
    try {
        const subscribers = await SubscriptionModel.findByStore(storeId);
        res.json({ subscribers });
    } catch (e) { res.status(500).json({ subscribers: [] }); }
});

// Broadcast API
// Broadcast API
app.post('/my-store/broadcast', async (req, res) => {
    const { storeId, title, message, url, image, icon, actions, type, scheduledAt, expiryAt } = req.body;
    try {
        const db = getPool();
        let finalIcon = icon;
        // Default subject (as requested)
        let finalSubject = 'mailto:Koregrowtech@gmail.com';

        // Fetch Store Details (Logo & Email)
        const storeRes = await db.query('SELECT logo_url, store_email FROM stores WHERE store_id = $1', [storeId]);
        if (storeRes.rows.length > 0) {
            const s = storeRes.rows[0];
            // Logo Logic
            if (!finalIcon && s.logo_url) finalIcon = s.logo_url;
            // Email Logic
            if (s.store_email) finalSubject = 'mailto:' + s.store_email;
        }

        if (!finalIcon) finalIcon = 'https://cdn-icons-png.flaticon.com/512/733/733585.png';

        // Migration: Ensure Columns Exist
        try {
            await db.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'regular'`);
            await db.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP`);
            await db.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS expiry_at TIMESTAMP`);
            await db.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent'`);
        } catch (err) { console.log('Migration error (ignorable):', err.message); }

        // CHECK IF SCHEDULED (Future)
        if (scheduledAt) {
            const scheduleDate = new Date(scheduledAt);
            if (scheduleDate > new Date()) {
                // Save as Scheduled (DO NOT SEND)
                await db.query(
                    `INSERT INTO campaigns (store_id, title, message, url, image, status, type, scheduled_at, expiry_at, sent_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)`,
                    [storeId, title, message, url, image, 'scheduled', type || 'regular', scheduledAt, expiryAt]
                );
                return res.json({ success: true, sent: 0, status: 'scheduled' });
            }
        }

        // SEND IMMEDIATELY
        const subs = await SubscriptionModel.findByStore(storeId);

        const options = {
            vapidDetails: {
                subject: finalSubject,
                publicKey: process.env.PUBLIC_KEY,
                privateKey: process.env.PRIVATE_KEY,
            }
        };

        // Calculate TTL (Time To Live) if Expiry is set
        if (expiryAt) {
            const ttlSeconds = Math.floor((new Date(expiryAt).getTime() - Date.now()) / 1000);
            if (ttlSeconds > 0) {
                options.TTL = ttlSeconds;
            }
        }

        const payload = JSON.stringify({
            title,
            body: message,
            url,
            image,
            icon: finalIcon,
            actions,
            data: {
                expiryAt, // Pass expiry to Service Worker if needed
                type
            }
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

        // Save to History (Sent)
        try {
            await initCampaignTable(); // Ensure table exists
            await db.query(
                `INSERT INTO campaigns (store_id, title, message, url, image, status, type, expiry_at, sent_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [storeId, title, message, url, image, 'sent', type || 'regular', expiryAt, sent]
            );
        } catch (dbErr) { console.error('Failed to save campaign history:', dbErr); }

        res.json({ success: true, sent, status: 'sent' });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

/* Settings API */
app.get('/my-store/details', async (req, res) => {
    const { storeId } = req.query;
    try {
        const db = getPool();
        // Ensure email col exists
        try { await db.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_email TEXT'); } catch (e) { }

        const result = await db.query('SELECT store_name, logo_url, store_email FROM stores WHERE store_id = $1', [storeId]);
        if (result.rows.length > 0) {
            res.json({ success: true, store: result.rows[0] });
        } else {
            res.json({ success: false, error: 'Store not found' });
        }
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/my-store/update-settings', async (req, res) => {
    const { storeId, storeName, logoUrl, storeEmail } = req.body;
    try {
        const db = getPool();
        await db.query('UPDATE stores SET store_name = $1, logo_url = $2, store_email = $3 WHERE store_id = $4', [storeName, logoUrl, storeEmail, storeId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

/* Automation API */
app.get('/my-store/automations', async (req, res) => {
    const { storeId } = req.query;
    try {
        const db = getPool();
        // Ensure columns exist (Migration)
        await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS welcome_enabled BOOLEAN DEFAULT FALSE`);
        await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS welcome_title TEXT`);
        await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS welcome_body TEXT`);
        await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS welcome_sent_count INT DEFAULT 0`);
        await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS welcome_click_count INT DEFAULT 0`);

        const result = await db.query('SELECT welcome_enabled, welcome_title, welcome_body, welcome_sent_count, welcome_click_count FROM stores WHERE store_id = $1', [storeId]);
        if (result.rows.length > 0) {
            res.json({ success: true, automations: result.rows[0] });
        } else {
            res.json({ success: false });
        }
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/my-store/update-automations', async (req, res) => {
    const { storeId, welcomeEnabled, welcomeTitle, welcomeBody } = req.body;
    try {
        const db = getPool();
        await db.query('UPDATE stores SET welcome_enabled = $1, welcome_title = $2, welcome_body = $3 WHERE store_id = $4',
            [welcomeEnabled, welcomeTitle, welcomeBody, storeId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

/* Trigger Welcome Notification (Called by Shopify App) */
app.post('/api/trigger-welcome', async (req, res) => {
    const { storeId, subscription } = req.body;
    try {
        const db = getPool();
        const storeRes = await db.query('SELECT welcome_enabled, welcome_title, welcome_body, logo_url FROM stores WHERE store_id = $1', [storeId]);

        if (storeRes.rows.length > 0) {
            const settings = storeRes.rows[0];
            if (settings.welcome_enabled) {
                // Increment Sent Count
                await db.query('UPDATE stores SET welcome_sent_count = welcome_sent_count + 1 WHERE store_id = $1', [storeId]);

                const payload = JSON.stringify({
                    title: settings.welcome_title || 'Welcome!',
                    body: settings.welcome_body || 'Thanks for subscribing.',
                    icon: settings.logo_url || 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
                    data: {
                        url: '/',
                        tracking: { type: 'welcome', storeId }
                    }
                });
                const options = {
                    vapidDetails: {
                        subject: 'mailto:admin@zyrajewel.co.in',
                        publicKey: process.env.PUBLIC_KEY,
                        privateKey: process.env.PRIVATE_KEY,
                    }
                };

                await webPush.sendNotification(subscription, payload, options);
                console.log(`Welcome Notification sent to store ${storeId}`);
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error("Welcome Trigger Failed", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

/* Tracking API */
app.post('/api/track-event', async (req, res) => {
    const { type, storeId, event } = req.body;
    try {
        const db = getPool();
        if (type === 'welcome' && event === 'click') {
            await db.query('UPDATE stores SET welcome_click_count = welcome_click_count + 1 WHERE store_id = $1', [storeId]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

/* CRON JOB for Scheduler */
app.get('/api/run-scheduler', async (req, res) => {
    try {
        const db = getPool();
        const pending = await db.query("SELECT * FROM campaigns WHERE status = 'scheduled' AND scheduled_at <= NOW()");
        let processed = 0;

        for (const camp of pending.rows) {
            const subs = await SubscriptionModel.findByStore(camp.store_id);
            let sent = 0;

            // Fetch Icon & Email
            const storeRes = await db.query('SELECT logo_url, store_email FROM stores WHERE store_id = $1', [camp.store_id]);
            const s = storeRes.rows[0] || {};
            const icon = s.logo_url || 'https://cdn-icons-png.flaticon.com/512/733/733585.png';
            const subject = s.store_email ? 'mailto:' + s.store_email : 'mailto:Koregrowtech@gmail.com';

            const options = {
                vapidDetails: {
                    subject: subject,
                    publicKey: process.env.PUBLIC_KEY,
                    privateKey: process.env.PRIVATE_KEY,
                }
            };

            if (camp.expiry_at) {
                const ttl = Math.floor((new Date(camp.expiry_at).getTime() - Date.now()) / 1000);
                if (ttl > 0) options.TTL = ttl;
            }

            const payload = JSON.stringify({
                title: camp.title,
                body: camp.message,
                url: camp.url,
                image: camp.image,
                icon: icon,
                data: { type: camp.type, expiryAt: camp.expiry_at }
            });

            for (const sub of subs) {
                try {
                    await webPush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, options);
                    sent++;
                } catch (e) { console.error("Cron Push Error", e.message); }
            }

            await db.query("UPDATE campaigns SET status = 'sent', sent_count = $1 WHERE id = $2", [sent, camp.id]);
            processed++;
        }
        res.json({ success: true, processed });

    } catch (e) {
        console.error("Cron Error", e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = app;