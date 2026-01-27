-- Migration V5: Competitor Watch (Ad Library Integration)
-- Run against Supabase SQL Editor

-- Watchlist: brands/pages to monitor
CREATE TABLE IF NOT EXISTS competitor_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_name text NOT NULL,
  page_id text, -- Facebook Page ID (optional, auto-detected)
  brand text, -- e.g. "Engel & Völkers", "Von Poll"
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Scraped ads from Ad Library
CREATE TABLE IF NOT EXISTS competitor_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid REFERENCES competitor_watchlist(id) ON DELETE CASCADE,
  ad_library_id text UNIQUE, -- Meta Ad Library ID
  page_name text,
  page_id text,
  ad_creative_bodies text[], -- array of ad texts
  ad_creative_link_titles text[],
  ad_creative_link_descriptions text[],
  ad_snapshot_url text,
  publisher_platforms text[], -- FACEBOOK, INSTAGRAM, etc.
  ad_delivery_start_time timestamptz,
  ad_delivery_stop_time timestamptz,
  ad_type text, -- HOUSING_ADS, ALL, etc.
  is_active boolean DEFAULT true,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  days_running integer GENERATED ALWAYS AS (
    GREATEST(1, EXTRACT(DAY FROM (COALESCE(ad_delivery_stop_time, now()) - ad_delivery_start_time))::integer)
  ) STORED,
  created_at timestamptz DEFAULT now()
);

-- Alerts for new/removed ads
CREATE TABLE IF NOT EXISTS competitor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid REFERENCES competitor_ads(id) ON DELETE CASCADE,
  watchlist_id uuid REFERENCES competitor_watchlist(id) ON DELETE CASCADE,
  alert_type text NOT NULL, -- 'new_ad', 'removed_ad', 'long_running'
  message text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS but with permissive policies (internal tool)
ALTER TABLE competitor_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON competitor_watchlist FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON competitor_ads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON competitor_alerts FOR ALL USING (true) WITH CHECK (true);
