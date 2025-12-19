# Quick Start - Shopify Push Notifications

## 🚀 What's Been Set Up

Your backend server now has complete Shopify integration with:

✅ **Service Worker endpoint** - `/apps/push/sw.js`  
✅ **Subscribe endpoint** - `POST /apps/push/subscribe`  
✅ **Test notification** - `POST /apps/push/test-notification`  
✅ **Broadcast endpoint** - `POST /apps/push/broadcast`  
✅ **Stats endpoint** - `GET /apps/push/stats`  

✅ **Environment configured** with Neon PostgreSQL  
✅ **VAPID keys** for Web Push API  

## 🎯 Quick Test (5 minutes)

### 1. Start Backend
```bash
cd backend
npm start
```
You should see: `App running live on port 9000`

### 2. Test API in Another Terminal
```bash
# Check if backend is running
curl http://localhost:9000/

# Get stats (should return empty initially)
curl http://localhost:9000/apps/push/stats
```

### 3. Get Public URL (for Shopify)
In another terminal:
```bash
npx localtunnel --port 9000
```
This gives you a URL like: `https://xxxxx.loca.lt`

## 📱 Deploy to Shopify

### Option 1: Local Testing
1. Use the `localtunnel` URL above
2. Update in `shopify-files/push-notification-helper.js`:
   ```javascript
   const BACKEND_URL = 'https://xxxxx.loca.lt';
   ```
3. Copy files to your Shopify theme's Assets folder

### Option 2: Production Deploy

1. **Deploy to Vercel:**
   ```bash
   cd ..
   vercel deploy
   ```
   Note your deployment URL

2. **Update Shopify files:**
   ```javascript
   const BACKEND_URL = 'https://your-app.vercel.app';
   ```

3. **Add to Shopify theme**

## 🧪 Test in Browser Console

Once files are in Shopify:

```javascript
// Check service worker
shopifyTest.checkServiceWorker()

// Subscribe
shopifyTest.subscribe()

// Send test notification
shopifyTest.sendTest()

// Get stats
shopifyTest.getStats()

// Broadcast to all
shopifyTest.broadcast('Hello!', 'This is a test')
```

## 📊 Monitor Subscriptions

Check stats anytime:
```javascript
shopifyTest.getStats()
```

Or via cURL:
```bash
curl https://your-app.vercel.app/apps/push/stats
```

## 🔗 Files Reference

- **Backend endpoints**: `backend/server.js` (lines 1410-1660)
- **Helper script**: `shopify-files/push-notification-helper.js`
- **Test console**: `shopify-files/test-shopify-integration.js`
- **Deployment guide**: `SHOPIFY_DEPLOYMENT.md`

## ✅ Next Steps

1. ✅ Backend configured
2. ⏳ Deploy backend (Vercel)
3. ⏳ Add files to Shopify theme
4. ⏳ Test subscription flow
5. ⏳ Create admin dashboard (optional)

## 🆘 Troubleshooting

**Backend won't start?**
```bash
npm install  # Re-install dependencies
npm start
```

**Database connection error?**
Check `.env` file has valid `DATABASE_URL`

**Service worker not registering?**
1. Check browser console (F12) for errors
2. Verify `/apps/push/sw.js` is accessible
3. Check CORS settings

**No subscriptions storing?**
1. Check PostgreSQL connection
2. Verify endpoint returns 201 status
3. Check backend logs

---

**Ready?** Run `npm start` in the backend folder! 🚀
