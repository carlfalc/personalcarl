# Medical Page

New `/medical` route in the sidebar, backed by three new tables and one AI server function. Reuses the birthday-style dashboard notification pattern for GP checkup reminders.

## Page layout

1. **My details** (single card, edit dialog)
   - Doctor name, clinic name, clinic address, doctor phone, clinic phone, email, website
   - **Checkup frequency** dropdown: 1, 2, 3, 4, 6, 9, 10, 11, 12 months
   - Last visit date (so next-due can be calculated)

2. **Prescriptions** (list under "My details" with add/edit/delete)
   - Name, dosage amount, unit (mg, mcg, g, ml, tabs, capsules, puffs, drops, IU), frequency (once/twice/three times daily, weekly, as needed), notes

3. **Blood test analysis**
   - Intro paragraph explaining you can upload screenshots/PDFs of blood results and get an AI overview
   - Upload zone (images + PDFs, multi-file) + Send button
   - AI report renders with:
     - Header: user name + DOB from Settings profile, today's date/time
     - **Quick overview** — colored bullets: very bad / bad / neutral / good / very good
     - **Results table** — each marker with normal/abnormal label + up/down arrow (red down = low, green up = high or vice-versa per marker), reference range
     - **Suggested questions for your physician** — flagged concerns (e.g. liver markers)
     - **Disclaimer** — research/educational, not medical advice
   - Save button stores the report in a log; log renders as a collapsible history list below

## Dashboard reminder

- New notification kind `doctor_checkup` alongside birthdays / overdue tasks
- Computed from `last_visit_date + frequency_months`; when due, shows in the same dashboard notifications area
- Click → popup "Your regular doctor's checkup is due" with a button to jump to `/medical`

## Data model (new tables, all RLS-scoped to auth.uid)

- `medical_profile` (1 row per user): doctor + clinic fields, `checkup_frequency_months int`, `last_visit_date date`
- `medical_prescriptions`: name, dosage_amount numeric, dosage_unit text, frequency text, notes
- `medical_blood_reports`: uploaded file paths, `ai_report jsonb` (overview bullets, results array, questions, disclaimer), `created_at`

Storage: new private bucket `medical-uploads` with owner-scoped RLS on `storage.objects`.

## Server functions (`src/lib/medical.functions.ts`)

- `getMedicalProfile`, `saveMedicalProfile`
- `listPrescriptions`, `savePrescription`, `deletePrescription`
- `listBloodReports`, `saveBloodReport`, `deleteBloodReport`
- `analyzeBloodResults({ fileUrls, userName, dob })` — calls Lovable AI Gateway (`google/gemini-2.5-pro`) with the images/PDFs and a strict prompt returning JSON:
  ```
  { overview: [{severity, text}], results: [{marker, value, unit, range, direction: 'up'|'down'|'ok', status: 'normal'|'abnormal', note}], questions: string[], disclaimer: string }
  ```
- `markCheckupDone` (updates `last_visit_date` to today)

All `requireSupabaseAuth`.

## AI prompt (blood analysis)

System: "You are a clinical results summarizer for educational research only. Never provide diagnosis or treatment. Always include a disclaimer. Return JSON only."

User instruction includes: patient name + DOB (from Settings), today's date, the uploaded images/PDFs, and asks for:
- Quick overview bullets with severity (very_bad/bad/neutral/good/very_good)
- Full marker-by-marker table with reference ranges and direction arrows
- Suggested questions to ask the physician, especially for markers suggesting possible concerns (e.g. elevated ALT/AST → liver)
- Standard disclaimer text

## Files to create/edit

- Migration: 3 tables + storage bucket + RLS + GRANTs
- `src/lib/medical.functions.ts` (new)
- `src/routes/medical.tsx` (new)
- `src/components/AppSidebar.tsx` — add Medical link (Stethoscope icon)
- Dashboard notifications component — add checkup-due card (same pattern as birthdays)
- `src/integrations/supabase/types.ts` — regenerated after migration

## Confirmations before I build

1. AI model: default to `google/gemini-2.5-pro` (best multimodal for reading photographed lab reports + PDFs). OK?
2. Reminder threshold: show the checkup notification starting 7 days before it's due, and keep showing until dismissed or marked done. OK?
3. Prescription dosage units — proposed list: mg, mcg, g, ml, tabs, capsules, puffs, drops, IU. Add/remove any?
