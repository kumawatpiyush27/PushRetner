# 🏪 Multi-Store Broadcast Guide

## 🎯 **How to Send Notifications to Specific Store**

### **Step 1: Database Already Updated** ✅

Backend code updated to track:
- `store_id` - Unique store identifier (e.g., "zyra", "dupatta")
- `store_name` - Store display name (e.g., "Zyra Jewel")
- `store_domain` - Store domain (e.g., "zyrajewel.myshopify.com")

---

### **Step 2: Add Broadcast Endpoint for Specific Store**

Add this to `backend/server.js`:

```javascript
// Broadcast to specific store
app.post('/broadcast-store/:storeId', async (req, res) => {
    try {
        const { storeId } = req.params;
        const { title, body, icon, url } = req.body;

        console.log(`📢 Broadcasting to store: ${storeId}`);

        // Get subscriptions for this store only
        const subscriptions = await SubscriptionModel.findByStore(storeId);

        if (subscriptions.length === 0) {
            return res.json({
                success: true,
                message: `No subscribers found for store: ${storeId}`,
                sent: 0
            });
        }

        const payload = JSON.stringify({
            title: title || 'New Notification',
            body: body || 'You have a new update!',
            icon: icon || '/icon.png',
            data: { url: url || '/' }
        });

        let successCount = 0;
        let failCount = 0;

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(sub, payload);
                successCount++;
                console.log(`✅ Sent to subscription ${sub._id}`);
            } catch (err) {
                failCount++;
                console.error(`❌ Failed to send to ${sub._id}:`, err.message);
                
                // Delete invalid subscriptions
                if (err.statusCode === 410) {
                    await SubscriptionModel.deleteOne({ _id: sub._id });
                    console.log(`🗑️ Deleted expired subscription ${sub._id}`);
                }
            }
        }

        res.json({
            success: true,
            storeId: storeId,
            total: subscriptions.length,
            sent: successCount,
            failed: failCount
        });

    } catch (error) {
        console.error('❌ Broadcast error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get stats for specific store
app.get('/stats/:storeId', async (req, res) => {
    try {
        const { storeId } = req.params;
        const subscriptions = await SubscriptionModel.findByStore(storeId);
        
        res.json({
            storeId: storeId,
            count: subscriptions.length,
            storeName: subscriptions[0]?.storeName || 'Unknown'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all stores
app.get('/stores', async (req, res) => {
    try {
        const query = `
            SELECT 
                store_id,
                store_name,
                store_domain,
                COUNT(*) as subscriber_count
            FROM subscriptions
            WHERE store_id IS NOT NULL
            GROUP BY store_id, store_name, store_domain
            ORDER BY subscriber_count DESC
        `;
        
        const result = await pool.query(query);
        
        res.json({
            stores: result.rows.map(row => ({
                id: row.store_id,
                name: row.store_name,
                domain: row.store_domain,
                subscribers: parseInt(row.subscriber_count)
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

---

## 🚀 **How to Use:**

### **Option 1: Via API (Postman/cURL)**

#### **Send to Zyra Jewel:**
```bash
curl -X POST https://push-retner.vercel.app/broadcast-store/zyrajewel \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Arrivals at Zyra! 💎",
    "body": "Check out our latest jewelry collection",
    "icon": "https://zyrajewel.com/icon.png",
    "url": "https://zyrajewel.com/collections/new"
  }'
```

#### **Send to Dupatta Bazaar:**
```bash
curl -X POST https://push-retner.vercel.app/broadcast-store/dupattabazaar1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Dupatta Sale! 🎉",
    "body": "50% off on all dupattas this weekend",
    "icon": "https://dupattabazaar.com/icon.png",
    "url": "https://dupattabazaar.com/collections/sale"
  }'
```

---

### **Option 2: Via Admin Dashboard**

Update admin dashboard HTML to include store selector:

```html
<!-- Add store selector -->
<div class="form-group">
    <label>Select Store:</label>
    <select id="storeSelector">
        <option value="">All Stores (Broadcast)</option>
        <option value="zyrajewel">Zyra Jewel</option>
        <option value="dupattabazaar1">Dupatta Bazaar</option>
    </select>
</div>

<!-- Update send function -->
<script>
async function sendCampaign() {
    const storeId = document.getElementById('storeSelector').value;
    const title = document.getElementById('campaignTitle').value;
    const message = document.getElementById('campaignMessage').value;
    const url = document.getElementById('campaignUrl').value;
    
    // Choose endpoint based on store selection
    const endpoint = storeId 
        ? `/broadcast-store/${storeId}` 
        : '/broadcast';
    
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: title,
            body: message,
            url: url
        })
    });
    
    const result = await response.json();
    alert(`Sent to ${result.sent} subscribers in ${storeId || 'all stores'}`);
}
</script>
```

---

## 📊 **Check Store Stats:**

### **All Stores:**
```
GET https://push-retner.vercel.app/stores
```

**Response:**
```json
{
  "stores": [
    {
      "id": "zyrajewel",
      "name": "Zyra Jewel",
      "domain": "zyrajewel.myshopify.com",
      "subscribers": 150
    },
    {
      "id": "dupattabazaar1",
      "name": "Dupatta Bazaar",
      "domain": "dupattabazaar1.myshopify.com",
      "subscribers": 89
    }
  ]
}
```

### **Specific Store:**
```
GET https://push-retner.vercel.app/stats/zyrajewel
```

**Response:**
```json
{
  "storeId": "zyrajewel",
  "count": 150,
  "storeName": "Zyra Jewel"
}
```

---

## 🎯 **Quick Commands:**

### **Zyra Jewel ke liye:**
```javascript
// Browser console or Postman
fetch('https://push-retner.vercel.app/broadcast-store/zyrajewel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        title: 'Zyra Special! 💎',
        body: 'New jewelry collection launched',
        url: 'https://zyrajewel.com'
    })
}).then(r => r.json()).then(console.log);
```

### **Dupatta Bazaar ke liye:**
```javascript
fetch('https://push-retner.vercel.app/broadcast-store/dupattabazaar1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        title: 'Dupatta Sale! 🎉',
        body: '50% off this weekend',
        url: 'https://dupattabazaar.com'
    })
}).then(r => r.json()).then(console.log);
```

---

## ✅ **Summary:**

| Action | Endpoint | Store |
|--------|----------|-------|
| Broadcast to Zyra | `POST /broadcast-store/zyrajewel` | Zyra only |
| Broadcast to Dupatta | `POST /broadcast-store/dupattabazaar1` | Dupatta only |
| Broadcast to All | `POST /broadcast` | All stores |
| Zyra Stats | `GET /stats/zyrajewel` | Zyra only |
| Dupatta Stats | `GET /stats/dupattabazaar1` | Dupatta only |
| All Stores | `GET /stores` | List all |

---

**Store IDs:**
- Zyra Jewel: `zyrajewel`
- Dupatta Bazaar: `dupattabazaar1`

These are automatically extracted from Shopify domain!
