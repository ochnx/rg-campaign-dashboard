-- Migration v9: Expose Jobs
-- Run this in Supabase SQL Editor BEFORE using the Exposés feature

-- Expose Jobs table
CREATE TABLE IF NOT EXISTS expose_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client TEXT NOT NULL CHECK (client IN ('engel-voelkers', 'von-poll')),
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'done', 'error')),
  
  -- Parsed data (filled after parsing)
  property_title TEXT,
  property_address TEXT,
  property_city TEXT,
  property_plz TEXT,
  property_price NUMERIC,
  property_size_sqm NUMERIC,
  property_rooms INTEGER,
  property_type TEXT,
  
  -- Output
  ad_copy_md TEXT,
  video_concept_md TEXT,
  drive_folder_url TEXT,
  
  -- Storage
  pdf_storage_path TEXT,
  
  -- Meta
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE expose_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access for service role" ON expose_jobs FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for expose PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('exposes', 'exposes', false) ON CONFLICT DO NOTHING;
CREATE POLICY "Service role full access" ON storage.objects FOR ALL USING (bucket_id = 'exposes') WITH CHECK (bucket_id = 'exposes');
