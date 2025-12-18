# 🔗 Shopify App Proxy Setup Guide

## 📋 Overview
Shopify App Proxy aapko allows karta hai ki aapka backend URL hide rahe aur Shopify domain se hi requests jayein.

**Example:**
- Without Proxy: `https://push-retner.vercel.app/subscribe`
- With Proxy: `https://yourstore.myshopify.com/apps/push/subscribe`

---

## ✅ **Kab App Proxy Use Karein:**

### **Use App Proxy If:**
- ✅ Professional setup chahiye
- ✅ Backend URL hide karna hai
- ✅ Shopify domain se requests bhejni hain
- ✅ Future mein Shopify App Store par publish karna hai

### **Don't Use App Proxy If:**
- ❌ Quick setup chahiye (Direct URL better hai)
- ❌ Shopify Partners account nahi hai
- ❌ Testing phase mein ho

---

## 🚀 **Complete App Proxy Setup:**

### **Step 1: Shopify Partners Account Banao**

1. Visit: https://partners.shopify.com/signup
2. Sign up karo (free hai)
3. Email verify karo
4. Dashboard access karo

### **Step 2: Development Store Banao (Optional)**

Agar testing ke liye store chahiye:
1. Partners Dashboard → **Stores** → **Add store**
2. **Development store** select karo
3. Store details fill karo
4. Create karo

### **Step 3: Shopify App Banao**

1. Partners Dashboard → **Apps** → **Create app**
2. **Create app manually** select karo
3. Fill details:
   ```
   App name: Zyra Push Notifications
   App URL: https://push-retner.vercel.app
   Allowed redirection URL(s): https://push-retner.vercel.app/auth/callback
   ```
4. **Create** par click karo

### **Step 4: App Proxy Configure Karo**

1. App dashboard mein left sidebar se **Configuration** → **App proxy** par jao
2. **Set up app proxy** button par click karo
3. Fill details:
   ```
   Subpath prefix: apps
   Subpath: push
   Proxy URL: https://push-retner.vercel.app
   ```
4. **Save** karo

**Result:** 
- Shopify URL: `https://yourstore.myshopify.com/apps/push/*`
- Forwards to: `https://push-retner.vercel.app/*`

### **Step 5: App Install Karo**

1. App dashboard → **Test your app** button
2. Apni store select karo
3. **Install app** par click karo
4. Permissions approve karo

### **Step 6: Code Update Karo**

`push-notification-helper.js` file mein ye changes karo:

```javascript
// Line 7-8: Enable App Proxy
const USE_APP_PROXY = true;  // Change to true
const BACKEND_URL = '';      // Empty rakhdo
```

### **Step 7: Test Karo**

1. Shopify store open karo
2. Browser console open karo (F12)
3. Push notification subscribe karo
4. Console mein ye URLs dikhne chahiye:
   ```
   Service Worker: /apps/push/sw.js
   Subscribe URL: /apps/push/subscribe
   ```

---

## 🔧 **App Proxy Settings Detail:**

### **Subpath Prefix Options:**
- `apps` (Recommended)
- `tools`
- `community`
- `a`

### **Subpath:**
- `push` (Your choice)
- Alphanumeric only
- No spaces or special characters

### **Full URL Examples:**
```
Subpath prefix: apps
Subpath: push
Result: yourstore.myshopify.com/apps/push/

Subpath prefix: tools
Subpath: notifications
Result: yourstore.myshopify.com/tools/notifications/
```

---

## 📝 **Backend Configuration (Vercel):**

App Proxy ke liye backend mein koi change nahi chahiye! Vercel automatically handle karega.

**Shopify Headers:**
Shopify automatically ye headers bhejta hai:
```
X-Shopify-Shop-Domain: yourstore.myshopify.com
X-Shopify-Customer-Id: 123456
X-Shopify-Access-Token: xxxxx
```

---

## 🧪 **Testing:**

### **Test 1: Service Worker**
```
URL: https://yourstore.myshopify.com/apps/push/sw.js
Expected: JavaScript service worker code
```

### **Test 2: Subscribe Endpoint**
```javascript
fetch('/apps/push/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ test: true })
})
```

### **Test 3: Stats Endpoint**
```
URL: https://yourstore.myshopify.com/apps/push/stats
Expected: {"count": 0}
```

---

## 🐛 **Troubleshooting:**

### **404 Error on /apps/push/**
**Problem:** App Proxy not configured properly
**Solution:**
1. Check App Proxy settings in Shopify Partners
2. Verify app is installed on store
3. Wait 5 minutes for DNS propagation

### **CORS Errors**
**Problem:** Backend not allowing Shopify domain
**Solution:** Backend already has `cors: '*'` enabled, should work

### **Service Worker Not Registering**
**Problem:** Scope issues
**Solution:** 
```javascript
// Use correct scope
navigator.serviceWorker.register('/apps/push/sw.js', {
  scope: '/apps/push/'  // Important!
});
```

---

## 🔄 **Switching Between Direct URL and App Proxy:**

### **Current Setup (Direct URL):**
```javascript
const USE_APP_PROXY = false;
const BACKEND_URL = 'https://push-retner.vercel.app';
```

### **App Proxy Setup:**
```javascript
const USE_APP_PROXY = true;
const BACKEND_URL = '';
```

**No other code changes needed!** 🎉

---

## 📊 **Comparison:**

| Feature | Direct URL | App Proxy |
|---------|-----------|-----------|
| Setup Time | 5 minutes | 30 minutes |
| Shopify App Needed | ❌ No | ✅ Yes |
| Backend URL Visible | ✅ Yes | ❌ No |
| Professional | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Maintenance | Easy | Medium |
| Shopify App Store | ❌ No | ✅ Yes |

---

## 💡 **Recommendation:**

### **For Testing/Development:**
Use **Direct URL** (current setup)
- Faster setup
- Easier debugging
- No Shopify app needed

### **For Production:**
Use **App Proxy**
- More professional
- Backend URL hidden
- Better for Shopify App Store

---

## 📞 **Support:**

### **Shopify Partners Help:**
- https://help.shopify.com/en/partners
- https://shopify.dev/docs/apps/tools/app-proxy

### **Common Issues:**
1. **App not showing in store:** Check if app is installed
2. **Proxy not working:** Wait 5 minutes after setup
3. **404 errors:** Verify proxy URL is correct

---

## ✅ **Quick Setup Checklist:**

- [ ] Shopify Partners account created
- [ ] App created in Partners dashboard
- [ ] App Proxy configured (apps/push)
- [ ] App installed on store
- [ ] Code updated (USE_APP_PROXY = true)
- [ ] Tested service worker registration
- [ ] Tested subscription flow
- [ ] Verified in admin dashboard

---

**Current Status:** Direct URL setup (recommended for now)
**To Enable App Proxy:** Follow steps above and change `USE_APP_PROXY = true`

---

**Made with ❤️ for Zyra Jewel**
