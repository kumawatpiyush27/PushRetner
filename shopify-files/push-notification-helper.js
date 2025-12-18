// Push Notification Helper for Shopify
// Place this file in your Shopify theme: Assets > push-notification-helper.js

// ============================================
// CONFIGURATION - Choose one option:
// ============================================

// OPTION 1: Direct Vercel URL (Recommended - No Shopify App needed)
const USE_APP_PROXY = false;
const BACKEND_URL = 'https://push-retner.vercel.app';

// OPTION 2: Shopify App Proxy (Requires Shopify App setup)
// const USE_APP_PROXY = true;
// const BACKEND_URL = ''; // Leave empty when using proxy

// ============================================

// Subscribe to push notifications
async function subscribeToPushNotifications() {
    try {
        console.log('Step 1: Requesting Permission...');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Permission blocked by user');
        }

        console.log('Step 2: Registering SW...');

        // Service Worker URL - Hosted on Shopify to avoid cross-origin issues
        // This will be constructed dynamically based on your Shopify store
        const swUrl = '/push-sw.js';  // Relative path - will be served from Shopify

        const registration = await navigator.serviceWorker.register(swUrl, {
            scope: '/'
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
        // VAPID Public Key - Must match the PUBLIC_KEY in Vercel environment variables
        const publicVapidKey = 'BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04';

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicVapidKey
        });
        console.log('Subscription Object Created:', JSON.stringify(subscription));

        console.log('Step 4: Sending to Backend...');

        // Subscription endpoint based on configuration
        const subscribeUrl = USE_APP_PROXY ? '/apps/push/subscribe' : `${BACKEND_URL}/subscribe`;

        const response = await fetch(subscribeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(subscription)
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
