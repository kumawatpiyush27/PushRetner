self.addEventListener('activate', function (event) {
    console.log('Push notification service worker activated');
});

self.addEventListener('push', async function (event) {
    try {
        const message = await event.data.json();
        let { title, description, image, url } = message;

        console.log('Push notification received:', message);

        await event.waitUntil(
            self.registration.showNotification(title, {
                body: description,
                icon: image,
                badge: image,
                vibrate: [200, 100, 200],
                tag: 'notification-' + Date.now(),
                requireInteraction: false,
                actions: [
                    {
                        action: 'open',
                        title: 'Open'
                    },
                    {
                        action: 'close',
                        title: 'Close'
                    }
                ],
                data: {
                    url: url || '/'
                }
            })
        );
    } catch (error) {
        console.error('Error showing notification:', error);
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    if (event.action === 'open' || !event.action) {
        const urlToOpen = event.notification.data.url || '/';
        event.waitUntil(
            clients.openWindow(urlToOpen)
        );
    }
});
