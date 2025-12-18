# 🚀 App Proxy Setup - No File Upload Needed!

## ✅ **Benefits:**
- ✅ Service Worker Vercel se serve hoga (no upload needed)
- ✅ Shopify domain se accessible
- ✅ Professional setup
- ✅ Easy maintenance

---

## 📋 **Complete Setup (10 Minutes):**

### **PART 1: Shopify Partners Setup**

#### Step 1: Create Partners Account
1. Visit: https://partners.shopify.com/signup
2. Sign up with email
3. Verify email
4. Login to dashboard

#### Step 2: Create App
1. Click **Apps** → **Create app**
2. Select **Create app manually**
3. Fill details:
   ```
   App name: Dupatta Bazaar Push Notifications
   App URL: https://push-retner.vercel.app
   Allowed redirection URL(s): https://push-retner.vercel.app/auth/callback
   ```
4. Click **Create**

#### Step 3: Configure App Proxy ⚡ (MOST IMPORTANT!)
1. In app dashboard, click **Configuration** tab
2. Left sidebar → **App proxy**
3. Click **Set up app proxy**
4. Fill EXACTLY these values:

```
┌──────────────────────────────────────────────────┐
│ Subpath prefix:  apps                            │
│ Subpath:         push                            │
│ Proxy URL:       https://push-retner.vercel.app  │
└──────────────────────────────────────────────────┘
```

5. Click **Save**

**What this does:**
- `dupattabazaar1.myshopify.com/apps/push/*` → `push-retner.vercel.app/*`
- `dupattabazaar1.myshopify.com/apps/push/sw.js` → `push-retner.vercel.app/sw.js`
- `dupattabazaar1.myshopify.com/apps/push/subscribe` → `push-retner.vercel.app/subscribe`

#### Step 4: Install App on Store
1. In app dashboard, click **Test your app** (top right)
2. Select store: **dupattabazaar1.myshopify.com**
3. Click **Install app**
4. Approve permissions (if asked)

#### Step 5: Verify App Proxy Working
Open these URLs in browser:

**Test 1: Service Worker**
```
https://dupattabazaar1.myshopify.com/apps/push/sw.js
```
Expected: JavaScript service worker code ✅

**Test 2: Stats**
```
https://dupattabazaar1.myshopify.com/apps/push/stats
```
Expected: `{"count":0}` ✅

**Test 3: Admin**
```
https://dupattabazaar1.myshopify.com/apps/push/admin
```
Expected: Admin dashboard ✅

---

### **PART 2: Shopify Theme Setup**

#### Step 1: Upload Helper Script
1. **Shopify Admin** → **Online Store** → **Themes** → **Edit Code**
2. **Assets** folder → **Add a new asset**
3. **Create a blank file**
4. File name: `push-notification-helper.js`
5. Copy-paste code from: `push-notification-helper-app-proxy.js`
6. **Save**

#### Step 2: Add Popup Code
1. **Layout** folder → **theme.liquid**
2. Find `</body>` tag
3. BEFORE `</body>`, paste this code:

```html
<!-- Push Notification Popup -->
<style>
  .push-notification-popup {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px 25px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 99999;
    max-width: 350px;
    animation: slideIn 0.5s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .push-notification-popup.hidden { display: none; }
  @keyframes slideIn {
    from { transform: translateY(100px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .push-popup-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .push-popup-icon { font-size: 32px; }
  .push-popup-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }
  .push-popup-message {
    font-size: 14px;
    margin: 0 0 15px 0;
    opacity: 0.95;
    line-height: 1.5;
  }
  .push-popup-buttons {
    display: flex;
    gap: 10px;
  }
  .push-popup-btn {
    flex: 1;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
  }
  .push-popup-btn-allow {
    background: white;
    color: #667eea;
  }
  .push-popup-btn-allow:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255, 255, 255, 0.3);
  }
  .push-popup-btn-later {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }
  .push-popup-btn-later:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  @media (max-width: 480px) {
    .push-notification-popup {
      bottom: 10px;
      right: 10px;
      left: 10px;
      max-width: none;
    }
  }
</style>

<div id="pushNotificationPopup" class="push-notification-popup hidden">
  <div class="push-popup-header">
    <div class="push-popup-icon">🔔</div>
    <h3 class="push-popup-title">Stay Updated!</h3>
  </div>
  <p class="push-popup-message">
    Get instant notifications about new products and exclusive offers!
  </p>
  <div class="push-popup-buttons">
    <button class="push-popup-btn push-popup-btn-allow" onclick="allowPushNotifications()">
      ✓ Allow
    </button>
    <button class="push-popup-btn push-popup-btn-later" onclick="laterPushNotifications()">
      Maybe Later
    </button>
  </div>
</div>

<script src="{{ 'push-notification-helper.js' | asset_url }}" defer></script>
<script>
  setTimeout(() => {
    const isSubscribed = localStorage.getItem('pushNotificationSubscribed');
    const popupDismissed = localStorage.getItem('pushPopupDismissed');
    if (!isSubscribed && !popupDismissed) {
      document.getElementById('pushNotificationPopup').classList.remove('hidden');
    }
  }, 5000);

  async function allowPushNotifications() {
    document.getElementById('pushNotificationPopup').classList.add('hidden');
    if (window.PushNotifications && window.PushNotifications.subscribe) {
      await window.PushNotifications.subscribe();
    }
  }

  function laterPushNotifications() {
    document.getElementById('pushNotificationPopup').classList.add('hidden');
    localStorage.setItem('pushPopupDismissed', 'true');
  }
</script>
```

4. **Save**

---

### **PART 3: Test Complete Flow**

1. **Clear browser cache** (Ctrl + Shift + Delete)
2. Open: `https://dupattabazaar1.myshopify.com`
3. Wait **5 seconds**
4. **Popup** should appear
5. Click **"Allow"**
6. Browser permission → **Allow**
7. **Success message** ✅

---

## 🎯 **How It Works:**

```
User visits Shopify Store
    ↓
Popup shows after 5 seconds
    ↓
User clicks "Allow"
    ↓
Service Worker registers: /apps/push/sw.js
    ↓ (Shopify App Proxy forwards to)
Vercel serves: push-retner.vercel.app/sw.js
    ↓
Subscription created
    ↓
Sent to: /apps/push/subscribe
    ↓ (Shopify App Proxy forwards to)
Vercel saves: push-retner.vercel.app/subscribe
    ↓
Saved in PostgreSQL Database
    ↓
Welcome notification sent! ✅
```

---

## ✅ **Checklist:**

- [ ] Shopify Partners account created
- [ ] App created in Partners
- [ ] App Proxy configured (apps/push)
- [ ] App installed on store
- [ ] Verified /apps/push/sw.js accessible
- [ ] Verified /apps/push/stats returns JSON
- [ ] Helper script uploaded to Shopify theme
- [ ] Popup code added to theme.liquid
- [ ] Tested on store
- [ ] Subscription successful
- [ ] Notification received

---

## 🐛 **Troubleshooting:**

### **404 on /apps/push/sw.js**
**Problem:** App Proxy not working
**Solution:**
1. Wait 5-10 minutes (DNS propagation)
2. Verify app is installed on store
3. Check App Proxy settings in Partners dashboard
4. Clear browser cache

### **Service Worker Registration Failed**
**Problem:** Scope issue
**Solution:** Scope must be `/apps/push/` (with trailing slash)

### **Subscription Not Saving**
**Problem:** Vercel environment variables missing
**Solution:**
1. Check Vercel dashboard → Environment Variables
2. Verify: DATABASE_URL, PUBLIC_KEY, PRIVATE_KEY, NODE_ENV
3. Redeploy if needed

---

## 📊 **URLs Reference:**

| Purpose | Shopify URL | Vercel URL |
|---------|-------------|------------|
| Service Worker | `/apps/push/sw.js` | `/sw.js` |
| Subscribe | `/apps/push/subscribe` | `/subscribe` |
| Stats | `/apps/push/stats` | `/stats` |
| Admin | `/apps/push/admin` | `/admin` |
| Broadcast | `/apps/push/broadcast` | `/broadcast` |

---

## 🎉 **Success Indicators:**

- ✅ No cross-origin errors
- ✅ Service Worker registers successfully
- ✅ Popup shows on store
- ✅ Subscription succeeds
- ✅ Welcome notification received
- ✅ Subscriber count increases
- ✅ Admin dashboard accessible

---

**Estimated Time:** 10-15 minutes
**Files to Upload:** Only 1 (push-notification-helper.js)
**Service Worker:** Served from Vercel (no upload needed!)

---

**Made with ❤️ for Dupatta Bazaar**
