## Goal
Give you a self-contained HTML block of your current Tasks that you can copy-paste anywhere (email, Notion, docs). Delivered **inline in chat** as a code block, plus saved as a downloadable file.

## What it includes
- All **active tasks** from `entries` where `type='task'` and `status ∈ (todo, doing)` — currently 3 tasks (excludes 1 deleted).
- For each task: title, optional notes, priority pill (P1/P2/P3 with red/blue/grey), status pill (todo/doing), due date if set, created date.
- Grouped by priority (P1 → P3), then newest first inside each group.
- Inline CSS matching the app's palette (green `#0d3a2c` / gold `#C9A961` accents used across Roster + shadcn slate tokens).
- Single `<div>` wrapper with all styles inside a `<style>` tag — no external assets, safe to paste into any HTML surface.

## Not included (say the word to add)
- Completed task history (the diary "completed/task" entries).
- Deleted tasks.
- Tags array (empty for all current tasks).

## Technical approach
1. `psql` SELECT the 3 active tasks with content/priority/status/due_date/created_at.
2. Generate the HTML with a small Python script, split title/notes on first newline (mirrors `splitTask` in `src/routes/tasks.tsx`).
3. Write to `/mnt/documents/tasks.html` as an artifact AND print the full HTML inline in the chat reply for copy-paste.
