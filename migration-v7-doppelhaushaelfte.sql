-- Migration v7: Add "doppelhaushaelfte" to property_type constraint
-- Run in Supabase SQL Editor

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_property_type_check;
ALTER TABLE properties ADD CONSTRAINT properties_property_type_check 
  CHECK (property_type IN ('wohnung', 'haus', 'penthouse', 'villa', 'reihenhaus', 'grundstueck', 'gewerbe', 'neubauprojekt', 'zweifamilienhaus', 'doppelhaushaelfte', 'sonstige'));
