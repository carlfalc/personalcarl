## Goal

Fill the empty space below the Weather tile with a compact **Quick Stats** tile showing your task and meeting counts. Layout: 1 hero stat + 3 small.

## What it shows

- **Hero (big number)**: Open tasks **today** (open = not done/deleted, due today or overdue with no due date showing as today's open list — same logic the current "Today's Tasks" list uses)
- **Small tiles (3 across)**:
  - **Done today** — tasks completed today
  - **Overdue** — tasks past due, still open
  - **Meetings today** with sub-label "X this week"

Each small tile: number on top, label underneath, soft warm card background matching the existing Weather/Grocery cards. Hero uses a larger numeral and the orange accent color already used elsewhere (e.g. ideas lightbulb).

## Where it lives

Inside the **weather slot** of the dashboard grid — the Weather panel and the new Stats panel are stacked in the same sortable cell. That way:
- It sits directly in the gap shown in your screenshot
- It moves with Weather when you drag-reorder tiles
- It doesn't push Grocery/Meetings around

No new sidebar item, no new route.

## Data source

Reuses the `entries` and `meetings` queries already loaded on the dashboard (`today-entries`, `today-meetings`) — no extra network calls, no new server functions, no schema changes. Counts derived client-side with the same filters used by the existing task/meeting lists.

## Technical notes

- New small component `QuickStats` inside `src/routes/index.tsx` (or split to `src/components/QuickStats.tsx` if it grows).
- Wrap the existing Weather `<Panel>` in a `<div className="space-y-5">` containing Weather + `<QuickStats />`, and assign that wrapper to `tiles.weather` so DnD ordering still works.
- Styling uses existing Tailwind tokens (warm card, muted-foreground for labels, orange-accent for the hero number) — no new design tokens.
- No changes to backend, RLS, routes, or other tiles.

## Out of scope

- Email/diary stats (can add later if useful)
- Click-through filters (numbers are display-only for v1)
- Mobile-specific layout tweaks (existing responsive grid already handles it)
