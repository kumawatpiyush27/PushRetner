// Push Notification Helper for Shopify
// SIMPLIFIED VERSION - No complex waiting logic

async function subscribeToPushNotifications() {
    try {
        console.log('🚀 Step 1: Requesting Permission...');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('❌ Permission Denied. Please allow notifications in your browser settings.');
        }
        console.log('✅ Permission Granted!');

        console.log('🚀 Step 2: Registering Service Worker...');
        // Register with the proxy path
        const registration = await navigator.serviceWorker.register('/apps/push/sw.js', {
            scope: '/apps/push/'
        });
        console.log('✅ Service Worker Registered:', registration);

        // CRITICAL FIX: Use getRegistration instead of waiting
        console.log('🚀 Step 2.5: Getting Active Registration...');
        const activeReg = await navigator.serviceWorker.getRegistration('/apps/push/');

        if (!activeReg) {
            throw new Error('❌ Service Worker registration not found');
        }

        // Wait a bit for activation (simple timeout approach)
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('✅ Using Registration:', activeReg);

        console.log('🚀 Step 3: Creating Push Subscription...');
        const publicVapidKey = 'BJFvSsHhCT8vKMQ9GtUiMmXZlnzzepGZvGqLwcbfrFxpSoBhuL6x52r_ivBW7PhgROj6X8w4wm7986xgURm1r1s';

        // Try to subscribe using the active registration
        let subscription;
        try {
            subscription = await activeReg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: publicVapidKey
            });
        } catch (subError) {
            console.error('Subscription error:', subError);
            throw new Error('❌ Failed to create subscription: ' + subError.message);
        }

        console.log('✅ Subscription Created:', JSON.stringify(subscription));

        console.log('🚀 Step 4: Sending to Backend...');
        const response = await fetch('/apps/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });

        console.log('📡 Server Response:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server Error (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ Server Response:', result);

        console.log('🎉 Step 5: SUCCESS!');
        localStorage.setItem('pushNotificationSubscribed', 'true');
        alert('🎉 SUCCESS! You are now subscribed to push notifications!');
        return { success: true };

    } catch (error) {
        console.error('❌ SUBSCRIPTION FAILED:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        alert('❌ Subscription Failed: ' + error.message);
        return { success: false, message: error.message };
    }
}

// Check if subscribed
async function isSubscribed() {
    return localStorage.getItem('pushNotificationSubscribed') === 'true';
}

// Expose globally
window.PushNotifications = {
    subscribe: subscribeToPushNotifications,
    isSubscribed: isSubscribed
};

console.log('✅ Push Notification Helper Loaded!');
