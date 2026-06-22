
CREATE TABLE public.task_notifications (
  entry_id uuid PRIMARY KEY REFERENCES public.entries(id) ON DELETE CASCADE,
  last_sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_notifications TO authenticated;
GRANT ALL ON public.task_notifications TO service_role;
ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages task notifications"
  ON public.task_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
