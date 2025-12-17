this.addEventListener('activate', function (event) {
    console.log('service worker activated');
});

this.addEventListener('push', async function (event) {
    const message = await event.data.json();
    let { title, description, image, url, buttons } = message;
    console.log({ message });

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
        requireInteraction: false,
        data: { url: url || '/' }
    };

    // Add actions if buttons exist
    if (actions.length > 0) {
        notificationOptions.actions = actions;
    }

    await event.waitUntil(
        this.registration.showNotification(title, notificationOptions)
    );
});
