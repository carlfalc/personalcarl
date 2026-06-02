ALTER TYPE public.memory_category ADD VALUE IF NOT EXISTS 'family';
ALTER TYPE public.memory_category ADD VALUE IF NOT EXISTS 'business';
ALTER TYPE public.memory_category ADD VALUE IF NOT EXISTS 'technology';
ALTER TYPE public.memory_category ADD VALUE IF NOT EXISTS 'travel';

ALTER TABLE public.memory
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS relationship text,
  ADD COLUMN IF NOT EXISTS birth_date date;