-- Migration to add store columns to existing subscriptions table
-- Run this on Neon database console

-- Add store columns if they don't exist
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS store_id TEXT,
ADD COLUMN IF NOT EXISTS store_name TEXT,
ADD COLUMN IF NOT EXISTS store_domain TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_store_id ON subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_store_domain ON subscriptions(store_domain);

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'subscriptions'
ORDER BY ordinal_position;
