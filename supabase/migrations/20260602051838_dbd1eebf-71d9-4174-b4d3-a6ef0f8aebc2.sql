CREATE TABLE public.pending_email_intents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_confirmation',
  recipient_email TEXT,
  recipient_name TEXT,
  candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  gmail_draft_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_email_intents_chat_active
  ON public.pending_email_intents (chat_id, created_at DESC)
  WHERE status = 'awaiting_confirmation';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_email_intents TO authenticated;
GRANT ALL ON public.pending_email_intents TO service_role;

ALTER TABLE public.pending_email_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access"
  ON public.pending_email_intents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER pending_email_intents_set_updated_at
  BEFORE UPDATE ON public.pending_email_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();