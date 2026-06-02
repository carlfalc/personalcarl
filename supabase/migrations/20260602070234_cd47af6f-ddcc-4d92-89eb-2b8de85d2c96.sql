ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_chat_id text;

CREATE TABLE public.birthdays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  birth_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.birthdays TO authenticated;
GRANT ALL ON public.birthdays TO service_role;

ALTER TABLE public.birthdays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own birthdays" ON public.birthdays
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own birthdays" ON public.birthdays
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own birthdays" ON public.birthdays
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own birthdays" ON public.birthdays
  FOR DELETE TO authenticated USING (auth.uid() = user_id);