# Shopify Push Notifications Deployment Guide

## Overview
This guide walks you through deploying push notifications to your Shopify store.

## Backend Setup (Already Configured)

Your Express backend now has Shopify-specific endpoints:

- `GET /apps/push/sw.js` - Service Worker for Shopify
- `POST /apps/push/subscribe` - Create subscription
- `POST /apps/push/test-notification` - Send test notification
- `POST /apps/push/broadcast` - Broadcast to all subscribers
- `GET /apps/push/stats` - Get subscription statistics

## Frontend Integration Steps

### Step 1: Add Files to Shopify Theme

1. Go to **Shopify Admin** → **Online Store** → **Themes**
2. Find your active theme and click **Edit code**
3. In the **Assets** folder, add these files:
   - `push-notification-helper.js` - Main helper functions
   - `test-shopify-integration.js` - Testing console

4. In your theme's `theme.liquid` or `index.liquid`, add before `</body>`:

```liquid
<script src="{{ 'push-notification-helper.js' | asset_url }}" defer></script>
```

### Step 2: Add Subscription Button

Add a button in your theme template (e.g., in your header or product page):

```html
<button id="subscribe-btn" class="shopify-push-notification-btn">
  Subscribe to Notifications
</button>

<script>
  document.getElementById('subscribe-btn').addEventListener('click', function() {
    subscribeToPushNotifications().then(result => {
      if (result.success) {
        alert('✅ Subscribed successfully!');
      } else {
        alert('❌ ' + result.message);
      }
    });
  });
</script>
```

### Step 3: Configure Backend URL

Update the `REACT_APP_BACKEND_URL` environment variable. Your backend should be accessible at:
- Local development: `http://localhost:9000`
- Production: Your Vercel URL or deployed backend URL

Update in `push-notification-helper.js`:
```javascript
const BACKEND_URL = 'https://your-deployment-url.vercel.app';
```

## Testing

### Local Testing

1. **Start your backend:**
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **Use ngrok or localtunnel for external access:**
   ```bash
   npx localtunnel --port 9000
   ```
   This gives you a public URL like `https://xxxxx.loca.lt`

3. **Update BACKEND_URL in helper file to the tunnel URL**

4. **Test in browser console:**
   ```javascript
   // Load the test script in browser console
   // Then run:
   shopifyTest.checkServiceWorker();
   shopifyTest.subscribe();
   shopifyTest.sendTest();
   shopifyTest.getStats();
   ```

### Production Testing

1. **Deploy backend to Vercel:**
   ```bash
   vercel deploy
   ```

2. **Get your deployment URL and update in Shopify**

3. **Enable notifications in Shopify theme**

4. **Test using Shopify's browser console:**
   - Open store in browser
   - Open DevTools Console (F12)
   - Run test commands

## API Endpoints Reference

### Subscribe
**Endpoint:** `POST /apps/push/subscribe`

```json
{
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription created successfully for Shopify",
  "subscriptionId": "https://..."
}
```

### Test Notification
**Endpoint:** `POST /apps/push/test-notification`

```json
{
  "title": "Test Title",
  "body": "Test message"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test notification sent",
  "successCount": 5,
  "failureCount": 0,
  "totalSubscriptions": 5
}
```

### Broadcast
**Endpoint:** `POST /apps/push/broadcast`

```json
{
  "title": "Announcement",
  "body": "Check out our new products!",
  "url": "/collections/new"
}
```

### Stats
**Endpoint:** `GET /apps/push/stats`

**Response:**
```json
{
  "success": true,
  "totalSubscriptions": 42,
  "subscriptions": [...]
}
```

## Troubleshooting

### Service Worker Not Registering
- Check browser console for CORS errors
- Ensure `/apps/push/sw.js` is accessible
- Verify `Service-Worker-Allowed` header is set

### Subscriptions Not Storing
- Check PostgreSQL connection in `.env`
- Verify `DATABASE_URL` is correct
- Check backend logs for database errors

### Notifications Not Sending
- Verify VAPID keys in `.env`
- Check subscription endpoint is valid
- Look for 410 Gone errors (invalid subscriptions)

### CORS Issues
- Backend should have CORS enabled for Shopify domain
- Update CORS origin in server.js if needed

## Next Steps

1. ✅ Backend is configured with Shopify routes
2. ⏳ Deploy backend to Vercel
3. ⏳ Add helper script to Shopify theme
4. ⏳ Test subscription flow
5. ⏳ Create admin dashboard for sending notifications
6. ⏳ Monitor subscription health

## Support

For issues:
1. Check backend logs: `npm start` output
2. Check browser console errors (F12)
3. Review `/apps/push/stats` for subscription status
4. Test endpoints directly using cURL or Postman
