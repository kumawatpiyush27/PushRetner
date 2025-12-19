// Shopify Integration Testing Script
// Run this in your browser console on your Shopify store

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:9000';

console.log('🚀 Shopify Integration Tester Loaded');
console.log('Available commands:');
console.log('  - shopifyTest.subscribe() - Subscribe to push notifications');
console.log('  - shopifyTest.sendTest() - Send test notification');
console.log('  - shopifyTest.broadcast(title, body, url) - Broadcast to all');
console.log('  - shopifyTest.getStats() - Get subscription stats');
console.log('  - shopifyTest.checkServiceWorker() - Check SW status');

const shopifyTest = {
    // Check service worker status
    async checkServiceWorker() {
        console.log('🔍 Checking Service Worker status...');
        
        if (!navigator.serviceWorker) {
            console.error('❌ Service Workers not supported');
            return;
        }

        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            console.log(`Found ${registrations.length} service worker registrations:`);
            
            registrations.forEach((reg, i) => {
                console.log(`\n  [${i}] Scope: ${reg.scope}`);
                console.log(`      Active: ${reg.active ? '✅ Yes' : '❌ No'}`);
                console.log(`      Installing: ${reg.installing ? '⏳ Yes' : '❌ No'}`);
                console.log(`      Waiting: ${reg.waiting ? '⏳ Yes' : '❌ No'}`);
            });

            const pushReg = await navigator.serviceWorker.getRegistration('/apps/push/');
            if (pushReg) {
                console.log('\n✅ Push notification SW registered at /apps/push/');
            } else {
                console.log('\n⚠️  Push notification SW NOT registered at /apps/push/');
            }
        } catch (error) {
            console.error('Error checking SW:', error);
        }
    },

    // Subscribe to notifications
    async subscribe() {
        console.log('🚀 Starting subscription process...\n');
        
        try {
            // Step 1: Request permission
            console.log('📍 Step 1: Requesting notification permission...');
            const permission = await Notification.requestPermission();
            console.log(`   Result: ${permission}`);
            
            if (permission !== 'granted') {
                console.error('   ❌ Permission not granted');
                return;
            }
            console.log('   ✅ Permission granted\n');

            // Step 2: Register service worker
            console.log('📍 Step 2: Registering service worker...');
            const registration = await navigator.serviceWorker.register('/apps/push/sw.js', {
                scope: '/apps/push/'
            });
            console.log('   ✅ SW registered:', registration.scope + '\n');

            // Step 3: Get active registration
            console.log('📍 Step 3: Getting active registration...');
            await new Promise(resolve => setTimeout(resolve, 500));
            const activeReg = await navigator.serviceWorker.getRegistration('/apps/push/');
            if (!activeReg) {
                throw new Error('No active registration found');
            }
            console.log('   ✅ Active registration found\n');

            // Step 4: Create subscription
            console.log('📍 Step 4: Creating push subscription...');
            const subscription = await activeReg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: 'BJFvSsHhCT8vKMQ9GtUiMmXZlnzzepGZvGqLwcbfrFxpSoBhuL6x52r_ivBW7PhgROj6X8w4wm7986xgURm1r1s'
            });
            console.log('   ✅ Subscription created\n');

            // Step 5: Send to backend
            console.log('📍 Step 5: Sending subscription to backend...');
            const response = await fetch(`${BACKEND_URL}/apps/push/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: subscription.toJSON() })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Backend error');
            }

            console.log('   ✅ Backend response:', data);
            console.log('\n✅✅✅ SUBSCRIPTION SUCCESSFUL ✅✅✅\n');
            console.log('Subscription endpoint:', subscription.endpoint);
            
        } catch (error) {
            console.error('\n❌ Subscription failed:', error.message);
        }
    },

    // Send test notification
    async sendTest() {
        console.log('🚀 Sending test notification...\n');
        
        try {
            const response = await fetch(`${BACKEND_URL}/apps/push/test-notification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Test Notification',
                    body: 'This is a test notification from Shopify'
                })
            });

            const data = await response.json();
            console.log('Response:', data);
            
            if (data.success) {
                console.log(`✅ Test sent successfully!`);
                console.log(`   Success: ${data.successCount}, Failed: ${data.failureCount}`);
            } else {
                console.error('❌ Test failed:', data.message);
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    },

    // Broadcast notification
    async broadcast(title = 'Hello Shopify', body = 'Test broadcast notification', url = '/') {
        console.log(`🚀 Broadcasting: "${title}"\n`);
        
        try {
            const response = await fetch(`${BACKEND_URL}/apps/push/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body, url })
            });

            const data = await response.json();
            console.log('Response:', data);
            
            if (data.success) {
                console.log(`✅ Broadcast sent!`);
                console.log(`   Success: ${data.successCount}, Failed: ${data.failureCount}`);
            } else {
                console.error('❌ Broadcast failed:', data.message);
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    },

    // Get stats
    async getStats() {
        console.log('🚀 Fetching subscription stats...\n');
        
        try {
            const response = await fetch(`${BACKEND_URL}/apps/push/stats`);
            const data = await response.json();
            
            if (data.success) {
                console.log(`✅ Total Subscriptions: ${data.totalSubscriptions}`);
                if (data.subscriptions && data.subscriptions.length > 0) {
                    console.log('\nRecent subscriptions:');
                    data.subscriptions.slice(0, 5).forEach((sub, i) => {
                        console.log(`   [${i + 1}] ${sub.endpoint.substring(0, 50)}...`);
                        console.log(`       Created: ${new Date(sub.createdAt).toLocaleString()}`);
                    });
                    if (data.subscriptions.length > 5) {
                        console.log(`   ... and ${data.subscriptions.length - 5} more`);
                    }
                }
            } else {
                console.error('❌ Failed:', data.message);
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    }
};

// Make available globally
window.shopifyTest = shopifyTest;
console.log('✅ Ready! Type shopifyTest. to see available commands\n');
