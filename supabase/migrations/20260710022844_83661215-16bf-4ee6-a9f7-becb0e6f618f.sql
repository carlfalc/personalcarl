-- Messenger threads
CREATE TABLE public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  owner_user_id uuid NOT NULL,
  staff_user_id uuid NOT NULL,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_threads TO authenticated;
GRANT ALL ON public.message_threads TO service_role;
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Thread participants can view" ON public.message_threads
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id OR auth.uid() = staff_user_id);
CREATE POLICY "Owner can create threads" ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Participants can update thread" ON public.message_threads
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id OR auth.uid() = staff_user_id)
  WITH CHECK (auth.uid() = owner_user_id OR auth.uid() = staff_user_id);
CREATE POLICY "Owner can delete thread" ON public.message_threads
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE TRIGGER message_threads_set_updated_at
  BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_thread_created_idx ON public.messages (thread_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Thread participants can view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id = messages.thread_id
      AND (auth.uid() = t.owner_user_id OR auth.uid() = t.staff_user_id)
  ));
CREATE POLICY "Participants can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_user_id
    AND EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id = messages.thread_id
        AND (auth.uid() = t.owner_user_id OR auth.uid() = t.staff_user_id)
    )
  );
CREATE POLICY "Sender can soft-delete own messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_user_id)
  WITH CHECK (auth.uid() = sender_user_id);

-- Per-user last-read marker
CREATE TABLE public.message_reads (
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reads TO authenticated;
GRANT ALL ON public.message_reads TO service_role;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view read markers" ON public.message_reads
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id = message_reads.thread_id
      AND (auth.uid() = t.owner_user_id OR auth.uid() = t.staff_user_id)
  ));
CREATE POLICY "User can upsert own read marker" ON public.message_reads
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id = message_reads.thread_id
        AND (auth.uid() = t.owner_user_id OR auth.uid() = t.staff_user_id)
    )
  );
CREATE POLICY "User can update own read marker" ON public.message_reads
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_threads;