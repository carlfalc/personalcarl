
-- 1. Add UPDATE policy for meeting-documents bucket
CREATE POLICY "Users update own meeting-documents files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'meeting-documents'
  AND EXISTS (
    SELECT 1 FROM public.meeting_documents md
    WHERE md.file_path = storage.objects.name
      AND md.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'meeting-documents'
  AND EXISTS (
    SELECT 1 FROM public.meeting_documents md
    WHERE md.file_path = storage.objects.name
      AND md.user_id = auth.uid()
  )
);

-- 2. Lock down realtime.messages so users can only subscribe to their own topics
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can subscribe to their own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
  OR realtime.topic() = 'user:' || auth.uid()::text
);

CREATE POLICY "Users can broadcast to their own realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
  OR realtime.topic() = 'user:' || auth.uid()::text
);
