## Goal
Make arranging a meeting feel effortless: type-to-add attendees with validation and recent-contact suggestions, then show who accepted/declined right on the meeting card. Invites continue to come from your connected Google Calendar account (`sendUpdates=all` is already on, so Gmail/Outlook/Apple recipients all get a normal accept/decline invite).

## What changes

### 1. Better attendee UX (in `src/routes/meetings.tsx` create/edit dialog)
- Replace the current email field with a chip-style input:
  - Type an email + Enter / comma / blur → adds a chip
  - Zod-validated; invalid entries shake + show inline error, never silently dropped
  - Backspace removes the last chip; click × on a chip to remove
  - Paste a comma/space/newline-separated list → splits into chips
- Recent-contact suggestions dropdown:
  - As you type, query distinct attendee emails from your own past `meetings` rows (already in your DB) — fast, no extra API call
  - Optional fallback to Gmail "Sent" lookup (the existing `lookupRecipient` server fn in `src/lib/email.functions.ts`) when nothing matches locally
  - Arrow keys + Enter to pick

### 2. RSVP status on the meeting card
- New server fn `getEventRsvps({ eventId })` in `src/lib/meetings.functions.ts`:
  - GETs `/calendars/primary/events/{eventId}` via the existing connector gateway
  - Returns `[{ email, displayName, responseStatus }]` from the event's `attendees`
- New column `google_event_id` on `meetings` (nullable text) so we know which Google event to ask about. The existing `createCalendarEvent` already returns `eventId` — wire that into the insert.
- On each upcoming meeting card, show small status badges per attendee:
  - ✓ accepted (green), ✗ declined (red), ? tentative (amber), … needsAction (muted)
- Fetched via `useQuery` per meeting (enabled only when `google_event_id` exists), cached 60s, refetch on window focus and via a manual refresh button.

### 3. Tiny safety polish
- Disable the "Create" button while `createEvent` is pending so double-clicks can't create duplicate calendar events.
- Toast on success: "Invite sent to N attendee(s)".

## Technical notes
- DB: one migration to add `meetings.google_event_id text` (nullable, no backfill needed) plus standard GRANTs already in place.
- No new secrets, no new connector — uses the already-linked Google Calendar connector and existing Gmail connector for the optional sent-folder lookup.
- No changes to the calendar create path itself beyond storing the returned `eventId`; invites already go out because `sendUpdates=all` is set.

## Out of scope (say the word and I'll add)
- Reminders / Google Meet link on the invite
- Per-user OAuth (each app user signing in with their own Google account)
- Editing attendee list after creation re-sending invites
