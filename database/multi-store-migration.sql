-- Multi-Store Support - Database Migration

-- Add store_id column to track which store the subscription came from
ALTER TABLE subscriptions 
ADD COLUMN store_id TEXT,
ADD COLUMN store_name TEXT,
ADD COLUMN store_domain TEXT;

-- Add index for faster queries
CREATE INDEX idx_store_id ON subscriptions(store_id);
CREATE INDEX idx_store_domain ON subscriptions(store_domain);

-- Example data after update:
/*
id | endpoint      | store_id | store_name      | store_domain
---+---------------+----------+-----------------+---------------------------
1  | fcm.../abc123 | zyra     | Zyra Jewel      | zyrajewel.myshopify.com
2  | fcm.../xyz789 | dupatta  | Dupatta Bazaar  | dupattabazaar1.myshopify.com
3  | fcm.../def456 | zyra     | Zyra Jewel      | zyrajewel.myshopify.com
*/
