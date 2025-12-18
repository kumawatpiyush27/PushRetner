# 🔥 Shopify App Proxy - Complete Setup Guide

## 📋 Overview
App Proxy se aapka Vercel backend Shopify domain ke through accessible ho jayega.

**Result:**
- Shopify URL: `https://dupattabazaar1.myshopify.com/apps/push/*`
- Forwards to: `https://push-retner.vercel.app/*`
- No cross-origin errors! ✅

---

## 🚀 **Step-by-Step Setup:**

### **Step 1: Shopify Partners Account**

1. Visit: https://partners.shopify.com/signup
2. Sign up karo (free hai)
3. Email verify karo
4. Dashboard access karo

---

### **Step 2: Shopify App Create Karo**

1. Partners Dashboard → **Apps** → **Create app**
2. **Create app manually** select karo
3. Fill details:

```
App name: Dupatta Bazaar Push Notifications
App URL: https://push-retner.vercel.app
Allowed redirection URL(s): https://push-retner.vercel.app/auth/callback
```

4. **Create** par click karo

---

### **Step 3: App Proxy Configure Karo** (Most Important!)

1. App dashboard mein **Configuration** tab par jao
2. Left sidebar se **App proxy** select karo
3. **Set up app proxy** button par click karo
4. Fill these exact values:

```
┌─────────────────────────────────────────────┐
│ Subpath prefix:  apps                       │
│ Subpath:         push                       │
│ Proxy URL:       https://push-retner.vercel.app │
└─────────────────────────────────────────────┘
```

5. **Save** karo

**Result:**
- `https://dupattabazaar1.myshopify.com/apps/push/` → `https://push-retner.vercel.app/`
- `https://dupattabazaar1.myshopify.com/apps/push/sw.js` → `https://push-retner.vercel.app/sw.js`
- `https://dupattabazaar1.myshopify.com/apps/push/subscribe` → `https://push-retner.vercel.app/subscribe`

---

### **Step 4: App Install Karo**

1. App dashboard → **Test your app** button (top right)
2. **Select store**: dupattabazaar1.myshopify.com
3. **Install app** par click karo
4. Permissions approve karo (if asked)

---

### **Step 5: Verify App Proxy Working**

Browser mein ye URLs test karo:

**Test 1: Service Worker**
```
https://dupattabazaar1.myshopify.com/apps/push/sw.js
```
Expected: JavaScript code dikhna chahiye

**Test 2: Stats Endpoint**
```
https://dupattabazaar1.myshopify.com/apps/push/stats
```
Expected: `{"count":0}`

**Test 3: Admin Dashboard**
```
https://dupattabazaar1.myshopify.com/apps/push/admin
```
Expected: Admin dashboard dikhna chahiye

---

### **Step 6: Code Update Karo**

Ab Shopify theme mein files upload karo:

#### 6.1 Helper Script Update
`push-notification-helper.js` mein ye changes already hain:
```javascript
// App Proxy URLs will be used automatically
const swUrl = '/apps/push/sw.js';
const subscribeUrl = '/apps/push/subscribe';
```

#### 6.2 Shopify Theme Mein Upload
1. **Shopify Admin** → **Online Store** → **Themes** → **Edit Code**
2. **Assets** folder → **Add a new asset**
3. File name: `push-notification-helper.js`
4. Content: Copy from `shopify-files/push-notification-helper.js`
5. **Save**

#### 6.3 Popup Code Add
1. **Layout** → **theme.liquid**
2. `</body>` tag se pehle paste karo:

```html
<!-- Push Notification System -->
<script src="{{ 'push-notification-helper.js' | asset_url }}" defer></script>

<!-- Popup HTML -->
<!-- Copy from shopify-files/shopify-popup.liquid -->
```

3. **Save**

---

### **Step 7: Test Complete Flow**

1. **Shopify store** open karo: `https://dupattabazaar1.myshopify.com`
2. **5 seconds** wait karo
3. **Popup** dikhega
4. **"Allow"** par click karo
5. **Browser permission** allow karo
6. **Success!** ✅

---

## 🎯 **App Proxy URLs:**

| Endpoint | Shopify URL | Vercel URL |
|----------|-------------|------------|
| Service Worker | `/apps/push/sw.js` | `https://push-retner.vercel.app/sw.js` |
| Subscribe | `/apps/push/subscribe` | `https://push-retner.vercel.app/subscribe` |
| Stats | `/apps/push/stats` | `https://push-retner.vercel.app/stats` |
| Admin | `/apps/push/admin` | `https://push-retner.vercel.app/admin` |
| Broadcast | `/apps/push/broadcast` | `https://push-retner.vercel.app/broadcast` |

---

## 🔧 **Vercel Backend Configuration:**

Backend mein koi change nahi chahiye! Shopify automatically sab headers forward karega.

**Shopify Headers (Automatic):**
```
X-Shopify-Shop-Domain: dupattabazaar1.myshopify.com
X-Shopify-Customer-Id: 123456 (if logged in)
```

---

## 🧪 **Testing Checklist:**

- [ ] App created in Shopify Partners
- [ ] App Proxy configured (apps/push)
- [ ] App installed on store
- [ ] `/apps/push/sw.js` accessible
- [ ] `/apps/push/stats` returns JSON
- [ ] Helper script uploaded to theme
- [ ] Popup code added to theme.liquid
- [ ] Popup shows after 5 seconds
- [ ] Subscription works
- [ ] Notification received

---

## 🐛 **Troubleshooting:**

### **404 on /apps/push/**
**Problem:** App Proxy not configured or app not installed
**Solution:**
1. Check App Proxy settings in Partners dashboard
2. Verify app is installed on store
3. Wait 5 minutes for DNS propagation
4. Clear browser cache

### **Service Worker Registration Failed**
**Problem:** Scope or URL issue
**Solution:**
```javascript
// Correct scope for App Proxy
navigator.serviceWorker.register('/apps/push/sw.js', {
  scope: '/apps/push/'  // Important!
});
```

### **Subscription Not Saving**
**Problem:** Backend environment variables missing
**Solution:**
1. Check Vercel environment variables
2. Verify DATABASE_URL, PUBLIC_KEY, PRIVATE_KEY set
3. Test direct Vercel URL: `https://push-retner.vercel.app/stats`

---

## ✅ **Benefits of App Proxy:**

- ✅ **No cross-origin errors** (same domain)
- ✅ **Professional setup**
- ✅ **Backend URL hidden**
- ✅ **Shopify domain used**
- ✅ **Easy to maintain**
- ✅ **Scalable**
- ✅ **Future-proof for App Store**

---

## 📊 **Architecture:**

```
User Browser
    ↓
Shopify Store (dupattabazaar1.myshopify.com)
    ↓
/apps/push/* (App Proxy)
    ↓ (Shopify forwards request)
Vercel Backend (push-retner.vercel.app)
    ↓
PostgreSQL Database (Neon)
```

---

## 🎉 **Success Indicators:**

When everything is working:
- ✅ `/apps/push/sw.js` loads successfully
- ✅ Service Worker registers without errors
- ✅ Popup shows on store
- ✅ Subscription succeeds
- ✅ Welcome notification received
- ✅ Subscriber count increases in `/apps/push/stats`
- ✅ Admin dashboard accessible at `/apps/push/admin`

---

## 📝 **Important Notes:**

1. **DNS Propagation:** App Proxy setup ke baad 5-10 minutes wait karo
2. **HTTPS Only:** Service Workers sirf HTTPS par work karte hain (Shopify provides)
3. **Scope:** Service Worker scope `/apps/push/` hona chahiye
4. **Testing:** Incognito mode mein test karo for fresh start

---

## 🚀 **Next Steps:**

1. ✅ Shopify Partners account banao
2. ✅ App create karo
3. ✅ App Proxy configure karo
4. ✅ App install karo
5. ✅ Test URLs (sw.js, stats)
6. ✅ Upload helper script to theme
7. ✅ Add popup code
8. ✅ Test subscription flow
9. ✅ Send test notification

---

**Estimated Time:** 20-30 minutes for complete setup
**Difficulty:** Medium (but worth it!)

---

**Made with ❤️ for Dupatta Bazaar**
