# Client Dashboard Fix Task

## File
Only edit: `index.html` (single-file app, ~2970 lines)

## Current State
The dashboard loads correctly with token-based auth. 4 fixes were already applied (navbar sticky top, German creative labels, KW format, section reorder). These are LIVE and working.

## Remaining Issues to Fix

### 1. Navbar should be sticky (not scrolling away)
The navbar at the top (with "R&G", client name, "Report exportieren", "Abmelden") should stay fixed at the top when scrolling. Currently it scrolls out of view. Make it `position: sticky; top: 0; z-index: 1000;` with a white background and subtle bottom border/shadow.

### 2. Chart X-axis labels
The weekly chart shows "KW 6" and "KW 7" but only those two ticks. Make sure all weeks are shown if there's data, and the format is clean "KW X" (no year prefix).

### 3. Section spacing & visual hierarchy
- The sections (KPI Cards → Chart → Kampagnen → Insights → Creative) could use slightly more vertical spacing between them
- Section headers should have consistent styling

### 4. Token auto-login from URL
When the URL contains `?token=XXX`, auto-fill the token and log in immediately without showing the login screen. Check if this already works — if not, add it.

## Rules
- ONLY edit `index.html`
- Do NOT change any Supabase URLs/keys
- Do NOT change any business logic or data fetching
- Keep all existing functionality intact
- After finishing, commit with a clear message and push to origin/main

When completely finished, run this command to notify me:
openclaw gateway wake --text "Done: Client dashboard fixes applied — sticky navbar, chart labels, spacing, auto-login" --mode now
