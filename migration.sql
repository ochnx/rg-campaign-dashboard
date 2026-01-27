-- Campaign Dashboard Schema Migration
-- Run & Gun Agency

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  brand text,
  created_at timestamptz DEFAULT now()
);

-- Properties
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  plz text,
  stadtteil text,
  city text,
  property_type text CHECK (property_type IN ('wohnung', 'haus', 'penthouse', 'villa', 'reihenhaus', 'grundstueck', 'gewerbe', 'sonstige')),
  size_sqm numeric,
  rooms numeric,
  price numeric,
  price_per_sqm numeric GENERATED ALWAYS AS (price / NULLIF(size_sqm, 0)) STORED,
  created_at timestamptz DEFAULT now()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  platform text NOT NULL,
  campaign_name text NOT NULL,
  campaign_type text,
  start_date date,
  end_date date,
  total_budget numeric,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at timestamptz DEFAULT now()
);

-- Campaign Daily Metrics
CREATE TABLE IF NOT EXISTS campaign_daily_metrics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  date date NOT NULL,
  spend numeric DEFAULT 0,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  clicks integer,
  leads integer DEFAULT 0,
  cpl numeric GENERATED ALWAYS AS (spend / NULLIF(leads, 0)) STORED,
  cpm numeric GENERATED ALWAYS AS ((spend / NULLIF(impressions, 0)) * 1000) STORED,
  ctr numeric GENERATED ALWAYS AS ((clicks::numeric / NULLIF(impressions, 0)) * 100) STORED,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, date)
);

-- Creatives
CREATE TABLE IF NOT EXISTS creatives (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  creative_name text NOT NULL,
  creative_type text CHECK (creative_type IN ('single_image', 'carousel', 'reel', 'video', 'story')),
  created_at timestamptz DEFAULT now()
);

-- Creative Daily Metrics
CREATE TABLE IF NOT EXISTS creative_daily_metrics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  creative_id uuid REFERENCES creatives(id) ON DELETE CASCADE,
  date date NOT NULL,
  spend numeric DEFAULT 0,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  clicks integer,
  leads integer DEFAULT 0,
  cpl numeric GENERATED ALWAYS AS (spend / NULLIF(leads, 0)) STORED,
  cpm numeric GENERATED ALWAYS AS ((spend / NULLIF(impressions, 0)) * 1000) STORED,
  created_at timestamptz DEFAULT now(),
  UNIQUE(creative_id, date)
);

-- Disable RLS for now (internal tool)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_daily_metrics ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for anon access (internal tool)
CREATE POLICY "Allow all for clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for properties" ON properties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for campaigns" ON campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for campaign_daily_metrics" ON campaign_daily_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for creatives" ON creatives FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for creative_daily_metrics" ON creative_daily_metrics FOR ALL USING (true) WITH CHECK (true);
