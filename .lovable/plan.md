# Merge Settings & About Me → single "Settings / About Me" page

## Route & navigation
- Create new route `src/routes/settings.tsx` (replacing current) at `/settings`, titled **"Settings / About Me"**.
- Delete `src/routes/about.tsx`; add a redirect from `/about` → `/settings` so old links still work.
- Sidebar: remove the separate "About Me" entry; keep a single "Settings / About Me" item (using the existing Settings icon).

## Page layout (top → bottom)

**1. Profile card** (always open at top)
- Avatar upload (existing behaviour, kept as-is).
- Editable **Name** (inline pencil, saved to `profiles.display_name`).
- **Date of birth** (date input, saved to `profiles.date_of_birth`).
- **Country** dropdown (searchable, all 195 countries from a bundled list).
- **City** dropdown that populates based on selected country.
  - Approach: use the `country-state-city` npm package (~2MB, bundled) so we get all countries + cities offline with no API key. Cities load only for the picked country, so runtime cost is small.
- Optional contact fields: email (read-only from auth), phone.
- Save button persists all profile fields at once.

**2. Important people** (collapsible, open by default)
- Contact list of family / close friends: name, relationship, birthday, phone, email.
- Reuses the existing `memory` table entries where `category = 'family'` (already stores name, relationship, contact_email, contact_phone, birth_date).
- Add / edit / delete rows inline; keeps the existing FamilyDialog behaviour, just inline on the page instead of a separate About tab.
- The other About-Me categories (interests, projects, preferences, business, technology, travel) move into a secondary collapsible "About me notes" section further down — kept, not lost.

**3. Birthdays** (collapsible, above cron settings)
- Existing birthdays table UI moved here, wrapped in an accordion so it can be opened/closed.
- Add / edit / delete birthdays unchanged.

**4. Telegram** (collapsible)
- Chat ID + save button, unchanged.

**5. Scheduled briefings** (each in its own collapsible sub-section within Telegram or as siblings — I'll keep them as siblings for clarity):
- Morning briefing, Evening nudge, Weekly review, Grocery send, Daily diary summary — each is its own collapsible card, all closed by default except any that are enabled.

## Database
One migration adds two nullable columns to `profiles`:
- `date_of_birth date`
- `country text`
- `city text`
- `phone text`

No RLS changes (existing profile policies already cover the owner).

## Technical details
- Use `<Accordion>` from shadcn (`@/components/ui/accordion`) for all collapsible sections — single component, consistent look, open/close state remembered per session via `defaultValue`.
- Country/city data: install `country-state-city` and lazy-load city list on country change.
- Keep the existing avatar upload, birthday CRUD, and Telegram/cron save mutations as-is — just re-arranged in the new layout.
- Update `AppSidebar.tsx`: remove the About entry, rename Settings item to "Settings / About Me".
- Regenerate route tree implicitly via Vite plugin.

## Out of scope
- No changes to how the assistant reads memory (still queries `memory` table).
- No changes to birthday notifications or Telegram flows.
- No changes to the auth email field editability.

After you approve, I'll implement in one pass and you can review.
