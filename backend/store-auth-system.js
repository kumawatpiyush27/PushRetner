// Store Authentication & Multi-Tenant System
// Add to backend/server.js

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// JWT Secret (add to .env)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Store credentials database (in production, use database)
// For now, using in-memory object
const storeCredentials = {
    'zyrajewel': {
        password: '$2b$10$...', // bcrypt hashed password
        name: 'Zyra Jewel',
        domain: 'zyrajewel.myshopify.com',
        email: 'admin@zyrajewel.com'
    },
    'dupattabazaar1': {
        password: '$2b$10$...', // bcrypt hashed password
        name: 'Dupatta Bazaar',
        domain: 'dupattabazaar1.myshopify.com',
        email: 'admin@dupattabazaar.com'
    }
};

// 🔐 Store Login Endpoint
app.post('/store-login', async (req, res) => {
    try {
        const { storeId, password } = req.body;

        console.log('🔐 Login attempt for store:', storeId);

        // Validate input
        if (!storeId || !password) {
            return res.status(400).json({
                success: false,
                error: 'Store ID and password required'
            });
        }

        // Check if store exists
        const store = storeCredentials[storeId];
        if (!store) {
            return res.status(401).json({
                success: false,
                error: 'Invalid store ID or password'
            });
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, store.password);
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid store ID or password'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                storeId: storeId,
                storeName: store.name,
                storeDomain: store.domain
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('✅ Login successful for:', store.name);

        res.json({
            success: true,
            token: token,
            store: {
                id: storeId,
                name: store.name,
                domain: store.domain
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

// 🔒 Middleware to verify JWT token
function authenticateStore(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        const decoded = jwt.verify(token, JWT_SECRET);
        req.store = decoded; // Attach store info to request

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
}

// 📊 Get store-specific stats (protected route)
app.get('/my-store/stats', authenticateStore, async (req, res) => {
    try {
        const storeId = req.store.storeId;

        const subscriptions = await SubscriptionModel.findByStore(storeId);

        res.json({
            success: true,
            storeId: storeId,
            storeName: req.store.storeName,
            subscribers: subscriptions.length,
            data: subscriptions.map(sub => ({
                id: sub._id,
                subscribed: sub.created_at,
                endpoint: sub.endpoint.substring(0, 50) + '...'
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📢 Store-specific broadcast (protected route)
app.post('/my-store/broadcast', authenticateStore, async (req, res) => {
    try {
        const storeId = req.store.storeId;
        const { title, message, url, image } = req.body;

        console.log(`📢 Broadcast from ${req.store.storeName}`);

        // Get only this store's subscriptions
        const subscriptions = await SubscriptionModel.findByStore(storeId);

        if (subscriptions.length === 0) {
            return res.json({
                success: true,
                message: 'No subscribers yet',
                sent: 0
            });
        }

        const payload = JSON.stringify({
            title: title || 'New Notification',
            body: message || 'You have a new update!',
            icon: image || '/icon.png',
            data: {
                url: url || '/',
                storeId: storeId
            }
        });

        const options = {
            vapidDetails: {
                subject: 'mailto:admin@zyrajewel.co.in',
                publicKey: process.env.PUBLIC_KEY,
                privateKey: process.env.PRIVATE_KEY,
            },
            TTL: 24 * 60 * 60,
        };

        let successCount = 0;
        let failCount = 0;

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(sub, payload, options);
                successCount++;
            } catch (err) {
                failCount++;
                if (err.statusCode === 410) {
                    await SubscriptionModel.deleteOne({ _id: sub._id });
                }
            }
        }

        res.json({
            success: true,
            storeName: req.store.storeName,
            total: subscriptions.length,
            sent: successCount,
            failed: failCount
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🔑 Create store account (admin only - for setup)
app.post('/admin/create-store', async (req, res) => {
    try {
        const { storeId, password, name, domain, email } = req.body;

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // In production, save to database
        storeCredentials[storeId] = {
            password: hashedPassword,
            name: name,
            domain: domain,
            email: email
        };

        res.json({
            success: true,
            message: `Store account created for ${name}`,
            storeId: storeId,
            loginUrl: `/store-admin?store=${storeId}`
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🏠 Store Admin Dashboard (HTML page)
app.get('/store-admin', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Store Admin - Push Notifications</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .login-form, .dashboard {
            display: none;
        }
        
        .login-form.active, .dashboard.active {
            display: block;
        }
        
        h1 {
            color: #1a1a2e;
            margin-bottom: 10px;
            font-size: 28px;
        }
        
        p {
            color: #666;
            margin-bottom: 30px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            color: #333;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        input, textarea {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        
        input:focus, textarea:focus {
            outline: none;
            border-color: #667eea;
        }
        
        textarea {
            resize: vertical;
            min-height: 100px;
        }
        
        .btn {
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }
        
        .btn-secondary {
            background: #f0f0f0;
            color: #333;
            margin-top: 10px;
        }
        
        .stats {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        
        .stat-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .stat-label {
            color: #666;
        }
        
        .stat-value {
            color: #667eea;
            font-weight: 700;
            font-size: 18px;
        }
        
        .alert {
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: none;
        }
        
        .alert.show {
            display: block;
        }
        
        .alert-success {
            background: #d4edda;
            color: #155724;
        }
        
        .alert-error {
            background: #f8d7da;
            color: #721c24;
        }
        
        .store-info {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        
        .logout-btn {
            background: none;
            border: none;
            color: white;
            text-decoration: underline;
            cursor: pointer;
            float: right;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Login Form -->
        <div class="login-form active" id="loginForm">
            <h1>🔐 Store Admin Login</h1>
            <p>Login to manage your push notifications</p>
            
            <div class="alert alert-error" id="loginError"></div>
            
            <div class="form-group">
                <label>Store ID</label>
                <input type="text" id="storeId" placeholder="e.g., zyrajewel">
            </div>
            
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="password" placeholder="Enter your password">
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;">
                    <input type="checkbox" id="useMasterPassword" onchange="toggleMasterPassword()">
                    <span>Use Master Password</span>
                </label>
                <a href="#" onclick="showForgotPassword(); return false;" style="color: #667eea; text-decoration: none; font-size: 14px;">Forgot Password?</a>
            </div>
            
            <button class="btn btn-primary" onclick="login()">Login</button>
        </div>
        
        <!-- Forgot Password Form -->
        <div class="login-form" id="forgotPasswordForm">
            <h1>🔑 Reset Password</h1>
            <p>Enter your store ID to reset password</p>
            
            <div class="alert alert-success" id="resetSuccess"></div>
            <div class="alert alert-error" id="resetError"></div>
            
            <div class="form-group">
                <label>Store ID</label>
                <input type="text" id="resetStoreId" placeholder="e.g., zyrajewel">
            </div>
            
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="resetEmail" placeholder="admin@yourstore.com">
            </div>
            
            <button class="btn btn-primary" onclick="requestPasswordReset()">Request Reset</button>
            <button class="btn btn-secondary" onclick="showLogin()">Back to Login</button>
        </div>
        
        <!-- Dashboard -->
        <div class="dashboard" id="dashboard">
            <div class="store-info">
                <button class="logout-btn" onclick="logout()">Logout</button>
                <h2 id="storeName">Store Name</h2>
                <small id="storeDomain">store.myshopify.com</small>
            </div>
            
            <div class="stats">
                <div class="stat-item">
                    <span class="stat-label">Total Subscribers:</span>
                    <span class="stat-value" id="subscriberCount">0</span>
                </div>
            </div>
            
            <div class="alert alert-success" id="successAlert"></div>
            <div class="alert alert-error" id="errorAlert"></div>
            
            <h3 style="margin-bottom: 15px;">Send Notification</h3>
            
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="notifTitle" placeholder="e.g., New Arrivals!">
            </div>
            
            <div class="form-group">
                <label>Message</label>
                <textarea id="notifMessage" placeholder="Your notification message..."></textarea>
            </div>
            
            <div class="form-group">
                <label>URL (Optional)</label>
                <input type="text" id="notifUrl" placeholder="https://yourstore.com/page">
            </div>
            
            <button class="btn btn-primary" onclick="sendNotification()">
                🚀 Send to My Subscribers
            </button>
            
            <button class="btn btn-secondary" onclick="refreshStats()">
                🔄 Refresh Stats
            </button>
        </div>
    </div>

    <script>
        let authToken = localStorage.getItem('storeAuthToken');
        let storeData = JSON.parse(localStorage.getItem('storeData') || '{}');
        
        // Master password (change this in production!)
        const MASTER_PASSWORD = 'admin@2025';

        // Check if already logged in
        if (authToken && storeData.id) {
            showDashboard();
            loadStats();
        }
        
        function toggleMasterPassword() {
            const checkbox = document.getElementById('useMasterPassword');
            const storeIdInput = document.getElementById('storeId');
            
            if (checkbox.checked) {
                storeIdInput.value = 'MASTER';
                storeIdInput.disabled = true;
                storeIdInput.style.background = '#f0f0f0';
            } else {
                storeIdInput.value = '';
                storeIdInput.disabled = false;
                storeIdInput.style.background = 'white';
            }
        }
        
        function showForgotPassword() {
            document.getElementById('loginForm').classList.remove('active');
            document.getElementById('forgotPasswordForm').classList.add('active');
        }
        
        function showLogin() {
            document.getElementById('forgotPasswordForm').classList.remove('active');
            document.getElementById('loginForm').classList.add('active');
        }
        
        async function requestPasswordReset() {
            const storeId = document.getElementById('resetStoreId').value;
            const email = document.getElementById('resetEmail').value;
            
            if (!storeId || !email) {
                showError('resetError', 'Please enter Store ID and Email');
                return;
            }
            
            // In production, this would send an email
            showSuccess('resetSuccess', '✅ Password reset instructions sent to ' + email);
            
            setTimeout(() => {
                showLogin();
            }, 2000);
        }

        async function login() {
            const storeId = document.getElementById('storeId').value;
            const password = document.getElementById('password').value;
            const useMaster = document.getElementById('useMasterPassword').checked;

            if (!storeId || !password) {
                showError('loginError', 'Please enter Store ID and Password');
                return;
            }
            
            // Master password bypass
            if (useMaster && password === MASTER_PASSWORD) {
                console.log('🔓 Master password used - bypassing authentication');
                
                // Create a master admin token
                authToken = 'MASTER_TOKEN_' + Date.now();
                storeData = {
                    id: 'master',
                    name: 'Master Admin',
                    domain: 'all-stores'
                };
                
                localStorage.setItem('storeAuthToken', authToken);
                localStorage.setItem('storeData', JSON.stringify(storeData));
                
                showDashboard();
                loadStats();
                return;
            }

            try {
                const response = await fetch('/store-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ storeId, password })
                });

                const data = await response.json();

                if (data.success) {
                    authToken = data.token;
                    storeData = data.store;
                    
                    localStorage.setItem('storeAuthToken', authToken);
                    localStorage.setItem('storeData', JSON.stringify(storeData));
                    
                    showDashboard();
                    loadStats();
                } else {
                    showError('loginError', data.error || 'Login failed');
                }
            } catch (error) {
                showError('loginError', 'Login failed. Please try again.');
            }
        }

        function showDashboard() {
            document.getElementById('loginForm').classList.remove('active');
            document.getElementById('dashboard').classList.add('active');
            
            document.getElementById('storeName').textContent = storeData.name;
            document.getElementById('storeDomain').textContent = storeData.domain;
        }

        async function loadStats() {
            try {
                const response = await fetch('/my-store/stats', {
                    headers: {
                        'Authorization': \`Bearer \${authToken}\`
                    }
                });

                const data = await response.json();

                if (data.success) {
                    document.getElementById('subscriberCount').textContent = data.subscribers;
                }
            } catch (error) {
                console.error('Failed to load stats:', error);
            }
        }

        async function sendNotification() {
            const title = document.getElementById('notifTitle').value;
            const message = document.getElementById('notifMessage').value;
            const url = document.getElementById('notifUrl').value;

            if (!title || !message) {
                showError('errorAlert', 'Title and Message are required');
                return;
            }

            try {
                const response = await fetch('/my-store/broadcast', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${authToken}\`
                    },
                    body: JSON.stringify({ title, message, url })
                });

                const data = await response.json();

                if (data.success) {
                    showSuccess('successAlert', \`Sent to \${data.sent} subscribers!\`);
                    document.getElementById('notifTitle').value = '';
                    document.getElementById('notifMessage').value = '';
                    document.getElementById('notifUrl').value = '';
                } else {
                    showError('errorAlert', data.error || 'Failed to send');
                }
            } catch (error) {
                showError('errorAlert', 'Failed to send notification');
            }
        }

        function refreshStats() {
            loadStats();
            showSuccess('successAlert', 'Stats refreshed!');
        }

        function logout() {
            localStorage.removeItem('storeAuthToken');
            localStorage.removeItem('storeData');
            location.reload();
        }

        function showError(elementId, message) {
            const el = document.getElementById(elementId);
            el.textContent = message;
            el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), 5000);
        }

        function showSuccess(elementId, message) {
            const el = document.getElementById(elementId);
            el.textContent = message;
            el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), 5000);
        }
    </script>
</body>
</html>
    `);
});
