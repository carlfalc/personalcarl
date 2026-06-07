
-- 1. Add user_id columns (nullable first, backfill, then NOT NULL with default auth.uid())
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.memory ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.meeting_documents ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2. Backfill to the single existing owner
UPDATE public.entries SET user_id = '76a50751-76c1-4d1d-b23e-14b28dfa0a04' WHERE user_id IS NULL;
UPDATE public.meetings SET user_id = '76a50751-76c1-4d1d-b23e-14b28dfa0a04' WHERE user_id IS NULL;
UPDATE public.memory SET user_id = '76a50751-76c1-4d1d-b23e-14b28dfa0a04' WHERE user_id IS NULL;
UPDATE public.meeting_documents SET user_id = '76a50751-76c1-4d1d-b23e-14b28dfa0a04' WHERE user_id IS NULL;

-- 3. NOT NULL + default auth.uid() so client inserts auto-populate
ALTER TABLE public.entries ALTER COLUMN user_id SET DEFAULT auth.uid(), ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.meetings ALTER COLUMN user_id SET DEFAULT auth.uid(), ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.memory ALTER COLUMN user_id SET DEFAULT auth.uid(), ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.meeting_documents ALTER COLUMN user_id SET DEFAULT auth.uid(), ALTER COLUMN user_id SET NOT NULL;

-- 4. Replace permissive policies with owner-scoped ones
DROP POLICY IF EXISTS "authenticated all entries" ON public.entries;
DROP POLICY IF EXISTS "authenticated all meetings" ON public.meetings;
DROP POLICY IF EXISTS "authenticated all memory" ON public.memory;
DROP POLICY IF EXISTS "authenticated all meeting_documents" ON public.meeting_documents;

CREATE POLICY "Users manage their own entries" ON public.entries
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage their own meetings" ON public.meetings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage their own memory" ON public.memory
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage their own meeting_documents" ON public.meeting_documents
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Tighten storage policies on the meeting-documents bucket: ownership via meeting_documents.file_path
DROP POLICY IF EXISTS "authenticated read meeting-documents" ON storage.objects;
DROP POLICY IF EXISTS "authenticated upload meeting-documents" ON storage.objects;
DROP POLICY IF EXISTS "authenticated delete meeting-documents" ON storage.objects;

CREATE POLICY "Users read own meeting-documents files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'meeting-documents'
    AND EXISTS (
      SELECT 1 FROM public.meeting_documents md
      WHERE md.file_path = storage.objects.name
        AND md.user_id = auth.uid()
    )
  );

CREATE POLICY "Users upload own meeting-documents files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'meeting-documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own meeting-documents files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'meeting-documents'
    AND EXISTS (
      SELECT 1 FROM public.meeting_documents md
      WHERE md.file_path = storage.objects.name
        AND md.user_id = auth.uid()
    )
  );
