-- Migration V9: Multi Ad Account Support
-- Adds ad_account_id column to campaigns table for multi-business-manager support

-- Add ad_account_id column (nullable, existing campaigns default to R&G account)
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS ad_account_id TEXT DEFAULT 'act_850524294087986';

-- Add ad_account_name for display purposes
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS ad_account_name TEXT DEFAULT 'R&G';

-- Update comment
COMMENT ON COLUMN campaigns.ad_account_id IS 'Meta Ad Account ID (format: act_XXXXXXXXXX)';
COMMENT ON COLUMN campaigns.ad_account_name IS 'Display name for the ad account (e.g., R&G, E&V)';

-- Known Ad Accounts:
-- act_850524294087986 = Immobilien_main (R&G)
-- act_763575219714223 = Immobilien_E&V
