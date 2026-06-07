CREATE TABLE IF NOT EXISTS public.grocery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  item text NOT NULL,
  quantity text,
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grocery_items TO authenticated;
GRANT ALL ON public.grocery_items TO service_role;

ALTER TABLE public.grocery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their grocery items"
  ON public.grocery_items
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_grocery_items_updated_at
  BEFORE UPDATE ON public.grocery_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.grocery_items;
ALTER TABLE public.grocery_items REPLICA IDENTITY FULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grocery_send_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grocery_send_day int,
  ADD COLUMN IF NOT EXISTS grocery_send_time time NOT NULL DEFAULT '16:00',
  ADD COLUMN IF NOT EXISTS last_grocery_sent timestamptz;