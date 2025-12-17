this.addEventListener('activate', function (event) {
    console.log('service worker activated');
});

this.addEventListener('push', async function (event) {
    try {
        const message = await event.data.json();
        let { title, body, icon, badge, actions, data, requireInteraction, tag } = message;
        
        console.log('🔔 Push received:', { title, body, actionsCount: actions ? actions.length : 0 });

        const notificationOptions = {
            body: body || 'You have a new notification',
            icon: icon || 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
            badge: badge,
            requireInteraction: requireInteraction || false,
            tag: tag || 'notification-' + Date.now(),
            data: data || {}
        };

        // Add actions if they exist
        if (actions && actions.length > 0) {
            notificationOptions.actions = actions;
            console.log('✅ Actions added:', actions);
        }

        await event.waitUntil(
            this.registration.showNotification(title, notificationOptions)
        );
    } catch (error) {
        console.error('❌ Push error:', error);
    }
});

this.addEventListener('notificationclick', function (event) {
    console.log('🖱️ Clicked:', event.action);
    event.notification.close();

    let urlToOpen = '/';

    if (event.action && event.action.includes('button_')) {
        const parts = event.action.split('_');
        if (parts.length >= 3) {
            urlToOpen = parts.slice(2).join('_');
        }
    } else if (event.notification.data && event.notification.data.url) {
        urlToOpen = event.notification.data.url;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (let client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
