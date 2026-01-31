-- Migration V6: AdSpend Tracking fields for competitor_ads
-- Adds spend, impressions, reach columns + computed estimated_spend and estimated_cpm

ALTER TABLE competitor_ads ADD COLUMN IF NOT EXISTS spend_lower integer;  -- in Euro cents
ALTER TABLE competitor_ads ADD COLUMN IF NOT EXISTS spend_upper integer;
ALTER TABLE competitor_ads ADD COLUMN IF NOT EXISTS impressions_lower integer;
ALTER TABLE competitor_ads ADD COLUMN IF NOT EXISTS impressions_upper integer;
ALTER TABLE competitor_ads ADD COLUMN IF NOT EXISTS eu_total_reach integer;

-- Computed: average spend (cents)
ALTER TABLE competitor_ads ADD COLUMN IF NOT EXISTS estimated_spend integer GENERATED ALWAYS AS (
  COALESCE((spend_lower + spend_upper) / 2, 0)
) STORED;

-- Computed: CPM in cents
ALTER TABLE competitor_ads ADD COLUMN IF NOT EXISTS estimated_cpm numeric GENERATED ALWAYS AS (
  CASE WHEN COALESCE((impressions_lower + impressions_upper) / 2, 0) > 0
    THEN ROUND(COALESCE((spend_lower + spend_upper) / 2, 0)::numeric / (COALESCE((impressions_lower + impressions_upper) / 2, 0)::numeric / 1000), 2)
    ELSE NULL
  END
) STORED;
