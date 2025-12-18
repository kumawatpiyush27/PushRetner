// Push Notification Helper - Final Working Version
// Upload to: Shopify Theme > Assets > push-notification-helper.js

(function () {
    'use strict';

    console.log('🚀 Push Notification Helper Loading...');

    async function subscribeToPushNotifications() {
        try {
            console.log('🔔 Starting subscription process...');

            // Step 1: Check browser support
            if (!('serviceWorker' in navigator)) {
                throw new Error('Service Workers not supported in this browser');
            }

            if (!('PushManager' in window)) {
                throw new Error('Push notifications not supported in this browser');
            }

            // Step 2: Request permission
            console.log('📝 Requesting notification permission...');
            const permission = await Notification.requestPermission();

            if (permission !== 'granted') {
                throw new Error('Notification permission denied');
            }

            console.log('✅ Permission granted!');

            // Step 3: Unregister any existing service workers first
            console.log('🧹 Cleaning up old service workers...');
            const existingRegs = await navigator.serviceWorker.getRegistrations();
            for (let reg of existingRegs) {
                console.log('Unregistering:', reg.scope);
                await reg.unregister();
            }

            // Step 4: Register new service worker
            console.log('📦 Registering new service worker...');
            const swUrl = '/apps/push/sw.js';

            const registration = await navigator.serviceWorker.register(swUrl, {
                scope: '/apps/push/'
            });

            console.log('✅ Service Worker registered:', registration.scope);

            // Step 5: Wait for activation with proper handling
            console.log('⏳ Waiting for activation...');

            if (registration.installing) {
                console.log('📦 SW is installing...');
                await waitForActivation(registration.installing);
            } else if (registration.waiting) {
                console.log('⏸️ SW is waiting...');
                await waitForActivation(registration.waiting);
            } else if (registration.active) {
                console.log('✅ SW already active!');
            }

            // Small delay to ensure SW is fully ready
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log('✅ Service Worker is ready!');

            // Step 6: Create subscription
            console.log('🔑 Step 3: Creating push subscription...');
            const publicVapidKey = 'BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04';

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });

            console.log('✅ Subscription created!');

            // Step 7: Send to backend
            console.log('📡 Sending subscription to server...');
            const response = await fetch('/apps/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(subscription)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ Server response:', result);

            // Step 8: Success!
            localStorage.setItem('pushNotificationSubscribed', 'true');
            console.log('🎉 Subscription complete!');

            alert('✅ Successfully subscribed to notifications!');
            return { success: true };

        } catch (error) {
            console.error('❌ Subscription failed:', error);

            // User-friendly error messages
            let message = error.message;
            if (message.includes('denied')) {
                message = 'Please enable notifications in your browser settings and try again.';
            } else if (message.includes('not supported')) {
                message = 'Your browser does not support push notifications.';
            } else if (message.includes('timeout')) {
                message = 'Request timed out. Please try again.';
            }

            alert('❌ Error: ' + message);
            return { success: false, error: error.message };
        }
    }

    // Helper function to wait for service worker activation
    function waitForActivation(serviceWorker) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Service Worker activation timeout'));
            }, 15000); // 15 second timeout

            if (serviceWorker.state === 'activated') {
                clearTimeout(timeout);
                resolve();
                return;
            }

            serviceWorker.addEventListener('statechange', function handler() {
                console.log('🔄 SW state changed to:', serviceWorker.state);

                if (serviceWorker.state === 'activated') {
                    clearTimeout(timeout);
                    serviceWorker.removeEventListener('statechange', handler);
                    resolve();
                } else if (serviceWorker.state === 'redundant') {
                    clearTimeout(timeout);
                    serviceWorker.removeEventListener('statechange', handler);
                    reject(new Error('Service Worker became redundant'));
                }
            });
        });
    }

    // Helper function to convert VAPID key
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    // Check if already subscribed
    async function isSubscribed() {
        return localStorage.getItem('pushNotificationSubscribed') === 'true';
    }

    // Debug function
    async function checkStatus() {
        console.log('📊 Checking status...');

        const regs = await navigator.serviceWorker.getRegistrations();
        console.log('Service Worker Registrations:', regs.length);

        regs.forEach((reg, i) => {
            console.log(`Registration ${i + 1}:`, {
                scope: reg.scope,
                active: !!reg.active,
                installing: !!reg.installing,
                waiting: !!reg.waiting
            });
        });

        const subscribed = await isSubscribed();
        console.log('Subscription status:', subscribed);

        return { registrations: regs.length, subscribed };
    }

    // Expose API
    window.PushNotifications = {
        subscribe: subscribeToPushNotifications,
        isSubscribed: isSubscribed,
        checkStatus: checkStatus
    };

    console.log('✅ Push Notification Helper loaded successfully!');
    console.log('📞 Available: window.PushNotifications.subscribe()');

})();
