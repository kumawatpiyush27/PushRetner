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
app.use(express.static('public'));
app.use(express.static('../frontend/build'));

app.get('/', (req, res) => {
    res.sendFile(require('path').join(__dirname, '../frontend/build/index.html'));
});

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
                <title>Zyra Push - Admin Dashboard</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <meta charset="UTF-8">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: #f8f9fa;
                        color: #333;
                    }
                    
                    .sidebar {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: 260px;
                        height: 100vh;
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                        padding: 25px;
                        overflow-y: auto;
                        z-index: 1000;
                    }
                    
                    .logo { 
                        font-size: 20px; 
                        font-weight: 700; 
                        margin-bottom: 35px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    
                    .nav-item { 
                        padding: 13px 16px; 
                        margin-bottom: 8px; 
                        border-radius: 8px; 
                        cursor: pointer;
                        transition: all 0.3s;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        font-size: 14px;
                    }
                    
                    .nav-item:hover { 
                        background: rgba(102, 126, 234, 0.15); 
                    }
                    
                    .nav-item.active { 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        font-weight: 600;
                    }
                    
                    .main-content {
                        margin-left: 260px;
                        padding: 35px;
                    }
                    
                    .header { 
                        margin-bottom: 35px; 
                    }
                    
                    .header h1 { 
                        font-size: 30px; 
                        margin-bottom: 8px;
                        color: #1a1a2e;
                    }
                    
                    .header p { 
                        color: #999; 
                    }
                    
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
                        gap: 20px;
                        margin-bottom: 35px;
                    }
                    
                    .stat-card {
                        background: white;
                        padding: 25px;
                        border-radius: 12px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                        border-top: 4px solid;
                        border-image: linear-gradient(135deg, #667eea, #764ba2) 1;
                    }
                    
                    .stat-label { 
                        color: #999; 
                        font-size: 12px; 
                        margin-bottom: 12px;
                        text-transform: uppercase;
                        letter-spacing: 0.8px;
                        font-weight: 600;
                    }
                    
                    .stat-value { 
                        font-size: 36px; 
                        font-weight: 700; 
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    }
                    
                    .section { 
                        background: white; 
                        padding: 30px; 
                        border-radius: 12px; 
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                        margin-bottom: 25px;
                    }
                    
                    .section-title { 
                        font-size: 18px; 
                        font-weight: 600; 
                        margin-bottom: 22px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        color: #1a1a2e;
                    }
                    
                    .form-group { 
                        margin-bottom: 20px; 
                    }
                    
                    label { 
                        display: block; 
                        margin-bottom: 8px; 
                        font-weight: 600;
                        font-size: 14px;
                        color: #1a1a2e;
                    }
                    
                    input, textarea { 
                        width: 100%; 
                        padding: 12px 14px; 
                        border: 2px solid #e8e8e8; 
                        border-radius: 8px; 
                        font-size: 14px;
                        font-family: inherit;
                        transition: border 0.3s, box-shadow 0.3s;
                    }
                    
                    input:focus, textarea:focus { 
                        outline: none; 
                        border-color: #667eea;
                        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                    }
                    
                    .form-row { 
                        display: grid; 
                        grid-template-columns: 1fr 1fr; 
                        gap: 18px;
                    }
                    
                    button { 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white; 
                        border: none; 
                        padding: 13px 28px; 
                        border-radius: 8px; 
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                        display: inline-block;
                    }
                    
                    button:hover { 
                        transform: translateY(-2px);
                        box-shadow: 0 12px 24px rgba(102, 126, 234, 0.3);
                    }
                    
                    button:disabled { 
                        opacity: 0.6; 
                        cursor: not-allowed;
                        transform: none;
                    }
                    
                    .status { 
                        margin-top: 18px; 
                        padding: 14px 16px; 
                        border-radius: 8px;
                        display: none;
                        border-left: 4px solid;
                        font-size: 14px;
                    }
                    
                    .success { 
                        background: #ecfdf5; 
                        color: #047857;
                        border-color: #10b981;
                    }
                    
                    .error { 
                        background: #fef2f2; 
                        color: #dc2626;
                        border-color: #ef4444;
                    }
                    
                    .tab-buttons {
                        display: flex;
                        gap: 8px;
                        margin-bottom: 25px;
                        border-bottom: 2px solid #e8e8e8;
                    }
                    
                    .tab-btn {
                        background: none;
                        border: none;
                        padding: 14px 0;
                        margin-right: 24px;
                        font-size: 14px;
                        font-weight: 600;
                        color: #999;
                        cursor: pointer;
                        border-bottom: 3px solid transparent;
                        margin-bottom: -2px;
                        transition: all 0.3s;
                    }
                    
                    .tab-btn.active {
                        color: #667eea;
                        border-bottom-color: #667eea;
                    }
                    
                    .tab-content { display: none; }
                    .tab-content.active { display: block; }
                    
                    .feature-item {
                        padding: 16px;
                        background: #f8f9fa;
                        border-radius: 8px;
                        margin-bottom: 12px;
                        border-left: 4px solid #667eea;
                    }
                    
                    .feature-item strong { color: #1a1a2e; }
                    .feature-item p { color: #666; font-size: 13px; margin-top: 4px; }
                    
                    @media (max-width: 768px) {
                        .sidebar { width: 100%; height: auto; position: relative; }
                        .main-content { margin-left: 0; padding: 20px; }
                        .form-row { grid-template-columns: 1fr; }
                        .stats-grid { grid-template-columns: 1fr; }
                    }
                </style>
            </head>
            <body>
                <!-- Sidebar -->
                <div class="sidebar">
                    <div class="logo">📬 Zyra Push</div>
                    <div class="nav-item active" onclick="switchTab('dashboard')">📊 Dashboard</div>
                    <div class="nav-item" onclick="switchTab('campaigns')">📧 Campaigns</div>
                    <div class="nav-item" onclick="switchTab('automations')">⚙️ Automations</div>
                    <div class="nav-item" onclick="switchTab('subscribers')">👥 Subscribers</div>
                </div>
                
                <!-- Main Content -->
                <div class="main-content">
                    <!-- Dashboard Tab -->
                    <div id="dashboard" class="tab-content active">
                        <div class="header">
                            <h1>Welcome to Zyra Push 👋</h1>
                            <p>Manage your push notifications efficiently</p>
                        </div>
                        
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-label">📈 Total Subscribers</div>
                                <div class="stat-value" id="total-subs">0</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">📤 Campaigns Sent</div>
                                <div class="stat-value" id="campaigns-sent">0</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">✅ Success Rate</div>
                                <div class="stat-value" id="success-rate">100%</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">👁️ Impressions</div>
                                <div class="stat-value" id="impressions">0</div>
                            </div>
                        </div>
                        
                        <div class="section">
                            <div class="section-title">🚀 Quick Send Campaign</div>
                            <div class="form-group">
                                <label>Campaign Title</label>
                                <input type="text" id="quick-title" placeholder="Big Sale Alert!" value="Big Sale Alert! 🚀">
                            </div>
                            <div class="form-group">
                                <label>Message</label>
                                <textarea id="quick-message" rows="3" placeholder="Enter your message...">Get 20% off on all items! Limited time only.</textarea>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Link URL</label>
                                    <input type="text" id="quick-url" placeholder="https://zyrajewel.co.in" value="https://zyrajewel.co.in">
                                </div>
                            </div>
                            <button onclick="sendQuickCampaign()">🚀 Send Campaign</button>
                            <div id="quick-status" class="status"></div>
                        </div>
                    </div>
                    
                    <!-- Campaigns Tab -->
                    <div id="campaigns" class="tab-content">
                        <div class="header">
                            <h1>📧 Campaigns</h1>
                            <p>Create and manage campaigns</p>
                        </div>
                        
                        <!-- Campaign List View -->
                        <div id="campaigns-list-view" class="section">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                <div class="section-title" style="margin: 0;">📋 Recent Campaigns</div>
                                <button onclick="switchCampaignView('create')" style="padding: 8px 16px; font-size: 13px;">+ New Campaign</button>
                            </div>
                            <div id="campaigns-history" style="color: #999; text-align: center; padding: 40px;">
                                <p>No campaigns yet. Create your first campaign!</p>
                            </div>
                        </div>

                        <!-- Campaign Creation Flow -->
                        <div id="campaigns-create-view" style="display: none;">
                            <!-- Step 1: Campaign Details -->
                            <div id="step1" class="section">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                                    <div>
                                        <div class="section-title" style="margin: 0;">Step 1: Campaign Details</div>
                                        <p style="color: #999; font-size: 13px; margin-top: 5px;">Add basic information</p>
                                    </div>
                                    <div style="background: #f0f0f0; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">1/4</div>
                                </div>

                                <div class="form-group">
                                    <label>Campaign Name *</label>
                                    <input type="text" id="camp-name" placeholder="e.g., Black Friday Sale">
                                </div>
                                <div class="form-group">
                                    <label>Campaign Type</label>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 12px; border: 2px solid #e8e8e8; border-radius: 8px;">
                                            <input type="radio" name="type" value="regular" checked>
                                            <span style="font-weight: normal;">Regular Campaign</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 12px; border: 2px solid #e8e8e8; border-radius: 8px; opacity: 0.5;">
                                            <input type="radio" name="type" value="flash" disabled>
                                            <span style="font-weight: normal;">Flash Sale</span>
                                        </label>
                                    </div>
                                </div>

                                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 25px;">
                                    <button onclick="switchCampaignView('list')" style="background: #f0f0f0; color: #333;">Cancel</button>
                                    <button onclick="goToStep(2)">Next: Message →</button>
                                </div>
                            </div>

                            <!-- Step 2: Message Content -->
                            <div id="step2" class="section" style="display: none;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                                    <div>
                                        <div class="section-title" style="margin: 0;">Step 2: Message Content</div>
                                        <p style="color: #999; font-size: 13px; margin-top: 5px;">Compose your notification</p>
                                    </div>
                                    <div style="background: #f0f0f0; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">2/4</div>
                                </div>

                                <div class="form-group">
                                    <label>Notification Title *</label>
                                    <input type="text" id="camp-title" placeholder="e.g., Mega Sale Alert!" maxlength="50" oninput="updatePreview()">
                                    <small style="color: #999; margin-top: 5px; display: block;"><span id="title-count">0</span>/50</small>
                                </div>
                                <div class="form-group">
                                    <label>Message *</label>
                                    <textarea id="camp-message" rows="4" placeholder="e.g., Get 50% off on all items!" maxlength="200" oninput="updatePreview()"></textarea>
                                    <small style="color: #999; margin-top: 5px; display: block;"><span id="message-count">0</span>/200</small>
                                </div>

                                <!-- Live Preview -->
                                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #667eea;">
                                    <p style="font-size: 12px; color: #999; margin-bottom: 8px;">📱 Preview</p>
                                    <div style="background: white; padding: 12px; border-radius: 6px;">
                                        <strong id="preview-title" style="display: block; font-size: 14px; margin-bottom: 4px;">Notification Title</strong>
                                        <p id="preview-message" style="font-size: 12px; color: #666; margin: 0;">Your message here</p>
                                    </div>
                                </div>

                                <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 25px;">
                                    <button onclick="goToStep(1)" style="background: #f0f0f0; color: #333;">← Back</button>
                                    <button onclick="goToStep(3)">Next: Link & Options →</button>
                                </div>
                            </div>

                            <!-- Step 3: Link & Settings -->
                            <div id="step3" class="section" style="display: none;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                                    <div>
                                        <div class="section-title" style="margin: 0;">Step 3: Link & Media</div>
                                        <p style="color: #999; font-size: 13px; margin-top: 5px;">Add destination, images, and icons</p>
                                    </div>
                                    <div style="background: #f0f0f0; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">3/4</div>
                                </div>

                                <div class="form-group">
                                    <label>Link URL (Optional)</label>
                                    <input type="text" id="camp-link" placeholder="https://zyrajewel.co.in" value="https://zyrajewel.co.in">
                                </div>

                                <!-- Image Upload -->
                                <div class="form-group">
                                    <label>Campaign Image (Optional)</label>
                                    <div style="border: 2px dashed #e8e8e8; padding: 20px; border-radius: 8px; text-align: center; cursor: pointer;" onclick="document.getElementById('image-input').click()">
                                        <div id="image-preview" style="display: none; margin-bottom: 15px;">
                                            <img id="preview-img" src="" style="max-width: 100%; max-height: 200px; border-radius: 6px;">
                                        </div>
                                        <div id="image-placeholder">
                                            <p style="font-size: 20px; margin: 0;">📸</p>
                                            <p style="margin: 8px 0 0 0; color: #999; font-size: 13px;">Click to upload image or drag & drop</p>
                                        </div>
                                    </div>
                                    <input type="file" id="image-input" accept="image/*" style="display: none;" onchange="handleImageUpload(event)">
                                    <small style="color: #999; margin-top: 5px; display: block;">Supported: PNG, JPG, GIF (Max 2MB)</small>
                                </div>

                                <!-- Icon Selection -->
                                <div class="form-group">
                                    <label>Notification Icon</label>
                                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                                        <label style="display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; padding: 12px; border: 2px solid #e8e8e8; border-radius: 8px; text-align: center;">
                                            <input type="radio" name="icon" value="🔔" checked onchange="updatePreview()">
                                            <span style="font-size: 20px;">🔔</span>
                                        </label>
                                        <label style="display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; padding: 12px; border: 2px solid #e8e8e8; border-radius: 8px; text-align: center;">
                                            <input type="radio" name="icon" value="🎉" onchange="updatePreview()">
                                            <span style="font-size: 20px;">🎉</span>
                                        </label>
                                        <label style="display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; padding: 12px; border: 2px solid #e8e8e8; border-radius: 8px; text-align: center;">
                                            <input type="radio" name="icon" value="💰" onchange="updatePreview()">
                                            <span style="font-size: 20px;">💰</span>
                                        </label>
                                        <label style="display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; padding: 12px; border: 2px solid #e8e8e8; border-radius: 8px; text-align: center;">
                                            <input type="radio" name="icon" value="⭐" onchange="updatePreview()">
                                            <span style="font-size: 20px;">⭐</span>
                                        </label>
                                        <label style="display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; padding: 12px; border: 2px solid #e8e8e8; border-radius: 8px; text-align: center;">
                                            <input type="radio" name="icon" value="🎁" onchange="updatePreview()">
                                            <span style="font-size: 20px;">🎁</span>
                                        </label>
                                        <label style="display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; padding: 12px; border: 2px solid #e8e8e8; border-radius: 8px; text-align: center;">
                                            <input type="radio" name="icon" value="🚀" onchange="updatePreview()">
                                            <span style="font-size: 20px;">🚀</span>
                                        </label>
                                        <label style="display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; padding: 12px; border: 2px solid #e8e8e8; border-radius: 8px; text-align: center;">
                                            <input type="radio" name="icon" value="❤️" onchange="updatePreview()">
                                            <span style="font-size: 20px;">❤️</span>
                                        </label>
                                        <label style="display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; padding: 12px; border: 2px solid #e8e8e8; border-radius: 8px; text-align: center;">
                                            <input type="radio" name="icon" value="✅" onchange="updatePreview()">
                                            <span style="font-size: 20px;">✅</span>
                                        </label>
                                    </div>
                                </div>

                                <!-- Action Buttons -->
                                <div class="form-group">
                                    <label>Action Buttons (Optional)</label>
                                    <div id="buttons-list" style="margin-bottom: 12px;">
                                        <!-- Buttons will be added here -->
                                    </div>
                                    <button type="button" onclick="addButton()" style="background: #667eea; font-size: 13px; padding: 8px 16px; width: auto;">+ Add Button</button>
                                </div>

                                <!-- Target Audience -->
                                <div class="form-group">
                                    <label>Target Audience</label>
                                    <select style="width: 100%; padding: 12px; border: 2px solid #e8e8e8; border-radius: 8px; font-family: inherit;">
                                        <option>All Subscribers</option>
                                        <option disabled>New Subscribers (Coming Soon)</option>
                                        <option disabled>Engaged Users (Coming Soon)</option>
                                    </select>
                                </div>

                                <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 25px;">
                                    <button onclick="goToStep(2)" style="background: #f0f0f0; color: #333;">← Back</button>
                                    <button onclick="goToStep(4)">Next: Send Options →</button>
                                </div>
                            </div>

                            <!-- Step 4: Send Options -->
                            <div id="step4" class="section" style="display: none;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                                    <div>
                                        <div class="section-title" style="margin: 0;">Step 4: Send Options</div>
                                        <p style="color: #999; font-size: 13px; margin-top: 5px;">Choose when to send</p>
                                    </div>
                                    <div style="background: #667eea; color: white; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">4/4</div>
                                </div>

                                <div class="form-group">
                                    <label>Sending Option</label>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 12px; border: 2px solid #667eea; border-radius: 8px; background: #f0f3ff;">
                                            <input type="radio" name="send" value="now" checked>
                                            <span style="font-weight: normal;">Send Now</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 12px; border: 2px solid #e8e8e8; border-radius: 8px; opacity: 0.5;">
                                            <input type="radio" name="send" value="schedule" disabled>
                                            <span style="font-weight: normal;">Schedule (Premium)</span>
                                        </label>
                                    </div>
                                </div>

                                <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
                                    <p style="margin: 0; color: #047857; font-size: 14px;">
                                        <strong>✅ Ready to send</strong><br>
                                        <span style="font-size: 12px;">This campaign will be sent to <strong id="audience-count">0</strong> subscribers</span>
                                    </p>
                                </div>

                                <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 25px;">
                                    <button onclick="goToStep(3)" style="background: #f0f0f0; color: #333;">← Back</button>
                                    <button onclick="submitCampaign()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); font-weight: 700;">🚀 Send Campaign</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Automations Tab -->
                    <div id="automations" class="tab-content">
                        <div class="header">
                            <h1>⚙️ Automations</h1>
                            <p>Automated campaigns</p>
                        </div>
                        
                        <div class="section">
                            <div class="section-title">Welcome Notifications</div>
                            <div class="feature-item">
                                <strong>✅ Active</strong>
                                <p>Automatic welcome message sent when users subscribe</p>
                            </div>
                        </div>
                        
                        <div class="section">
                            <div class="section-title">Coming Soon</div>
                            <div class="feature-item">
                                <strong>🔜 Abandoned Cart Recovery</strong>
                                <p>Remind users about items left in their cart</p>
                            </div>
                            <div class="feature-item">
                                <strong>🔜 Follow-up Sequences</strong>
                                <p>Send automated follow-up campaigns</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Subscribers Tab -->
                    <div id="subscribers" class="tab-content">
                        <div class="header">
                            <h1>👥 Subscribers</h1>
                            <p>Manage subscriber list</p>
                        </div>
                        
                        <div class="section">
                            <div class="feature-item">
                                <strong>Total Active Subscribers: <span id="sub-count" style="color: #667eea;">0</span></strong>
                                <p>All active subscriptions ready to receive campaigns</p>
                            </div>
                        </div>
                    </div>
                </div>

                <script>
                    function switchTab(tabName) {
                        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
                        document.getElementById(tabName).classList.add('active');
                        event.target.classList.add('active');
                    }

                    async function loadStats() {
                        try {
                            const res = await fetch('/stats');
                            const data = await res.json();
                            document.getElementById('total-subs').textContent = data.count;
                            document.getElementById('sub-count').textContent = data.count;
                        } catch (e) {
                            console.error('Error:', e);
                        }
                    }

                    async function sendQuickCampaign() {
                        const btn = event.target;
                        const status = document.getElementById('quick-status');
                        btn.disabled = true;
                        btn.textContent = '⏳ Sending...';

                        const data = {
                            title: document.getElementById('quick-title').value,
                            message: document.getElementById('quick-message').value,
                            url: document.getElementById('quick-url').value,
                            icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png'
                        };

                        try {
                            const res = await fetch('/broadcast', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            
                            const result = await res.json();
                            
                            if (!res.ok) throw new Error(result.error);
                            
                            status.textContent = '✅ ' + result.message + ' (' + result.sent + ' sent)';
                            status.className = 'status success';
                            document.getElementById('campaigns-sent').textContent = parseInt(document.getElementById('campaigns-sent').textContent || '0') + 1;
                            document.getElementById('success-rate').textContent = ((result.sent / result.totalSubscribers) * 100).toFixed(0) + '%';
                            document.getElementById('impressions').textContent = parseInt(document.getElementById('impressions').textContent || '0') + result.sent;
                        } catch (err) {
                            status.textContent = '❌ Error: ' + err.message;
                            status.className = 'status error';
                        }
                        
                        status.style.display = 'block';
                        btn.disabled = false;
                        btn.textContent = '🚀 Send Campaign';
                    }

                    function createCampaign() {
                        const name = document.getElementById('campaign-name').value;
                        if (!name) {
                            alert('Please enter campaign name');
                            return;
                        }
                        alert('Campaign saved! Ready to send.');
                    }

                    // Campaign Flow Functions
                    function switchCampaignView(view) {
                        if (view === 'list') {
                            document.getElementById('campaigns-list-view').style.display = 'block';
                            document.getElementById('campaigns-create-view').style.display = 'none';
                        } else {
                            document.getElementById('campaigns-list-view').style.display = 'none';
                            document.getElementById('campaigns-create-view').style.display = 'block';
                            goToStep(1);
                        }
                    }

                    function goToStep(stepNum) {
                        // Hide all steps
                        for (let i = 1; i <= 4; i++) {
                            document.getElementById('step' + i).style.display = 'none';
                        }
                        // Show current step
                        document.getElementById('step' + stepNum).style.display = 'block';
                        // Scroll to top
                        document.querySelector('.main-content').scrollTop = 0;
                    }

                    function updatePreview() {
                        const title = document.getElementById('camp-title').value || 'Notification Title';
                        const message = document.getElementById('camp-message').value || 'Your message here';
                        const icon = document.querySelector('input[name="icon"]:checked').value || '🔔';
                        
                        document.getElementById('preview-title').textContent = icon + ' ' + title;
                        document.getElementById('preview-message').textContent = message;
                        
                        // Update character counts
                        document.getElementById('title-count').textContent = document.getElementById('camp-title').value.length;
                        document.getElementById('message-count').textContent = document.getElementById('camp-message').value.length;
                    }

                    function handleImageUpload(event) {
                        const file = event.target.files[0];
                        if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                                alert('Image size must be less than 2MB');
                                return;
                            }
                            
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                document.getElementById('preview-img').src = e.target.result;
                                document.getElementById('image-preview').style.display = 'block';
                                document.getElementById('image-placeholder').style.display = 'none';
                                document.getElementById('image-input').dataset.base64 = e.target.result;
                            };
                            reader.readAsDataURL(file);
                        }
                    }

                    let buttonCount = 0;
                    function addButton() {
                        buttonCount++;
                        const buttonsList = document.getElementById('buttons-list');
                        const buttonDiv = document.createElement('div');
                        buttonDiv.id = 'button-' + buttonCount;
                        buttonDiv.style.display = 'flex';
                        buttonDiv.style.gap = '8px';
                        buttonDiv.style.marginBottom = '10px';
                        buttonDiv.innerHTML = '<input type="text" placeholder="Button text" maxlength="20" style="flex: 1; padding: 8px; border: 2px solid #e8e8e8; border-radius: 6px; font-size: 13px;"><input type="text" placeholder="Button URL" style="flex: 1.5; padding: 8px; border: 2px solid #e8e8e8; border-radius: 6px; font-size: 13px;"><button type="button" onclick="removeButton(' + buttonCount + ')" style="background: #ff6b6b; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 13px;">✕</button>';
                        buttonsList.appendChild(buttonDiv);
                    }

                    function removeButton(id) {
                        const element = document.getElementById('button-' + id);
                        if (element) element.remove();
                    }

                    async function submitCampaign() {
                        const name = document.getElementById('camp-name').value;
                        const title = document.getElementById('camp-title').value;
                        const message = document.getElementById('camp-message').value;
                        const link = document.getElementById('camp-link').value;

                        if (!name || !title || !message) {
                            alert('Please fill in all required fields');
                            return;
                        }

                        const btn = event.target;
                        btn.disabled = true;
                        btn.textContent = '⏳ Sending...';

                        try {
                            const res = await fetch('/broadcast', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    title: title,
                                    message: message,
                                    url: link || 'https://zyrajewel.co.in',
                                    icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png'
                                })
                            });

                            const result = await res.json();

                            if (!res.ok) throw new Error(result.error);

                            alert('✅ Campaign sent successfully to ' + result.sent + ' subscribers!');
                            
                            // Update stats
                            document.getElementById('campaigns-sent').textContent = parseInt(document.getElementById('campaigns-sent').textContent || '0') + 1;
                            document.getElementById('success-rate').textContent = ((result.sent / result.totalSubscribers) * 100).toFixed(0) + '%';

                            // Reset form and go back to list
                            document.getElementById('camp-name').value = '';
                            document.getElementById('camp-title').value = '';
                            document.getElementById('camp-message').value = '';
                            document.getElementById('camp-link').value = 'https://zyrajewel.co.in';
                            switchCampaignView('list');
                        } catch (err) {
                            alert('❌ Error: ' + err.message);
                        }

                        btn.disabled = false;
                        btn.textContent = '🚀 Send Campaign';
                    }

                    window.addEventListener('load', () => {
                        loadStats();
                        // Load audience count
                        fetch('/stats')
                            .then(r => r.json())
                            .then(d => {
                                document.getElementById('audience-count').textContent = d.count;
                            });
                    });
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
    const { title, message, icon, url, image, buttons } = req.body;

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
                        image: image || icon || 'https://cdn2.vectorstock.com/i/thumb-large/94/66/emoji-smile-icon-symbol-smiley-face-vector-26119466.jpg',
                        buttons: buttons || [],
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
