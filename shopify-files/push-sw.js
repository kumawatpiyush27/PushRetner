// Service Worker for Push Notifications
// Upload this file to: Shopify Theme > Assets > push-sw.js

self.addEventListener('push', async function (event) {
    try {
        const message = await event.data.json();
        let { title, body, icon, badge, actions, data, requireInteraction, tag } = message;

        console.log('🔔 Push notification received:', {
            title,
            body,
            hasIcon: !!icon,
            actionsCount: actions ? actions.length : 0
        });

        const notificationOptions = {
            body: body || 'You have a new notification',
            icon: icon || 'https://cdn.shopify.com/s/files/1/0000/0000/0000/files/icon.png',
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

self.addEventListener('notificationclick', function (event) {
    console.log('🖱️ Notification clicked:', {
        action: event.action,
        notification: event.notification.tag
    });
    event.notification.close();

    let urlToOpen = '/';

    if (event.action) {
        // If action is a URL (from button), use it
        if (event.action.startsWith('http')) {
            urlToOpen = event.action;
        } else {
            // Otherwise use data url
            urlToOpen = event.notification.data.url || '/';
        }
    } else if (event.notification.data && event.notification.data.url) {
        urlToOpen = event.notification.data.url;
    }

    event.waitUntil(
        clients.openWindow(urlToOpen)
    );
});
