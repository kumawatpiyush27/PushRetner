#!/bin/bash

# Shopify Push Notifications - cURL Test Commands
# Use these commands to test your API endpoints

# Set your backend URL here
BACKEND_URL="http://localhost:9000"

echo "🚀 Shopify Push Notifications - API Test Commands"
echo "=================================================="
echo ""
echo "Using backend URL: $BACKEND_URL"
echo ""

# Test 1: Health check
echo "📍 Test 1: Health Check"
echo "Command:"
echo "curl $BACKEND_URL/"
echo ""
curl "$BACKEND_URL/"
echo ""
echo ""

# Test 2: Get service worker
echo "📍 Test 2: Get Service Worker"
echo "Command:"
echo "curl $BACKEND_URL/apps/push/sw.js"
echo ""
echo "(Service Worker script - headers and first 200 chars:)"
curl -i "$BACKEND_URL/apps/push/sw.js" 2>/dev/null | head -20
echo ""
echo ""

# Test 3: Get current stats
echo "📍 Test 3: Get Current Stats"
echo "Command:"
echo "curl $BACKEND_URL/apps/push/stats"
echo ""
curl -s "$BACKEND_URL/apps/push/stats" | jq .
echo ""
echo ""

# Test 4: Test notification (requires existing subscriptions)
echo "📍 Test 4: Send Test Notification"
echo "Command:"
echo "curl -X POST $BACKEND_URL/apps/push/test-notification \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"title\":\"Test\",\"body\":\"Testing...\"}'"
echo ""
curl -s -X POST "$BACKEND_URL/apps/push/test-notification" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Notification","body":"Testing Shopify integration"}' | jq .
echo ""
echo ""

# Test 5: Broadcast (requires existing subscriptions)
echo "📍 Test 5: Broadcast Notification"
echo "Command:"
echo "curl -X POST $BACKEND_URL/apps/push/broadcast \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"title\":\"Hello\",\"body\":\"Broadcast test\",\"url\":\"/\"}'"
echo ""
curl -s -X POST "$BACKEND_URL/apps/push/broadcast" \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello Shopify","body":"This is a broadcast test notification","url":"/"}' | jq .
echo ""
echo ""

# Test 6: Mock subscription (for testing backend)
echo "📍 Test 6: Sample Subscription (Mock)"
echo "Note: In real usage, this comes from the browser"
echo ""
MOCK_SUB='{
  "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint",
  "expirationTime": null,
  "keys": {
    "p256dh": "test-p256dh-key",
    "auth": "test-auth-key"
  }
}'
echo "Command:"
echo "curl -X POST $BACKEND_URL/apps/push/subscribe \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '$MOCK_SUB'"
echo ""
curl -s -X POST "$BACKEND_URL/apps/push/subscribe" \
  -H "Content-Type: application/json" \
  -d "$MOCK_SUB" | jq .
echo ""
echo ""

echo "=================================================="
echo "✅ Test Complete!"
echo ""
echo "To use a different backend URL, update BACKEND_URL variable at top of script"
echo ""
echo "For production testing, replace:"
echo '  BACKEND_URL="http://localhost:9000"'
echo "with:"
echo '  BACKEND_URL="https://your-app.vercel.app"'
