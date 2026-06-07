ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_review_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_review_day int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_review_time time NOT NULL DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS last_weekly_review_sent timestamptz;