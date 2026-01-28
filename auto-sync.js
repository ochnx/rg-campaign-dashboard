#!/usr/bin/env node
// Auto-Sync: Competitor Ad Library → Supabase
// Standalone Node.js script (no external dependencies)
// Run daily via cron: 0 8 * * * node /home/clawd/clawd/dashboard/auto-sync.js >> /var/log/ad-sync.log 2>&1

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const SB_URL = 'https://lvhxabadywdqeepymwdm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aHhhYmFkeXdkcWVlcHltd2RtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUyMjM3NSwiZXhwIjoyMDg1MDk4Mzc1fQ.3BWQG5yeG8nshvukSi3YksxUbg273tJDiZnU9fAlzY0';

let META_TOKEN;
try {
  const tokenPath = path.join(require('os').homedir(), '.config/meta/long_lived_token.json');
  META_TOKEN = JSON.parse(fs.readFileSync(tokenPath, 'utf8')).access_token;
} catch (e) {
  console.error('[FATAL] Cannot read Meta token from ~/.config/meta/long_lived_token.json:', e.message);
  process.exit(1);
}

const SB_HEADERS = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// ============================================
// SUPABASE REST HELPERS
// ============================================
async function sbGet(table, query = '') {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function sbInsert(table, data) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: SB_HEADERS,
    body: JSON.stringify(Array.isArray(data) ? data : [data])
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function sbUpdate(table, query, data) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: SB_HEADERS,
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function sbPatch(table, id, data) {
  return sbUpdate(table, `id=eq.${id}`, data);
}

async function sbUpsert(table, data, onConflict) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      ...SB_HEADERS,
      'Prefer': 'return=representation,resolution=merge-duplicates'
    },
    body: JSON.stringify(Array.isArray(data) ? data : [data])
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ============================================
// META AD LIBRARY API
// ============================================
const AD_FIELDS = 'id,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_descriptions,ad_snapshot_url,page_name,page_id,ad_delivery_start_time,ad_delivery_stop_time,publisher_platforms';

async function fetchAdLibraryPage(params) {
  const url = new URL('https://graph.facebook.com/v24.0/ads_archive');
  url.searchParams.set('access_token', META_TOKEN);
  url.searchParams.set('ad_reached_countries', '["DE"]');
  url.searchParams.set('ad_active_status', 'ALL');
  url.searchParams.set('ad_type', 'HOUSING_ADS');
  url.searchParams.set('fields', AD_FIELDS);
  url.searchParams.set('limit', '100');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Meta API returned invalid JSON (HTTP ${res.status}): ${text.substring(0, 200)}`);
  }
  if (!res.ok) {
    if (data.error && /token|expired|invalid/i.test(data.error.message || '')) {
      console.error('[FATAL] Meta API token expired/invalid:', data.error.message);
      process.exit(1);
    }
    throw new Error((data.error && data.error.message) || `Meta API HTTP ${res.status}`);
  }
  return data;
}

async function fetchAllAdsForBrand(params, maxPages = 5) {
  const allAds = [];
  let page = 0;
  let nextUrl = null;

  // First page
  const firstResult = await fetchAdLibraryPage(params);
  if (firstResult.data) allAds.push(...firstResult.data);
  nextUrl = firstResult.paging && firstResult.paging.next;
  page++;

  // Follow pagination
  while (nextUrl && page < maxPages) {
    const res = await fetch(nextUrl);
    if (!res.ok) break;
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { break; }
    if (data.data) allAds.push(...data.data);
    nextUrl = data.paging && data.paging.next;
    page++;
  }

  return allAds;
}

// ============================================
// HELPERS
// ============================================
function calcDaysRunning(ad) {
  if (!ad.ad_delivery_start_time) return 0;
  const start = new Date(ad.ad_delivery_start_time);
  const end = ad.ad_delivery_stop_time ? new Date(ad.ad_delivery_stop_time) : new Date();
  return Math.max(1, Math.ceil((end - start) / 86400000));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// CLI FLAGS
// ============================================
const NO_ALERTS = process.argv.includes('--no-alerts');

// ============================================
// MAIN SYNC
// ============================================
async function main() {
  console.log(`[SYNC] Starting at ${new Date().toISOString()}${NO_ALERTS ? ' (alerts suppressed via --no-alerts)' : ''}`);

  // 1. Validate Supabase connection
  try {
    await sbGet('competitor_watchlist', 'select=id&limit=1');
  } catch (e) {
    console.error('[FATAL] Supabase unreachable:', e.message);
    process.exit(1);
  }

  // 2. Fetch active watchlist
  const watchlist = await sbGet('competitor_watchlist', 'select=*&is_active=eq.true&order=brand.asc.nullsfirst,page_name.asc');
  console.log(`[SYNC] Starting sync for ${watchlist.length} brands...`);

  if (watchlist.length === 0) {
    console.log('[SYNC] No active brands in watchlist. Nothing to do.');
    process.exit(0);
  }

  // Pre-fetch all existing ad_library_ids to detect true new ads (cross-brand dedup)
  // Fetch ALL existing ad_library_ids (paginate past Supabase 1000-row default limit)
  const allExistingAdLibraryIds = new Set();
  const watchlistWithAds = new Set();
  let offset = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const batch = await sbGet('competitor_ads', `select=ad_library_id,watchlist_id&limit=${PAGE_SIZE}&offset=${offset}`);
    for (const a of batch) {
      allExistingAdLibraryIds.add(a.ad_library_id);
      watchlistWithAds.add(a.watchlist_id);
    }
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  console.log(`[SYNC] ${allExistingAdLibraryIds.size} existing ads in database (fetched in ${Math.ceil(offset / PAGE_SIZE) + 1} pages)`);

  let totalNew = 0;
  let totalRemoved = 0;
  let totalAlerts = 0;
  let brandsProcessed = 0;

  for (let i = 0; i < watchlist.length; i++) {
    const w = watchlist[i];
    const brandLabel = w.brand || w.page_name || `ID:${w.id}`;

    try {
      // Build search params
      const params = {};
      if (w.page_id) {
        params.search_page_ids = JSON.stringify([w.page_id]);
      } else if (w.page_name) {
        params.search_terms = w.page_name;
      } else {
        console.log(`[WARN] Brand: ${brandLabel} — no page_id or page_name, skipping`);
        continue;
      }

      // Fetch all ads from Meta API (with pagination)
      const apiAds = await fetchAllAdsForBrand(params);
      const apiAdIds = apiAds.map(a => a.id);

      // Get existing ads for this watchlist entry from DB
      const existingAds = await sbGet('competitor_ads', `select=*&watchlist_id=eq.${w.id}`);
      const existingAdIds = existingAds.map(a => a.ad_library_id);

      let newAdsThisBrand = 0;
      let removedThisBrand = 0;
      const now = new Date().toISOString();

      // Detect if this is the first/baseline sync for this watchlist entry
      const isBaselineSync = !watchlistWithAds.has(w.id);
      if (isBaselineSync) {
        console.log(`[SYNC] Brand: ${brandLabel} — first sync (baseline), will skip new_ad alerts`);
      }

      // Process each ad from API
      for (const apiAd of apiAds) {
        const isNewToThisBrand = !existingAdIds.includes(apiAd.id);
        const isTrulyNew = !allExistingAdLibraryIds.has(apiAd.id);

        if (isTrulyNew) {
          // TRULY NEW AD — insert
          await sbInsert('competitor_ads', {
            watchlist_id: w.id,
            ad_library_id: apiAd.id,
            page_name: apiAd.page_name,
            page_id: apiAd.page_id,
            ad_creative_bodies: apiAd.ad_creative_bodies || [],
            ad_creative_link_titles: apiAd.ad_creative_link_titles || [],
            ad_creative_link_descriptions: apiAd.ad_creative_link_descriptions || [],
            ad_snapshot_url: apiAd.ad_snapshot_url,
            publisher_platforms: apiAd.publisher_platforms || [],
            ad_delivery_start_time: apiAd.ad_delivery_start_time || null,
            ad_delivery_stop_time: apiAd.ad_delivery_stop_time || null,
            ad_type: 'HOUSING_ADS',
            is_active: true,
            first_seen_at: now,
            last_seen_at: now
          });
          allExistingAdLibraryIds.add(apiAd.id);

          // Create new_ad alert (skip on baseline sync or --no-alerts)
          if (!isBaselineSync && !NO_ALERTS) {
            const adSnippet = (apiAd.ad_creative_bodies && apiAd.ad_creative_bodies[0])
              ? apiAd.ad_creative_bodies[0].substring(0, 80)
              : '';
            await sbInsert('competitor_alerts', {
              watchlist_id: w.id,
              alert_type: 'new_ad',
              message: `🆕 Neue Ad von ${apiAd.page_name || w.page_name}${adSnippet ? ': "' + adSnippet + '…"' : ''}`
            });
            totalAlerts++;
          }
          newAdsThisBrand++;
        } else if (!isNewToThisBrand) {
          // EXISTING AD for this brand — update last_seen_at
          const existing = existingAds.find(a => a.ad_library_id === apiAd.id);
          if (existing) {
            await sbPatch('competitor_ads', existing.id, {
              last_seen_at: now,
              is_active: true,
              ad_delivery_stop_time: apiAd.ad_delivery_stop_time || null
            });
          }
        }
        // else: exists in DB under different brand — skip (don't duplicate)
      }

      // Burst detection: 3+ new ads from one brand (skip on baseline sync or --no-alerts)
      if (newAdsThisBrand >= 3 && !isBaselineSync && !NO_ALERTS) {
        await sbInsert('competitor_alerts', {
          watchlist_id: w.id,
          alert_type: 'burst',
          message: `📢 ${brandLabel} hat ${newAdsThisBrand} neue Ads gestartet`
        });
        totalAlerts++;
      }

      // Detect removed ads
      for (const ea of existingAds) {
        if (ea.is_active && !apiAdIds.includes(ea.ad_library_id)) {
          const days = calcDaysRunning(ea);
          await sbPatch('competitor_ads', ea.id, {
            is_active: false,
            ad_delivery_stop_time: ea.ad_delivery_stop_time || now
          });

          // Create removed/long_running alerts (suppressed only by --no-alerts, not baseline)
          if (!NO_ALERTS) {
            const eaSnippet = (ea.ad_creative_bodies && ea.ad_creative_bodies[0])
              ? ea.ad_creative_bodies[0].substring(0, 60)
              : '';
            const alertType = days >= 30 ? 'long_running' : 'removed_ad';
            const alertMsg = days >= 30
              ? `🔥 Top Performer gestoppt: "${eaSnippet}…" von ${ea.page_name || w.page_name} nach ${days} Tagen`
              : `⏹️ Ad gestoppt: "${eaSnippet}…" von ${ea.page_name || w.page_name} nach ${days} Tagen`;

            await sbInsert('competitor_alerts', {
              ad_id: ea.id,
              watchlist_id: w.id,
              alert_type: alertType,
              message: alertMsg
            });
            totalAlerts++;
          }
          removedThisBrand++;
        }
      }

      // Update watchlist page_id if missing but API returned one
      if (!w.page_id && apiAds.length > 0 && apiAds[0].page_id) {
        const matchingAd = apiAds.find(a =>
          a.page_name && a.page_name.toLowerCase() === (w.page_name || '').toLowerCase()
        );
        if (matchingAd && matchingAd.page_id) {
          await sbPatch('competitor_watchlist', w.id, { page_id: matchingAd.page_id });
          console.log(`[SYNC] Updated page_id for ${brandLabel}: ${matchingAd.page_id}`);
        }
      }

      // Mark this watchlist entry as having ads (for baseline detection of other entries in same run)
      if (newAdsThisBrand > 0) {
        watchlistWithAds.add(w.id);
      }

      totalNew += newAdsThisBrand;
      totalRemoved += removedThisBrand;
      brandsProcessed++;

      console.log(`[SYNC] Brand: ${brandLabel} — found ${apiAds.length} ads (${newAdsThisBrand} new, ${removedThisBrand} removed)`);

      // Rate limit: wait 2s between brands
      if (i < watchlist.length - 1) {
        await sleep(2000);
      }

    } catch (err) {
      console.error(`[ERROR] Brand: ${brandLabel} — ${err.message}`);
      // Continue to next brand
    }
  }

  console.log(`[SYNC] Complete: ${brandsProcessed} brands synced, ${totalNew} new ads, ${totalRemoved} removed, ${totalAlerts} alerts created`);
  process.exit(0);
}

// ============================================
// RUN
// ============================================
main().catch(err => {
  console.error('[FATAL] Unexpected error:', err.message);
  process.exit(1);
});
