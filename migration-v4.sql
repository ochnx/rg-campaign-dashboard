-- Migration v4: Add Neubauprojekt & Zweifamilienhaus support
-- Run this in Supabase SQL Editor

-- Expand property_type constraint
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_property_type_check;
ALTER TABLE properties ADD CONSTRAINT properties_property_type_check 
  CHECK (property_type IN ('wohnung', 'haus', 'penthouse', 'villa', 'reihenhaus', 'grundstueck', 'gewerbe', 'sonstige', 'neubauprojekt', 'zweifamilienhaus'));

-- Neubauprojekt-specific fields
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_from numeric;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_to numeric;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS size_from numeric;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS size_to numeric;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS num_units integer;

-- Constraints
DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_price_from_check CHECK (price_from IS NULL OR price_from > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_price_to_check CHECK (price_to IS NULL OR price_to > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_size_from_check CHECK (size_from IS NULL OR size_from > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_size_to_check CHECK (size_to IS NULL OR size_to > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_num_units_check CHECK (num_units IS NULL OR num_units > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
