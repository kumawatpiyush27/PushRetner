# Shopify Push Notifications - Command Reference Card

## 🚀 Quick Commands

### Start Development
```bash
cd backend
npm start
```
→ Backend runs on http://localhost:9000

### Get Public Tunnel
```bash
npx localtunnel --port 9000
```
→ Get URL like https://xxxxx.loca.lt

### Deploy to Vercel
```bash
vercel deploy
```
→ Get production URL

### Test Backend Health
```bash
curl http://localhost:9000/
```

## 📱 Browser Console Commands

### Check Service Worker
```javascript
shopifyTest.checkServiceWorker()
```

### Subscribe User
```javascript
shopifyTest.subscribe()
```

### Send Test Notification
```javascript
shopifyTest.sendTest()
```

### Get Stats
```javascript
shopifyTest.getStats()
```

### Broadcast to All
```javascript
shopifyTest.broadcast('Title', 'Message', '/url')
```

## 🔗 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/apps/push/sw.js` | Service Worker |
| POST | `/apps/push/subscribe` | Store subscription |
| POST | `/apps/push/test-notification` | Send test |
| POST | `/apps/push/broadcast` | Send to all |
| GET | `/apps/push/stats` | Get stats |

## 📊 cURL Test Commands

### Health Check
```bash
curl http://localhost:9000/
```

### Get Service Worker
```bash
curl http://localhost:9000/apps/push/sw.js
```

### Get Statistics
```bash
curl http://localhost:9000/apps/push/stats | jq
```

### Send Test
```bash
curl -X POST http://localhost:9000/apps/push/test-notification \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test","body":"Testing"}'
```

### Broadcast
```bash
curl -X POST http://localhost:9000/apps/push/broadcast \
  -H 'Content-Type: application/json' \
  -d '{"title":"Hello","body":"Test broadcast","url":"/"}'
```

## 📝 Configuration Files

| File | Purpose | Status |
|------|---------|--------|
| `backend/.env` | Database & VAPID keys | ✅ Configured |
| `backend/server.js` | Backend routes | ✅ Updated |
| `shopify-files/push-notification-helper.js` | Main helper | ✅ Updated |
| `shopify-files/test-shopify-integration.js` | Test console | ✅ NEW |

## 🐛 Quick Troubleshooting

| Issue | Check | Fix |
|-------|-------|-----|
| Backend won't start | Port 9000 in use | `lsof -i :9000` and kill, or use different port |
| Service Worker errors | Browser console (F12) | Check CORS and `/apps/push/sw.js` accessible |
| No subscriptions | Check database | Verify `DATABASE_URL` in `.env` |
| Notifications fail | VAPID keys | Verify `PUBLIC_KEY` and `PRIVATE_KEY` in `.env` |
| CORS errors | Origin not allowed | Update CORS config in server.js |

## 📚 Documentation

- **Full Guide:** `SHOPIFY_DEPLOYMENT.md`
- **Quick Start:** `SHOPIFY_QUICK_START.md`
- **Deployment Status:** `DEPLOYMENT_COMPLETE.md`
- **API Tests:** `test-api.sh`
- **Checklist:** `deploy-checklist.sh`

## 🎯 Deployment Flow

```
1. npm start
   ↓
2. npx localtunnel --port 9000
   ↓
3. Update BACKEND_URL
   ↓
4. Add to Shopify theme
   ↓
5. Test in browser console
   ↓
6. vercel deploy
   ↓
7. Update production URL
   ↓
8. Monitor /apps/push/stats
```

## 💾 Database Connection

**Neon PostgreSQL via:**
- `DATABASE_URL` (pooled) ← Use this
- `DATABASE_URL_UNPOOLED` (direct connection)

Both in `backend/.env`

## 🔑 VAPID Keys

Already configured in `backend/.env`:
- `PUBLIC_KEY` - Browser-side
- `PRIVATE_KEY` - Backend-side (keep secret!)

## 📍 Current Status

✅ Backend configured with Shopify endpoints  
✅ Database connected  
✅ VAPID keys set  
✅ Files updated  
✅ Ready to deploy  

**Next:** Run `npm start` in backend folder!

---

*For detailed information, see the documentation files.*
