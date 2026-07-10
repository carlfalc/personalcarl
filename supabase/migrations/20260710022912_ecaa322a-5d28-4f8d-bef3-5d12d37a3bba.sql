-- Files are stored under <thread_id>/<uuid>-<filename>
CREATE POLICY "Participants can read attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id::text = split_part(name, '/', 1)
        AND (auth.uid() = t.owner_user_id OR auth.uid() = t.staff_user_id)
    )
  );

CREATE POLICY "Participants can upload attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND owner = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id::text = split_part(name, '/', 1)
        AND (auth.uid() = t.owner_user_id OR auth.uid() = t.staff_user_id)
    )
  );

CREATE POLICY "Uploader can delete own attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'message-attachments' AND owner = auth.uid());