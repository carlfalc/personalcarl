
CREATE TABLE public.itinerary_favorite_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leg_id uuid NOT NULL REFERENCES public.itinerary_legs(id) ON DELETE CASCADE,
  itinerary_id uuid NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  address text,
  distance_label text,
  distance_meters integer,
  why text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX itinerary_favorite_places_leg_idx ON public.itinerary_favorite_places(leg_id);
CREATE INDEX itinerary_favorite_places_itinerary_idx ON public.itinerary_favorite_places(itinerary_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_favorite_places TO authenticated;
GRANT ALL ON public.itinerary_favorite_places TO service_role;

ALTER TABLE public.itinerary_favorite_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own favorite places"
  ON public.itinerary_favorite_places
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER itinerary_favorite_places_updated_at
  BEFORE UPDATE ON public.itinerary_favorite_places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
