#!/usr/bin/env node
// backfill-thumbnails.js — One-time script to fetch thumbnail_url for creatives missing them
// Fetches from Meta API: GET /{meta_ad_id}?fields=creative{id,thumbnail_url}

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIG
// ============================================
const SB_URL = 'https://lvhxabadywdqeepymwdm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aHhhYmFkeXdkcWVlcHltd2RtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUyMjM3NSwiZXhwIjoyMDg1MDk4Mzc1fQ.3BWQG5yeG8nshvukSi3YksxUbg273tJDiZnU9fAlzY0';
const RATE_LIMIT_MS = 500;

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

// ============================================
// LOGGING
// ============================================
function log(msg) {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  console.log('[BACKFILL] [' + ts + '] ' + msg);
}

// ============================================
// HTTP HELPERS
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

async function sbUpdate(table, id, data) {
  var url = SB_URL + '/rest/v1/' + table + '?id=eq.' + id;
  var res = await httpRequest(url, {
    method: 'PATCH',
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error('sbUpdate ' + table + ' failed: HTTP ' + res.status + ' — ' + res.body);
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
// MAIN
// ============================================
async function main() {
  log('Starting thumbnail backfill...');

  var token = getMetaToken();
  if (!token) {
    log('FATAL: No Meta API token found. Exiting.');
    process.exit(1);
  }

  // 1. Query all creatives with meta_ad_id but no thumbnail_url
  var creatives;
  try {
    creatives = await sbGet('creatives',
      'select=id,creative_name,meta_ad_id,meta_creative_id,thumbnail_url&meta_ad_id=not.is.null&thumbnail_url=is.null');
  } catch (e) {
    log('FATAL: Could not fetch creatives: ' + e.message);
    process.exit(1);
  }

  log('Found ' + creatives.length + ' creatives missing thumbnail_url');

  if (creatives.length === 0) {
    log('Nothing to backfill. Done.');
    process.exit(0);
  }

  // 2. Process each creative
  var updated = 0;
  var errors = 0;

  for (var i = 0; i < creatives.length; i++) {
    var creative = creatives[i];
    log('(' + (i + 1) + '/' + creatives.length + ') Processing: ' + creative.creative_name);

    try {
      // Fetch ad with creative info from Meta
      var adData = await metaGet(creative.meta_ad_id,
        'fields=creative{id,thumbnail_url}&access_token=' + encodeURIComponent(token));

      if (!adData.creative) {
        log('  SKIP: No creative data returned');
        continue;
      }

      var metaCreativeId = adData.creative.id || null;
      var thumbnailUrl = adData.creative.thumbnail_url || null;

      if (!thumbnailUrl) {
        log('  SKIP: No thumbnail_url in response');
        continue;
      }

      // Update Supabase
      var updateData = { thumbnail_url: thumbnailUrl };
      if (metaCreativeId && !creative.meta_creative_id) {
        updateData.meta_creative_id = metaCreativeId;
      }

      await sbUpdate('creatives', creative.id, updateData);
      updated++;
      log('  OK: ' + thumbnailUrl.substring(0, 60) + '...');

    } catch (e) {
      log('  ERROR: ' + e.message);
      errors++;
    }

    // Rate limiting
    if (i < creatives.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  // 3. Summary
  log('========================================');
  log('Backfill complete!');
  log('  Total processed: ' + creatives.length);
  log('  Updated: ' + updated);
  log('  Errors: ' + errors);
  log('  Skipped: ' + (creatives.length - updated - errors));
  log('========================================');

  process.exit(errors > 0 ? 1 : 0);
}

main().catch(function(e) {
  log('FATAL: ' + e.message);
  process.exit(1);
});
