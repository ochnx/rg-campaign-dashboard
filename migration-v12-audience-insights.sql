-- Migration v12: Audience Insights (Geo + Demographics)
-- Run in Supabase SQL Editor

-- ============================================
-- TABLE: campaign_geo_insights
-- Stores regional breakdown per campaign per sync
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_geo_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sync_date DATE NOT NULL DEFAULT CURRENT_DATE,
  region TEXT NOT NULL,          -- e.g. "Hamburg", "Berlin", "Bayern"
  country TEXT NOT NULL DEFAULT 'DE',
  impressions INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER,
  leads INTEGER NOT NULL DEFAULT 0,
  spend NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (campaign_id, sync_date, region, country)
);

-- ============================================
-- TABLE: campaign_demo_insights
-- Stores age + gender breakdown per campaign per sync
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_demo_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sync_date DATE NOT NULL DEFAULT CURRENT_DATE,
  age TEXT NOT NULL,             -- e.g. "25-34", "35-44", "45-54"
  gender TEXT NOT NULL,          -- "male", "female", "unknown"
  impressions INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER,
  leads INTEGER NOT NULL DEFAULT 0,
  spend NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (campaign_id, sync_date, age, gender)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_geo_insights_campaign ON campaign_geo_insights(campaign_id);
CREATE INDEX IF NOT EXISTS idx_geo_insights_sync_date ON campaign_geo_insights(sync_date DESC);
CREATE INDEX IF NOT EXISTS idx_demo_insights_campaign ON campaign_demo_insights(campaign_id);
CREATE INDEX IF NOT EXISTS idx_demo_insights_sync_date ON campaign_demo_insights(sync_date DESC);

-- ============================================
-- GRANT (if using anon/authenticated roles)
-- ============================================
GRANT SELECT ON campaign_geo_insights TO anon, authenticated;
GRANT SELECT ON campaign_demo_insights TO anon, authenticated;

-- Done. Verify:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%insights%';
