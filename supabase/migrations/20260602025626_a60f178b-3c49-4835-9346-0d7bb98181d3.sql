
-- Enums
CREATE TYPE public.entry_type AS ENUM ('task', 'idea', 'todo', 'diary');
CREATE TYPE public.memory_category AS ENUM ('interest', 'project', 'preference');

-- entries
CREATE TABLE public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.entry_type NOT NULL,
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  priority int NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'todo',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO anon, authenticated;
GRANT ALL ON public.entries TO service_role;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all entries" ON public.entries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- memory
CREATE TABLE public.memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact text NOT NULL,
  category public.memory_category NOT NULL,
  confidence numeric NOT NULL DEFAULT 0.8,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory TO anon, authenticated;
GRANT ALL ON public.memory TO service_role;
ALTER TABLE public.memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all memory" ON public.memory FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- meetings
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  datetime timestamptz NOT NULL,
  location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO anon, authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all meetings" ON public.meetings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.memory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER TABLE public.entries REPLICA IDENTITY FULL;
ALTER TABLE public.memory REPLICA IDENTITY FULL;
ALTER TABLE public.meetings REPLICA IDENTITY FULL;
