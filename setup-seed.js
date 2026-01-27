#!/usr/bin/env node
/**
 * Seed script for Campaign Dashboard
 * Run AFTER executing migration.sql in the Supabase SQL Editor
 * 
 * Usage: node setup-seed.js
 */

const SUPABASE_URL = 'https://lvhxabadywdqeepymwdm.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aHhhYmFkeXdkcWVlcHltd2RtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUyMjM3NSwiZXhwIjoyMDg1MDk4Mzc1fQ.3BWQG5yeG8nshvukSi3YksxUbg273tJDiZnU9fAlzY0';

const headers = {
  'Content-Type': 'application/json',
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Prefer': 'return=representation'
};

async function api(path, method = 'GET', body = null) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  const data = await res.json();
  if (!res.ok) {
    console.error(`API Error (${path}):`, data);
    throw new Error(data.message || JSON.stringify(data));
  }
  return data;
}

async function seed() {
  console.log('🚀 Seeding Campaign Dashboard...\n');

  // 1. Client
  console.log('1️⃣  Creating client: Von Järten & Cie...');
  const [client] = await api('clients', 'POST', {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'Von Järten & Cie',
    brand: 'Von Poll'
  });
  console.log(`   ✅ Client: ${client.name} (${client.id})`);

  // 2. Property
  console.log('2️⃣  Creating property: Falkensteiner Ufer...');
  const [property] = await api('properties', 'POST', {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    client_id: client.id,
    name: 'Falkensteiner Ufer',
    address: 'Falkensteiner Ufer, 22587 Hamburg',
    plz: '22587',
    stadtteil: 'Blankenese',
    city: 'Hamburg',
    property_type: 'wohnung'
  });
  console.log(`   ✅ Property: ${property.name} (${property.id})`);

  // 3. Campaign
  console.log('3️⃣  Creating campaign...');
  const [campaign] = await api('campaigns', 'POST', {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    property_id: property.id,
    platform: 'meta',
    campaign_name: 'VON JÄRTEN & CIE // Falkensteiner Ufer // Voroptimierte Leads',
    campaign_type: 'lead_gen',
    start_date: '2025-12-29',
    end_date: '2026-01-26',
    total_budget: 992.86,
    status: 'completed'
  });
  console.log(`   ✅ Campaign: ${campaign.campaign_name}`);

  // 4. Creatives
  console.log('4️⃣  Creating creatives...');
  const creativesData = [
    { id: 'd4e5f6a7-b8c9-0123-def0-234567890123', campaign_id: campaign.id, creative_name: 'Single Image 1', creative_type: 'single_image' },
    { id: 'e5f6a7b8-c9d0-1234-ef01-345678901234', campaign_id: campaign.id, creative_name: 'Single Image 2', creative_type: 'single_image' },
    { id: 'f6a7b8c9-d0e1-2345-f012-456789012345', campaign_id: campaign.id, creative_name: 'Single Image 3', creative_type: 'single_image' },
    { id: 'a7b8c9d0-e1f2-3456-0123-567890123456', campaign_id: campaign.id, creative_name: 'Single Image 4', creative_type: 'single_image' },
    { id: 'b8c9d0e1-f2a3-4567-1234-678901234567', campaign_id: campaign.id, creative_name: 'SCN-Reel', creative_type: 'reel' },
    { id: 'c9d0e1f2-a3b4-5678-2345-789012345678', campaign_id: campaign.id, creative_name: 'Carousel 1', creative_type: 'carousel' },
    { id: 'd0e1f2a3-b4c5-6789-3456-890123456789', campaign_id: campaign.id, creative_name: 'Carousel 2', creative_type: 'carousel' }
  ];
  const creatives = await api('creatives', 'POST', creativesData);
  console.log(`   ✅ ${creatives.length} creatives created`);

  // 5. Campaign Daily Metrics
  console.log('5️⃣  Inserting daily metrics (29 days)...');
  const dailyMetrics = [
    { date: '2025-12-29', spend: 38.02, impressions: 3728, reach: 3415, leads: 8 },
    { date: '2025-12-30', spend: 32.75, impressions: 3310, reach: 3033, leads: 5 },
    { date: '2025-12-31', spend: 30.47, impressions: 3122, reach: 2862, leads: 6 },
    { date: '2026-01-01', spend: 37.12, impressions: 5254, reach: 4815, leads: 6 },
    { date: '2026-01-02', spend: 36.95, impressions: 4894, reach: 4487, leads: 12 },
    { date: '2026-01-03', spend: 32.57, impressions: 3755, reach: 3442, leads: 3 },
    { date: '2026-01-04', spend: 38.03, impressions: 4120, reach: 3776, leads: 6 },
    { date: '2026-01-05', spend: 34.67, impressions: 3423, reach: 3137, leads: 4 },
    { date: '2026-01-06', spend: 0.32, impressions: 21, reach: 19, leads: 0 },
    { date: '2026-01-07', spend: 47.72, impressions: 4786, reach: 4387, leads: 6 },
    { date: '2026-01-08', spend: 45.80, impressions: 4952, reach: 4539, leads: 4 },
    { date: '2026-01-09', spend: 39.51, impressions: 4767, reach: 4369, leads: 7 },
    { date: '2026-01-10', spend: 38.45, impressions: 5007, reach: 4590, leads: 3 },
    { date: '2026-01-11', spend: 37.52, impressions: 4988, reach: 4572, leads: 3 },
    { date: '2026-01-12', spend: 37.67, impressions: 4296, reach: 3937, leads: 4 },
    { date: '2026-01-13', spend: 34.49, impressions: 3688, reach: 3380, leads: 4 },
    { date: '2026-01-14', spend: 35.50, impressions: 3331, reach: 3053, leads: 6 },
    { date: '2026-01-15', spend: 33.92, impressions: 2780, reach: 2548, leads: 4 },
    { date: '2026-01-16', spend: 32.64, impressions: 2873, reach: 2633, leads: 6 },
    { date: '2026-01-17', spend: 32.74, impressions: 2913, reach: 2670, leads: 4 },
    { date: '2026-01-18', spend: 40.39, impressions: 4298, reach: 3939, leads: 6 },
    { date: '2026-01-19', spend: 34.96, impressions: 3280, reach: 3006, leads: 4 },
    { date: '2026-01-20', spend: 34.64, impressions: 3531, reach: 3236, leads: 3 },
    { date: '2026-01-21', spend: 33.77, impressions: 2979, reach: 2730, leads: 1 },
    { date: '2026-01-22', spend: 35.16, impressions: 2774, reach: 2542, leads: 3 },
    { date: '2026-01-23', spend: 32.96, impressions: 2752, reach: 2522, leads: 3 },
    { date: '2026-01-24', spend: 32.91, impressions: 2747, reach: 2518, leads: 2 },
    { date: '2026-01-25', spend: 39.37, impressions: 3622, reach: 3320, leads: 3 },
    { date: '2026-01-26', spend: 11.84, impressions: 926, reach: 849, leads: 1 }
  ].map(m => ({ ...m, campaign_id: campaign.id }));

  const metricsResult = await api('campaign_daily_metrics', 'POST', dailyMetrics);
  console.log(`   ✅ ${metricsResult.length} daily metrics inserted`);

  // 6. Creative Daily Metrics (aggregate totals as single-day summary)
  console.log('6️⃣  Inserting creative metrics...');
  const creativeMetrics = [
    { creative_id: 'd4e5f6a7-b8c9-0123-def0-234567890123', date: '2026-01-26', spend: 637.13, impressions: 64360, reach: 59278, leads: 80 },
    { creative_id: 'e5f6a7b8-c9d0-1234-ef01-345678901234', date: '2026-01-26', spend: 313.27, impressions: 34817, reach: 31554, leads: 42 },
    { creative_id: 'f6a7b8c9-d0e1-2345-f012-456789012345', date: '2026-01-26', spend: 0.96, impressions: 123, reach: 109, leads: 0 },
    { creative_id: 'a7b8c9d0-e1f2-3456-0123-567890123456', date: '2026-01-26', spend: 29.51, impressions: 2509, reach: 2328, leads: 5 },
    { creative_id: 'b8c9d0e1-f2a3-4567-1234-678901234567', date: '2026-01-26', spend: 8.16, impressions: 775, reach: 717, leads: 0 },
    { creative_id: 'c9d0e1f2-a3b4-5678-2345-789012345678', date: '2026-01-26', spend: 0.89, impressions: 95, reach: 90, leads: 0 },
    { creative_id: 'd0e1f2a3-b4c5-6789-3456-890123456789', date: '2026-01-26', spend: 2.94, impressions: 238, reach: 215, leads: 0 }
  ];

  const creativeResult = await api('creative_daily_metrics', 'POST', creativeMetrics);
  console.log(`   ✅ ${creativeResult.length} creative metrics inserted`);

  console.log('\n🎉 Seed complete! Open index.html to see the dashboard.');
}

seed().catch(err => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
