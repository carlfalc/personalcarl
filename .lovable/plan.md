# Messenger — Carl ↔ mymanager.co.nz

A Facebook-Messenger-style inbox shared between this project (Carl) and your other Lovable project (mymanager.co.nz). Both apps read/write the same threads, so anything you send from Carl pops up in his inbox in real time — with text, image and file attachments, read receipts, delete, and full history.

## How the two projects share one inbox

Both apps talk to the **same Lovable Cloud backend** (this project's). The other project keeps its own UI and users, but points its Supabase client at Carl's Cloud URL + publishable key. That's what makes the inbox shared — no webhooks, no polling, no second database to sync.

Since you don't need per-user identity on the other end ("it's just an inbox that pops up like Messenger"), each app authenticates with a single **shared account** that owns that side of every thread — one for you (owner), one for the mymanager side (staff inbox). Messages route by a `thread_id` you pick per employee (e.g. `jamison`), not by user id. Clean, no auth wiring in the other project beyond signing into that shared inbox account once.

## What gets built in this project (Carl)

### Inbox route `/messages`
- Left column: thread list with employee name, last message preview, unread count, last-active time.
- Right column: message stream (newest at bottom), Messenger-style bubbles, own messages right-aligned.
- Composer: multiline text, attach button (image or file), send on ⌘/Ctrl+Enter.
- Per-message: sender label, timestamp, "Seen ✓✓ 2:14pm" when the other side opens the thread, hover delete (soft delete — hidden for both sides, kept in DB for history/audit).
- Realtime: new messages, read receipts, and deletes appear instantly via Supabase Realtime.
- Sidebar badge: unread total next to the "Messages" nav item.
- History: infinite scroll upward, grouped by day.

### Data model (one migration)
- `message_threads` — `id`, `slug` (e.g. `jamison`), `title`, `owner_user_id`, `staff_user_id`, timestamps.
- `messages` — `id`, `thread_id`, `sender_user_id`, `body`, `attachments jsonb` (array of `{path, name, mime, size}`), `read_at`, `deleted_at`, `created_at`.
- `message_reads` — `thread_id`, `user_id`, `last_read_at` (drives unread counts and ✓✓).
- Realtime enabled on `messages` and `message_reads`.
- Storage bucket `message-attachments` (private, signed URLs on read).
- RLS: only the thread's `owner_user_id` and `staff_user_id` can read/write; storage policies mirror this.

### Server functions (`src/lib/messages.functions.ts`)
- `listThreads`, `getThread(slug)`, `listMessages(threadId, before?)`, `sendMessage(threadId, body, attachments)`, `markRead(threadId)`, `deleteMessage(id)`, `uploadAttachment` (signed upload URL). All use `requireSupabaseAuth`.

### UI files
- `src/routes/messages.tsx` — inbox route (thread list + stream + composer).
- `src/components/messages/ThreadList.tsx`, `MessageStream.tsx`, `MessageBubble.tsx`, `Composer.tsx`, `AttachmentPreview.tsx`.
- Sidebar: add "Messages" item with realtime unread badge.

## What you copy into mymanager.co.nz

A single drop-in folder — I'll place it at `/mnt/documents/messenger-portable/` and also keep an in-project copy so cross-project mention (`@personal-carl` from that project) can read it. Contents:

- `README.md` — 4-step wiring guide (env vars, sign in as staff inbox account, drop route in, add sidebar link).
- `env.example` — the 3 env vars to add (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) — all pointing at Carl's Cloud.
- `sql/schema.sql` — same migration (idempotent, safe to skip if you use `@personal-carl` remixing later).
- `lib/messages.functions.ts` — identical server functions.
- `routes/inbox.tsx` — same UI, relabeled "Inbox" (no thread list needed — one shared staff account sees all threads addressed to it).
- `components/messages/*` — same 5 components.
- `PROMPT.md` — a one-shot LLM prompt version so you can also regenerate the UI in any tool from context alone.

That folder is what makes the two projects **integrated and compatible** — same schema, same RPCs, same components. Anything you change on Carl's side, you copy the changed file across.

## Scope of v1
Text • image and file attachments (≤20 MB) • read receipts (✓✓ + timestamp) • delete for both sides • full searchable history per thread • realtime delivery • unread badge • folder-style keep/archive on each thread.

## Out of scope for v1 (say the word to add)
Voice notes • typing indicators • push/email notification when the other side is offline • group threads • message editing • end-to-end encryption.

## Technical notes (for the record)
- Both projects run against this Cloud instance's `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`. RLS + `requireSupabaseAuth` gate everything — the publishable key is safe to ship in the other project's client bundle.
- Realtime: `supabase.channel(thread:<id>).on('postgres_changes', ...)` in `useEffect`, torn down on unmount (per project realtime rules).
- Attachments: client requests a signed upload URL from the server fn, uploads directly to Storage, then sends the message with the object path. Read side generates short-lived signed download URLs.
- "Delete" is soft (`deleted_at`) so audit history is preserved; UI renders "Message deleted" in place.
- Unread count = `messages` newer than the viewer's `message_reads.last_read_at` for that thread.
