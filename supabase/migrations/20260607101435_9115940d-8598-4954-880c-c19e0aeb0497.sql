ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS diary_summary_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_diary_summary timestamptz;