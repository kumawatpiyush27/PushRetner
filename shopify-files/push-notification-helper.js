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
        const registration = await navigator.serviceWorker.register('/apps/push/sw.js', {
            scope: '/apps/push/'
        });

        // Wait for the service worker to be active before proceeding
        // WAITING LOGIC FIX
        console.log('Step 2.5: Checking SW State...');

        // We need to wait until there is an active worker to subscribe
        if (!registration.active) {
            console.log('⏳ Waiting for SW to become active...');
            await new Promise(resolve => {
                const worker = registration.installing || registration.waiting;
                if (!worker) {
                    // Should not happen if registered successfully, but safe fallback
                    resolve();
                    return;
                }
                const check = () => {
                    if (worker.state === 'activated') {
                        worker.removeEventListener('statechange', check);
                        resolve();
                    }
                };
                worker.addEventListener('statechange', check);
                // Also resolve if registration.active appears
                const interval = setInterval(() => {
                    if (registration.active) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 200);
            });
        }

        console.log('SW Active:', registration);

        console.log('Step 3: Creating Subscription with VAPID...');
        // Replace this with your actual VAPID Public Key from Vercel env
        const publicVapidKey = 'BJFvSsHhCT8vKMQ9GtUiMmXZlnzzepGZvGqLwcbfrFxpSoBhuL6x52r_ivBW7PhgROj6X8w4wm7986xgURm1r1s';

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicVapidKey
        });
        console.log('Subscription Object Created:', JSON.stringify(subscription));

        console.log('Step 4: Sending to Backend via Proxy...');
        const response = await fetch('/apps/push/subscribe', {
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
