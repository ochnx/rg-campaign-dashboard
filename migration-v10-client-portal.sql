-- Migration v10: Client Portal
-- Adds access_token and related columns to clients table for client-facing dashboard

-- Add access_token to existing clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#e7352e';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Create RPC function for token lookup
CREATE OR REPLACE FUNCTION get_client_by_token(p_token TEXT)
RETURNS TABLE (id UUID, name TEXT, brand TEXT, logo_url TEXT, primary_color TEXT)
AS $$
  SELECT id, name, brand, logo_url, primary_color
  FROM clients
  WHERE access_token = p_token AND active = true;
$$ LANGUAGE sql SECURITY DEFINER;

-- Set initial token for E&V (for testing)
UPDATE clients SET access_token = 'ev-hq-2026' WHERE id = 'c7c0d649-3e50-4994-ac7f-53df5a555d70';
