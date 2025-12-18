// Push Notification Helper for Shopify - App Proxy Version (Fixed)
// Upload to: Shopify Theme > Assets > push-notification-helper.js

async function subscribeToPushNotifications() {
    try {
        console.log('🔔 Step 1: Requesting Permission...');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Permission blocked by user');
        }
        console.log('✅ Permission granted!');

        console.log('📝 Step 2: Registering Service Worker...');

        // Service Worker via App Proxy - Served from Vercel
        const swUrl = '/apps/push/sw.js';

        const registration = await navigator.serviceWorker.register(swUrl, {
            scope: '/apps/push/'
        });

        console.log('📦 Service Worker registered:', registration);

        // Wait for service worker to be active with timeout
        console.log('⏳ Waiting for SW to activate...');

        let serviceWorker = registration.installing || registration.waiting || registration.active;

        if (serviceWorker) {
            if (serviceWorker.state === 'activated') {
                console.log('✅ SW already active!');
            } else {
                // Wait for activation with timeout
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Service Worker activation timeout (10s)'));
                    }, 10000); // 10 second timeout

                    serviceWorker.addEventListener('statechange', function listener() {
                        console.log('🔄 SW state:', serviceWorker.state);
                        if (serviceWorker.state === 'activated') {
                            clearTimeout(timeout);
                            serviceWorker.removeEventListener('statechange', listener);
                            console.log('✅ SW activated!');
                            resolve();
                        } else if (serviceWorker.state === 'redundant') {
                            clearTimeout(timeout);
                            serviceWorker.removeEventListener('statechange', listener);
                            reject(new Error('Service Worker became redundant'));
                        }
                    });
                });
            }
        }

        // Double check with ready
        await navigator.serviceWorker.ready;
        console.log('✅ Service Worker ready!');

        console.log('🔑 Step 3: Creating Subscription...');
        const publicVapidKey = 'BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04';

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicVapidKey
        });

        console.log('✅ Subscription created!');
        console.log('📤 Subscription object:', JSON.stringify(subscription, null, 2));

        console.log('📡 Step 4: Sending to Backend...');
        const response = await fetch('/apps/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });

        console.log('📥 Response status:', response.status);

        if (!response.ok) {
            const text = await response.text();
            console.error('❌ Server error:', text);
            throw new Error(`Server Error ${response.status}: ${text}`);
        }

        const result = await response.json();
        console.log('✅ Server response:', result);

        console.log('🎉 Step 5: Success!');
        localStorage.setItem('pushNotificationSubscribed', 'true');
        alert('✅ Subscribed Successfully! You will now receive notifications.');
        return { success: true };

    } catch (error) {
        console.error('❌ Subscription Failed:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });

        let errorMessage = error.message;

        // Better error messages
        if (error.message.includes('timeout')) {
            errorMessage = 'Service Worker took too long to activate. Please refresh the page and try again.';
        } else if (error.message.includes('redundant')) {
            errorMessage = 'Service Worker failed to activate. Please refresh the page and try again.';
        } else if (error.message.includes('blocked')) {
            errorMessage = 'Notification permission was blocked. Please enable notifications in your browser settings.';
        }

        alert('❌ Error: ' + errorMessage);
        return { success: false, message: error.message };
    }
}

async function isSubscribed() {
    return localStorage.getItem('pushNotificationSubscribed') === 'true';
}

// Debug function
async function checkServiceWorkerStatus() {
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('📋 Service Worker Registrations:', registrations);

        registrations.forEach((reg, index) => {
            console.log(`Registration ${index + 1}:`, {
                scope: reg.scope,
                active: reg.active ? 'Yes' : 'No',
                installing: reg.installing ? 'Yes' : 'No',
                waiting: reg.waiting ? 'Yes' : 'No'
            });
        });

        return registrations;
    } else {
        console.error('❌ Service Workers not supported');
        return [];
    }
}

// Export functions
window.PushNotifications = {
    subscribe: subscribeToPushNotifications,
    isSubscribed: isSubscribed,
    checkStatus: checkServiceWorkerStatus
};

// Auto-check on load
console.log('🚀 Push Notification Helper Loaded');
console.log('📞 Available functions:', Object.keys(window.PushNotifications));
