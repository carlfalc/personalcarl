
-- Add roster_type to distinguish staff vs manager rosters
ALTER TABLE public.roster_staff ADD COLUMN IF NOT EXISTS roster_type TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE public.roster_snapshots ADD COLUMN IF NOT EXISTS roster_type TEXT NOT NULL DEFAULT 'staff';

CREATE INDEX IF NOT EXISTS idx_roster_staff_type ON public.roster_staff(roster_type);
CREATE INDEX IF NOT EXISTS idx_roster_snapshots_type ON public.roster_snapshots(roster_type);

-- Meta table holds the week starting date per roster type
CREATE TABLE IF NOT EXISTS public.roster_meta (
  roster_type TEXT PRIMARY KEY,
  week_start_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_meta TO authenticated;
GRANT ALL ON public.roster_meta TO service_role;

ALTER TABLE public.roster_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read roster_meta" ON public.roster_meta
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert roster_meta" ON public.roster_meta
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update roster_meta" ON public.roster_meta
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.roster_meta (roster_type) VALUES ('staff'), ('manager')
  ON CONFLICT (roster_type) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.roster_meta;
