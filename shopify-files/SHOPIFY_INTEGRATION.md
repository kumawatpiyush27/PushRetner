# 🛒 Shopify Push Notification Integration Guide

## 📋 Overview
Ye guide aapko step-by-step batayega ki Shopify store mein push notifications kaise add karein.

---

## ✅ Prerequisites (Pehle ye karo)

1. ✅ Vercel backend deployed ho (https://push-retner.vercel.app)
2. ✅ Environment variables add ho Vercel mein
3. ✅ Backend test ho chuka ho (/admin dashboard working)

---

## 🔧 Step 1: Shopify Theme Mein Files Upload Karo

### 1.1 Shopify Admin Mein Jao
1. **Online Store** → **Themes** → **Actions** → **Edit Code**

### 1.2 JavaScript File Upload Karo
1. Left sidebar mein **Assets** folder par click karo
2. **Add a new asset** button par click karo
3. **Create a blank file** select karo
4. File name: `push-notification-helper.js`
5. File content: `shopify-files/push-notification-helper.js` ka updated code paste karo
6. **Save** karo

### 1.3 Popup Code Add Karo
1. Left sidebar mein **Layout** folder par click karo
2. **theme.liquid** file open karo
3. **</body>** tag se pehle `shopify-files/shopify-popup.liquid` ka code paste karo
4. **Save** karo

---

## 🎨 Step 2: Popup Customize Karo (Optional)

### Colors Change Karna Hai?
`shopify-popup.liquid` file mein ye lines edit karo:

```css
/* Line 14: Gradient color */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Apni brand colors use karo */
background: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%);
```

### Message Change Karna Hai?
```html
<!-- Line 142: Popup message -->
<p class="push-popup-message">
  Get instant notifications about new products, exclusive offers, and order updates!
</p>
```

### Popup Timing Change Karna Hai?
```javascript
/* Line 157: Show after 5 seconds */
setTimeout(() => {
  // ...
}, 5000); // 5000 = 5 seconds, 10000 = 10 seconds
```

---

## 🧪 Step 3: Test Karo

### 3.1 Shopify Store Open Karo
1. Apni Shopify store ka URL browser mein kholo
2. 5 seconds wait karo
3. **Push notification popup** dikhna chahiye

### 3.2 Subscribe Karo
1. **"✓ Allow"** button par click karo
2. Browser notification permission popup aayega
3. **"Allow"** par click karo
4. Success message dikhega: "✅ Subscribed Successfully!"

### 3.3 Verify Karo
1. Vercel admin dashboard kholo: `https://push-retner.vercel.app/admin`
2. **Total Subscribers** count 1 hona chahiye
3. Test notification bhejo

---

## 🚀 Step 4: Test Notification Bhejo

### Admin Dashboard Se:
1. `https://push-retner.vercel.app/admin` par jao
2. **Quick Send Campaign** section mein:
   - Title: "Test Notification 🔔"
   - Message: "Hello from Shopify!"
   - URL: Your Shopify store URL
3. **"🚀 Send Campaign"** button par click karo
4. Notification aana chahiye (even if browser minimized hai)

---

## 📱 User Flow (Customer Experience)

1. **Customer Shopify store visit karta hai**
2. **5 seconds baad popup dikhta hai**
3. **Customer "Allow" par click karta hai**
4. **Browser permission popup aata hai**
5. **Customer "Allow" karta hai**
6. **Success message dikhta hai**
7. **Welcome notification milta hai**
8. **Future mein aap broadcast notifications bhej sakte ho**

---

## 🎯 Advanced Features (Optional)

### Feature 1: Homepage Par Hi Popup Dikhao
```javascript
// shopify-popup.liquid mein ye condition add karo
if (window.location.pathname === '/') {
  // Only show on homepage
  setTimeout(() => {
    // ... popup code
  }, 5000);
}
```

### Feature 2: Cart Page Par Popup Dikhao
```javascript
if (window.location.pathname.includes('/cart')) {
  // Show on cart page
  setTimeout(() => {
    // ... popup code
  }, 3000); // Show after 3 seconds
}
```

### Feature 3: Exit Intent Popup
```javascript
// Show popup when user tries to leave
document.addEventListener('mouseleave', (e) => {
  if (e.clientY < 0) {
    document.getElementById('pushNotificationPopup').classList.remove('hidden');
  }
});
```

---

## 🐛 Troubleshooting

### Popup Nahi Dikh Raha?
1. Browser console check karo (F12)
2. Errors dekho
3. `push-notification-helper.js` properly load hua hai?
4. Theme.liquid mein code properly paste hua hai?

### Subscription Fail Ho Raha?
1. HTTPS enabled hai Shopify store mein? (Required)
2. VAPID key sahi hai?
3. Backend URL sahi hai? (`https://push-retner.vercel.app`)
4. Vercel environment variables set hain?

### Notification Nahi Aa Raha?
1. Browser notifications enabled hain?
2. Admin dashboard mein subscriber count dikh raha hai?
3. Backend logs check karo Vercel mein
4. Service worker register hua hai? (DevTools → Application → Service Workers)

---

## 📊 Analytics & Tracking

### Subscriber Count Dekhna Hai?
```
https://push-retner.vercel.app/stats
```

### Admin Dashboard:
```
https://push-retner.vercel.app/admin
```

---

## 🔒 Security Best Practices

1. ✅ HTTPS use karo (Shopify automatically provides)
2. ✅ VAPID keys secret rakho
3. ✅ Backend environment variables mein store karo
4. ✅ Regular backups lo database ki

---

## 📝 Files Summary

### Files Banaye Gaye:
1. **push-notification-helper.js** - Main subscription logic
2. **shopify-popup.liquid** - Beautiful popup UI
3. **SHOPIFY_INTEGRATION.md** - Ye guide

### Shopify Mein Upload Karne Hain:
1. `push-notification-helper.js` → Assets folder
2. `shopify-popup.liquid` ka code → theme.liquid file mein

---

## 🎉 Success Checklist

- [ ] Backend deployed on Vercel
- [ ] Environment variables added
- [ ] `push-notification-helper.js` uploaded to Shopify Assets
- [ ] Popup code added to `theme.liquid`
- [ ] Tested subscription on Shopify store
- [ ] Received test notification
- [ ] Admin dashboard accessible
- [ ] Subscriber count showing correctly

---

## 🚀 Next Steps

1. **Customize popup** apne brand ke according
2. **Test thoroughly** different browsers mein
3. **Send test campaigns** to verify everything works
4. **Monitor subscriber growth** admin dashboard se
5. **Plan notification strategy** (welcome, cart abandonment, offers, etc.)

---

## 📞 Support

Agar koi problem aaye toh:
1. Browser console check karo
2. Vercel deployment logs dekho
3. Backend `/stats` endpoint test karo
4. Service worker status check karo

---

**Made with ❤️ for Zyra Jewel**

Last Updated: {{ "now" | date: "%Y-%m-%d" }}
