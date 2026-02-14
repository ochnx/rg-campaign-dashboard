# PDF Export Fixes — URGENT

Edit ONLY `index.html`. Do NOT change Supabase URLs/keys. Keep all existing functionality.

## Fix 1: Section Order in PDF
In `exportPDF()` function, the current order is:
1. KPI Cards
2. Trend Chart ("Wöchentlicher Verlauf")
3. Performance Insights
4. Creative Performance
5. Campaign Table ("Kampagnen-Übersicht")

**CORRECT order must be (matching the website):**
1. KPI Cards
2. Trend Chart ("Wöchentlicher Verlauf")
3. Campaign Table ("Kampagnen-Übersicht") — MOVE THIS UP
4. Performance Insights — MOVE THIS DOWN
5. Creative Performance — KEEP LAST

Just reorder the sections (cut/paste the code blocks).

## Fix 2: Section Title Spacing
The section titles ("Creative Performance", "Kampagnen-Übersicht") overlap with the table below them.
After each `pdfDrawSectionTitle()` call, there needs to be MORE vertical space before the table starts.
Currently `y += 5` after section titles — change to `y += 8` for ALL section titles in both PDF functions.

## Fix 3: Chart Labels MUCH Bigger
In `pdfChartConfig()` function, the chart is rendered at 1400x560 but the font sizes are still too small.
Change ALL font sizes in pdfChartConfig:
- X-axis ticks: size 15 → **size 28**
- Y-axis ticks: size 15 → **size 28**  
- Y1-axis ticks: size 15 → **size 28**
- Legend labels: size 16 → **size 28**

Also in the detail chart (`renderDetailChart`), keep sizes at 11 (those are for screen display, not PDF).

## After fixing:
```bash
git add client/index.html
git commit -m "fix(client): PDF section order, title spacing, chart label sizes"
git push origin main
openclaw gateway wake --text "PDF fixes done: section order, spacing, chart labels" --mode now
```
