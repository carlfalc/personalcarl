ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nudge_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nudge_time time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS last_nudge_sent timestamptz;