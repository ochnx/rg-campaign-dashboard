-- Seed Data: Von Järten & Cie - Falkensteiner Ufer Campaign
-- Source: /home/clawd/clawd/reports/von-jaerten-falkensteiner-ufer-jan2026.md

-- 1. Client
INSERT INTO clients (id, name, brand)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Von Järten & Cie', 'Von Poll')
ON CONFLICT DO NOTHING;

-- 2. Property
INSERT INTO properties (id, client_id, name, address, plz, stadtteil, city, property_type, size_sqm, rooms, price)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Falkensteiner Ufer',
  'Falkensteiner Ufer, 22587 Hamburg',
  '22587',
  'Blankenese',
  'Hamburg',
  'wohnung',
  NULL,
  NULL,
  NULL
)
ON CONFLICT DO NOTHING;

-- 3. Campaign
INSERT INTO campaigns (id, property_id, platform, campaign_name, campaign_type, start_date, end_date, total_budget, status)
VALUES (
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'meta',
  'VON JÄRTEN & CIE // Falkensteiner Ufer // Voroptimierte Leads',
  'lead_gen',
  '2025-12-29',
  '2026-01-26',
  992.86,
  'completed'
)
ON CONFLICT DO NOTHING;

-- 4. Creatives
INSERT INTO creatives (id, campaign_id, creative_name, creative_type) VALUES
  ('d4e5f6a7-b8c9-0123-def0-234567890123', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'Single Image 1', 'single_image'),
  ('e5f6a7b8-c9d0-1234-ef01-345678901234', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'Single Image 2', 'single_image'),
  ('f6a7b8c9-d0e1-2345-f012-456789012345', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'Single Image 3', 'single_image'),
  ('a7b8c9d0-e1f2-3456-0123-567890123456', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'Single Image 4', 'single_image'),
  ('b8c9d0e1-f2a3-4567-1234-678901234567', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'SCN-Reel', 'reel'),
  ('c9d0e1f2-a3b4-5678-2345-789012345678', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'Carousel 1', 'carousel'),
  ('d0e1f2a3-b4c5-6789-3456-890123456789', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'Carousel 2', 'carousel')
ON CONFLICT DO NOTHING;

-- 5. Campaign Daily Metrics (29 days)
INSERT INTO campaign_daily_metrics (campaign_id, date, spend, impressions, reach, clicks, leads) VALUES
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2025-12-29', 38.02, 3728, 3415, NULL, 8),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2025-12-30', 32.75, 3310, 3033, NULL, 5),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2025-12-31', 30.47, 3122, 2862, NULL, 6),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-01', 37.12, 5254, 4815, NULL, 6),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-02', 36.95, 4894, 4487, NULL, 12),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-03', 32.57, 3755, 3442, NULL, 3),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-04', 38.03, 4120, 3776, NULL, 6),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-05', 34.67, 3423, 3137, NULL, 4),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-06', 0.32, 21, 19, NULL, 0),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-07', 47.72, 4786, 4387, NULL, 6),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-08', 45.80, 4952, 4539, NULL, 4),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-09', 39.51, 4767, 4369, NULL, 7),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-10', 38.45, 5007, 4590, NULL, 3),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-11', 37.52, 4988, 4572, NULL, 3),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-12', 37.67, 4296, 3937, NULL, 4),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-13', 34.49, 3688, 3380, NULL, 4),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-14', 35.50, 3331, 3053, NULL, 6),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-15', 33.92, 2780, 2548, NULL, 4),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-16', 32.64, 2873, 2633, NULL, 6),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-17', 32.74, 2913, 2670, NULL, 4),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-18', 40.39, 4298, 3939, NULL, 6),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-19', 34.96, 3280, 3006, NULL, 4),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-20', 34.64, 3531, 3236, NULL, 3),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-21', 33.77, 2979, 2730, NULL, 1),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-22', 35.16, 2774, 2542, NULL, 3),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-23', 32.96, 2752, 2522, NULL, 3),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-24', 32.91, 2747, 2518, NULL, 2),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-25', 39.37, 3622, 3320, NULL, 3),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', '2026-01-26', 11.84, 926, 849, NULL, 1)
ON CONFLICT (campaign_id, date) DO NOTHING;

-- 6. Creative aggregate metrics (total campaign period)
-- Single Image 1: 80 leads, 637.13€ spend, 64360 impressions, 59278 reach
-- Single Image 2: 42 leads, 313.27€ spend, 34817 impressions, 31554 reach
-- Single Image 4: 5 leads, 29.51€ spend, 2509 impressions, 2328 reach
-- SCN-Reel: 0 leads, 8.16€ spend, 775 impressions, 717 reach
-- Carousel 2: 0 leads, 2.94€ spend, 238 impressions, 215 reach
-- Single Image 3: 0 leads, 0.96€ spend, 123 impressions, 109 reach
-- Carousel 1: 0 leads, 0.89€ spend, 95 impressions, 90 reach

-- Since we only have aggregate creative data from the report, we insert as single-day summary
-- on the campaign end date for each creative
INSERT INTO creative_daily_metrics (creative_id, date, spend, impressions, reach, clicks, leads) VALUES
  ('d4e5f6a7-b8c9-0123-def0-234567890123', '2026-01-26', 637.13, 64360, 59278, NULL, 80),
  ('e5f6a7b8-c9d0-1234-ef01-345678901234', '2026-01-26', 313.27, 34817, 31554, NULL, 42),
  ('f6a7b8c9-d0e1-2345-f012-456789012345', '2026-01-26', 0.96, 123, 109, NULL, 0),
  ('a7b8c9d0-e1f2-3456-0123-567890123456', '2026-01-26', 29.51, 2509, 2328, NULL, 5),
  ('b8c9d0e1-f2a3-4567-1234-678901234567', '2026-01-26', 8.16, 775, 717, NULL, 0),
  ('c9d0e1f2-a3b4-5678-2345-789012345678', '2026-01-26', 0.89, 95, 90, NULL, 0),
  ('d0e1f2a3-b4c5-6789-3456-890123456789', '2026-01-26', 2.94, 238, 215, NULL, 0)
ON CONFLICT (creative_id, date) DO NOTHING;
