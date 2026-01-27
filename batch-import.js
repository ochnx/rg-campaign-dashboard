#!/usr/bin/env node
// Batch Import Campaign Data into Supabase
// Imports CSV data for 5 properties across 3 clients

const fs = require('fs');
const path = require('path');

// ─── Supabase Config ────────────────────────────────────────────────
const SB_URL = 'https://lvhxabadywdqeepymwdm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aHhhYmFkeXdkcWVlcHltd2RtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUyMjM3NSwiZXhwIjoyMDg1MDk4Mzc1fQ.3BWQG5yeG8nshvukSi3YksxUbg273tJDiZnU9fAlzY0';
const HEADERS = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// ─── CSV Parsing ────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  // Strip BOM
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] || '');
    return obj;
  });
}

// ─── Helpers ────────────────────────────────────────────────────────
function num(val) {
  if (!val || val === '' || val === '-') return 0;
  return parseFloat(val) || 0;
}

function intNum(val) {
  if (!val || val === '' || val === '-') return 0;
  return parseInt(val, 10) || 0;
}

function inferCreativeType(adName) {
  const name = adName.toLowerCase();
  if (name.startsWith('single image') || name.startsWith('bild')) return 'single_image';
  if (name.startsWith('carousel')) return 'carousel';
  if (name.startsWith('th-reel')) return 'reel'; // th_reel -> reel (DB constraint)
  if (name.startsWith('scn-reel')) return 'reel'; // scn_reel -> reel (DB constraint)
  if (name.includes('reel')) return 'reel';
  if (name.includes('video')) return 'video';
  if (name.includes('story')) return 'story';
  return null;
}

function extractCreativeName(adName) {
  // Ad name format: "CREATIVE_TYPE // CTA" -> use full ad name as creative name
  return adName.trim();
}

// Identify which property an ad set belongs to
function identifyProperty(adSetName) {
  if (adSetName.includes('Andresen & Co. Immobilien // Norder Wung')) return 'Norder Wung';
  if (adSetName.includes('Andresen & Co. Immobilien // Apartmentanlage in Westerland')) return 'Apartmentanlage in Westerland';
  if (adSetName.includes('NEUBAUTEAM // Oelkersallee')) return 'Oelkersallee';
  if (adSetName.includes('NEUBAUTEAM // Osterstraße')) return 'Osterstraße';
  if (adSetName.includes('VON POLL Berlin-Pankow // Friedrich-Engels-Straße')) return 'Friedrich-Engels-Straße';
  return null;
}

async function insert(table, data) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`INSERT ${table} failed: ${errText}`);
  }
  return res.json();
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('=== Batch Import: Campaign Data ===\n');

  // 1. Parse all CSVs
  const mainCSV = parseCSV(fs.readFileSync(path.join(__dirname, 'import-batch-main.csv'), 'utf-8'));
  const ifOelkersCSV = parseCSV(fs.readFileSync(path.join(__dirname, 'import-if-oelkersallee.csv'), 'utf-8'));
  const ifOsterCSV = parseCSV(fs.readFileSync(path.join(__dirname, 'import-if-osterstrasse.csv'), 'utf-8'));

  console.log(`Parsed: main=${mainCSV.length} rows, if-oelkersallee=${ifOelkersCSV.length} rows, if-osterstrasse=${ifOsterCSV.length} rows`);

  // 2. Categorize rows by property
  // For main CSV, use ad set name to identify property
  // For IF CSVs, all rows go to Oelkersallee / Osterstraße respectively
  const propertyRows = {
    'Norder Wung': [],
    'Apartmentanlage in Westerland': [],
    'Oelkersallee': [],
    'Osterstraße': [],
    'Friedrich-Engels-Straße': []
  };

  // Also handle the IF ad set rows from main CSV that belong to Oelkersallee/Osterstraße
  // The IF ad set "IF // Hamburg (+ 19km)..." appears in both main CSV and the IF CSV files
  // According to task: main CSV rows with "NEUBAUTEAM // Oelkersallee" go to Oelkersallee
  //                    main CSV rows with "NEUBAUTEAM // Osterstraße" go to Osterstraße
  //                    ALL rows from if-oelkersallee.csv go to Oelkersallee
  //                    ALL rows from if-osterstrasse.csv go to Osterstraße

  for (const row of mainCSV) {
    const prop = identifyProperty(row['Ad set name']);
    if (prop) {
      propertyRows[prop].push(row);
    }
    // IF ad set rows in main CSV are NOT assigned to any property here
    // (they appear in the separate IF files for the respective properties)
  }

  // Add ALL IF CSV rows to their respective properties
  for (const row of ifOelkersCSV) {
    propertyRows['Oelkersallee'].push(row);
  }
  for (const row of ifOsterCSV) {
    propertyRows['Osterstraße'].push(row);
  }

  console.log('\nRows per property:');
  for (const [prop, rows] of Object.entries(propertyRows)) {
    console.log(`  ${prop}: ${rows.length} rows`);
  }

  // 3. Create clients
  console.log('\n--- Creating Clients ---');

  const [andresen] = await insert('clients', { name: 'Andresen & Co. Immobilien', brand: 'Andresen & Co.' });
  console.log(`Created client: Andresen & Co. Immobilien (${andresen.id})`);

  const [neubauteam] = await insert('clients', { name: 'NEUBAUTEAM', brand: 'NEUBAUTEAM' });
  console.log(`Created client: NEUBAUTEAM (${neubauteam.id})`);

  const VON_POLL_ID = '8350f69a-612c-4509-9343-b5dd45e626b7';
  console.log(`Using existing client: VON POLL (${VON_POLL_ID})`);

  // 4. Create properties
  console.log('\n--- Creating Properties ---');

  const propertyConfigs = [
    { name: 'Norder Wung', client_id: andresen.id },
    { name: 'Apartmentanlage in Westerland', client_id: andresen.id },
    { name: 'Oelkersallee', client_id: neubauteam.id, city: 'Hamburg' },
    { name: 'Osterstraße', client_id: neubauteam.id, city: 'Hamburg' },
    { name: 'Friedrich-Engels-Straße', client_id: VON_POLL_ID, city: 'Berlin', stadtteil: 'Pankow' }
  ];

  const properties = {};
  for (const cfg of propertyConfigs) {
    const [prop] = await insert('properties', cfg);
    properties[cfg.name] = prop;
    console.log(`Created property: ${cfg.name} (${prop.id})`);
  }

  // 5. Create campaigns
  console.log('\n--- Creating Campaigns ---');

  const campaigns = {};
  for (const propName of Object.keys(propertyRows)) {
    const rows = propertyRows[propName];
    if (rows.length === 0) continue;

    // Derive start_date and end_date from data
    const dates = rows.map(r => r['Day']).filter(d => d).sort();
    const start_date = dates[0];
    const end_date = dates[dates.length - 1];

    const activeCampaigns = ['Apartmentanlage in Westerland', 'Friedrich-Engels-Straße'];
    const campaignData = {
      property_id: properties[propName].id,
      platform: 'meta',
      campaign_name: `${propName} – Lead-Kampagne`,
      campaign_type: 'lead_generation',
      start_date,
      end_date,
      status: activeCampaigns.includes(propName) ? 'active' : 'completed'
    };

    const [campaign] = await insert('campaigns', campaignData);
    campaigns[propName] = campaign;
    console.log(`Created campaign: ${propName} (${campaign.id}) [${start_date} → ${end_date}]`);
  }

  // 6. For each property, aggregate daily metrics per creative and create creatives
  console.log('\n--- Creating Creatives & Daily Metrics ---');

  const summaryData = {};

  for (const propName of Object.keys(propertyRows)) {
    const rows = propertyRows[propName];
    if (rows.length === 0) continue;

    // Group by creative name + day, summing metrics
    // Key: "creativeName|day"
    const creativeMap = {}; // creativeName -> { days: { day: { spend, impressions, reach, leads } } }

    for (const row of rows) {
      const creativeName = extractCreativeName(row['Ad name']);
      const day = row['Day'];
      const spend = num(row['Amount spent (EUR)']);
      const impressions = intNum(row['Impressions']);
      const reach = intNum(row['Reach']);
      const leads = intNum(row['Results']);

      if (!creativeMap[creativeName]) {
        creativeMap[creativeName] = { days: {} };
      }
      if (!creativeMap[creativeName].days[day]) {
        creativeMap[creativeName].days[day] = { spend: 0, impressions: 0, reach: 0, leads: 0 };
      }

      const d = creativeMap[creativeName].days[day];
      d.spend += spend;
      d.impressions += impressions;
      d.reach += reach;
      d.leads += leads;
    }

    // Create creatives and their daily metrics
    let totalSpend = 0;
    let totalLeads = 0;
    let totalImpressions = 0;

    for (const [creativeName, data] of Object.entries(creativeMap)) {
      const creativeType = inferCreativeType(creativeName);
      const creativeData = {
        campaign_id: campaigns[propName].id,
        creative_name: creativeName,
        creative_type: creativeType
      };

      const [creative] = await insert('creatives', creativeData);

      // Insert daily metrics in batches
      const dailyMetrics = [];
      for (const [day, metrics] of Object.entries(data.days)) {
        dailyMetrics.push({
          creative_id: creative.id,
          date: day,
          spend: Math.round(metrics.spend * 100) / 100,
          impressions: metrics.impressions,
          reach: metrics.reach,
          leads: metrics.leads
        });
        totalSpend += metrics.spend;
        totalLeads += metrics.leads;
        totalImpressions += metrics.impressions;
      }

      // Insert in chunks of 50
      for (let i = 0; i < dailyMetrics.length; i += 50) {
        const chunk = dailyMetrics.slice(i, i + 50);
        await insert('creative_daily_metrics', chunk);
      }

      console.log(`  ${propName} / ${creativeName}: ${dailyMetrics.length} days`);
    }

    summaryData[propName] = {
      spend: Math.round(totalSpend * 100) / 100,
      leads: totalLeads,
      impressions: totalImpressions,
      cpl: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : null,
      creatives: Object.keys(creativeMap).length
    };
  }

  // 7. Create campaign_daily_metrics by aggregating all creatives per day
  console.log('\n--- Creating Campaign Daily Metrics ---');

  for (const propName of Object.keys(propertyRows)) {
    const rows = propertyRows[propName];
    if (rows.length === 0) continue;

    // Aggregate all rows per day (already raw, need to sum across ad sets)
    const dayMap = {}; // day -> { spend, impressions, reach, leads }

    for (const row of rows) {
      const day = row['Day'];
      const spend = num(row['Amount spent (EUR)']);
      const impressions = intNum(row['Impressions']);
      const reach = intNum(row['Reach']);
      const leads = intNum(row['Results']);

      if (!dayMap[day]) {
        dayMap[day] = { spend: 0, impressions: 0, reach: 0, leads: 0 };
      }
      dayMap[day].spend += spend;
      dayMap[day].impressions += impressions;
      dayMap[day].reach += reach;
      dayMap[day].leads += leads;
    }

    const campaignMetrics = [];
    for (const [day, metrics] of Object.entries(dayMap)) {
      campaignMetrics.push({
        campaign_id: campaigns[propName].id,
        date: day,
        spend: Math.round(metrics.spend * 100) / 100,
        impressions: metrics.impressions,
        reach: metrics.reach,
        leads: metrics.leads
      });
    }

    // Insert in chunks of 50
    for (let i = 0; i < campaignMetrics.length; i += 50) {
      const chunk = campaignMetrics.slice(i, i + 50);
      await insert('campaign_daily_metrics', chunk);
    }

    console.log(`  ${propName}: ${campaignMetrics.length} days`);
  }

  // 8. Print Summary
  console.log('\n=== IMPORT SUMMARY ===\n');
  console.log('Property                        | Spend     | Leads | CPL');
  console.log('--------------------------------|-----------|-------|--------');
  for (const [prop, data] of Object.entries(summaryData)) {
    const propPad = prop.padEnd(32);
    const spendPad = `€${data.spend.toFixed(2)}`.padStart(9);
    const leadsPad = String(data.leads).padStart(5);
    const cplPad = data.cpl ? `€${data.cpl.toFixed(2)}`.padStart(8) : '     N/A';
    console.log(`${propPad}|${spendPad} |${leadsPad} |${cplPad}`);
  }
  console.log('\nDone!');
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
