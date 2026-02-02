-- Migration v9: Editorial Planner
-- Run against Supabase SQL Editor

-- Clients table (for future multi-client support)
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Ferrari Hamburg as first client
INSERT INTO clients (name, short_name, logo_url) 
VALUES ('Ferrari Hamburg', 'Ferrari HH', NULL)
ON CONFLICT DO NOTHING;

-- Editorial entries table
CREATE TABLE IF NOT EXISTS editorial_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  publish_date DATE NOT NULL,
  publish_time TIME DEFAULT '01:00',
  title TEXT NOT NULL,
  vehicle TEXT,
  content_series TEXT,
  custom_series TEXT,
  location TEXT,
  reference_link TEXT,
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outlook notes for next month
CREATE TABLE IF NOT EXISTS editorial_outlook (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, year, month)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_editorial_entries_client_month 
  ON editorial_entries(client_id, year, month);
CREATE INDEX IF NOT EXISTS idx_editorial_outlook_client_month 
  ON editorial_outlook(client_id, year, month);
