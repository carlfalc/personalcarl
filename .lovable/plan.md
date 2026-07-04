## Goal
Make Telegram voice/text → Gmail drafts a single step: always draft immediately, always send a Telegram confirmation, always push the draft into the `/email` page. When no recipient is found, still create the draft and mark it "needs recipient — add manually" on the Email page. Also make sure typed triggers like "draft email" / "email draft" on Telegram start the same flow.

## Changes

### 1. `supabase/functions/telegram-webhook/index.ts` — one-shot email flow
- Extend `SYSTEM_PROMPT.email_intents` to also carry `recipient_email` (if an @ address was dictated) and `content` (the full ask), not just `recipient_query`.
- Detect typed triggers alongside Claude: a regex for `draft (an )?email|email draft|compose (an )?email|write (an )?email` short-circuits into the drafting path even when Claude's parse is weak.
- Replace the current two-step `awaiting_recipient` → `awaiting_content` flow (via `pending_email_intents`) with a single step:
  1. Resolve recipient: explicit email in the message → top Gmail Sent-folder match → none.
  2. `composeEmail(fullTranscript)` → `{ subject, body }`.
  3. Call `createGmailDraft` (existing helper). If no recipient, build the RFC 2822 message **without a `To:` header** so Gmail stores it as a draft with no recipient.
  4. Insert into `drafts_log` (owner_id, gmail_draft_id, recipient nullable, subject, body_preview).
  5. Always `sendTelegram(...)` a confirmation:
     - With recipient: "✅ Draft ready for Name <email>. Subject: X — open the Email page or Gmail Drafts to review."
     - Without recipient: "✅ Draft written but I couldn't find an email address. Open the Email page to add the recipient and save."
- Wrap the compose+draft in try/catch that always emits a Telegram failure message so the user is never left in silence.
- Keep the old `pending_email_intents` code paths as no-op fallbacks (don't insert new pending rows going forward).

### 2. `src/routes/email.tsx` — surface "needs recipient" drafts
- In the "Completed drafts" sidebar, show an amber "Needs recipient" badge on any item whose `recipient` is null.
- Clicking such a draft loads it into compose (already works) with the `To` field empty and focused, and shows an inline amber hint under the To field: "Add a recipient before saving to Gmail Drafts."
- Add a light 15s refetch on the drafts list so Telegram-created drafts appear without manual reload.
- Small copy tweak on the mic/polish flow: after "Polish into email" toast, add hint text under Body: "Ready to review — edit and Save to Gmail Drafts."

## Out of scope
- No DB schema changes (`drafts_log.recipient` is already nullable).
- No Gmail attachments from Telegram, no editing the Gmail draft in place after Telegram creates it (Email page save creates a fresh draft, unchanged).
- Multi-candidate recipient picker on Telegram (one-shot uses only the top match).
