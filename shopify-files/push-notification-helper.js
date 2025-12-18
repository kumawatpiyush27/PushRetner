// Push Notification Helper for Shopify
// Updated for production use

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:9000';
const PUBLIC_VAPID_KEY = 'BJFvSsHhCT8vKMQ9GtUiMmXZlnzzepGZvGqLwcbfrFxpSoBhuL6x52r_ivBW7PhgROj6X8w4wm7986xgURm1r1s';

async function subscribeToPushNotifications() {
    try {
        console.log('🚀 Step 1: Requesting Permission...');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('❌ Permission Denied. Please allow notifications in your browser settings.');
        }
        console.log('✅ Permission Granted!');

        console.log('🚀 Step 2: Registering Service Worker...');
        const registration = await navigator.serviceWorker.register('/apps/push/sw.js', {
            scope: '/apps/push/'
        });
        console.log('✅ Service Worker Registered:', registration);

        console.log('🚀 Step 2.5: Getting Active Registration...');
        const activeReg = await navigator.serviceWorker.getRegistration('/apps/push/');

        if (!activeReg) {
            throw new Error('❌ Service Worker registration not found');
        }

        // Wait for activation
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ Using Registration:', activeReg);

        console.log('🚀 Step 3: Creating Push Subscription...');

        let subscription;
        try {
            subscription = await activeReg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: PUBLIC_VAPID_KEY
            });
        } catch (subError) {
            console.error('Subscription error:', subError);
            throw new Error('❌ Failed to create subscription: ' + subError.message);
        }

        console.log('✅ Subscription Created:', JSON.stringify(subscription));

        console.log('🚀 Step 4: Sending to Backend...');
        const response = await fetch(`${BACKEND_URL}/apps/push/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subscription: subscription.toJSON()
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`❌ Backend Error: ${data.message}`);
        }

        console.log('✅ Backend Response:', data);
        console.log('✅✅✅ Subscription Complete! ✅✅✅');

        return {
            success: true,
            message: 'Successfully subscribed to push notifications',
            subscription: subscription.toJSON()
        };
    } catch (error) {
        console.error('❌ Subscription failed:', error);
        return {
            success: false,
            message: error.message,
            error: error
        };
    }
}

// Test notification
async function sendTestNotification() {
    try {
        console.log('🚀 Sending test notification...');
        const response = await fetch(`${BACKEND_URL}/apps/push/test-notification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: 'Test Notification',
                body: 'This is a test notification from Shopify'
            })
        });

        const data = await response.json();
        console.log('✅ Test notification response:', data);
        return data;
    } catch (error) {
        console.error('❌ Test notification failed:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// Broadcast notification
async function broadcastNotification(title, body, url) {
    try {
        console.log('🚀 Broadcasting notification...');
        const response = await fetch(`${BACKEND_URL}/apps/push/broadcast`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: title,
                body: body,
                url: url || '/'
            })
        });

        const data = await response.json();
        console.log('✅ Broadcast response:', data);
        return data;
    } catch (error) {
        console.error('❌ Broadcast failed:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// Get stats
async function getNotificationStats() {
    try {
        const response = await fetch(`${BACKEND_URL}/apps/push/stats`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();
        console.log('✅ Stats:', data);
        return data;
    } catch (error) {
        console.error('❌ Failed to get stats:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        subscribeToPushNotifications,
        sendTestNotification,
        broadcastNotification,
        getNotificationStats
    };
}
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
