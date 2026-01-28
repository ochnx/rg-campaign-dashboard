#!/usr/bin/env node
// campaign-sync.js — Sync daily metrics for ALL live-tracked Meta campaigns
// No external dependencies. Standalone Node.js script.

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIG
// ============================================
const SB_URL = 'https://lvhxabadywdqeepymwdm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aHhhYmFkeXdkcWVlcHltd2RtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUyMjM3NSwiZXhwIjoyMDg1MDk4Mzc1fQ.3BWQG5yeG8nshvukSi3YksxUbg273tJDiZnU9fAlzY0';
const AD_ACCOUNT_ID = 'act_850524294087986';
const RATE_LIMIT_MS = 2000; // 2 second delay between campaigns

function getMetaToken() {
  const tokenPath = path.join(process.env.HOME || '/home/clawd', '.config/meta/long_lived_token.json');
  try {
    const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    return data.access_token || data.token || '';
  } catch (e) {
    log('ERROR: Could not read Meta token from ' + tokenPath + ': ' + e.message);
    return '';
  }
}

// ============================================
// LOGGING
// ============================================
function log(msg) {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  console.log('[CAMPAIGN-SYNC] [' + ts + '] ' + msg);
}

// ============================================
// HTTP HELPERS (no deps)
// ============================================
function httpRequest(url, options) {
  return new Promise(function(resolve, reject) {
    var parsedUrl = new URL(url);
    var opts = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    var protocol = parsedUrl.protocol === 'https:' ? https : require('http');
    var req = protocol.request(opts, function(res) {
      var chunks = [];
      res.on('data', function(chunk) { chunks.push(chunk); });
      res.on('end', function() {
        var body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, body: body });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function sbGet(table, query) {
  var url = SB_URL + '/rest/v1/' + table + '?' + (query || '');
  var res = await httpRequest(url, {
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json'
    }
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error('sbGet ' + table + ' failed: HTTP ' + res.status + ' — ' + res.body);
  }
  return JSON.parse(res.body);
}

async function sbUpsert(table, data, onConflict) {
  var url = SB_URL + '/rest/v1/' + table;
  if (onConflict) {
    url += '?on_conflict=' + onConflict;
  }
  var headers = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=representation'
  };
  var res = await httpRequest(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(data)
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error('sbUpsert ' + table + ' failed: HTTP ' + res.status + ' — ' + res.body);
  }
  return JSON.parse(res.body);
}

async function sbPatch(table, id, data) {
  var url = SB_URL + '/rest/v1/' + table + '?id=eq.' + id;
  var headers = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  var res = await httpRequest(url, {
    method: 'PATCH',
    headers: headers,
    body: JSON.stringify(data)
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error('sbPatch ' + table + ' failed: HTTP ' + res.status + ' — ' + res.body);
  }
  return JSON.parse(res.body);
}

async function metaGet(endpoint, params) {
  var url = 'https://graph.facebook.com/v24.0/' + endpoint;
  if (params) {
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    url += sep + params;
  }
  var res = await httpRequest(url, {
    headers: { 'Content-Type': 'application/json' }
  });
  if (res.status < 200 || res.status >= 300) {
    var errBody = '';
    try { errBody = JSON.parse(res.body).error.message; } catch (e) { errBody = res.body.substring(0, 200); }
    throw new Error('Meta API error (' + res.status + '): ' + errBody);
  }
  return JSON.parse(res.body);
}

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// ============================================
// CREATIVE TYPE INFERENCE
// ============================================
function inferCreativeType(adName) {
  if (!adName) return 'video';
  var lower = adName.toLowerCase();
  // Check specific types first (more specific → less specific)
  if (lower.includes('single image')) return 'single_image';
  if (lower.includes('carousel')) return 'carousel';
  if (lower.includes('th-reel') || lower.includes('th reel')) return 'th_reel';
  if (lower.includes('scn-reel') || lower.includes('scn reel')) return 'scn_reel';
  // "Bild" means image in German - check before reel/video
  if (lower.includes('bild')) return 'single_image';
  if (lower.includes('reel')) return 'video';
  if (lower.includes('video')) return 'video';
  if (lower.includes('story')) return 'story';
  return 'video';
}

// ============================================
// PARSE META INSIGHTS RESPONSE
// ============================================
function parseInsightsRow(row) {
  var spend = parseFloat(row.spend) || 0;
  var impressions = parseInt(row.impressions) || 0;
  var reach = parseInt(row.reach) || 0;
  var clicks = 0;
  var leads = 0;
  if (row.actions && Array.isArray(row.actions)) {
    row.actions.forEach(function(a) {
      if (a.action_type === 'link_click') clicks = parseInt(a.value) || 0;
      if (a.action_type === 'lead') leads = parseInt(a.value) || 0;
    });
  }
  return {
    date: row.date_start,
    spend: Math.round(spend * 100) / 100,
    impressions: impressions,
    reach: reach,
    clicks: clicks || null,
    leads: leads
  };
}

// ============================================
// FETCH ALL PAGES OF INSIGHTS
// ============================================
async function fetchAllInsights(entityId, token, sinceDate) {
  var allRows = [];
  var fields = 'spend,impressions,reach,actions,cost_per_action_type';
  var params = 'fields=' + fields + '&time_increment=1&limit=500&access_token=' + encodeURIComponent(token);
  if (sinceDate) {
    params += '&time_range=' + encodeURIComponent(JSON.stringify({ since: sinceDate, until: new Date().toISOString().slice(0, 10) }));
  }

  var data = await metaGet(entityId + '/insights', params);
  if (data.data) allRows = allRows.concat(data.data);

  // Handle pagination
  while (data.paging && data.paging.next) {
    data = await metaGet('', '').catch(function() { return {}; });
    // Use the full next URL
    var res = await httpRequest(data.paging.next, { headers: {} }).catch(function() { return null; });
    if (!res) break;
    try {
      data = JSON.parse(res.body);
      if (data.data) allRows = allRows.concat(data.data);
    } catch (e) {
      break;
    }
  }

  return allRows;
}

// Actually, let me fix the pagination properly:
async function fetchAllInsightsPages(entityId, token, sinceDate) {
  var allRows = [];
  var fields = 'spend,impressions,reach,actions';
  var params = 'fields=' + fields + '&time_increment=1&limit=500&access_token=' + encodeURIComponent(token);
  if (sinceDate) {
    params += '&time_range=' + encodeURIComponent(JSON.stringify({ since: sinceDate, until: new Date().toISOString().slice(0, 10) }));
  }

  var url = 'https://graph.facebook.com/v24.0/' + entityId + '/insights?' + params;

  while (url) {
    var res = await httpRequest(url, { headers: {} });
    if (res.status < 200 || res.status >= 300) {
      var errMsg = '';
      try { errMsg = JSON.parse(res.body).error.message; } catch (e) { errMsg = res.body.substring(0, 200); }
      throw new Error('Meta insights error (' + res.status + '): ' + errMsg);
    }
    var data = JSON.parse(res.body);
    if (data.data) allRows = allRows.concat(data.data);
    url = (data.paging && data.paging.next) ? data.paging.next : null;
  }

  return allRows;
}

// ============================================
// SYNC ONE CAMPAIGN
// ============================================
async function syncCampaign(campaign, token) {
  var metaCampaignId = campaign.meta_campaign_id;
  var campaignId = campaign.id;
  var campaignName = campaign.campaign_name || metaCampaignId;

  log('Syncing campaign: ' + campaignName + ' (meta_id=' + metaCampaignId + ')');

  // 1. Find last synced date
  var sinceDate = null;
  try {
    var maxDateRows = await sbGet('campaign_daily_metrics',
      'select=date&campaign_id=eq.' + campaignId + '&order=date.desc&limit=1');
    if (maxDateRows.length > 0) {
      sinceDate = maxDateRows[0].date;
      log('  Last synced date: ' + sinceDate + ' — fetching from there');
    } else {
      log('  No existing data — fetching all history');
    }
  } catch (e) {
    log('  WARNING: Could not check last sync date: ' + e.message);
  }

  // 2. Fetch campaign-level insights
  var insightRows = [];
  try {
    insightRows = await fetchAllInsightsPages(metaCampaignId, token, sinceDate);
  } catch (e) {
    log('  ERROR fetching campaign insights: ' + e.message);
    return { days: 0, leads: 0, spend: 0, errors: 1 };
  }

  // 3. Parse and upsert campaign daily metrics
  var totalDays = 0;
  var totalLeads = 0;
  var totalSpend = 0;

  if (insightRows.length > 0) {
    var metricsToUpsert = insightRows.map(function(row) {
      var parsed = parseInsightsRow(row);
      totalLeads += parsed.leads;
      totalSpend += parsed.spend;
      return {
        campaign_id: campaignId,
        date: parsed.date,
        spend: parsed.spend,
        impressions: parsed.impressions,
        reach: parsed.reach,
        clicks: parsed.clicks,
        leads: parsed.leads
        // NO cpl, cpm, ctr — GENERATED ALWAYS columns
      };
    });
    totalDays = metricsToUpsert.length;

    // Upsert in batches of 50
    for (var i = 0; i < metricsToUpsert.length; i += 50) {
      var batch = metricsToUpsert.slice(i, i + 50);
      try {
        await sbUpsert('campaign_daily_metrics', batch, 'campaign_id,date');
      } catch (e) {
        log('  ERROR upserting campaign metrics batch: ' + e.message);
      }
    }
    log('  Campaign metrics: ' + totalDays + ' days, ' + totalLeads + ' leads, ' + totalSpend.toFixed(2) + '€');
  } else {
    log('  No new campaign insights data');
  }

  // 4. Sync ads (creatives)
  try {
    var adsData = await metaGet(metaCampaignId + '/ads',
      'fields=name,status,creative&limit=100&access_token=' + encodeURIComponent(token));
    var ads = adsData.data || [];

    for (var a = 0; a < ads.length; a++) {
      var ad = ads[a];
      var adId = ad.id;
      var adName = ad.name || 'Ad ' + adId;
      var creativeType = inferCreativeType(adName);
      var metaCreativeId = (ad.creative && ad.creative.id) ? ad.creative.id : null;

      // Fetch thumbnail_url from Meta creative
      var thumbnailUrl = null;
      if (metaCreativeId) {
        try {
          var crData = await metaGet(metaCreativeId,
            'fields=thumbnail_url&access_token=' + encodeURIComponent(token));
          thumbnailUrl = crData.thumbnail_url || null;
        } catch (e) {
          // Non-fatal: thumbnail fetch can fail
        }
      }

      // Check if creative exists by campaign_id + creative_name (from CSV import, no meta_ad_id)
      var creativeId;
      try {
        var existingCreative = await sbGet('creatives',
          'campaign_id=eq.' + campaignId + '&creative_name=eq.' + encodeURIComponent(adName) + '&limit=1');

        if (existingCreative.length > 0 && !existingCreative[0].meta_ad_id) {
          // Update existing creative (from CSV import) with Meta data
          var patchData = { meta_ad_id: adId };
          if (metaCreativeId) patchData.meta_creative_id = metaCreativeId;
          if (thumbnailUrl) patchData.thumbnail_url = thumbnailUrl;
          await sbPatch('creatives', existingCreative[0].id, patchData);
          creativeId = existingCreative[0].id;
          log('  Updated existing creative (matched by name): ' + adName);
        } else {
          // Normal upsert by meta_ad_id
          var creativeUpsertData = {
            campaign_id: campaignId,
            creative_name: adName,
            creative_type: creativeType,
            meta_ad_id: adId
          };
          if (metaCreativeId) creativeUpsertData.meta_creative_id = metaCreativeId;
          if (thumbnailUrl) creativeUpsertData.thumbnail_url = thumbnailUrl;

          var creativeRows = await sbUpsert('creatives', [creativeUpsertData], 'meta_ad_id');
          creativeId = creativeRows[0].id;
        }
      } catch (e) {
        log('  WARNING: Creative upsert failed for ' + adName + ': ' + e.message);
        continue;
      }

      // Find last synced date for this creative
      var creativeSinceDate = sinceDate; // Use campaign-level since date as fallback
      try {
        var crMaxDate = await sbGet('creative_daily_metrics',
          'select=date&creative_id=eq.' + creativeId + '&order=date.desc&limit=1');
        if (crMaxDate.length > 0) {
          creativeSinceDate = crMaxDate[0].date;
        }
      } catch (e) { /* use campaign sinceDate */ }

      // Fetch ad-level insights
      try {
        var adInsights = await fetchAllInsightsPages(adId, token, creativeSinceDate);
        if (adInsights.length > 0) {
          var crMetrics = adInsights.map(function(row) {
            var parsed = parseInsightsRow(row);
            return {
              creative_id: creativeId,
              date: parsed.date,
              spend: parsed.spend,
              impressions: parsed.impressions,
              reach: parsed.reach,
              clicks: parsed.clicks,
              leads: parsed.leads
              // NO cpl, cpm — GENERATED ALWAYS columns
            };
          });

          // Upsert in batches
          for (var ci = 0; ci < crMetrics.length; ci += 50) {
            var crBatch = crMetrics.slice(ci, ci + 50);
            try {
              await sbUpsert('creative_daily_metrics', crBatch, 'creative_id,date');
            } catch (e) {
              log('  WARNING: Creative metrics upsert failed: ' + e.message);
            }
          }
          log('  Creative "' + adName + '": ' + adInsights.length + ' days synced');
        }
      } catch (e) {
        log('  WARNING: Ad insights fetch failed for ' + adName + ': ' + e.message);
      }

      // Small delay between ads
      await sleep(500);
    }
    log('  Synced ' + ads.length + ' ads/creatives');
  } catch (e) {
    log('  WARNING: Ads sync failed: ' + e.message);
  }

  return { days: totalDays, leads: totalLeads, spend: totalSpend, errors: 0 };
}

// ============================================
// MAIN
// ============================================
async function main() {
  log('Starting...');

  var token = getMetaToken();
  if (!token) {
    log('FATAL: No Meta API token found. Exiting.');
    process.exit(1);
  }

  // 1. Fetch all live campaigns
  var liveCampaigns;
  try {
    liveCampaigns = await sbGet('campaigns',
      'select=id,campaign_name,meta_campaign_id,is_live&is_live=eq.true&meta_campaign_id=not.is.null');
  } catch (e) {
    log('FATAL: Could not fetch live campaigns: ' + e.message);
    process.exit(1);
  }

  log(liveCampaigns.length + ' live campaigns found');

  if (liveCampaigns.length === 0) {
    log('Nothing to sync. Done.');
    process.exit(0);
  }

  // 2. Check Meta status for each campaign — only sync ACTIVE ones
  var totalDays = 0;
  var totalLeads = 0;
  var totalSpend = 0;
  var totalErrors = 0;
  var skippedInactive = 0;

  for (var i = 0; i < liveCampaigns.length; i++) {
    var campaign = liveCampaigns[i];
    try {
      // Check if campaign is still active on Meta
      var metaStatusRes = await httpRequest(
        'https://graph.facebook.com/v24.0/' + campaign.meta_campaign_id +
        '?fields=status&access_token=' + encodeURIComponent(token), {});
      var statusData = JSON.parse(metaStatusRes.body);
      if (statusData.status && statusData.status !== 'ACTIVE') {
        log('SKIP: ' + campaign.campaign_name + ' (Meta status: ' + statusData.status + ')');
        skippedInactive++;
        continue;
      }

      var result = await syncCampaign(campaign, token);
      totalDays += result.days;
      totalLeads += result.leads;
      totalSpend += result.spend;
      totalErrors += result.errors;
    } catch (e) {
      log('ERROR syncing campaign ' + campaign.campaign_name + ': ' + e.message);
      totalErrors++;
    }

    // Rate limiting between campaigns
    if (i < liveCampaigns.length - 1) {
      log('Rate limiting... waiting ' + (RATE_LIMIT_MS / 1000) + 's');
      await sleep(RATE_LIMIT_MS);
    }
  }

  // 3. Summary
  log('========================================');
  log('Sync complete!');
  log('  Campaigns: ' + liveCampaigns.length + ' (' + skippedInactive + ' skipped — not active on Meta)');
  log('  Days synced: ' + totalDays);
  log('  Total leads: ' + totalLeads);
  log('  Total spend: ' + totalSpend.toFixed(2) + '€');
  log('  Errors: ' + totalErrors);
  log('========================================');

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch(function(e) {
  log('FATAL: ' + e.message);
  process.exit(1);
});
