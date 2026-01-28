-- Migration v8: Add thumbnail_url to creatives table
-- Run in Supabase SQL Editor

ALTER TABLE creatives ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS meta_creative_id TEXT;
