
CREATE POLICY "Users read own telegram-images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'telegram-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own telegram-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'telegram-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users insert own telegram-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'telegram-images' AND (storage.foldername(name))[1] = auth.uid()::text);
