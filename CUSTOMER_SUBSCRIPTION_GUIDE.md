# 🎯 Customer-Specific Push Notifications Guide

## 📊 **Current System:**

Har user ka subscription **already unique** hai! Browser automatically unique endpoint generate karta hai.

---

## 🔧 **Enhanced System - Customer Tracking:**

### **Option 1: Add Customer Metadata to Subscriptions**

#### **Database Schema Update:**

```sql
-- Add customer tracking columns
ALTER TABLE subscriptions 
ADD COLUMN customer_id TEXT,
ADD COLUMN customer_email TEXT,
ADD COLUMN customer_name TEXT,
ADD COLUMN user_agent TEXT,
ADD COLUMN subscribed_at TIMESTAMP DEFAULT NOW();

-- Add index for faster queries
CREATE INDEX idx_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_customer_email ON subscriptions(customer_email);
```

#### **Updated Subscription Model:**

```javascript
// backend/subscriptionModel.js
create: async (data) => {
    const query = `
        INSERT INTO subscriptions (
            endpoint, 
            expiration_time, 
            keys,
            customer_id,
            customer_email,
            customer_name,
            user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (endpoint) 
        DO UPDATE SET 
            customer_id = EXCLUDED.customer_id,
            customer_email = EXCLUDED.customer_email,
            customer_name = EXCLUDED.customer_name,
            subscribed_at = NOW()
        RETURNING *;
    `;
    
    const values = [
        data.endpoint,
        data.expirationTime || null,
        data.keys,
        data.customerId || null,
        data.customerEmail || null,
        data.customerName || null,
        data.userAgent || null
    ];
    
    const res = await pool.query(query, values);
    return res.rows[0];
}
```

---

## 📱 **Frontend Integration (Shopify):**

### **Send Customer Info with Subscription:**

```javascript
// In push-notification-helper.js

async function subscribeToPushNotifications() {
    // ... existing code ...
    
    // Get Shopify customer info (if logged in)
    const customerInfo = getShopifyCustomerInfo();
    
    // Add customer info to subscription
    const subscriptionData = {
        ...subscription.toJSON(),
        customerId: customerInfo.id,
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        userAgent: navigator.userAgent
    };
    
    // Send to backend
    const response = await fetch('/apps/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionData)
    });
}

// Get Shopify customer info from Liquid variables
function getShopifyCustomerInfo() {
    // This will be injected via Liquid in theme.liquid
    return {
        id: window.shopifyCustomerId || null,
        email: window.shopifyCustomerEmail || null,
        name: window.shopifyCustomerName || null
    };
}
```

### **In theme.liquid (Inject Customer Data):**

```liquid
<!-- Add this in theme.liquid BEFORE push notification script -->
{% if customer %}
<script>
  window.shopifyCustomerId = "{{ customer.id }}";
  window.shopifyCustomerEmail = "{{ customer.email }}";
  window.shopifyCustomerName = "{{ customer.first_name }} {{ customer.last_name }}";
</script>
{% endif %}
```

---

## 🎯 **Use Cases:**

### **1. Send to Specific Customer:**

```javascript
// Backend: Send notification to specific customer
async function sendToCustomer(customerId, notification) {
    // Get customer's subscriptions
    const query = `
        SELECT * FROM subscriptions 
        WHERE customer_id = $1
    `;
    const result = await pool.query(query, [customerId]);
    
    // Send to all their devices
    for (const sub of result.rows) {
        await webpush.sendNotification(sub, JSON.stringify(notification));
    }
}

// Usage:
await sendToCustomer('123456', {
    title: 'Order Update',
    body: 'Your order #1234 has been shipped!',
    data: { url: '/account/orders/1234' }
});
```

### **2. Send to All Customers:**

```javascript
// Already working! Current broadcast function
async function broadcastToAll(notification) {
    const subscriptions = await SubscriptionModel.find();
    
    for (const sub of subscriptions) {
        await webpush.sendNotification(sub, JSON.stringify(notification));
    }
}
```

### **3. Send to Customers by Email:**

```javascript
async function sendToEmail(email, notification) {
    const query = `
        SELECT * FROM subscriptions 
        WHERE customer_email = $1
    `;
    const result = await pool.query(query, [email]);
    
    for (const sub of result.rows) {
        await webpush.sendNotification(sub, JSON.stringify(notification));
    }
}
```

### **4. Segmented Notifications:**

```javascript
// Send to customers who subscribed in last 7 days
async function sendToRecentSubscribers(notification) {
    const query = `
        SELECT * FROM subscriptions 
        WHERE subscribed_at > NOW() - INTERVAL '7 days'
    `;
    const result = await pool.query(query);
    
    for (const sub of result.rows) {
        await webpush.sendNotification(sub, JSON.stringify(notification));
    }
}
```

---

## 📊 **Admin Dashboard - View Subscribers:**

### **Enhanced Stats Endpoint:**

```javascript
// backend/server.js
app.get('/stats', async (req, res) => {
    try {
        const totalQuery = 'SELECT COUNT(*) FROM subscriptions';
        const totalResult = await pool.query(totalQuery);
        
        const customersQuery = `
            SELECT COUNT(DISTINCT customer_id) 
            FROM subscriptions 
            WHERE customer_id IS NOT NULL
        `;
        const customersResult = await pool.query(customersQuery);
        
        const recentQuery = `
            SELECT COUNT(*) FROM subscriptions 
            WHERE subscribed_at > NOW() - INTERVAL '24 hours'
        `;
        const recentResult = await pool.query(recentQuery);
        
        res.json({
            total: parseInt(totalResult.rows[0].count),
            uniqueCustomers: parseInt(customersResult.rows[0].count),
            last24Hours: parseInt(recentResult.rows[0].count)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### **List All Subscribers:**

```javascript
app.get('/subscribers', async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                customer_id,
                customer_email,
                customer_name,
                subscribed_at,
                SUBSTRING(endpoint, 1, 50) as endpoint_preview
            FROM subscriptions
            ORDER BY subscribed_at DESC
            LIMIT 100
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

---

## 🔒 **Privacy & GDPR Compliance:**

### **Delete Customer Subscription:**

```javascript
app.delete('/unsubscribe/:customerId', async (req, res) => {
    try {
        const query = `
            DELETE FROM subscriptions 
            WHERE customer_id = $1
            RETURNING *
        `;
        const result = await pool.query(query, [req.params.customerId]);
        
        res.json({ 
            success: true, 
            deleted: result.rowCount 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

---

## 📝 **Summary:**

| Feature | Status | How It Works |
|---------|--------|--------------|
| **Unique Subscriptions** | ✅ Already Working | Browser generates unique endpoint |
| **Multiple Devices** | ✅ Already Working | Same user = multiple subscriptions |
| **Customer Tracking** | ⚙️ Optional Enhancement | Add customer_id to database |
| **Targeted Notifications** | ⚙️ Optional Enhancement | Query by customer_id/email |
| **Broadcast to All** | ✅ Already Working | Send to all subscriptions |

---

## 🎯 **Quick Answer:**

**Q: Har client ka alag subscription kaise hoga?**

**A: Already hai! ✅**

- Har browser/device automatically unique subscription generate karta hai
- Same user, different device = 2 subscriptions (both work!)
- Database mein har subscription unique endpoint ke saath save hota hai
- Broadcast karo = sabko notification jayega
- Specific user ko bhejne ke liye: customer_id track karo (optional)

---

## 🚀 **Current System (No Changes Needed):**

```
User A (Phone) → Subscription 1 → Database Row 1
User A (Laptop) → Subscription 2 → Database Row 2
User B (Phone) → Subscription 3 → Database Row 3
User C (Tablet) → Subscription 4 → Database Row 4

Broadcast → All 4 get notification ✅
```

---

**Aapka current system already har client ko alag handle kar raha hai! Customer tracking optional enhancement hai agar specific users ko target karna ho.** 😊

Kya aap customer tracking add karna chahte ho? Ya current system theek hai?
