## Goal

When you send a photo to the Telegram bot, it gets saved into Lovable Cloud and shows up on a new **Images** page in the sidebar. From that page you can delete each image, share it, print it, save it as PDF, and attach it to a draft on the Email compose page.

## What gets built

### 1. Storage + database

- **New storage bucket** `telegram-images` (private). Images are served via short-lived signed URLs.
- **New table** `public.images` with the user-facing fields: `storage_path`, `caption`, `width`, `height`, `mime_type`, `size_bytes`, `source` (defaults to `'telegram'`), `telegram_message_id`. RLS scoped to `auth.uid()`; service role grant so the Telegram webhook can insert.

### 2. Telegram webhook update (`supabase/functions/telegram-webhook/index.ts`)

- Detect `message.photo[]` (and `message.document` when it's an image mime type).
- Pick the largest photo size, download via the existing `getFile` + `https://api.telegram.org/file/...` flow, upload to the `telegram-images` bucket under `{owner_id}/{uuid}.{ext}`, and insert a row into `public.images` (caption = `message.caption`).
- Reply on Telegram: `📸 Saved to Images.`
- Photos do not run through the voice/text classifier, so nothing else fires.

### 3. New Images page (`src/routes/images.tsx`)

- Route `/images`, added to the sidebar with an `ImageIcon` between existing menu items.
- Grid of thumbnails (signed URL, 1‑hour expiry, refreshed via React Query).
- Each tile shows caption + relative date, with an overlay action bar:
  - **X** delete (confirm, removes storage object + row)
  - **Share** (Web Share API with file; falls back to copying signed URL)
  - **Print** (opens print dialog with the image)
  - **Save as PDF** (renders image into a one-page PDF client-side via `jspdf` and triggers download)
  - **Attach to email** (see step 4)
- Click a tile to open a lightbox preview.
- Realtime: subscribes to `images` inserts so new Telegram photos appear instantly.

### 4. Attach to drafted email (`src/routes/email.tsx` + draft model)

- "Attach to email" on the Images page stashes the selected image id(s) in `sessionStorage` (`email-attachments`) and navigates to `/email`.
- Compose page reads them on mount, shows a small **Attachments** strip under the Body field with thumbnails and an X to remove individual attachments.
- `createGmailDraft` server fn (`src/lib/email.functions.ts`) extended to accept `attachmentIds: string[]`. The server fn loads each image from storage (admin client) and builds a proper multipart/related RFC 2822 message before saving via the Gmail Drafts API. The `drafts_log` row also records the attachment ids in `metadata`.
- Existing voice/polish flow is untouched; attachments are independent of body content.

## Out of scope

- Sharing directly to specific social networks (Instagram, X, etc.) — the Web Share API hands off to whichever apps the user has installed, which is the standard browser pattern.
- Editing/cropping images.
- Bulk select / multi-delete (single-image actions only for v1).

## Technical notes

- New npm dep: `jspdf` (client-side, for the Save-as-PDF action).
- Image MIME limited to `image/jpeg | image/png | image/webp | image/gif`; oversized (>15 MB) photos are rejected by the webhook with a Telegram reply.
- Signed URLs cached in React Query for 50 min (under the 60 min expiry).
- Gmail draft attachments use base64 encoding inside `multipart/related`; total raw size capped at ~25 MB to stay within Gmail's limit.
