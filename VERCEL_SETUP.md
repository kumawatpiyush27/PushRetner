# 🚀 Quick Vercel Environment Variables Setup

## Your Backend Deployment: push-retner.vercel.app

### Environment Variables to Add in Vercel Dashboard

Go to: https://vercel.com/piyushs-projects-79c8b5dd/push-retner/settings/environment-variables

Add these 4 variables:

1. **DATABASE_URL**
   ```
   postgresql://neondb_owner:npg_Q2FL0BrtGfqY@ep-square-pine-a4iy909q-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

2. **PUBLIC_KEY**
   ```
   BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04
   ```

3. **PRIVATE_KEY**
   ```
   l_uWy8qBj22_JqzEAHlj6TvxTYM7xCqR2V7SFa_fmb4
   ```

4. **NODE_ENV**
   ```
   production
   ```

## After Adding Variables

1. Go to "Deployments" tab
2. Click "..." on latest deployment
3. Click "Redeploy"
4. Wait for deployment to complete

## Test Your Backend

Visit these URLs to verify:
- https://push-retner.vercel.app/stats (should show {"count":0})
- https://push-retner.vercel.app/admin (should show admin dashboard)
- https://push-retner.vercel.app/sw.js (should show service worker code)

## Frontend Deployment

Once backend is working, deploy frontend with:

**Environment Variables for Frontend:**
- `REACT_APP_API_URL` = `https://push-retner.vercel.app`
- `REACT_APP_PUBLIC_KEY` = `BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04`

---

## Troubleshooting

**Still getting 404?**
- Check Vercel logs: Deployments → Click deployment → View Function Logs
- Verify all 4 environment variables are set
- Make sure you redeployed after adding variables

**Database connection errors?**
- Verify DATABASE_URL is exactly as shown above
- Check Neon database is active
- Ensure SSL mode is included in connection string
