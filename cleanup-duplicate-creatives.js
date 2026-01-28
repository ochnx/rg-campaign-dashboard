#!/usr/bin/env node
// cleanup-duplicate-creatives.js — One-time cleanup of duplicate creatives
// Keeps creatives with meta_ad_id, removes orphans from CSV imports

const https = require('https');

const SB_URL = 'https://lvhxabadywdqeepymwdm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aHhhYmFkeXdkcWVlcHltd2RtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUyMjM3NSwiZXhwIjoyMDg1MDk4Mzc1fQ.3BWQG5yeG8nshvukSi3YksxUbg273tJDiZnU9fAlzY0';

function log(msg) {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  console.log('[CLEANUP] [' + ts + '] ' + msg);
}

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

async function sbPatch(table, query, data) {
  var url = SB_URL + '/rest/v1/' + table + '?' + query;
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

async function sbDelete(table, query) {
  var url = SB_URL + '/rest/v1/' + table + '?' + query;
  var headers = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  var res = await httpRequest(url, {
    method: 'DELETE',
    headers: headers
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error('sbDelete ' + table + ' failed: HTTP ' + res.status + ' — ' + res.body);
  }
  return JSON.parse(res.body);
}

async function main() {
  log('Fetching all creatives...');

  var allCreatives = await sbGet('creatives', 'select=id,campaign_id,creative_name,meta_ad_id&limit=5000');
  log('Found ' + allCreatives.length + ' total creatives');

  // Group by campaign_id + creative_name
  var groups = {};
  allCreatives.forEach(function(c) {
    var key = c.campaign_id + '::' + c.creative_name;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });

  // Find duplicates
  var duplicateGroups = Object.entries(groups).filter(function(entry) {
    return entry[1].length > 1;
  });

  log('Found ' + duplicateGroups.length + ' duplicate groups');

  var deleted = 0;
  var migratedMetrics = 0;

  for (var i = 0; i < duplicateGroups.length; i++) {
    var key = duplicateGroups[i][0];
    var creatives = duplicateGroups[i][1];

    // Separate: one with meta_ad_id (keep), one without (delete)
    var withMeta = creatives.filter(function(c) { return !!c.meta_ad_id; });
    var withoutMeta = creatives.filter(function(c) { return !c.meta_ad_id; });

    if (withMeta.length === 0 || withoutMeta.length === 0) {
      log('SKIP: ' + key + ' (no clear keep/delete)');
      continue;
    }

    var keepCreative = withMeta[0];
    var deleteCreatives = withoutMeta;

    for (var j = 0; j < deleteCreatives.length; j++) {
      var toDelete = deleteCreatives[j];

      // Check for metrics on the old creative
      var oldMetrics = await sbGet('creative_daily_metrics',
        'creative_id=eq.' + toDelete.id + '&select=id,date');

      if (oldMetrics.length > 0) {
        // Check which dates already exist on the kept creative
        var existingMetrics = await sbGet('creative_daily_metrics',
          'creative_id=eq.' + keepCreative.id + '&select=date');
        var existingDates = new Set(existingMetrics.map(function(m) { return m.date; }));

        // Migrate only non-conflicting metrics
        var toMigrate = oldMetrics.filter(function(m) { return !existingDates.has(m.date); });
        var toDeleteMetrics = oldMetrics.filter(function(m) { return existingDates.has(m.date); });

        if (toMigrate.length > 0) {
          var migrateIds = toMigrate.map(function(m) { return m.id; });
          log('Migrating ' + toMigrate.length + ' metrics from creative ' + toDelete.id + ' to ' + keepCreative.id);
          await sbPatch('creative_daily_metrics', 'id=in.(' + migrateIds.join(',') + ')',
            { creative_id: keepCreative.id });
          migratedMetrics += toMigrate.length;
        }

        if (toDeleteMetrics.length > 0) {
          var deleteIds = toDeleteMetrics.map(function(m) { return m.id; });
          log('Deleting ' + toDeleteMetrics.length + ' conflicting metrics (data exists on kept creative)');
          await sbDelete('creative_daily_metrics', 'id=in.(' + deleteIds.join(',') + ')');
        }
      }

      // Delete the duplicate
      await sbDelete('creatives', 'id=eq.' + toDelete.id);
      log('Deleted duplicate: id=' + toDelete.id + ' name="' + toDelete.creative_name + '"');
      deleted++;
    }
  }

  log('========================================');
  log('Cleanup complete!');
  log('  Deleted duplicates: ' + deleted);
  log('  Migrated metrics: ' + migratedMetrics);
  log('========================================');
}

main().catch(function(e) {
  log('FATAL: ' + e.message);
  console.error(e);
  process.exit(1);
});
