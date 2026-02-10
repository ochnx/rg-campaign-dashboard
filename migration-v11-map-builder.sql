-- Migration v11: Property Map Builder
-- Creates tables for saving/loading property maps with POIs

CREATE TABLE IF NOT EXISTS property_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  property_address TEXT NOT NULL,
  property_lat NUMERIC,
  property_lng NUMERIC,
  zoom_level INTEGER DEFAULT 15,
  map_style TEXT DEFAULT 'clean',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS map_pois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID REFERENCES property_maps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  category TEXT, -- supermarket, doctor, school, pool, park, transport, restaurant, other
  lat NUMERIC,
  lng NUMERIC,
  pin_color TEXT DEFAULT '#e7352e',
  pin_size TEXT DEFAULT 'medium', -- small, medium, large
  distance_meters INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE property_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_pois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for property_maps" ON property_maps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for map_pois" ON map_pois FOR ALL USING (true) WITH CHECK (true);
