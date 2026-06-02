
-- Storage bucket for meeting attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-documents', 'meeting-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: any authenticated user can manage files in this bucket
CREATE POLICY "authenticated read meeting-documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'meeting-documents');

CREATE POLICY "authenticated upload meeting-documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'meeting-documents');

CREATE POLICY "authenticated delete meeting-documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'meeting-documents');

-- Table to track document metadata linked to meetings
CREATE TABLE public.meeting_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  size_bytes BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_documents TO authenticated;
GRANT ALL ON public.meeting_documents TO service_role;

ALTER TABLE public.meeting_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated all meeting_documents"
ON public.meeting_documents FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_meeting_documents_meeting_id ON public.meeting_documents(meeting_id);
