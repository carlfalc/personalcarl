# Voice-to-Draft Email Plan

## Overview

Add a multi-user authentication system and a dedicated **Email** page where you (and other signed-in users) can record voice, get it transcribed by AI, refine into a polished email draft, and save it directly to your own Gmail Drafts folder.

Each user connects their own Google account, so drafts always land in the right inbox.

## What you'll see

1. A new **Login / Sign up** landing page (email + password, plus Google sign-in for one-click access).
2. After signing in, the existing Personal OS appears — now personalised per user.
3. A new **Email** item in the sidebar opens a page with:
   - A "Connect Gmail" button (only shown until you've connected).
   - A big mic button to record your message.
   - Live transcription as you speak.
   - A "Polish with AI" step that turns rambling speech into a proper email (subject + body + recipient).
   - "Save to Gmail Drafts" button — opens in your Gmail Drafts folder, ready to review/send.
   - A list of recently created drafts for reference.

## Do you need to set up the Google Console?

**No.** Lovable's connector system handles the Google OAuth credentials behind the scenes. Each user just clicks "Connect Gmail" and authorises access in a popup — no API keys, no Cloud Console, no developer setup on your end.

## Technical breakdown

**Authentication**
- Enable Supabase email/password auth + Google sign-in (Lovable-managed, no setup).
- Add `/login` and `/signup` routes; wrap protected pages in an `_authenticated` layout that redirects unauthenticated users.
- Add a `profiles` table keyed to `auth.users` (display name, avatar, plus a `gmail_connection_id` column to remember each user's Gmail link).
- The existing `useUserName` hook gets backed by the profile row instead of localStorage (still defaults to "Carl" for you).

**Per-user Gmail connection**
- Use Lovable's **App User Connector** flow for `google_mail`:
  - Server function `startGmailConnect` → returns an authorisation URL (popup mode).
  - Client helper opens the Google consent popup.
  - On success, a server function persists the returned `connection_id` to `profiles.gmail_connection_id`.
- Requests `gmail.compose` scope (sufficient for creating drafts).

**Voice → AI → Draft pipeline**
- Frontend records audio via `MediaRecorder`.
- Server function `transcribeAudio` → sends the audio to Lovable AI Gateway (Whisper-compatible model) and returns the transcript.
- Server function `polishToEmail` → uses Lovable AI (Gemini Flash) with a structured prompt to extract `{ to, subject, body }` from the transcript.
- Server function `createGmailDraft` → uses `callAsAppUser` against `google_mail` gateway path `/gmail/v1/users/me/drafts` with the user's `connection_id` to create the draft. RFC 2822 message is base64url-encoded.
- A `drafts_log` table records each created draft (id, subject, recipient, created_at) so the Email page can show history.

**Files added/changed**
- `src/routes/login.tsx`, `src/routes/signup.tsx`, `src/routes/_authenticated.tsx` (layout guard)
- Move existing pages under `_authenticated` so they require login
- `src/routes/_authenticated/email.tsx` (the new Email page)
- `src/integrations/lovable/appUserConnector.ts` + `appUserConnectorClient.ts` (Lovable helpers)
- `src/lib/email.functions.ts` (server functions: connect, transcribe, polish, draft)
- `src/components/AppSidebar.tsx` — add "Email" item with `Mail` icon
- `src/hooks/useUserName.ts` — read/write from `profiles` instead of localStorage
- Migration: `profiles` table + `drafts_log` table with RLS

## Out of scope

- Sending emails directly (drafts only — you review/send from Gmail).
- Reading inbox / replying to threads.
- Calendar and Drive integration (you mentioned them — happy to add as a follow-up; this plan keeps Gmail isolated so it ships clean).

Ready to build when you approve.
