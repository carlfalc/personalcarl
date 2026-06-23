CREATE TABLE public.market_quotes_cache (
  symbol TEXT PRIMARY KEY,
  display_symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  previous_close NUMERIC,
  change_pct NUMERIC,
  market_state TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.market_quotes_cache TO authenticated;
GRANT ALL ON public.market_quotes_cache TO service_role;
ALTER TABLE public.market_quotes_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read market cache"
  ON public.market_quotes_cache FOR SELECT TO authenticated USING (true);