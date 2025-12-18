#!/bin/bash

# Shopify Deployment Checklist Script
# This script validates your setup before deploying

echo "🚀 Shopify Push Notifications - Pre-Deployment Checklist"
echo "========================================================"
echo ""

# Check 1: Environment variables
echo "📋 Check 1: Environment Variables"
if grep -q "DATABASE_URL=" backend/.env; then
    echo "  ✅ DATABASE_URL configured"
else
    echo "  ❌ DATABASE_URL missing in backend/.env"
fi

if grep -q "PUBLIC_KEY=" backend/.env && grep -q "PRIVATE_KEY=" backend/.env; then
    echo "  ✅ VAPID keys configured"
else
    echo "  ❌ VAPID keys missing in backend/.env"
fi
echo ""

# Check 2: Backend dependencies
echo "📋 Check 2: Backend Dependencies"
if [ -d "backend/node_modules" ]; then
    echo "  ✅ Backend dependencies installed"
else
    echo "  ⚠️  Backend dependencies not installed. Run: cd backend && npm install"
fi
echo ""

# Check 3: Files exist
echo "📋 Check 3: Shopify Files"
if [ -f "shopify-files/push-notification-helper.js" ]; then
    echo "  ✅ push-notification-helper.js exists"
else
    echo "  ❌ push-notification-helper.js missing"
fi

if [ -f "shopify-files/sw.js" ]; then
    echo "  ✅ sw.js exists"
else
    echo "  ❌ sw.js missing"
fi

if [ -f "shopify-files/test-shopify-integration.js" ]; then
    echo "  ✅ test-shopify-integration.js exists"
else
    echo "  ❌ test-shopify-integration.js missing"
fi
echo ""

# Check 4: Backend endpoints
echo "📋 Check 4: Backend Configuration"
if grep -q "/apps/push/sw.js" backend/server.js; then
    echo "  ✅ Shopify SW endpoint configured"
else
    echo "  ❌ Shopify SW endpoint missing"
fi

if grep -q "/apps/push/subscribe" backend/server.js; then
    echo "  ✅ Subscribe endpoint configured"
else
    echo "  ❌ Subscribe endpoint missing"
fi

if grep -q "/apps/push/test-notification" backend/server.js; then
    echo "  ✅ Test notification endpoint configured"
else
    echo "  ❌ Test notification endpoint missing"
fi

if grep -q "/apps/push/broadcast" backend/server.js; then
    echo "  ✅ Broadcast endpoint configured"
else
    echo "  ❌ Broadcast endpoint missing"
fi
echo ""

# Check 5: Database
echo "📋 Check 5: Database Connection"
echo "  ℹ️  Database URL configured in backend/.env"
echo "  ℹ️  Run 'npm start' to test connection"
echo ""

# Summary
echo "========================================================"
echo "📝 DEPLOYMENT CHECKLIST:"
echo ""
echo "  □ All environment variables set"
echo "  □ Backend dependencies installed"
echo "  □ Backend tested locally (npm start)"
echo "  □ Shopify files prepared"
echo "  □ Backend deployed to Vercel"
echo "  □ Shopify files added to theme"
echo "  □ Subscribe button added to theme"
echo "  □ BACKEND_URL updated in helper file"
echo "  □ CORS configured for Shopify domain"
echo "  □ Test subscription flow in browser console"
echo ""
echo "✅ Ready to deploy! Follow SHOPIFY_DEPLOYMENT.md for detailed steps"
