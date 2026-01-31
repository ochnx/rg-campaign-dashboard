#!/usr/bin/env node
// Backfill: Fetch spend/impressions/reach for existing competitor_ads
// Rate limit: ~200 calls/hour → 1 call per 18s to be safe
// Usage: node backfill-adspend.js [--dry-run] [--batch-size=50]

const fs = require('fs');
const path = require('path');

const SB_URL = 'https://lvhxabadywdqeepymwdm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aHhhYmFkeXdkcWVlcHltd2RtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUyMjM3NSwiZXhwIjoyMDg1MDk4Mzc1fQ.3BWQG5yeG8nshvukSi3YksxUbg273tJDiZnU9fAlzY0';

let META_TOKEN;
try {
  const tokenPath = path.join(require('os').homedir(), '.config/meta/long_lived_token.json');
  META_TOKEN = JSON.parse(fs.readFileSync(tokenPath, 'utf8')).access_token;
} catch (e) {
  console.error('[FATAL] Cannot read Meta token:', e.message);
  process.exit(1);
}

const SB_HEADERS = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = parseInt((process.argv.find(a => a.startsWith('--batch-size=')) || '').split('=')[1]) || 50;
const DELAY_MS = 18000; // 18s between API calls (safe for 200/hr limit)

async function getAdsWithoutSpend(offset = 0, limit = BATCH_SIZE) {
  const url = `${SB_URL}/rest/v1/competitor_ads?select=id,ad_library_id,page_name&spend_lower=is.null&order=created_at.asc&offset=${offset}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Prefer': 'count=exact' }
  });
  const total = res.headers.get('content-range');
  const data = await res.json();
  return { data, total };
}

async function fetchAdSpendFromMeta(adLibraryId, pageName) {
  // Search by page name + match ad library id
  const url = new URL('https://graph.facebook.com/v24.0/ads_archive');
  url.searchParams.set('access_token', META_TOKEN);
  url.searchParams.set('ad_reached_countries', '["DE"]');
  url.searchParams.set('ad_active_status', 'ALL');
  url.searchParams.set('ad_type', 'HOUSING_ADS');
  url.searchParams.set('fields', 'id,spend,impressions,eu_total_reach');
  url.searchParams.set('search_page_ids', adLibraryId.split('_')[0] || ''); // page_id is sometimes embedded
  url.searchParams.set('limit', '25');

  // Alternative: search by the ad archive ID directly if possible
  // The Ad Library API doesn't support direct ID lookup easily,
  // so we'll try to match from a page search
  
  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.error && /token|expired/i.test(err.error.message || '')) {
        console.error('[FATAL] Meta token expired:', err.error.message);
        process.exit(1);
      }
      return null;
    }
    const data = await res.json();
    // Try to find our specific ad
    const match = (data.data || []).find(ad => ad.id === adLibraryId);
    if (match) return match;
    return null;
  } catch (e) {
    console.error(`[ERROR] API call failed for ${adLibraryId}:`, e.message);
    return null;
  }
}

function parseSpendData(metaAd) {
  if (!metaAd) return null;
  return {
    spend_lower: metaAd.spend ? parseInt(parseFloat(metaAd.spend.lower_bound || '0') * 100) : null,
    spend_upper: metaAd.spend ? parseInt(parseFloat(metaAd.spend.upper_bound || '0') * 100) : null,
    impressions_lower: metaAd.impressions ? parseInt(metaAd.impressions.lower_bound || '0') : null,
    impressions_upper: metaAd.impressions ? parseInt(metaAd.impressions.upper_bound || '0') : null,
    eu_total_reach: metaAd.eu_total_reach ? parseInt(metaAd.eu_total_reach) : null,
  };
}

async function updateAd(id, spendData) {
  if (DRY_RUN) {
    console.log(`[DRY-RUN] Would update ${id}:`, JSON.stringify(spendData));
    return;
  }
  const res = await fetch(`${SB_URL}/rest/v1/competitor_ads?id=eq.${id}`, {
    method: 'PATCH',
    headers: SB_HEADERS,
    body: JSON.stringify(spendData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`[ERROR] DB update failed for ${id}:`, err.message || res.status);
  }
}

async function main() {
  console.log(`[START] Backfill AdSpend data (dry-run: ${DRY_RUN}, batch: ${BATCH_SIZE})`);
  
  const { data: firstBatch, total } = await getAdsWithoutSpend(0, 1);
  console.log(`[INFO] Ads without spend data: ${total}`);
  
  let offset = 0;
  let processed = 0;
  let updated = 0;
  let failed = 0;

  while (true) {
    const { data: ads } = await getAdsWithoutSpend(offset, BATCH_SIZE);
    if (!ads || ads.length === 0) break;

    for (const ad of ads) {
      processed++;
      console.log(`[${processed}] Processing ${ad.ad_library_id} (${ad.page_name})...`);
      
      const metaAd = await fetchAdSpendFromMeta(ad.ad_library_id, ad.page_name);
      const spendData = parseSpendData(metaAd);
      
      if (spendData && (spendData.spend_lower !== null || spendData.eu_total_reach !== null)) {
        await updateAd(ad.id, spendData);
        updated++;
        console.log(`  ✅ Spend: €${(spendData.spend_lower/100).toFixed(0)}-${(spendData.spend_upper/100).toFixed(0)}, Reach: ${spendData.eu_total_reach || 'n/a'}`);
      } else {
        failed++;
        console.log(`  ⚠️ No spend data found`);
      }

      // Rate limiting
      if (processed % 10 === 0) {
        console.log(`[PROGRESS] ${processed} processed, ${updated} updated, ${failed} no data`);
      }
      await sleep(DELAY_MS);
    }

    offset += BATCH_SIZE;
  }

  console.log(`[DONE] Processed: ${processed}, Updated: ${updated}, No data: ${failed}`);
}

main().catch(e => {
  console.error('[FATAL]', e);
  process.exit(1);
});
