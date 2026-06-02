CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  prompt text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('once','hourly','daily','weekly')),
  time_of_day time,
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6),
  enabled boolean NOT NULL DEFAULT true,
  last_run timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own schedules" ON public.schedules
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own schedules" ON public.schedules
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own schedules" ON public.schedules
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own schedules" ON public.schedules
  FOR DELETE TO authenticated USING (auth.uid() = user_id);