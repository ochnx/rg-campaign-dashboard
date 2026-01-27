-- Migration v2: Add location fields to properties
-- Run this in Supabase SQL Editor after migration.sql

-- Add location fields to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_rating text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS micro_location text;

-- Add check constraints
DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_location_rating_check 
    CHECK (location_rating IS NULL OR location_rating IN ('A', 'B', 'C', 'D'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_micro_location_check 
    CHECK (micro_location IS NULL OR micro_location IN ('premium', 'gut', 'standard', 'randlage'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
