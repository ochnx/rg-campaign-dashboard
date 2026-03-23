#!/usr/bin/env node
// audience-insights-sync.js — Sync Geo + Demo breakdowns for ALL live campaigns
// Standalone Node.js, no external deps. Run after campaign-sync.js.
// Requires migration-v12-audience-insights.sql to be applied first.

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIG
// ============================================
const SB_URL = 'https://lvhxabadywdqeepymwdm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aHhhYmFkeXdkcWVlcHltd2RtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUyMjM3NSwiZXhwIjoyMDg1MDk4Mzc1fQ.3BWQG5yeG8nshvukSi3YksxUbg273tJDiZnU9fAlzY0';
const RATE_LIMIT_MS = 1500;

function getMetaToken() {
  const tokenPath = path.join(process.env.HOME || '/home/clawd', '.config/meta/long_lived_token.json');
  try {
    const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    return data.access_token || data.token || '';
  } catch (e) {
    log('ERROR: Could not read Meta token: ' + e.message);
    return '';
  }
}

function log(msg) {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  console.log('[AUDIENCE-SYNC] [' + ts + '] ' + msg);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// HTTP HELPERS
// ============================================
function httpRequest(url, options) {
  return new Promise(function(resolve, reject) {
    const parsedUrl = new URL(url);
    const opts = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    const req = https.request(opts, function(res) {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function sbGet(table, query) {
  const url = SB_URL + '/rest/v1/' + table + '?' + (query || '');
  const res = await httpRequest(url, {
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json'
    }
  });
  if (res.status < 200 || res.status >= 300) throw new Error('sbGet ' + table + ': HTTP ' + res.status + ' — ' + res.body);
  return JSON.parse(res.body);
}

async function sbUpsert(table, data, onConflict) {
  const url = SB_URL + '/rest/v1/' + table + '?on_conflict=' + onConflict;
  const res = await httpRequest(url, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(data)
  });
  if (res.status < 200 || res.status >= 300) throw new Error('sbUpsert ' + table + ': HTTP ' + res.status + ' — ' + res.body);
}

async function metaFetchBreakdown(metaCampaignId, token, breakdown) {
  // breakdown: 'region' or 'age,gender'
  // Uses date_preset=maximum to get full campaign lifetime aggregate
  const fields = 'spend,impressions,reach,actions';
  const params = new URLSearchParams({
    fields,
    breakdowns: breakdown,
    date_preset: 'maximum',
    limit: '500',
    access_token: token
  });

  let url = `https://graph.facebook.com/v24.0/${metaCampaignId}/insights?${params}`;
  const allRows = [];

  while (url) {
    const res = await httpRequest(url, { headers: {} });
    if (res.status < 200 || res.status >= 300) {
      let errMsg = '';
      try { errMsg = JSON.parse(res.body).error.message; } catch (e) { errMsg = res.body.substring(0, 200); }
      throw new Error('Meta insights error (' + res.status + '): ' + errMsg);
    }
    const data = JSON.parse(res.body);
    if (data.data) allRows.push(...data.data);
    url = (data.paging && data.paging.next) ? data.paging.next : null;
  }

  return allRows;
}

function extractLeads(actions) {
  if (!actions || !Array.isArray(actions)) return 0;
  // Meta does NOT return 'lead' action_type in region/geo breakdowns.
  // Use 'onsite_conversion.lead_grouped' as the lead proxy for breakdowns.
  // Take the max of both to handle both campaign-level and breakdown contexts.
  let leads = 0;
  actions.forEach(a => {
    if (a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped') {
      leads = Math.max(leads, parseInt(a.value) || 0);
    }
  });
  return leads;
}

function extractClicks(actions) {
  if (!actions || !Array.isArray(actions)) return null;
  const clickAction = actions.find(a => a.action_type === 'link_click');
  return clickAction ? parseInt(clickAction.value) || 0 : null;
}

// ============================================
// SYNC ONE CAMPAIGN — GEO
// ============================================
async function syncGeo(campaign, token) {
  const { id: campaignId, meta_campaign_id, campaign_name } = campaign;
  const today = new Date().toISOString().slice(0, 10);

  log('  Geo breakdown (region): ' + campaign_name);
  let regionCount = 0;
  try {
    const rows = await metaFetchBreakdown(meta_campaign_id, token, 'region');
    if (rows.length) {
      const upsertRows = rows.map(row => ({
        campaign_id: campaignId,
        sync_date: today,
        region: row.region || 'Unknown',
        country: row.country || 'DE',
        city: null,
        impressions: parseInt(row.impressions) || 0,
        reach: parseInt(row.reach) || 0,
        clicks: extractClicks(row.actions),
        leads: extractLeads(row.actions),
        spend: Math.round((parseFloat(row.spend) || 0) * 100) / 100
      }));
      for (let i = 0; i < upsertRows.length; i += 50) {
        await sbUpsert('campaign_geo_insights', upsertRows.slice(i, i + 50), 'campaign_id,sync_date,region,country');
      }
      regionCount = upsertRows.length;
      log('  Geo regions: ' + regionCount + ' synced');
    }
  } catch (e) {
    log('  WARNING region sync failed: ' + e.message);
  }

  // NOTE: Meta API does not support 'city' as a breakdown value.
  // Finest geographic granularity available is 'region' (Bundesland).

  return regionCount;
}

// ============================================
// SYNC ONE CAMPAIGN — DEMOGRAPHICS
// ============================================
async function syncDemo(campaign, token) {
  const { id: campaignId, meta_campaign_id, campaign_name } = campaign;
  const today = new Date().toISOString().slice(0, 10);

  log('  Demo breakdown: ' + campaign_name);
  try {
    const rows = await metaFetchBreakdown(meta_campaign_id, token, 'age,gender');
    if (!rows.length) { log('  No demo data'); return 0; }

    const upsertRows = rows.map(row => ({
      campaign_id: campaignId,
      sync_date: today,
      age: row.age || 'Unknown',
      gender: row.gender || 'unknown',
      impressions: parseInt(row.impressions) || 0,
      reach: parseInt(row.reach) || 0,
      clicks: extractClicks(row.actions),
      leads: extractLeads(row.actions),
      spend: Math.round((parseFloat(row.spend) || 0) * 100) / 100
    }));

    for (let i = 0; i < upsertRows.length; i += 50) {
      await sbUpsert('campaign_demo_insights', upsertRows.slice(i, i + 50), 'campaign_id,sync_date,age,gender');
    }
    log('  Demo: ' + upsertRows.length + ' segments synced');
    return upsertRows.length;
  } catch (e) {
    log('  WARNING demo sync failed: ' + e.message);
    return 0;
  }
}

// ============================================
// MAIN
// ============================================
async function main() {
  log('Starting audience insights sync...');

  const token = getMetaToken();
  if (!token) { log('ERROR: No Meta token'); process.exit(1); }

  // Fetch all live-tracked campaigns
  let campaigns;
  try {
    // Audience insights: sync ALL campaigns with a meta_campaign_id (incl. paused/completed)
    // is_live filter only makes sense for daily metrics, not lifetime audience data
    campaigns = await sbGet('campaigns', 'meta_campaign_id=not.is.null&select=id,meta_campaign_id,campaign_name');
  } catch (e) {
    log('ERROR: Could not fetch campaigns: ' + e.message);
    process.exit(1);
  }

  log('Found ' + campaigns.length + ' live-tracked campaigns');

  let totalGeo = 0;
  let totalDemo = 0;

  for (let i = 0; i < campaigns.length; i++) {
    const c = campaigns[i];
    log('Campaign ' + (i + 1) + '/' + campaigns.length + ': ' + c.campaign_name);

    await syncGeo(c, token);
    await sleep(RATE_LIMIT_MS);

    await syncDemo(c, token);
    await sleep(RATE_LIMIT_MS);
  }

  log('Done. Geo regions: ' + totalGeo + ' | Demo segments: ' + totalDemo);
}

main().catch(e => {
  log('FATAL: ' + e.message);
  process.exit(1);
});
