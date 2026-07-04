
-- Itineraries
CREATE TABLE public.itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  country text,
  city text,
  start_date date,
  end_date date,
  travel_modes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itineraries TO authenticated;
GRANT ALL ON public.itineraries TO service_role;
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own itineraries" ON public.itineraries FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER itineraries_updated_at BEFORE UPDATE ON public.itineraries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Legs
CREATE TABLE public.itinerary_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id uuid NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('flight','train','bus','vehicle','accommodation')),
  from_label text,
  to_label text,
  depart_at timestamptz,
  arrive_at timestamptz,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_legs TO authenticated;
GRANT ALL ON public.itinerary_legs TO service_role;
ALTER TABLE public.itinerary_legs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own legs" ON public.itinerary_legs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER itinerary_legs_updated_at BEFORE UPDATE ON public.itinerary_legs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX itinerary_legs_itinerary_idx ON public.itinerary_legs(itinerary_id, position);

-- Nearby searches (cache)
CREATE TABLE public.itinerary_nearby_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id uuid NOT NULL REFERENCES public.itinerary_legs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query text NOT NULL,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_nearby_searches TO authenticated;
GRANT ALL ON public.itinerary_nearby_searches TO service_role;
ALTER TABLE public.itinerary_nearby_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own nearby" ON public.itinerary_nearby_searches FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
