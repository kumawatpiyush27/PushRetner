// Push Notification Helper for Shopify
// Place this file in your Shopify theme: Assets > push-notification-helper.js

// IMPORTANT: Ensure your Shopify App Proxy (e.g., /apps/push) points to your Vercel Backend URL.
// You do not need to hardcode the URL here if using the proxy.
const BACKEND_URL = ''; // Kept for reference, logic uses /apps/push proxy below

// Subscribe to push notifications (Direct App Proxy Method)
async function subscribeToPushNotifications() {
    try {
        // 1. Request Permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Permission not granted');
        }

        // 2. Register Service Worker via App Proxy
        // This path maps to: https://ngrok-url/sw.js
        const registration = await navigator.serviceWorker.register('/apps/push/sw.js', {
            scope: '/apps/push/'
        });

        await navigator.serviceWorker.ready;

        // 3. Subscribe
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: 'BPj1sl5Dtd7yap6_bCwqGyBVga2KtU-KwMJ1UjnIJ77_1dx1MYKVl8ZcgG-68e6tdcUudmX9H135uh-sjl3trhE'
        });

        // 4. Send to Backend via Proxy
        // Maps to: https://ngrok-url/subscribe
        await fetch('/apps/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });

        return { success: true, message: 'Subscribed successfully!' };

    } catch (error) {
        console.error('Subscription failed:', error);
        alert('Debug Error: ' + error.message); // Show exact error to user
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
