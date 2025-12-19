// Push Notification Helper for Shopify
// Place this file in your Shopify theme: Assets > push-notification-helper.js

// IMPORTANT: Ensure your Shopify App Proxy (e.g., /apps/push) points to your Vercel Backend URL.
// You do not need to hardcode the URL here if using the proxy.
const BACKEND_URL = ''; // Kept for reference, logic uses /apps/push proxy below

// Subscribe to push notifications (Direct App Proxy Method)
async function subscribeToPushNotifications() {
    try {
        console.log('Step 1: Requesting Permission...');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Permission blocked by user');
        }

        console.log('Step 2: Registering SW...');
        // Note: Using the proxy path for SW to ensure it's served from the same origin
        const registration = await navigator.serviceWorker.register('/apps/push/sw.js', {
            scope: '/apps/push/'
        });

        // Wait for the service worker to be active before proceeding
        console.log('Step 2.5: Waiting for Service Worker to be active...');
        let serviceWorker = registration.installing || registration.waiting || registration.active;

        if (serviceWorker) {
            await new Promise((resolve) => {
                if (serviceWorker.state === 'activated') {
                    resolve();
                } else {
                    serviceWorker.addEventListener('statechange', function listener() {
                        if (serviceWorker.state === 'activated') {
                            serviceWorker.removeEventListener('statechange', listener);
                            resolve();
                        }
                    });
                }
            });
        }

        console.log('SW Active:', registration);

        console.log('Step 3: Creating Subscription with VAPID...');
        // Replace this with your actual VAPID Public Key from Vercel env
        const publicVapidKey = 'BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04';

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicVapidKey
        });
        console.log('Subscription Object Created:', JSON.stringify(subscription));

        console.log('Step 4: Sending to Backend via Proxy...');

        // 🔥 DYNAMIC STORE ID: Automatically detects the store identity
        // Priority: 1. Shopify Object 2. Hostname
        let dynamicStoreId = 'unknown-store';

        if (window.Shopify && window.Shopify.shop) {
            // Example: 'zyrajewel.myshopify.com' -> 'zyrajewel'
            dynamicStoreId = window.Shopify.shop.split('.')[0];
        } else {
            // Fallback for non-Shopify or testing: 'zyrajewel.co.in' -> 'zyrajewel'
            const host = window.location.hostname;
            dynamicStoreId = host.replace('www.', '').split('.')[0];
        }

        const storeName = document.title || dynamicStoreId;
        const storeDomain = window.location.hostname;

        console.log(`📍 Detected Store ID: ${dynamicStoreId}`);

        const response = await fetch('/apps/push/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...subscription.toJSON(),
                storeId: dynamicStoreId,       // ✅ DYNAMIC: Automatically uses store name
                storeName: storeName,
                storeDomain: storeDomain
            })
        });

        console.log('Server Response Status:', response.status);

        if (!response.ok) {
            // Try to parse error text to show detailed reason
            const text = await response.text();
            throw new Error(`Server Error ${response.status}: ${text}`);
        }

        console.log('Step 5: Success!');
        localStorage.setItem('pushNotificationSubscribed', 'true');
        alert('✅ Subscribed Successfully! You will now receive notifications.');
        return { success: true };

    } catch (error) {
        console.error('Subscription Failed:', error);
        alert('❌ Error: ' + error.message + '\n\nPlease try again.');
        return { success: false, message: error.message };
    }
}

// Check if user is already subscribed
async function isSubscribed() {
    // Since we can't check registration on cross-origin, we use local storage flag
    return localStorage.getItem('pushNotificationSubscribed') === 'true';
}

// Export functions for use in Shopify theme
window.PushNotifications = {
    subscribe: subscribeToPushNotifications,
    isSubscribed: isSubscribed
};
