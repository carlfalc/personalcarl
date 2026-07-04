
CREATE TABLE IF NOT EXISTS public.medical_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_name text,
  clinic_name text,
  clinic_address text,
  doctor_phone text,
  clinic_phone text,
  email text,
  website text,
  checkup_frequency_months int,
  last_visit_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_profile TO authenticated;
GRANT ALL ON public.medical_profile TO service_role;
ALTER TABLE public.medical_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own medical_profile" ON public.medical_profile;
CREATE POLICY "own medical_profile" ON public.medical_profile
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS medical_profile_updated_at ON public.medical_profile;
CREATE TRIGGER medical_profile_updated_at BEFORE UPDATE ON public.medical_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.medical_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dosage_amount numeric,
  dosage_unit text,
  frequency text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_prescriptions TO authenticated;
GRANT ALL ON public.medical_prescriptions TO service_role;
ALTER TABLE public.medical_prescriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own medical_prescriptions" ON public.medical_prescriptions;
CREATE POLICY "own medical_prescriptions" ON public.medical_prescriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS medical_prescriptions_user_id_idx ON public.medical_prescriptions(user_id);
DROP TRIGGER IF EXISTS medical_prescriptions_updated_at ON public.medical_prescriptions;
CREATE TRIGGER medical_prescriptions_updated_at BEFORE UPDATE ON public.medical_prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.medical_blood_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  source_paths text[] NOT NULL DEFAULT '{}',
  ai_report jsonb NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_blood_reports TO authenticated;
GRANT ALL ON public.medical_blood_reports TO service_role;
ALTER TABLE public.medical_blood_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own medical_blood_reports" ON public.medical_blood_reports;
CREATE POLICY "own medical_blood_reports" ON public.medical_blood_reports
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS medical_blood_reports_user_id_idx ON public.medical_blood_reports(user_id, reported_at DESC);
DROP TRIGGER IF EXISTS medical_blood_reports_updated_at ON public.medical_blood_reports;
CREATE TRIGGER medical_blood_reports_updated_at BEFORE UPDATE ON public.medical_blood_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "medical uploads select own" ON storage.objects;
CREATE POLICY "medical uploads select own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'medical-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "medical uploads insert own" ON storage.objects;
CREATE POLICY "medical uploads insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'medical-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "medical uploads update own" ON storage.objects;
CREATE POLICY "medical uploads update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'medical-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "medical uploads delete own" ON storage.objects;
CREATE POLICY "medical uploads delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'medical-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
