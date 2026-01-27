# Campaign Dashboard — Run & Gun

Data-driven Reporting-Tool für Immobilien-Kampagnen.

## Setup

### 1. Database Schema erstellen

Öffne den [Supabase SQL Editor](https://supabase.com/dashboard/project/lvhxabadywdqeepymwdm/sql) und führe den Inhalt von `migration.sql` aus.

Das erstellt:
- `clients` — Kunden
- `properties` — Objekte mit Korrelationsdaten
- `campaigns` — Kampagnen
- `campaign_daily_metrics` — Tageswerte
- `creatives` — Anzeigenmotive
- `creative_daily_metrics` — Creative-Tageswerte

### 2. Seed Data laden

Nach der Migration:

```bash
cd dashboard
node setup-seed.js
```

Das importiert die Falkensteiner Ufer Kampagne (Von Järten & Cie) mit allen 29 Tageswerten und 7 Creatives.

### 3. Dashboard öffnen

Einfach `index.html` im Browser öffnen, oder:

```bash
npx serve dashboard/
```

## Dateien

| Datei | Beschreibung |
|-------|-------------|
| `index.html` | Dashboard (Single HTML, kein Build nötig) |
| `migration.sql` | Database Schema |
| `seed.sql` | Seed Data (SQL Version) |
| `setup-seed.js` | Seed Data (Node.js via REST API) |

## Tech Stack

- **Backend:** Supabase (PostgreSQL + REST API)
- **Frontend:** Vanilla HTML/CSS/JS
- **Charts:** Chart.js 4.x
- **Font:** Inter (Google Fonts)
- **Design:** Dark theme, responsive
