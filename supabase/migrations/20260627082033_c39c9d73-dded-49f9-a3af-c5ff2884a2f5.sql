
CREATE TABLE public.saved_keg_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  keg_l numeric NOT NULL,
  glass_ml numeric NOT NULL,
  keg_price numeric NOT NULL,
  glass_price numeric NOT NULL,
  full_glasses numeric,
  revenue numeric,
  cost_per_glass numeric,
  profit_per_glass numeric,
  total_profit numeric,
  margin numeric,
  breakeven numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_keg_products TO authenticated;
GRANT ALL ON public.saved_keg_products TO service_role;
ALTER TABLE public.saved_keg_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_keg_products" ON public.saved_keg_products
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_saved_keg_updated BEFORE UPDATE ON public.saved_keg_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.saved_bottle_can_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  package_type text NOT NULL,
  ml numeric NOT NULL,
  units numeric NOT NULL,
  carton_cost numeric NOT NULL,
  sell_price numeric NOT NULL,
  wastage_pct numeric NOT NULL DEFAULT 0,
  cost_per_unit numeric,
  profit_per_unit numeric,
  margin_unit numeric,
  markup_unit numeric,
  breakeven numeric,
  saleable_units numeric,
  revenue numeric,
  profit_carton numeric,
  margin_carton numeric,
  markup_carton numeric,
  total_ml numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_bottle_can_products TO authenticated;
GRANT ALL ON public.saved_bottle_can_products TO service_role;
ALTER TABLE public.saved_bottle_can_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_bc_products" ON public.saved_bottle_can_products
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_saved_bc_updated BEFORE UPDATE ON public.saved_bottle_can_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
