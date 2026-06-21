CREATE TABLE public.roster_training (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  day text NOT NULL,
  start_time time,
  end_time time,
  training_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_training TO authenticated;
GRANT ALL ON public.roster_training TO service_role;

ALTER TABLE public.roster_training ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read roster_training" ON public.roster_training FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert roster_training" ON public.roster_training FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update roster_training" ON public.roster_training FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete roster_training" ON public.roster_training FOR DELETE TO authenticated USING (true);

CREATE TRIGGER set_roster_training_updated_at
BEFORE UPDATE ON public.roster_training
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.roster_training_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_at timestamptz NOT NULL DEFAULT now(),
  saved_by uuid,
  label text,
  data jsonb NOT NULL DEFAULT '[]'::jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_training_snapshots TO authenticated;
GRANT ALL ON public.roster_training_snapshots TO service_role;

ALTER TABLE public.roster_training_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read training snapshots" ON public.roster_training_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert training snapshots" ON public.roster_training_snapshots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete training snapshots" ON public.roster_training_snapshots FOR DELETE TO authenticated USING (true);

CREATE TABLE public.roster_training_meta (
  id integer PRIMARY KEY DEFAULT 1,
  week_start_date date,
  week_start_day integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roster_training_meta_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_training_meta TO authenticated;
GRANT ALL ON public.roster_training_meta TO service_role;

ALTER TABLE public.roster_training_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read training meta" ON public.roster_training_meta FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can upsert training meta" ON public.roster_training_meta FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update training meta" ON public.roster_training_meta FOR UPDATE TO authenticated USING (true) WITH CHECK (true);