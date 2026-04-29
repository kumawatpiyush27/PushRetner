# Vercel Environment Variables Setup

## Issue
SSO Verification failing because `SSO_SECRET` is not set in Vercel.

## Solution

### For `retner-smart-push` project:
1. Go to: https://vercel.com/kumawatpiyush27s-projects/retner-smart-push/settings/environment-variables
2. Add this variable:
   - **Name**: `SSO_SECRET`
   - **Value**: `retner_sso_final_2025`
   - **Environment**: Production, Preview, Development (select all)
3. Click **Save**
4. Go to **Deployments** tab
5. Click **...** on latest deployment > **Redeploy**

### For `push-retner` project:
Already has the correct secret in code (hardcoded), no changes needed.

## Why This Fixes It
- Shopify App signs JWT with `process.env.SSO_SECRET`
- Backend verifies JWT with `'retner_sso_final_2025'`
- Both must match for SSO to work
