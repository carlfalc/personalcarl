## Auto-pipeline to mymanager inbox (no recipient picking)

Right now `/messages` makes you create a thread with a slug + display name + staff UUID before you can send anything. You want the default behaviour to be: open Messages → type → send → it lands in the mymanager inbox. No picker, no setup.

## Changes on THIS project (personal-carl)

1. **Bake the inbox UUID into an env var**
   Add `VITE_MYMANAGER_INBOX_USER_ID = bd865b76-8dd2-4067-b76d-9eefb05f7eb4` so we never have to type it again.

2. **Auto-provision a default thread**
   On `/messages` load, if no thread exists for slug `mymanager`, silently call the existing `upsertThread` server fn with:
   - `slug: "mymanager"`
   - `title: "mymanager.co.nz"`
   - `staffUserId: <env var above>`

   Then auto-select it. You never see a prompt.

3. **Simplify the UI**
   - Remove the "New" button and the three `window.prompt` dialogs — they're the source of the friction.
   - Keep the thread list visible (it'll just show the one `mymanager.co.nz` row for now) so we can add more pipelines later without another rebuild.
   - Header on the right pane shows "mymanager.co.nz — Shared inbox".

4. **Keep the safety net**
   If the env var is missing (e.g. someone forks the project), fall back to a small banner saying "Inbox not configured" rather than crashing — no prompts.

No schema changes, no new server fns, no migrations. Purely a UI + one-line env change.

## Prompt to paste into the mymanager.co.nz project

> On the mymanager side, mirror the same "no recipient picking" behaviour:
>
> - Add env var `VITE_PERSONALCARL_OWNER_USER_ID` = **[Carl's own user ID from personalcarl — I'll fetch it and give it to you next]**.
> - On the Inbox route, after signing in as `inbox@mymanager.co.nz`, auto-provision (via `upsertThread`) a single default thread with slug `mymanager`, title `Carl (personalcarl)`, and `ownerUserId` set to the env var above. `staffUserId` is the currently signed-in inbox user (`auth.uid()`).
> - Auto-select that thread on load. Hide any "new thread" UI.
> - Composer sends straight into it — no recipient picker.
>
> Net effect: Carl types on his side → shows up in your inbox instantly, and vice versa, with zero setup steps for either user.

## What I'll need from you after approval

Your own user ID on personalcarl (so I can hand it to Carl for the env var above). I can pull it for you — it's the `id` on your `profiles` row. Just say "go" and I'll fetch it in the same turn I make the changes.
