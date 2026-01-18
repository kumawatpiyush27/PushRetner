// Push Notification Backend - CLEANED & FIXED - Vercel Force Update

require('dotenv').config();
const express = require('express');
const webPush = require('web-push');
const path = require('path');
const crypto = require('crypto'); // Restored for HMAC
const jwt = require('jsonwebtoken'); // Added for SSO
const SubscriptionModel = require('./subscriptionModel');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

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
            clicks INTEGER DEFAULT 0,
            revenue DECIMAL(10,2) DEFAULT 0.00,
        );
    `;
    try {
        await getPool().query(query);

        // Migration for existing tables
        try {
            await getPool().query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0');
            await getPool().query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS revenue DECIMAL(10,2) DEFAULT 0.00');
            console.log('✅ Campaigns table migrated');
        } catch (e) { console.log('Migration note:', e.message); }

    } catch (e) { console.error('❌ Campaign table error:', e); }
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
                const { title, body, icon, url, image, actions, data } = message; // Added 'data'
                const options = {
                    body: body || 'New Notification',
                    icon: icon || 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
                    image: image || null,
                    requireInteraction: true,
                    data: data || { url: url || '/' }, // Use 'data' from payload if available
                    actions: actions || [] // Add Actions here
                };
                await event.waitUntil(self.registration.showNotification(title, options));
            } catch (error) { console.error('Push Error:', error); }
        });
        self.addEventListener('notificationclick', function (event) {
            event.notification.close();
            const url = event.notification.data.url;
            const campId = event.notification.data.id;

            // Track Click
            if(campId) {
                fetch('/api/track/click?id=' + campId, { mode: 'no-cors' });
            }

            event.waitUntil(
                clients.matchAll({ type: 'window' }).then(windowClients => {
                    for (var i = 0; i < windowClients.length; i++) {
                        var client = windowClients[i];
                        if (client.url === url && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    if (clients.openWindow) {
                        return clients.openWindow(url);
                    }
                })
            );
        });
            
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

// --- ANALYTICS TRACKING ROUTES ---

// 1. Track Click
app.get('/api/track/click', async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).send('Missing ID');
    try {
        await getPool().query('UPDATE campaigns SET clicks = clicks + 1 WHERE id = $1', [id]);
        res.status(200).send('OK');
    } catch (e) { console.error('Track error', e); res.status(500).send('Error'); }
});

// --- SHOPIFY WEBHOOK HELPERS & GDPR ---
const verifyShopifyWebhook = (req, res, next) => {
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    if (!hmac) return res.status(400).send('Missing HMAC header');
    try {
        const generatedHash = crypto
            .createHmac('sha256', process.env.SHOPIFY_API_SECRET || '')
            .update(req.rawBody)
            .digest('base64');
        if (generatedHash !== hmac) {
            return res.status(400).send('HMAC validation failed');
        }
        next();
    } catch (e) {
        console.error("HMAC Error:", e);
        return res.status(500).send("Server Error Verification");
    }
};

// MANDATORY GDPR WEBHOOKS
app.post('/webhooks/shopify/redact/customer', verifyShopifyWebhook, (req, res) => res.status(200).send());
app.post('/webhooks/shopify/redact/shop', verifyShopifyWebhook, (req, res) => res.status(200).send());
app.post('/webhooks/shopify/data/customer', verifyShopifyWebhook, (req, res) => res.status(200).send());

// 2. Track Revenue (Shopify Webhook)
app.post('/webhooks/shopify/order', verifyShopifyWebhook, async (req, res) => {
    try {
        const order = req.body;
        // Check landing site for UTM
        // landing_site: "https://my-store.com/products/xyz?utm_source=push-retner&utm_medium=push&utm_campaign=push_camp_123"
        const landingSite = order.landing_site || order.landing_site_ref;

        if (landingSite && landingSite.includes('utm_campaign=push_camp_')) {
            const match = landingSite.match(/push_camp_(\d+)/);
            if (match && match[1]) {
                const campId = match[1];
                const value = parseFloat(order.total_price);

                await getPool().query('UPDATE campaigns SET revenue = revenue + $1 WHERE id = $2', [value, campId]);
                console.log(`💰 Revenue attributed! Campaign ${campId} + $${value}`);
            }
        }
        res.status(200).send('Webhook Received');
    } catch (e) {
        console.error('Webhook Error', e);
        res.status(500).send('Error');
    }
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

// CLICK TRACKING ENDPOINT
app.get('/track-click', async (req, res) => {
    const { url, c } = req.query;

    // Asynchronously update click count
    if (c) {
        try {
            const db = getPool();
            await db.query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0');
            await db.query('UPDATE campaigns SET clicks = COALESCE(clicks, 0) + 1 WHERE id = $1', [c]);
        } catch (e) {
            console.error("Click Tracking DB Error:", e.message);
        }
    }

    // Redirect to destination
    if (url) {
        res.redirect(url);
    } else {
        res.send("Invalid Link");
    }
});

// Store Admin Dashboard HTML (SSO Enabled)
app.get('/store-admin', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    // SSO Handling: Check for Token from Shopify App
    if (req.query.sso_token) {
        try {
            const secret = 'retner_sso_final_2025';
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
            // DEBUG: Show Error on Screen
            return res.send(`<div style="padding:50px; text-align:center; color:red; font-family:sans-serif;">
                <h1>SSO Verification Error</h1>
                <p><strong>Error:</strong> ${e.message}</p>
                <p>Try refreshing the Shopify App page completely.</p>
                <a href="/store-admin">Go to Login</a>
            </div>`);
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
            --primary: #2563EB;
            --primary-hover: #1E40AF;
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
        .menu-item:hover, .menu-item.active { background: #EBF5FF; color: var(--primary); }
        .menu-item.active { background: #EFF6FF; }

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
        .stat-trend { font-size: 12px; color: #2563EB; display: flex; align-items: center; gap: 4px; background: #DBEAFE; padding: 2px 8px; border-radius: 12px; width: fit-content; }
        
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
<div style="text-align: center; margin-bottom: 30px;"><img src="/full-logo.png" style="max-width: 250px; height: auto;"></div>
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
            <div class="logo" style="justify-content: center;"><img src="/full-logo.png" alt="Retner" style="max-height: 50px; max-width: 100%;"></div>
            
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
                            <span class="stat-title">Total Clicks (CTR)</span>
                            <div class="stat-icon" style="background:#fff4e5; color:#d97008;"><i class="fas fa-mouse-pointer"></i></div>
                        </div>
                        <div>
                            <div class="stat-value" id="stat-clicks">0 (0.00%)</div>
                            <div class="stat-trend">Real-time Data</div>
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
                            <h3>Clicks Overview</h3>
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
                                    <div class="selection-card" id="sel-later" style="opacity: 0.6; cursor: not-allowed; border: 1px solid #eee;">
                                        <div class="selection-title">Schedule for Later (Coming Soon 🚀)</div>
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
                                    <tr><td style="color:#666; padding:8px 0;">Schedule:</td><td style="font-weight:500;" id="revSchedule">Immediately</td></tr>
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
                <!-- ANALYTICS CARDS -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
                    <div class="card" style="display: flex; align-items: center; gap: 15px; padding: 20px;">
                        <div style="width: 45px; height: 45px; background: #eef2ff; color: #4338ca; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                            <i class="fas fa-paper-plane"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 24px;" id="histTotalCamp">0</h3>
                            <p style="margin: 0; color: #666; font-size: 13px;">Total Campaigns</p>
                        </div>
                    </div>
                    <div class="card" style="display: flex; align-items: center; gap: 15px; padding: 20px;">
                        <div style="width: 45px; height: 45px; background: #f0f9ff; color: #0284c7; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                            <i class="fas fa-eye"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 24px;" id="histTotalImp">0</h3>
                            <p style="margin: 0; color: #666; font-size: 13px;">Total Impressions</p>
                        </div>
                    </div>
                    <div class="card" style="display: flex; align-items: center; gap: 15px; padding: 20px;">
                        <div style="width: 45px; height: 45px; background: #ecfdf5; color: #059669; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                            <i class="fas fa-mouse-pointer"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 24px;" id="histAvgCtr">0%</h3>
                            <p style="margin: 0; color: #666; font-size: 13px;">Avg. Click Rate</p>
                        </div>
                    </div>
                    <div class="card" style="display: flex; align-items: center; gap: 15px; padding: 20px;">
                        <div style="width: 45px; height: 45px; background: #fdf4ff; color: #c026d3; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 24px;" id="histRevenue">₹0</h3>
                            <p style="margin: 0; color: #666; font-size: 13px;">Revenue</p>
                        </div>
                    </div>
                </div>

                <!-- FILTERS -->
                <div class="card">
                     <div style="display: flex; gap: 20px; margin-bottom: 15px; border-bottom: 1px solid #eee;">
                        <button id="tab-all" class="filter-tab active" onclick="filterTable('all')">All</button>
                        <button id="tab-sent" class="filter-tab" onclick="filterTable('sent')">Sent (<span id="count-sent">0</span>)</button>
                        <button id="tab-scheduled" class="filter-tab" onclick="filterTable('scheduled')">Scheduled (<span id="count-scheduled">0</span>)</button>
                        <button id="tab-draft" class="filter-tab" onclick="void(0)" style="opacity: 0.5; cursor: default;">Draft (0)</button>
                    </div>
                    <style>
                        .filter-tab { background: none; border: none; padding: 10px 5px; cursor: pointer; color: #666; font-weight: 500; font-size: 14px; border-bottom: 2px solid transparent; margin-bottom: -1px; }
                        .filter-tab.active { color: #008060; border-bottom-color: #008060; font-weight: 600; }
                        .filter-tab:hover { color: #333; }
                    </style>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                        <h3 style="margin:0;">Campaign History</h3>
                        <button class="btn-secondary" onclick="triggerScheduler()" style="padding: 6px 12px; font-size: 13px; cursor: pointer;">
                            <i class="fas fa-sync"></i> Process Pending
                        </button>
                    </div>
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
                        <div class="auto-card" id="card-abandoned">
                             <div class="auto-card-header">
                                <div class="auto-icon"><i class="fas fa-shopping-cart"></i></div>
                                <div style="flex: 1;">
                                     <div style="display: flex; gap: 8px; align-items: center;">
                                        <h4>Abandoned cart recovery</h4>
                                        <span class="badge badge-inactive" id="badge-abandoned">Inactive</span>
                                     </div>
                                     <p class="auto-desc">Remind subscribers about items they left in their cart.</p>
                                     <!-- Edit Area -->
                                     <div id="abandoned-edit-area" class="hidden" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                                          <input type="text" id="autoAbandonedTitle" class="input-sm" placeholder="Title">
                                          <textarea id="autoAbandonedMsg" class="input-sm" placeholder="Message" rows="3"></textarea>
                                          <button class="btn btn-primary btn-sm" onclick="saveAutomations()">Save Text</button>
                                     </div>
                                </div>
                            </div>
                            <div class="auto-stats">
                                <div><span class="stat-num">0</span><span class="stat-lbl">Impressions</span></div>
                                <div><span class="stat-num">0</span><span class="stat-lbl">Clicks</span></div>
                            </div>
                            <div class="auto-card-footer">
                                <div id="abandoned-status-text" style="font-size: 13px; color: #666;">Abandoned notifications are deactivated.</div>
                                <div style="display: flex; gap: 10px; align-items: center;">
                                     <button class="btn-link hidden" id="btn-edit-abandoned" onclick="toggleEditAbandoned()">Edit</button>
                                     <button class="btn-action" id="btn-toggle-abandoned" onclick="toggleAbandoned()">Activate</button>
                                </div>
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

            <!-- AUTOMATION EDITOR (MULTI-STEP FLOW) -->
            <div id="view-automation-editor" class="content-area hidden">
                <style>
                    .flow-column { display: flex; flex-direction: column; align-items: center; padding: 20px 10px; }
                    .flow-step { width: 100%; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; cursor: pointer; transition: all 0.2s; position: relative; }
                    .flow-step:hover { border-color: #2563EB; box-shadow: 0 2px 5px rgba(37,99,235,0.1); }
                    .flow-step.active { border-color: #2563EB; background: #eff6ff; border-left: 4px solid #2563EB; }
                    .flow-step.trigger { background: #fffbeb; border-color: #fcd34d; cursor: default; }
                    .flow-line { width: 2px; height: 20px; background: #e5e7eb; margin: 5px 0; }
                    .step-lbl { font-weight: 600; font-size: 14px; color: #111; }
                    .step-meta { font-size: 12px; color: #666; margin-top: 4px; }
                    .step-badge { position: absolute; top: 10px; right: 10px; font-size: 10px; padding: 2px 6px; border-radius: 10px; background: #eee; color: #666; }
                    .step-badge.active { background: #dcfce7; color: #166534; }
                </style>
                
                <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 20px;">
                    <button class="btn-secondary" onclick="switchView('automations')"><i class="fas fa-arrow-left"></i> Back</button>
                    <h2 style="margin: 0;" id="editor-page-title">Abandoned Cart Recovery</h2>
                    <span class="badge badge-inactive" id="editor-badge">Inactive</span>
                </div>

                <!-- STATS BAR -->
                <div class="card" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; padding: 20px; margin-bottom: 20px;">
                    <div><div class="stat-lbl">Impressions</div><div class="stat-num" id="edit-stat-imp">0</div></div>
                    <div><div class="stat-lbl">Clicks</div><div class="stat-num" id="edit-stat-clk">0</div></div>
                    <div><div class="stat-lbl">Revenue</div><div class="stat-num" id="edit-stat-rev">₹0</div></div>
                    <div><div class="stat-lbl">Active Reminders</div><div class="stat-num" id="edit-stat-active">1/3</div></div>
                </div>

                <!-- 3 COLUMNS: FLOW | EDITOR | PREVIEW -->
                <div style="display: grid; grid-template-columns: 260px 1fr 360px; gap: 20px; align-items: start;">
                    
                    <!-- LEFT: FLOW BUILDER -->
                    <div class="card flow-column">
                         <div class="flow-step trigger">
                             <div class="step-lbl"><i class="fas fa-shopping-cart"></i> Added to Cart</div>
                             <div class="step-meta">Trigger Event</div>
                         </div>
                         <div class="flow-line"></div>
                         
                         <!-- Reminder 1 -->
                         <div class="flow-step reminder active" id="step-card-0" onclick="selectReminder(0)">
                             <div class="step-lbl">Reminder 1</div>
                             <div class="step-meta" id="step-meta-0">Wait 20 Mins</div>
                             <span class="step-badge active" id="step-badge-0">ON</span>
                         </div>
                         <div class="flow-line"></div>

                         <!-- Reminder 2 -->
                         <div class="flow-step reminder" id="step-card-1" onclick="selectReminder(1)">
                             <div class="step-lbl">Reminder 2</div>
                             <div class="step-meta" id="step-meta-1">Wait 10 Hours</div>
                             <span class="step-badge" id="step-badge-1">OFF</span>
                         </div>
                         <div class="flow-line"></div>

                         <!-- Reminder 3 -->
                         <div class="flow-step reminder" id="step-card-2" onclick="selectReminder(2)">
                             <div class="step-lbl">Reminder 3</div>
                             <div class="step-meta" id="step-meta-2">Wait 24 Hours</div>
                             <span class="step-badge" id="step-badge-2">OFF</span>
                         </div>
                    </div>

                    <!-- MIDDLE: EDITOR FORM -->
                    <div class="card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
                            <h3 style="margin: 0;" id="editor-step-title">Edit Reminder 1</h3>
                            
                            <label class="toggle-switch" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <span style="font-size: 13px; font-weight: 500;">Enable Step</span>
                                <input type="checkbox" id="edit-step-enabled" onchange="updateStepStatus()">
                            </label>
                        </div>
                        
                        <!-- TIMING SETTINGS -->
                        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #eee; margin-bottom: 20px;">
                            <div style="font-weight: 600; font-size: 13px; margin-bottom: 10px; color: #444;">WAIT TIME</div>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <span>Wait for</span>
                                <input type="number" id="edit-delay-val" value="20" class="input-sm" style="width: 70px;" oninput="updateStepMeta()">
                                <select id="edit-delay-unit" class="input-sm" style="width: 100px;" onchange="updateStepMeta()">
                                    <option value="minutes">Minutes</option>
                                    <option value="hours">Hours</option>
                                    <option value="days">Days</option>
                                </select>
                            </div>
                        </div>

                        <!-- CONTENT SETTINGS -->
                        <div class="form-group">
                            <label>Notification Title</label>
                            <input type="text" id="edit-auto-title" placeholder="We saved your items!" oninput="updateAutoPreview()">
                        </div>
                        
                        <div class="form-group">
                            <label>Message Body</label>
                            <textarea id="edit-auto-msg" rows="3" placeholder="Return to cart..." oninput="updateAutoPreview()"></textarea>
                        </div>

                        <div class="form-group">
                            <label>Hero Image URL (Optional)</label>
                            <input type="text" id="edit-auto-img" placeholder="https://..." oninput="updateAutoPreview()">
                        </div>

                        <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
                            <h4 style="margin: 0 0 15px 0;">Action Buttons</h4>
                            <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div>
                                    <label style="font-size: 13px; font-weight: 500;">Button 1</label>
                                    <input type="text" id="edit-auto-btn1" placeholder="Checkout" oninput="updateAutoPreview()">
                                </div>
                                <div>
                                    <label style="font-size: 13px; font-weight: 500;">Button 2</label>
                                    <input type="text" id="edit-auto-btn2" placeholder="View Store" oninput="updateAutoPreview()">
                                </div>
                            </div>
                        </div>

                        <!-- ACTIONS FOOTER -->
                        <div style="margin-top: 30px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #eee; padding-top: 20px;">
                            <button class="btn-primary" style="width: 100%;" onclick="saveAutomationFull()">Save All & Activate</button>
                        </div>
                    </div>

                    <!-- RIGHT: PREVIEW (STICKY) -->
                    <div>
                        <div class="card" style="position: sticky; top: 20px;">
                            <h3 style="margin-top: 0; font-size: 16px; color: #666;">Live Preview</h3>
                            
                            <!-- ANDROID PREVIEW -->
                            <div style="margin-top: 20px;">
                                <div style="font-size: 12px; color: #999; margin-bottom: 5px;">Android</div>
                                <div class="preview-box">
                                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                        <div style="width: 40px; height: 40px; background: #ddd; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                                            <i class="fas fa-bell" style="color: #999;"></i>
                                        </div>
                                        <div>
                                            <div style="font-weight: bold; font-size: 14px;" id="prev-auto-title">Title</div>
                                            <div style="font-size: 12px; color: #666;" id="prev-auto-msg">Message...</div>
                                        </div>
                                    </div>
                                    <img id="prev-auto-hero" src="" style="display: none; width: 100%; height: 120px; object-fit: cover; border-radius: 4px; margin-top: 8px;">
                                    
                                    <div style="display: flex; gap: 10px; margin-top: 10px; border-top: 1px solid #eee; padding-top: 8px;" id="prev-auto-btns">
                                        <span style="font-size: 12px; font-weight: 600; color: #4338ca;" id="prev-auto-b1">BUTTON 1</span>
                                        <span style="font-size: 12px; font-weight: 600; color: #4338ca;" id="prev-auto-b2">BUTTON 2</span>
                                    </div>
                                </div>
                            </div>

                            <!-- WINDOWS PREVIEW -->
                            <div style="margin-top: 30px;">
                                <div style="font-size: 12px; color: #999; margin-bottom: 5px;">Windows 10/11</div>
                                <div style="background: #333; color: white; padding: 15px; border-radius: 0; font-family: 'Segoe UI', sans-serif; display: flex; gap: 15px;">
                                     <div style="width: 40px; height: 40px; background: #555; display: flex; align-items: center; justify-content: center;">
                                        <i class="fas fa-shopping-cart"></i>
                                     </div>
                                     <div style="flex: 1;">
                                         <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;" id="prev-win-title">Title</div>
                                         <div style="font-size: 12px; color: #ccc;" id="prev-win-msg">Message...</div>
                                         <img id="prev-win-hero" src="" style="display: none; width: 100%; margin-top: 10px; border: 1px solid #444;">
                                     </div>
                                </div>
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
            let titles = {
                dashboard: 'Dashboard', 
                campaign: 'Create Campaign', 
                history: 'Campaign History', 
                subscribers: 'Subscribers List', 
                settings: 'Settings', 
                automations: 'Automations',
                'automation-editor': 'Automation Editor'
            };
            document.getElementById('pageTitle').innerText = titles[viewName] || 'SmartPush';

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
            const impressions = data.totalImpressions || 0;
            const revenue = data.totalRevenue || 0;
            const clicks = data.totalClicks || 0;
            const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';

            document.getElementById('stat-total-sub').innerText = subCount;
            document.getElementById('stat-total-sent').innerText = campCount;
            if(document.getElementById('stat-clicks')) {
                 document.getElementById('stat-clicks').innerText = clicks + " (" + ctr + "%)";
            }
            if(document.getElementById('stat-revenue')) {
                 document.getElementById('stat-revenue').innerText = '₹' + revenue.toFixed(2);
            }
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
                        borderColor: '#2563EB',
                        tension: 0.4,
                        fill: true,
                        backgroundColor: 'rgba(37, 99, 235, 0.1)'
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
                        label: 'Clicks',
                        data: [Math.floor(clicks * 0.1), Math.floor(clicks * 0.15), Math.floor(clicks * 0.2), Math.floor(clicks * 0.25), Math.floor(clicks * 0.1), Math.floor(clicks * 0.15), Math.floor(clicks * 0.05)], 
                        backgroundColor: '#3B82F6',
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
                        '<td style="padding: 12px 10px;"><span style="background: #DBEAFE; color: #1E40AF; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">' + camp.sent_count + ' Sent</span></td>' +
                    '</tr>';
                });
            } else {
                tbodyRecent.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #999;">No recent campaigns found.</td></tr>';
            }
        }

        async function triggerScheduler() {
            const btn = document.querySelector('button[onclick="triggerScheduler()"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            btn.disabled = true;
            try {
                const res = await fetch('/api/run-scheduler');
                const data = await res.json();
                if(data.debug) {
                    alert('✅ Processed: ' + (data.processed || 0) + 
                          '\\nServer Time (UTC): ' + data.debug.serverTime + 
                          '\\nPending Due: ' + data.debug.pendingMatch + 
                          '\\nTotal Scheduled: ' + data.debug.totalScheduled);
                } else {
                    alert('✅ Processed ' + (data.processed || 0) + ' pending campaigns.');
                }
                loadCampaignHistory();
            } catch(e) { alert('Error: ' + e.message); }
            btn.innerHTML = originalText;
            btn.disabled = false;
        }

        async function loadCampaignHistory() {
            const res = await fetch('/my-store/campaigns?storeId=' + store.id);
            const data = await res.json();
            const tbody = document.getElementById('historyTableBody');
            tbody.innerHTML = ''; // Clear for analytics loop, but rendering is moved to filterTable

            
            // ANALYTICS CALCULATION
            let totalSent = 0;
            let totalImpressions = 0;
            let totalClicks = 0;
            let totalRevenue = 0;

            // STORE GLOBAL
            window.allCampaigns = data.campaigns;

            data.campaigns.forEach(camp => {
                if(camp.status !== 'scheduled') {
                    totalSent++;
                    totalImpressions += (camp.sent_count || 0);
                    totalClicks += (camp.clicks || 0);
                    totalRevenue += parseFloat(camp.revenue || 0);
                }
            });
            
            // INIT FILTER
            filterTable('all');

            // UPDATE ANALYTICS UI
            
            // UPDATE ANALYTICS UI
            const elTotalCamp = document.getElementById('histTotalCamp');
            const elTotalImp = document.getElementById('histTotalImp');
            const elAvgCtr = document.getElementById('histAvgCtr');
            const elRevenue = document.getElementById('histRevenue');

            if(elTotalCamp) elTotalCamp.innerText = totalSent;
            if(elTotalImp) elTotalImp.innerText = totalImpressions;
            
            let ctrVal = '0%';
            if(totalImpressions > 0) {
                 ctrVal = ((totalClicks / totalImpressions) * 100).toFixed(2) + '%';
            }
            if(elAvgCtr) elAvgCtr.innerText = ctrVal;

            if(elRevenue) elRevenue.innerText = '₹' + totalRevenue.toFixed(2);

            if(data.campaigns.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="padding: 20px; text-align: center;">No campaigns sent yet.</td></tr>';
            }
        }

        function filterTable(type) {
             const tabs = ['all', 'sent', 'scheduled', 'draft'];
             tabs.forEach(t => { 
                const el = document.getElementById('tab-'+t);
                if(el) {
                    if(t === type) el.classList.add('active');
                    else el.classList.remove('active'); 
                }
             });

             const tbody = document.getElementById('historyTableBody');
             tbody.innerHTML = '';
             
             let filtered = [];
             if(!window.allCampaigns) window.allCampaigns = [];
             
             if(type === 'all') filtered = window.allCampaigns;
             else if(type === 'sent') filtered = window.allCampaigns.filter(c => c.status !== 'scheduled');
             else if(type === 'scheduled') filtered = window.allCampaigns.filter(c => c.status === 'scheduled');
             
             // Update Counts
             const sentCount = window.allCampaigns.filter(c => c.status !== 'scheduled').length;
             const schCount = window.allCampaigns.filter(c => c.status === 'scheduled').length;
             if(document.getElementById('count-sent')) document.getElementById('count-sent').innerText = sentCount;
             if(document.getElementById('count-scheduled')) document.getElementById('count-scheduled').innerText = schCount;

             if(filtered.length === 0) {
                  tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #999;">No campaigns found.</td></tr>';
                  return;
             }

             filtered.forEach(camp => {
                const date = new Date(camp.created_at).toLocaleDateString() + ' ' + new Date(camp.created_at).toLocaleTimeString();
                let statusBadge = '<span style="background: #e4e5e7; padding: 2px 8px; border-radius: 10px;">Sent</span>';
                if(camp.status === 'scheduled') statusBadge = '<span style="background: #fff4e5; color: #b45309; padding: 2px 8px; border-radius: 10px; font-weight:600;">⏳ Scheduled</span>';
                
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
            
            const timeVal = document.getElementById('scheduleTime').value;
            let scheduleText = 'Immediately';
            if(scheduleMode === 'later' && timeVal) {
                scheduleText = new Date(timeVal).toLocaleString();
            }
            const revSch = document.getElementById('revSchedule');
            if(revSch) revSch.innerText = scheduleText;
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
            const appendUTM = (url, campId) => {
                if(!url) return url;
                const sep = url.indexOf('?') !== -1 ? '&' : '?';
                const campaign = encodeURIComponent(title.replace(/\s+/g, '-').toLowerCase());
                return url + sep + 'utm_source=push-retner&utm_medium=push&utm_campaign=push_camp_' + campId;
            };

            // URL will be updated after campaign ID is known
            let urlForPayload = rawUrl; 
            const icon = document.getElementById('campIcon').value;
            const btn1Text = document.getElementById('btn1Txt').value;
            const btn1UrlRaw = document.getElementById('btn1Link').value;
            let btn1UrlForPayload = btn1UrlRaw || rawUrl;

            const btn2Text = document.getElementById('btn2Txt').value;
            const btn2UrlRaw = document.getElementById('btn2Link').value;
            let btn2UrlForPayload = btn2UrlRaw || rawUrl;

            let scheduledAt = null;
            if(scheduleMode === 'later') {
                 const val = document.getElementById('scheduleTime').value;
                 if(val) scheduledAt = new Date(val).toISOString();
            }
            let expiryAt = null;
            if(campaignType === 'flash') {
                 const val = document.getElementById('expiryTime').value;
                 if(val) expiryAt = new Date(val).toISOString();
            }

            const actions = [];
            // Actions will be populated after campId is known

            // Original fetch call logic
            const res = await fetch('/my-store/broadcast', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ storeId: store.id, title, message, url: rawUrl, image, icon, actions, type: campaignType, scheduledAt, expiryAt, btn1Text, btn1UrlRaw, btn2Text, btn2UrlRaw })
            });
            const data = await res.json();
            
            if(data.success) {
                if(data.status === 'scheduled') {
                    alert('📅 Campaign Scheduled Successfully!');
                } else {
                    if(data.sent === 0 && data.lastError) {
                        alert('⚠️ Sent to 0. Reason: ' + data.lastError);
                    } else {
                        alert('✅ Sent to ' + data.sent + ' subscribers!');
                    }
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
        let automationState = { 
            welcome: false, 
            abandoned: false,
            // Default 3-step config
            abandonedConfig: [
                { id: 0, delay: 20, unit: 'minutes', title: 'We saved your items!', body: 'Complete your purchase now.', enabled: true, btn1: 'Checkout', btn2: 'View Store' },
                { id: 1, delay: 10, unit: 'hours', title: 'Still thinking about it?', body: 'Your cart is waiting for you.', enabled: false, btn1: 'Checkout', btn2: 'View Store'  },
                { id: 2, delay: 1, unit: 'days', title: 'Last chance!', body: 'Your cart will expire soon.', enabled: false, btn1: 'Checkout', btn2: 'View Store'  }
            ]
        };
        let currentReminderIndex = 0;

        /* WELCOME FUNCTIONS */
        function toggleEditWelcome() {
             document.getElementById('welcome-edit-area').classList.toggle('hidden');
        }

        function toggleWelcome() {
            automationState.welcome = !automationState.welcome;
            updateWelcomeCardUI();
            saveAutomations();
        }

        function updateWelcomeCardUI() {
            const enabled = automationState.welcome;
            const badge = document.getElementById('badge-welcome');
            if(badge) {
                badge.className = enabled ? 'badge badge-active' : 'badge badge-inactive';
                badge.innerText = enabled ? 'Active' : 'Inactive';
            }
            const txt = document.getElementById('welcome-status-text');
            if(txt) txt.innerText = enabled ? 'Welcome notifications are activated.' : 'Welcome notifications are deactivated.';
            
            const btn = document.getElementById('btn-toggle-welcome');
            if(btn) btn.innerText = enabled ? 'Deactivate' : 'Activate';
            
            const editBtn = document.getElementById('btn-edit-welcome');
            if(editBtn) {
                if(enabled) editBtn.classList.remove('hidden'); else editBtn.classList.add('hidden');
            }
            if(!enabled) document.getElementById('welcome-edit-area').classList.add('hidden');
        }

        /* ABANDONED CART FUNCTIONS - MULTI STEP FLOW */
        function openAutomationEditor(type) {
            if(type !== 'abandoned') return;
            switchView('automation-editor');
            
            // Sync Top Status
            const enabled = automationState.abandoned;
            const badge = document.getElementById('editor-badge');
            badge.className = enabled ? 'badge badge-active' : 'badge badge-inactive';
            badge.innerText = enabled ? 'Active' : 'Inactive';
            
            // Select First Reminder by Default
            selectReminder(0);
            updateFlowVisuals();
        }

        function selectReminder(index) {
            // 1. Save changes from current index before switching (if we were editing one)
            saveCurrentStepToState();

            // 2. Switch Index
            currentReminderIndex = index;

            // 3. Load Data for new Index
            const data = automationState.abandonedConfig[index];
            
            document.getElementById('editor-step-title').innerText = 'Edit Reminder ' + (index + 1);
            
            document.getElementById('edit-delay-val').value = data.delay;
            document.getElementById('edit-delay-unit').value = data.unit;
            document.getElementById('edit-step-enabled').checked = data.enabled;
            
            document.getElementById('edit-auto-title').value = data.title;
            document.getElementById('edit-auto-msg').value = data.body;
            document.getElementById('edit-auto-img').value = data.image || '';
            document.getElementById('edit-auto-btn1').value = data.btn1 || 'Checkout';
            document.getElementById('edit-auto-btn2').value = data.btn2 || 'View Store';

            // 4. Update UI
            updateFlowVisuals();
            updateAutoPreview();
        }

        function saveCurrentStepToState() {
            const idx = currentReminderIndex;
            const config = automationState.abandonedConfig[idx];
            
            config.delay = document.getElementById('edit-delay-val').value;
            config.unit = document.getElementById('edit-delay-unit').value;
            config.enabled = document.getElementById('edit-step-enabled').checked;
            config.title = document.getElementById('edit-auto-title').value;
            config.body = document.getElementById('edit-auto-msg').value;
            config.image = document.getElementById('edit-auto-img').value;
            config.btn1 = document.getElementById('edit-auto-btn1').value;
            config.btn2 = document.getElementById('edit-auto-btn2').value;
        }

        function updateFlowVisuals() {
            // Update the Left Sidebar Cards
            automationState.abandonedConfig.forEach((step, i) => {
                const card = document.getElementById('step-card-' + i);
                const meta = document.getElementById('step-meta-' + i);
                const badge = document.getElementById('step-badge-' + i);
                
                // Active Selection
                if(i === currentReminderIndex) card.classList.add('active');
                else card.classList.remove('active');

                // Meta Info
                meta.innerText = `Wait ${ step.delay } ${ step.unit }`;
                
                // ON/OFF Badge
                if(step.enabled) {
                    badge.classList.add('active');
                    badge.innerText = 'ON';
                } else {
                    badge.classList.remove('active');
                    badge.innerText = 'OFF';
                }
            });
            
            // Update Header Stats
            const activeCount = automationState.abandonedConfig.filter(s => s.enabled).length;
            document.getElementById('edit-stat-active').innerText = activeCount + '/3';
        }

        // Called when inputs change
        function updateStepMeta() {
            const val = document.getElementById('edit-delay-val').value;
            const unit = document.getElementById('edit-delay-unit').value;
            const meta = document.getElementById('step-meta-' + currentReminderIndex);
            if(meta) meta.innerText = `Wait ${ val } ${ unit }`;
        }
        
        function updateStepStatus() {
            const enabled = document.getElementById('edit-step-enabled').checked;
            const badge = document.getElementById('step-badge-' + currentReminderIndex);
            if(enabled) {
                badge.classList.add('active');
                badge.innerText = 'ON';
            } else {
                badge.classList.remove('active');
                badge.innerText = 'OFF';
            }
            updateFlowVisuals(); // Update counts
        }

        function updateAutoPreview() {
            const title = document.getElementById('edit-auto-title').value;
            const msg = document.getElementById('edit-auto-msg').value;
            const img = document.getElementById('edit-auto-img').value;
            const btn1 = document.getElementById('edit-auto-btn1').value || 'CHECKOUT';
            const btn2 = document.getElementById('edit-auto-btn2').value || 'VIEW STORE';

            // Android
            document.getElementById('prev-auto-title').innerText = title || 'Title';
            document.getElementById('prev-auto-msg').innerText = msg || 'Message...';
            document.getElementById('prev-auto-b1').innerText = btn1.toUpperCase();
            document.getElementById('prev-auto-b2').innerText = btn2.toUpperCase();
            
            const pHero = document.getElementById('prev-auto-hero');
            if(img) { pHero.src = img; pHero.style.display = 'block'; } else { pHero.style.display = 'none'; }

            // Windows
            document.getElementById('prev-win-title').innerText = title || 'Title';
            document.getElementById('prev-win-msg').innerText = msg || 'Message...';
            const wHero = document.getElementById('prev-win-hero');
             if(img) { wHero.src = img; wHero.style.display = 'block'; } else { wHero.style.display = 'none'; }
        }

        function updateAbandonedCardUI() {
            const enabled = automationState.abandoned;
            const badge = document.getElementById('badge-abandoned');
            if(badge) {
                badge.className = enabled ? 'badge badge-active' : 'badge badge-inactive';
                badge.innerText = enabled ? 'Active' : 'Inactive';
            }
            const txt = document.getElementById('abandoned-status-text');
            if(txt) txt.innerText = enabled ? 'Abandoned notifications are activated.' : 'Abandoned notifications are deactivated.';
            
            const btn = document.getElementById('btn-toggle-abandoned');
            if(btn) {
                btn.innerText = enabled ? 'Edit Settings' : 'Activate';
                btn.className = 'btn-action';
                btn.onclick = () => openAutomationEditor('abandoned'); 
            }
            const editBtn = document.getElementById('btn-edit-abandoned');
            if(editBtn) editBtn.style.display = 'none'; 
            document.getElementById('abandoned-edit-area').classList.add('hidden');
        }

        async function saveAutomationFull() {
            // Save current Step first
            saveCurrentStepToState();

            const btn = document.querySelector('#view-automation-editor .btn-primary');
            const originalText = btn.innerText;
            btn.innerText = 'Saving...';
            btn.disabled = true;

            const config = automationState.abandonedConfig;
            // Use Reminder 1 for the main dashboard display fallback
            const mainTitle = config[0].title;
            const mainBody = config[0].body;
            
            try {
                // Determine if overall enabled (if at least one reminder is ON)
                const isAnyEnabled = config.some(c => c.enabled);
                automationState.abandoned = isAnyEnabled;

                const res = await fetch('/my-store/update-automations', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        storeId: store.id, 
                        welcomeEnabled: automationState.welcome, 
                        welcomeTitle: document.getElementById('autoWelcomeTitle').value, 
                        welcomeBody: document.getElementById('autoWelcomeMsg').value,
                        abandonedEnabled: isAnyEnabled,
                        abandonedTitle: mainTitle,
                        abandonedBody: mainBody,
                        abandonedConfig: config // Send Full JSON
                    })
                });
                const data = await res.json();
                if(data.success) {
                    btn.innerText = 'Saved!';
                    setTimeout(() => {
                        btn.innerText = originalText;
                        btn.disabled = false;
                        switchView('automations'); // Return to list
                        updateAbandonedCardUI(); // Refresh UI
                    }, 1000);
                } else {
                    alert('Error: ' + data.error);
                    btn.disabled = false;
                    btn.innerText = originalText;
                }
            } catch(e) {
                alert('Connection Error');
                btn.disabled = false;
                btn.innerText = originalText;
            }
        }

        async function loadAutomations() {
            const res = await fetch('/my-store/automations?storeId=' + store.id);
            const data = await res.json();
            if(data.success && data.automations) {
                // Welcome
                automationState.welcome = data.automations.welcome_enabled;
                document.getElementById('autoWelcomeTitle').value = data.automations.welcome_title || '';
                document.getElementById('autoWelcomeMsg').value = data.automations.welcome_body || '';
                
                const wCard = document.getElementById('card-welcome');
                if(wCard) {
                    const stats = wCard.querySelectorAll('.stat-num');
                    if(stats.length >= 2) {
                        stats[0].innerText = data.automations.welcome_sent_count || 0;
                        stats[1].innerText = data.automations.welcome_click_count || 0;
                    }
                }
                updateWelcomeCardUI();

                // Abandoned - Load Config
                automationState.abandoned = data.automations.abandoned_enabled;
                
                if (data.automations.abandoned_config) {
                    try {
                        let parsed = JSON.parse(data.automations.abandoned_config);
                        if(parsed && Array.isArray(parsed)) {
                            automationState.abandonedConfig = parsed;
                        }
                    } catch(e) { console.error('JSON Error', e); }
                } else {
                    // Backwards Compatibility: Migration
                    // If we have old title/body but no config, map it to Reminder 1
                    if(data.automations.abandoned_title) {
                         automationState.abandonedConfig[0].title = data.automations.abandoned_title;
                         automationState.abandonedConfig[0].body = data.automations.abandoned_body;
                         automationState.abandonedConfig[0].enabled = data.automations.abandoned_enabled;
                    }
                }

                // Update UI elements for legacy cards (if visible)
                const abTitle = document.getElementById('autoAbandonedTitle');
                if(abTitle) abTitle.value = data.automations.abandoned_title || '';
                const abMsg = document.getElementById('autoAbandonedMsg');
                if(abMsg) abMsg.value = data.automations.abandoned_body || '';

                const aCard = document.getElementById('card-abandoned');
                if(aCard) {
                    const stats = aCard.querySelectorAll('.stat-num');
                    if(stats.length >= 2) {
                        stats[0].innerText = data.automations.abandoned_sent_count || 0;
                        stats[1].innerText = data.automations.abandoned_click_count || 0;
                    }
                }
                updateAbandonedCardUI();
            }
        }

        async function saveAutomations() {
            // Helper to show saving state on active edit button
            let activeBtn = null;
            if(!document.getElementById('welcome-edit-area').classList.contains('hidden')) {
                 activeBtn = document.querySelector('#welcome-edit-area button');
            } else if (!document.getElementById('abandoned-edit-area').classList.contains('hidden')) {
                 activeBtn = document.querySelector('#abandoned-edit-area button');
            }

            const originalText = activeBtn ? activeBtn.innerText : 'Save Text';
            if(activeBtn) {
                activeBtn.innerText = 'Saving...';
                activeBtn.disabled = true;
            }

            const welcomeTitle = document.getElementById('autoWelcomeTitle').value;
            const welcomeBody = document.getElementById('autoWelcomeMsg').value;
            const abandonedTitle = document.getElementById('autoAbandonedTitle') ? document.getElementById('autoAbandonedTitle').value : '';
            const abandonedBody = document.getElementById('autoAbandonedMsg') ? document.getElementById('autoAbandonedMsg').value : '';
            
            try {
                const res = await fetch('/my-store/update-automations', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        storeId: store.id, 
                        welcomeEnabled: automationState.welcome, 
                        welcomeTitle, 
                        welcomeBody,
                        abandonedEnabled: automationState.abandoned,
                        abandonedTitle,
                        abandonedBody
                    })
                });
                const data = await res.json();
                
                if(activeBtn) {
                    if(data.success) {
                        activeBtn.innerText = 'Saved!';
                        setTimeout(() => {
                            activeBtn.innerText = originalText;
                            activeBtn.disabled = false;
                            // Auto Close
                            if(activeBtn.parentElement) activeBtn.parentElement.classList.add('hidden');
                        }, 1500);
                    } else {
                        alert('Error: ' + data.error);
                        activeBtn.innerText = originalText;
                        activeBtn.disabled = false;
                    }
                }
            } catch(e) {
                if(activeBtn) {
                    activeBtn.innerText = originalText;
                    activeBtn.disabled = false;
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
        await initCampaignTable(); // Ensure columns exist (Migration)
        const db = getPool();
        const subRes = await db.query('SELECT COUNT(*) FROM subscriptions WHERE store_id = $1', [storeId]);
        let campRes;
        try {
            // Try Full Query (Requires revenue/clicks columns)
            campRes = await db.query('SELECT COUNT(*) AS total_campaigns, SUM(sent_count) AS total_impressions, SUM(revenue) AS total_revenue, SUM(clicks) AS total_clicks FROM campaigns WHERE store_id = $1', [storeId]);
        } catch (sqlErr) {
            console.error('Full Stats Query Failed (using fallback):', sqlErr.message);
            // Fallback: Count Only (Ignore revenue)
            campRes = await db.query('SELECT COUNT(*) AS total_campaigns, SUM(sent_count) AS total_impressions FROM campaigns WHERE store_id = $1', [storeId]);
        }

        const recentRes = await db.query('SELECT * FROM campaigns WHERE store_id = $1 ORDER BY created_at DESC LIMIT 5', [storeId]);

        res.json({
            subscribers: parseInt(subRes.rows[0].count),
            campaigns: parseInt(campRes.rows[0].total_campaigns || 0),
            totalImpressions: parseInt(campRes.rows[0].total_impressions || 0),
            totalRevenue: parseFloat(campRes.rows[0].total_revenue || 0),
            totalClicks: parseInt(campRes.rows[0].total_clicks || 0),
            recentCampaigns: recentRes.rows
        });
    } catch (e) {
        console.error('Stats Error:', e);
        res.status(500).json({ error: e.message, subscribers: 0, campaigns: 0, totalImpressions: 0, totalRevenue: 0, recentCampaigns: [] });
    }
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



/* -------------------------------------------------------------------------- */
/*                     SHOPIFY ORDER WEBHOOK (Existing)                       */
/* -------------------------------------------------------------------------- */

/* Shopify Webhook for Revenue Tracking */
app.post('/webhooks/shopify/order', async (req, res) => {
    console.log('Webhook Received: Order Create');
    const { id, total_price, landing_site, landing_site_ref } = req.body;

    // 1. Identify Campaign
    let campaignId = null;
    const urlToCheck = landing_site || landing_site_ref || '';
    const match = urlToCheck.match(/push_camp_(\d+)/);

    if (match && match[1]) {
        campaignId = parseInt(match[1]);
        console.log(`Attributing Order ${id} to Campaign ${campaignId}. Value: ${total_price}`);

        try {
            const db = getPool();
            // Update Revenue (Add to existing)
            await db.query('UPDATE campaigns SET revenue = revenue + $1 WHERE id = $2', [parseFloat(total_price || 0), campaignId]);

            // 2. TAG ORDER on Shopify (Via Remix App)
            const shopDomain = req.headers['x-shopify-shop-domain'];

            if (shopDomain) {
                // Call Remix App Internal API to Tag
                // We use fire-and-forget fetch to avoid blocking webhook response
                fetch('https://retner-smart-push.vercel.app/api/mark-push-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shop: shopDomain, orderId: id })
                }).catch(err => console.error('Tagging Call Failed:', err.message));
            }

        } catch (e) { console.error('Revenue Update Error', e); }
    } else {
        console.log('No Push Attribution found for Order', id);
    }

    res.status(200).send('OK');
});

// Broadcast API
app.post('/my-store/broadcast', async (req, res) => {
    const { storeId, title, message, url, image, icon, type, scheduledAt, expiryAt, btn1Text, btn1UrlRaw, btn2Text, btn2UrlRaw } = req.body;
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

        // Insert campaign first to get an ID for tracking
        const insertResult = await db.query(
            `INSERT INTO campaigns (store_id, title, message, url, image, status, type, scheduled_at, expiry_at, sent_count) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0) RETURNING id`,
            [storeId, title, message, url, image, scheduledAt ? 'scheduled' : 'sent', type || 'regular', scheduledAt, expiryAt]
        );
        const campId = insertResult.rows[0].id; // Get the generated ID

        // UTM Tracking Helper
        const appendUTM = (originalUrl, campaignId) => {
            if (!originalUrl) return originalUrl;
            const sep = originalUrl.indexOf('?') !== -1 ? '&' : '?';
            const campaign = encodeURIComponent(title.replace(/\s+/g, '-').toLowerCase());
            return originalUrl + sep + 'utm_source=push-retner&utm_medium=push&utm_campaign=push_camp_' + campaignId;
        };

        const finalUrl = appendUTM(url, campId);

        // Tracking Helper
        const createTrackingUrl = (destUrl, cid) => {
            const baseUrl = process.env.APP_URL || 'https://push-retner.vercel.app';
            return `${baseUrl}/track-click?url=${encodeURIComponent(destUrl)}&c=${cid}`;
        };

        const trackedMainUrl = createTrackingUrl(finalUrl, campId);

        const actions = [];
        if (btn1Text) actions.push({ action: createTrackingUrl(appendUTM(btn1UrlRaw || url, campId), campId), title: btn1Text });
        if (btn2Text) actions.push({ action: createTrackingUrl(appendUTM(btn2UrlRaw || url, campId), campId), title: btn2Text });

        // CHECK IF SCHEDULED (Future)
        if (scheduledAt) {
            const scheduleDate = new Date(scheduledAt);
            if (scheduleDate > new Date()) {
                // Campaign already saved as 'scheduled' above.
                return res.json({ success: true, sent: 0, status: 'scheduled' });
            }
        }

        // SEND IMMEDIATELY
        const subs = await SubscriptionModel.findByStore(storeId);

        const options = {
            vapidDetails: {
                subject: finalSubject,
                // Hardcoded New Keys (Rotated)
                publicKey: 'BJHfoHdkqKd_1TBdswVMLIR7bhhPoT1LvYLHfgXPo8Vxiy5co7fTCyr_rGv2eL-QV1bivLTw3kwo8Yhtmu2ioEE',
                privateKey: '7Tkx8ZMeTs-OnEXXtYzSHYAQIDnB6XiUpHBXSX_xHZk',
            }
        };

        // Calculate TTL (Time To Live) if Expiry is set
        if (expiryAt) {
            const ttlSeconds = Math.floor((new Date(expiryAt).getTime() - Date.now()) / 1000);
            if (ttlSeconds > 0) {
                options.TTL = ttlSeconds;
            }
        }

        // Fix: Ensure Icon is not Base64 (too large)
        let safeIcon = 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png';
        if (finalIcon && !finalIcon.startsWith('data:') && finalIcon.length < 500) {
            safeIcon = finalIcon;
        }

        const payload = JSON.stringify({
            title,
            body: message,
            icon: safeIcon,
            image: (image && !image.startsWith('data:')) ? image : null,
            badge: 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png',
            data: {
                id: campId,
                url: trackedMainUrl,
                expiryAt,
                type
            }
        });

        let sent = 0;
        let lastError = null;
        for (const sub of subs) {
            try {
                await webPush.sendNotification(
                    { endpoint: sub.endpoint, keys: sub.keys },
                    payload,
                    options
                );
                sent++;
            } catch (e) {
                console.error('Push failed', e.message);
                lastError = e.message;
                if (e.statusCode) lastError += ` (Status: ${e.statusCode})`;
                if (e.body) lastError += ` [${e.body}]`;
            }
        }

        // Update History (Sent Count)
        try {
            await db.query(
                `UPDATE campaigns SET sent_count = $1, status = 'sent' WHERE id = $2`,
                [sent, campId]
            );
        } catch (dbErr) { console.error('Failed to update campaign history:', dbErr); }

        res.json({ success: true, sent, status: 'sent', lastError });
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

        // Abandoned Cart Columns
        await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS abandoned_enabled BOOLEAN DEFAULT FALSE`);
        await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS abandoned_title TEXT`);
        await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS abandoned_body TEXT`);
        await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS abandoned_config TEXT`); // JSON for 3 reminders
        await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS abandoned_sent_count INT DEFAULT 0`);
        await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS abandoned_click_count INT DEFAULT 0`);

        const result = await db.query('SELECT welcome_enabled, welcome_title, welcome_body, welcome_sent_count, welcome_click_count, abandoned_enabled, abandoned_title, abandoned_body, abandoned_config, abandoned_sent_count, abandoned_click_count FROM stores WHERE store_id = $1', [storeId]);
        if (result.rows.length > 0) {
            res.json({ success: true, automations: result.rows[0] });
        } else {
            res.json({ success: false });
        }
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/my-store/update-automations', async (req, res) => {
    const { storeId, welcomeEnabled, welcomeTitle, welcomeBody, abandonedEnabled, abandonedTitle, abandonedBody, abandonedConfig } = req.body;
    try {
        const db = getPool();
        await db.query(`
            UPDATE stores SET 
            welcome_enabled = $1, welcome_title = $2, welcome_body = $3,
            abandoned_enabled = $4, abandoned_title = $5, abandoned_body = $6,
            abandoned_config = $7
            WHERE store_id = $8`,
            [welcomeEnabled, welcomeTitle, welcomeBody, abandonedEnabled, abandonedTitle, abandonedBody,
                abandonedConfig ? JSON.stringify(abandonedConfig) : null,
                storeId]);
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


        // Debug Info
        const allScheduled = await db.query("SELECT count(*) FROM campaigns WHERE status = 'scheduled'");
        const serverTime = new Date().toISOString();

        res.json({ success: true, processed, debug: { serverTime, pendingMatch: pending.rows.length, totalScheduled: allScheduled.rows[0].count } });

    } catch (e) {
        console.error("Cron Error", e);
        res.status(500).json({ error: e.message });
    }
});

/* =========================================
   SUPER ADMIN PANEL (Hidden Route)
   ========================================= */
const SUPER_PASS = 'piyush_admin_2025';

app.get('/master-admin', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Retner Super Admin</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>body{font-family: system-ui;} .container{max-width:1000px;}</style>
      </head>
      <body class="bg-light">
      <div class="container mt-5">
        <h2 class="mb-4">Retner Super Admin</h2>
        
        <div id="loginSection" class="card p-4 shadow-sm">
            <form id="loginForm">
                <label>Admin Password</label>
                <input type="password" id="adminPass" class="form-control mb-3" placeholder="Enter Password">
                <button type="submit" class="btn btn-primary w-100">Login</button>
            </form>
        </div>

        <div id="dashboardSection" style="display:none;" class="mt-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h3>All Stores</h3>
                <button class="btn btn-secondary btn-sm" onclick="location.reload()">Refresh</button>
            </div>
            <div class="card shadow-sm">
                <table class="table table-hover mb-0">
                    <thead class="table-dark">
                        <tr>
                            <th>Store ID (Name)</th>
                            <th>Email</th>
                            <th>Monthly Limit</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="storeTable"></tbody>
                </table>
            </div>
        </div>
      </div>

      <script>
        const API_URL = '/api/super';
        let adminToken = localStorage.getItem('super_token');

        if(adminToken) { showDashboard(); }

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pass = document.getElementById('adminPass').value;
            const res = await fetch(API_URL + '/login', { 
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body:JSON.stringify({pass}) 
            });
            const data = await res.json();
            if(data.success) {
                adminToken = data.token;
                localStorage.setItem('super_token', adminToken);
                showDashboard();
            } else { alert('Wrong Password'); }
        });

        function showDashboard() {
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('dashboardSection').style.display = 'block';
            loadStores();
        }

        async function loadStores() {
            const res = await fetch(API_URL + '/stores?token=' + adminToken);
            if(res.status === 403) { localStorage.removeItem('super_token'); location.reload(); return; }
            const data = await res.json();
            const tbody = document.getElementById('storeTable');
            tbody.innerHTML = data.stores.map(s => \`
                <tr>
                    <td>
                        <strong>\${s.store_name || s.store_id}</strong><br>
                        <small class="text-muted">\${s.store_id}</small>
                    </td>
                    <td>\${s.store_email || '-'}</td>
                    <td>
                        <div class="input-group input-group-sm" style="width:150px">
                            <input type="number" class="form-control" value="\${s.monthly_limit || 1000}" id="limit-\${s.store_id}">
                            <button class="btn btn-outline-success" onclick="updateLimit('\${s.store_id}')">Set</button>
                        </div>
                    </td>
                    <td>\${new Date(s.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteStore('\${s.store_id}')">Delete</button>
                    </td>
                </tr>
            \`).join('');
        }

        async function updateLimit(id) {
            const limit = document.getElementById('limit-'+id).value;
            await fetch(API_URL + '/update-limit', { 
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body:JSON.stringify({token:adminToken, store_id:id, limit}) 
            });
            alert('Limit Updated!');
        }

        async function deleteStore(id) {
            if(!confirm('Are you sure you want to DELETE ' + id + '? This cannot be undone.')) return;
            const res = await fetch(API_URL + '/delete-store', { 
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body:JSON.stringify({token:adminToken, store_id:id}) 
            });
            if(res.ok) { loadStores(); }
        }
      </script>
      </body>
      </html>
    `);
});

app.post('/api/super/login', (req, res) => {
    if (req.body.pass === SUPER_PASS) res.json({ success: true, token: 'super_secret_token_x99' });
    else res.json({ success: false });
});

app.get('/api/super/stores', async (req, res) => {
    if (req.query.token !== 'super_secret_token_x99') return res.status(403).json({});
    const db = getPool();
    // Ensure column exists
    try { await db.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS monthly_limit INTEGER DEFAULT 1000'); } catch (e) { }

    // Fetch
    const result = await db.query('SELECT * FROM stores ORDER BY created_at DESC');
    res.json({ stores: result.rows });
});

app.post('/api/super/update-limit', async (req, res) => {
    if (req.body.token !== 'super_secret_token_x99') return res.status(403).json({});
    const db = getPool();
    await db.query('UPDATE stores SET monthly_limit = $1 WHERE store_id = $2', [req.body.limit, req.body.store_id]);
    res.json({ success: true });
});

app.post('/api/super/delete-store', async (req, res) => {
    if (req.body.token !== 'super_secret_token_x99') return res.status(403).json({});
    const db = getPool();
    const storeId = req.body.store_id;

    try {
        console.log(`Deleting Store & Data for: ${storeId}`);
        // 1. Delete Campaigns
        await db.query('DELETE FROM campaigns WHERE store_id = $1', [storeId]);
        // 2. Delete Subscriptions (Users)
        await db.query('DELETE FROM subscriptions WHERE store_id = $1', [storeId]);
        // 3. Delete Store Account
        await db.query('DELETE FROM stores WHERE store_id = $1', [storeId]);

        res.json({ success: true });
    } catch (e) {
        console.error("Delete Store Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Privacy Policy Page
app.get('/privacy', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Privacy Policy - Retner Smart Push</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
                h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
                h2 { margin-top: 30px; color: #444; }
                .update-date { color: #666; font-style: italic; }
            </style>
        </head>
        <body>
            <h1>Privacy Policy</h1>
            <p class="update-date">Last updated: December 31, 2025</p>

            <p>Retner Smart Push ("we", "us", or "our") provides a web push notification service for Shopify merchants. This Privacy Policy describes how we collect, use, and handle your personal information when you use our app.</p>

            <h2>1. Information We Collect</h2>
            <p><strong>From Merchants:</strong> We collect your shop domain and basic store information provided by Shopify to identify your account.</p>
            <p><strong>From End Users (Store Visitors):</strong> We do NOT collect personal emails or phone numbers. We collect:</p>
            <ul>
                <li>Anonymous Push Subscription Tokens</li>
                <li>Device type (Desktop/Mobile)</li>
                <li>Browser language settings</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>We use the collected information solely to:</p>
            <ul>
                <li>Send web push notifications explicitly requested by the user.</li>
                <li>Provide analytics to the merchant (e.g., number of subscribers).</li>
                <li>Authenticate the merchant via Shopify's secure API.</li>
            </ul>

            <h2>3. Data Sharing</h2>
            <p>We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties.</p>

            <h2>4. Your Rights</h2>
            <p>Merchants and end-users have the right to access, correct, or delete their data. End-users can unsubscribe from notifications at any time via their browser settings.</p>

            <h2>5. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, please contact us at: <strong>Koregrowtech@gmail.com</strong></p>
        </body>
        </html>
    `);
});

module.exports = app;