## Goal
Generate a single self-contained HTML file of your current Glasshouse roster (staff + manager) using the exact styling used on the /roster page, and deliver it as a downloadable artifact.

## Approach
1. Query the live database (read-only) for:
   - `roster_staff` (all rows, both `staff` and `manager` roster types)
   - `roster_meta` (week start date / start day per roster type)
2. Reuse the existing `STYLE` block and `buildStaffHTML` layout from `src/routes/roster.tsx` so the exported file looks identical to the on-screen roster.
3. Produce **one HTML file** containing both rosters stacked:
   - Section 1: **Glasshouse — Roster** (staff), with "Pay week commencing …"
   - Section 2: **Glasshouse — Management Roster**, with its own week header
   - Ordered days follow each roster's `week_start_day`
   - Shifts show as `6am–10:30pm` style pills; days off show as `off`
   - Inline CSS only — no external assets, opens in any browser
4. Save to `/mnt/documents/glasshouse-roster.html` and present as a `<presentation-artifact>` for preview/download.

## Not included
- No hours/totals columns (matches the printable staff layout — cleaner for sharing). If you want totals included, say so and I'll add the totals + grand-total row.
- No edit controls, no snapshots panel — this is a static export of the current week.

## Technical notes
- Read via `supabase--read_query` (no writes, no schema changes).
- HTML is generated inline in a small script; no new project files are created unless you'd prefer a reusable "Export HTML" button added to the Roster page (say the word and I'll include it).
