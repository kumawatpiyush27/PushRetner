this.addEventListener('activate', function (event) {
    console.log('service worker activated');
});

this.addEventListener('push', async function (event) {
    try {
        const message = await event.data.json();
        let { title, description, image, url, buttons } = message;
        console.log('🔔 Push received:', { title, description, buttonsCount: buttons ? buttons.length : 0 });

        // Build actions from buttons array
        const actions = (buttons && buttons.length > 0) 
            ? buttons.map((btn, idx) => ({
                action: `button_${idx}_${btn.url}`,
                title: btn.text || 'Action ' + (idx + 1)
            }))
            : [];

        const notificationOptions = {
            body: description,
            icon: image || 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
            requireInteraction: false,
            data: { url: url || '/', buttons: buttons || [] }
        };

        // Add actions if buttons exist
        if (actions.length > 0) {
            notificationOptions.actions = actions;
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
