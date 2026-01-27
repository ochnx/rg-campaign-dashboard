-- Migration v3: Expand creative_type constraint
-- Run this in Supabase SQL Editor

-- Drop old constraint and add expanded one
ALTER TABLE creatives DROP CONSTRAINT IF EXISTS creatives_creative_type_check;
ALTER TABLE creatives ADD CONSTRAINT creatives_creative_type_check 
  CHECK (creative_type IN ('single_image', 'carousel', 'reel', 'video', 'story', 'scn_reel', 'th_reel'));
