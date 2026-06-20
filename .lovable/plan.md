# Roster Enhancements + Cloud Persistence

## New UI
- **"+ Add staff member" button** in the top toolbar (next to Manager/Staff view toggle). Opens a popup with a free-text name field → Save appends a new row that behaves exactly like existing rows (shifts, off, totals, 12pm/5pm counters).
- **Small "×" button** on each staff name tile. Click removes that person and all their shifts immediately (no confirmation, as requested).
- **"Save roster" button** in the toolbar. Snapshots the current roster (staff list + all shifts) into a saved-rosters log with a timestamp.
- **"Saved rosters" panel** below the grid: list of previously saved rosters showing the date/time saved, with a "Load" button to restore that snapshot into the live view.

## Cloud persistence (shared across all signed-in users)
Two new tables in Lovable Cloud:

1. `roster_staff` — the live shared staff list and shifts
   - `id`, `staff_name`, `day` (Mon–Sun), `is_off` (bool), `start_time`, `end_time`, `position` (for ordering staff), timestamps
   - Every add/edit/delete/off toggle writes immediately so the data is always saved and synced.
   - Realtime subscription so changes made by one user appear live for everyone.

2. `roster_snapshots` — the saved-roster history log
   - `id`, `saved_at`, `saved_by` (user id), `label` (optional), `data` (JSON snapshot of all staff + shifts), timestamp
   - Created when the user clicks "Save roster".

**Access:** Both tables are shared (any signed-in user can read/write/save). RLS enabled with policies allowing all `authenticated` users full access. Service role granted as usual.

**Initial seed:** The current in-memory roster (Jayda, Lauren, Abigail, Sarah, Izabella, Danielle, Savannah McDougall + their shifts) is inserted as the initial `roster_staff` rows in the migration, so the page looks identical on first load.

## Wiring
- Replace the in-memory `entries`/`STAFF` state in `src/routes/roster.tsx` with a TanStack Query subscription to `roster_staff` (via `useRealtimeTable`).
- All mutations (add shift, edit shift, delete shift, toggle off, add staff, delete staff) become Supabase calls; UI updates via realtime.
- "Save roster" inserts a row into `roster_snapshots` with the current data as JSON.
- "Load" from a snapshot replaces current `roster_staff` rows with the snapshot's data.
- Staff-copy HTML download and the 12pm / 5pm count rows (already in place) keep working unchanged.

## Files touched
- New migration: create `roster_staff` + `roster_snapshots`, grants, RLS, seed initial data.
- `src/routes/roster.tsx`: swap in-memory state for Supabase-backed data + add Add/Delete staff UI + Save/Load snapshot panel.

## Notes
- Roster page lives under `/roster`. To keep it shared and require sign-in, it stays as-is (top-level route); reads/writes use the authenticated browser Supabase client, so unauthenticated visitors will see an empty grid until they sign in. If you'd rather force a redirect to /auth, say the word and I'll move it under `_authenticated/`.
