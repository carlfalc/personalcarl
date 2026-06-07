ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS briefing_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS briefing_time time NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS last_briefing_sent timestamptz;