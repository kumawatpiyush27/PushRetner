# 🚀 QUICK FIX - Shopify Service Worker Setup

## ⚡ Immediate Solution (5 Minutes)

### **Step 1: Shopify Admin Mein Jao**
```
Online Store → Themes → Actions → Edit Code
```

### **Step 2: Service Worker Upload Karo**

1. Left sidebar → **Assets** folder
2. **Add a new asset** button
3. **Create a blank file**
4. File name: `push-sw.js`
5. Copy-paste this code:

```javascript
// Service Worker for Push Notifications
self.addEventListener('push', async function (event) {
    try {
        const message = await event.data.json();
        let { title, body, icon, badge, actions, data, requireInteraction, tag } = message;

        const notificationOptions = {
            body: body || 'You have a new notification',
            icon: icon || 'https://cdn.shopify.com/s/files/1/0000/0000/0000/files/icon.png',
            badge: badge,
            vibrate: [200, 100, 200],
            tag: tag || 'notification-' + Date.now(),
            requireInteraction: requireInteraction || false,
            data: data || {}
        };

        if (actions && actions.length > 0) {
            notificationOptions.actions = actions;
        }

        await event.waitUntil(
            self.registration.showNotification(title, notificationOptions)
        );
    } catch (error) {
        console.error('Error showing notification:', error);
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    let urlToOpen = '/';

    if (event.action) {
        if (event.action.startsWith('http')) {
            urlToOpen = event.action;
        } else {
            urlToOpen = event.notification.data.url || '/';
        }
    } else if (event.notification.data && event.notification.data.url) {
        urlToOpen = event.notification.data.url;
    }

    event.waitUntil(clients.openWindow(urlToOpen));
});
```

6. **Save** karo

### **Step 3: Helper Script Upload/Update Karo**

1. **Assets** folder mein
2. Agar `push-notification-helper.js` already hai toh **delete** karo
3. **Add a new asset** → **Create a blank file**
4. File name: `push-notification-helper.js`
5. Copy-paste this EXACT code:

```javascript
// Push Notification Helper for Shopify
const BACKEND_URL = 'https://push-retner.vercel.app';

async function subscribeToPushNotifications() {
    try {
        console.log('Step 1: Requesting Permission...');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Permission blocked by user');
        }

        console.log('Step 2: Registering SW...');
        
        // Use Shopify-hosted service worker
        const swUrl = '/push-sw.js';
        
        const registration = await navigator.serviceWorker.register(swUrl, {
            scope: '/'
        });
        
        // Wait for service worker to be active
        await navigator.serviceWorker.ready;
        console.log('SW Active:', registration);

        console.log('Step 3: Creating Subscription...');
        const publicVapidKey = 'BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04';

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicVapidKey
        });

        console.log('Step 4: Sending to Backend...');
        const response = await fetch(`${BACKEND_URL}/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Server Error ${response.status}: ${text}`);
        }

        console.log('Step 5: Success!');
        localStorage.setItem('pushNotificationSubscribed', 'true');
        alert('✅ Subscribed Successfully!');
        return { success: true };

    } catch (error) {
        console.error('Subscription Failed:', error);
        alert('❌ Error: ' + error.message);
        return { success: false, message: error.message };
    }
}

async function isSubscribed() {
    return localStorage.getItem('pushNotificationSubscribed') === 'true';
}

window.PushNotifications = {
    subscribe: subscribeToPushNotifications,
    isSubscribed: isSubscribed
};
```

6. **Save** karo

### **Step 4: Popup Code Add Karo (Agar Nahi Hai)**

1. **Layout** folder → **theme.liquid** open karo
2. **</body>** tag DHUNDO
3. Uske **UPAR** (pehle) ye code paste karo:

```html
<!-- Push Notification Popup -->
<style>
  .push-notification-popup {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px 25px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 99999;
    max-width: 350px;
    animation: slideIn 0.5s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .push-notification-popup.hidden { display: none; }
  @keyframes slideIn {
    from { transform: translateY(100px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .push-popup-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .push-popup-icon { font-size: 32px; }
  .push-popup-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }
  .push-popup-message {
    font-size: 14px;
    margin: 0 0 15px 0;
    opacity: 0.95;
    line-height: 1.5;
  }
  .push-popup-buttons {
    display: flex;
    gap: 10px;
  }
  .push-popup-btn {
    flex: 1;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
  }
  .push-popup-btn-allow {
    background: white;
    color: #667eea;
  }
  .push-popup-btn-allow:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255, 255, 255, 0.3);
  }
  .push-popup-btn-later {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }
  .push-popup-btn-later:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  @media (max-width: 480px) {
    .push-notification-popup {
      bottom: 10px;
      right: 10px;
      left: 10px;
      max-width: none;
    }
  }
</style>

<div id="pushNotificationPopup" class="push-notification-popup hidden">
  <div class="push-popup-header">
    <div class="push-popup-icon">🔔</div>
    <h3 class="push-popup-title">Stay Updated!</h3>
  </div>
  <p class="push-popup-message">
    Get instant notifications about new products and exclusive offers!
  </p>
  <div class="push-popup-buttons">
    <button class="push-popup-btn push-popup-btn-allow" onclick="allowPushNotifications()">
      ✓ Allow
    </button>
    <button class="push-popup-btn push-popup-btn-later" onclick="laterPushNotifications()">
      Maybe Later
    </button>
  </div>
</div>

<script src="{{ 'push-notification-helper.js' | asset_url }}" defer></script>
<script>
  setTimeout(() => {
    const isSubscribed = localStorage.getItem('pushNotificationSubscribed');
    const popupDismissed = localStorage.getItem('pushPopupDismissed');
    if (!isSubscribed && !popupDismissed) {
      document.getElementById('pushNotificationPopup').classList.remove('hidden');
    }
  }, 5000);

  async function allowPushNotifications() {
    document.getElementById('pushNotificationPopup').classList.add('hidden');
    if (window.PushNotifications && window.PushNotifications.subscribe) {
      await window.PushNotifications.subscribe();
    }
  }

  function laterPushNotifications() {
    document.getElementById('pushNotificationPopup').classList.add('hidden');
    localStorage.setItem('pushPopupDismissed', 'true');
  }
</script>
```

4. **Save** karo

### **Step 5: Test Karo!**

1. **Browser cache clear** karo (Ctrl + Shift + Delete)
2. **Shopify store** open karo
3. **5 seconds** wait karo
4. **Popup** dikhega
5. **"Allow"** par click karo
6. **Success!** ✅

---

## ✅ **Checklist:**

- [ ] `push-sw.js` uploaded to Shopify Assets
- [ ] `push-notification-helper.js` uploaded/updated in Shopify Assets
- [ ] Popup code added to `theme.liquid` (before </body>)
- [ ] Browser cache cleared
- [ ] Tested on store
- [ ] Subscription successful
- [ ] Notification received

---

## 🎯 **Files Location:**

```
Shopify Theme
├── Assets/
│   ├── push-sw.js              ← Service Worker
│   └── push-notification-helper.js  ← Subscription logic
└── Layout/
    └── theme.liquid            ← Popup code added
```

---

## 🐛 **Still Not Working?**

1. **Clear browser cache** completely
2. **Try incognito mode**
3. **Check browser console** for errors (F12)
4. **Verify files uploaded** correctly in Shopify
5. **Check file names** exactly match

---

**Time Required:** 5-10 minutes
**Difficulty:** Easy ⭐

---

**Made with ❤️ for Dupatta Bazaar**
