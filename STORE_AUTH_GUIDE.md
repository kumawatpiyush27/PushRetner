# 🔐 Store-Specific Admin System - Complete Guide

## 🎯 **Solution Overview:**

Instead of dropdown with all stores, each store owner gets their own login!

```
Store Owner → Login → See ONLY their data → Send to ONLY their subscribers
```

---

## 🏗️ **Architecture:**

```
Zyra Owner Login
    ↓
Username: zyrajewel
Password: ****
    ↓
Dashboard shows:
- Zyra subscribers only (150)
- Send button → sends to Zyra customers only
- Cannot see other stores' data

Dupatta Owner Login
    ↓
Username: dupattabazaar1
Password: ****
    ↓
Dashboard shows:
- Dupatta subscribers only (89)
- Send button → sends to Dupatta customers only
- Cannot see other stores' data
```

---

## 🔑 **Features:**

### **1. Secure Authentication**
- ✅ JWT tokens
- ✅ Bcrypt password hashing
- ✅ 24-hour session
- ✅ Auto-logout on token expiry

### **2. Store Isolation**
- ✅ Each store sees ONLY their data
- ✅ Cannot access other stores
- ✅ Cannot send to other stores
- ✅ Completely isolated

### **3. Simple Dashboard**
- ✅ Login page
- ✅ Subscriber count
- ✅ Send notification form
- ✅ Real-time stats
- ✅ Mobile-friendly

---

## 🚀 **Setup Instructions:**

### **Step 1: Install Dependencies**

```bash
cd backend
npm install jsonwebtoken bcrypt
```

### **Step 2: Add to .env**

```env
JWT_SECRET=your-super-secret-key-change-this-in-production
```

### **Step 3: Integrate with server.js**

Add this code to `backend/server.js`:

```javascript
// At the top, add imports
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Then copy all code from store-auth-system.js
// (Login endpoint, auth middleware, protected routes, dashboard)
```

### **Step 4: Create Store Accounts**

Use this endpoint to create accounts for each store:

```bash
curl -X POST https://push-retner.vercel.app/admin/create-store \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "zyrajewel",
    "password": "SecurePassword123",
    "name": "Zyra Jewel",
    "domain": "zyrajewel.myshopify.com",
    "email": "admin@zyrajewel.com"
  }'
```

---

## 📱 **Usage:**

### **For Zyra Jewel Owner:**

1. Visit: `https://push-retner.vercel.app/store-admin`
2. Login:
   - Store ID: `zyrajewel`
   - Password: `SecurePassword123`
3. Dashboard shows:
   - Subscribers: 150 (Zyra only)
   - Send notification form
4. Send notification → Goes to Zyra customers only! ✅

### **For Dupatta Bazaar Owner:**

1. Visit: `https://push-retner.vercel.app/store-admin`
2. Login:
   - Store ID: `dupattabazaar1`
   - Password: `SecurePassword456`
3. Dashboard shows:
   - Subscribers: 89 (Dupatta only)
   - Send notification form
4. Send notification → Goes to Dupatta customers only! ✅

---

## 🔒 **Security Features:**

### **1. Password Hashing**
```javascript
// Passwords stored as bcrypt hash
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
// Original password never stored
```

### **2. JWT Tokens**
```javascript
// Token contains:
{
  storeId: "zyrajewel",
  storeName: "Zyra Jewel",
  storeDomain: "zyrajewel.myshopify.com",
  exp: 1640000000  // Expires in 24h
}
```

### **3. Protected Routes**
```javascript
// All store-specific routes require valid token
GET /my-store/stats  → Requires auth
POST /my-store/broadcast  → Requires auth
```

---

## 📊 **API Endpoints:**

### **Public Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/store-login` | POST | Store owner login |
| `/store-admin` | GET | Admin dashboard page |

### **Protected Endpoints (Require Auth Token):**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/my-store/stats` | GET | Get my store's stats |
| `/my-store/broadcast` | POST | Send to my subscribers |

---

## 🎯 **Example Requests:**

### **1. Login:**

```javascript
fetch('https://push-retner.vercel.app/store-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        storeId: 'zyrajewel',
        password: 'SecurePassword123'
    })
})
.then(r => r.json())
.then(data => {
    console.log('Token:', data.token);
    localStorage.setItem('authToken', data.token);
});
```

### **2. Get Stats (with token):**

```javascript
fetch('https://push-retner.vercel.app/my-store/stats', {
    headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('authToken')
    }
})
.then(r => r.json())
.then(data => {
    console.log('Subscribers:', data.subscribers);
});
```

### **3. Send Notification (with token):**

```javascript
fetch('https://push-retner.vercel.app/my-store/broadcast', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('authToken')
    },
    body: JSON.stringify({
        title: 'New Arrivals!',
        message: 'Check out our latest collection',
        url: 'https://zyrajewel.com/new'
    })
})
.then(r => r.json())
.then(data => {
    console.log('Sent to:', data.sent, 'subscribers');
});
```

---

## 🎨 **Dashboard Features:**

### **Login Page:**
```
┌─────────────────────────────────┐
│  🔐 Store Admin Login           │
├─────────────────────────────────┤
│  Store ID: [zyrajewel        ]  │
│  Password: [**************   ]  │
│  [        Login        ]        │
└─────────────────────────────────┘
```

### **Dashboard (After Login):**
```
┌─────────────────────────────────┐
│  Zyra Jewel                     │
│  zyrajewel.myshopify.com        │
│  [Logout]                       │
├─────────────────────────────────┤
│  Total Subscribers: 150         │
├─────────────────────────────────┤
│  Send Notification              │
│  Title: [                    ]  │
│  Message: [                  ]  │
│  URL: [                      ]  │
│  [🚀 Send to My Subscribers ]  │
│  [🔄 Refresh Stats          ]  │
└─────────────────────────────────┘
```

---

## ✅ **Benefits:**

| Feature | Dropdown Approach | Login Approach |
|---------|------------------|----------------|
| **Security** | All stores visible | Each store isolated |
| **Privacy** | Can see all stores | See only own store |
| **Scalability** | Dropdown gets long | Unlimited stores |
| **Access Control** | Single admin | Multiple store owners |
| **Branding** | Generic | Store-specific |

---

## 🔐 **Store Account Management:**

### **Create Account for New Store:**

```bash
# Via API
POST /admin/create-store
{
  "storeId": "newstore",
  "password": "SecurePass123",
  "name": "New Store Name",
  "domain": "newstore.myshopify.com",
  "email": "admin@newstore.com"
}

# Response:
{
  "success": true,
  "message": "Store account created for New Store Name",
  "storeId": "newstore",
  "loginUrl": "/store-admin?store=newstore"
}
```

### **Share Login Details with Store Owner:**

```
Hi [Store Owner],

Your push notification admin panel is ready!

Login URL: https://push-retner.vercel.app/store-admin
Store ID: zyrajewel
Password: SecurePassword123

You can:
- View your subscriber count
- Send notifications to your customers
- Track delivery stats

Best regards,
Team
```

---

## 🚀 **Deployment Steps:**

1. ✅ Add JWT & bcrypt to package.json
2. ✅ Add JWT_SECRET to Vercel env vars
3. ✅ Integrate auth code into server.js
4. ✅ Deploy to Vercel
5. ✅ Create store accounts
6. ✅ Share login details with store owners

---

## 📊 **Database Schema (Optional Enhancement):**

For production, store credentials in database:

```sql
CREATE TABLE store_accounts (
    id SERIAL PRIMARY KEY,
    store_id TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    store_name TEXT NOT NULL,
    store_domain TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);
```

---

## 🎯 **Summary:**

**Old Way (Dropdown):**
```
1 admin → Sees all stores → Selects store → Sends
```

**New Way (Login):**
```
Store Owner → Logs in → Sees ONLY their store → Sends to their customers
```

**Perfect for:**
- ✅ 100+ stores
- ✅ Multiple store owners
- ✅ Privacy & security
- ✅ Scalability
- ✅ White-label solution

---

**Ready to deploy!** 🚀

Each store owner gets their own secure login and can manage their own notifications independently!
