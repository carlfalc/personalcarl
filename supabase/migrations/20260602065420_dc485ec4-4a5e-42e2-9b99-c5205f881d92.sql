-- Lock down entries, memory, meetings to authenticated users only.

DROP POLICY IF EXISTS "public all entries" ON public.entries;
DROP POLICY IF EXISTS "public all meetings" ON public.meetings;
DROP POLICY IF EXISTS "public all memory" ON public.memory;

REVOKE ALL ON public.entries FROM anon;
REVOKE ALL ON public.meetings FROM anon;
REVOKE ALL ON public.memory FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory TO authenticated;
GRANT ALL ON public.entries TO service_role;
GRANT ALL ON public.meetings TO service_role;
GRANT ALL ON public.memory TO service_role;

CREATE POLICY "authenticated all entries" ON public.entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated all meetings" ON public.meetings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated all memory" ON public.memory
  FOR ALL TO authenticated USING (true) WITH CHECK (true);