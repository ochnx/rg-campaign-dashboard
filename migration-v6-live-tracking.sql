-- migration-v6-live-tracking.sql
-- Add Meta campaign ID to campaigns table for live tracking
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS meta_campaign_id text UNIQUE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_live boolean DEFAULT false;

-- Add Meta ad ID to creatives table
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS meta_ad_id text UNIQUE;

-- Index for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_campaigns_meta_id ON campaigns(meta_campaign_id) WHERE meta_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_live ON campaigns(is_live) WHERE is_live = true;
CREATE INDEX IF NOT EXISTS idx_creatives_meta_id ON creatives(meta_ad_id) WHERE meta_ad_id IS NOT NULL;
