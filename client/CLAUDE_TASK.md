# Client Dashboard Fix Task

## File
Only edit: `index.html` (single-file app, ~2970 lines)

## Fixes Required

### 1. Change "Karussell" → "Carousel"
In the `CREATIVE_LABELS` object (around line 2938), change `'carousel': 'Karussell'` to `'carousel': 'Carousel'`.
"Carousel" is the official Instagram term — keep it English.

### 2. Fix PDF Export — German Umlauts
jsPDF's built-in Helvetica font CANNOT render German umlauts (ö, ä, ü, ß). They show as "oe", "ae", "ue", "ss".

**Fix all hardcoded strings in the PDF export functions:**
- `'Woechentlicher Verlauf'` → `'Wöchentlicher Verlauf'` (around line 2549)
- `'Kampagnen-Uebersicht'` → `'Kampagnen-Übersicht'` (around line 2637)
- In `collectBenchmarkInsights()` function (around line 2415-2430):
  - `'gehoert'` → `'gehört'`
  - `'ueber'` → `'über'`

**CRITICAL**: Since jsPDF's built-in Helvetica doesn't support umlauts, you MUST embed a custom font that does. The best approach:
1. Use a Base64-encoded font (e.g., Inter or Roboto) that supports full Latin charset including umlauts
2. OR: Use the `html2canvas` approach instead of jsPDF direct drawing for text sections
3. OR: At minimum, register a standard14 font with encoding that supports umlauts

**Simplest working approach**: After creating the jsPDF doc, add a font that supports umlauts. You can use:
```js
// Add the font before any text drawing
doc.addFont('helvetica', 'helvetica', 'normal'); // won't fix it
```

Actually, the simplest fix: **Use Unicode escape sequences** that jsPDF CAN render. BUT jsPDF built-in fonts genuinely cannot render ö/ü/ä. So the real fix is to embed a web font.

**Recommended approach**: Download Inter font as Base64 and register it:
```js
// At the top of exportPDF():
doc.addFileToVFS('Inter-Regular.ttf', INTER_REGULAR_BASE64);
doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
doc.addFileToVFS('Inter-Bold.ttf', INTER_BOLD_BASE64);
doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
doc.setFont('Inter');
```

Fetch the Inter font files from Google Fonts CDN, convert to Base64, and embed them. The font files are ~90KB each which is fine for a PDF export.

You can fetch the font at runtime:
```js
async function loadFontBase64(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
```

Then replace ALL `doc.setFont('helvetica', ...)` calls with `doc.setFont('Inter', ...)`.

### 3. Fix PDF Chart Quality
- The chart image is rendered at 700x280 pixels — too small for print
- Increase to at least **1400x560** (2x) for crisp PDF rendering
- Also increase font sizes in `pdfChartConfig()` for chart labels, axis ticks, and legend
- Find the `pdfChartConfig` function and increase all font sizes by ~50%

### 4. Fix PDF text sizes
- KPI card label font size is 7.5 — increase to at least 8.5
- KPI card value font size is 16 — this is fine
- Table font sizes (7 for headers, 8 for rows) — increase to 8 and 9
- Insight text is 8 — increase to 9
- Section titles are 11 — this is fine
- Footer text is 8 — this is fine

## Rules
- ONLY edit `index.html`
- Do NOT change any Supabase URLs/keys
- Do NOT change any business logic or data fetching
- Keep all existing functionality intact
- Test the PDF export mentally — make sure umlauts render correctly
- After finishing, commit with message 'fix(client): PDF export quality - umlauts, chart resolution, font sizes' and push to origin main

When completely finished, run this command to notify me:
openclaw gateway wake --text "Done: PDF export fixes - umlauts, chart quality, font sizes, Carousel label" --mode now
