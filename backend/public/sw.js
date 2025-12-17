// Service Worker for Shopify Push Notifications
// Place this file in your Shopify theme: Assets > sw.js

self.addEventListener('activate', function (event) {
    console.log('Push notification service worker activated');
});

self.addEventListener('push', async function (event) {
    try {
        const message = await event.data.json();
        let { title, body, icon, badge, actions, data, requireInteraction, tag } = message;

        console.log('🔔 Push notification received:', {
            title,
            body,
            hasIcon: !!icon,
            actionsCount: actions ? actions.length : 0,
            actions: actions
        });

        const notificationOptions = {
            body: body || 'You have a new notification',
            icon: icon,
            badge: badge,
            vibrate: [200, 100, 200],
            tag: tag || 'notification-' + Date.now(),
            requireInteraction: requireInteraction || false,
            data: data || {}
        };

        // Add actions if they exist
        if (actions && actions.length > 0) {
            notificationOptions.actions = actions;
            console.log('✅ Added actions:', actions);
        }

        console.log('📢 Showing notification with options:', notificationOptions);

        await event.waitUntil(
            self.registration.showNotification(title, notificationOptions)
        );
    } catch (error) {
        console.error('❌ Error showing notification:', error);
    }
});

// Handle notification click
self.addEventListener('notificationclick', function (event) {
    console.log('🖱️ Notification clicked:', {
        action: event.action,
        notification: event.notification.tag
    });

    event.notification.close();

    let urlToOpen = '/';

    // Check if it's a button click with URL embedded in action
    if (event.action && event.action.includes('button_')) {
        // Extract URL from action string (format: button_0_https://example.com)
        const parts = event.action.split('_');
        if (parts.length >= 3) {
            urlToOpen = parts.slice(2).join('_');
        }
    } else if (event.notification.data && event.notification.data.url) {
        // Default notification click - use notification URL
        urlToOpen = event.notification.data.url;
    }

    console.log('🌐 Opening URL:', urlToOpen);

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            // Check if window is already open
            for (let client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window if not already open
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
