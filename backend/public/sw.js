// Service Worker for Shopify Push Notifications
// Place this file in your Shopify theme: Assets > sw.js

self.addEventListener('activate', function (event) {
    console.log('Push notification service worker activated');
});

self.addEventListener('push', async function (event) {
    try {
        const message = await event.data.json();
        let { title, description, image, url, buttons } = message;

        console.log('Push notification received:', message);

        // Build actions from buttons array
        const actions = (buttons && buttons.length > 0) 
            ? buttons.map((btn, idx) => ({
                action: btn.url || '/',
                title: btn.text || 'Action ' + (idx + 1)
            }))
            : [];

        const notificationOptions = {
            body: description,
            icon: image,
            badge: image,
            vibrate: [200, 100, 200],
            tag: 'notification-' + Date.now(),
            requireInteraction: false,
            data: {
                url: url || '/'
            }
        };

        // Add actions if buttons exist
        if (actions.length > 0) {
            notificationOptions.actions = actions;
        }

        await event.waitUntil(
            self.registration.showNotification(title, notificationOptions)
        );
    } catch (error) {
        console.error('Error showing notification:', error);
    }
});

// Handle notification click
self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    // Check if action is a URL (from button) or default notification click
    const urlToOpen = (event.action && event.action.startsWith('http')) 
        ? event.action 
        : event.notification.data.url || '/';

    event.waitUntil(
            clients.openWindow(urlToOpen)
        );
    }
});
