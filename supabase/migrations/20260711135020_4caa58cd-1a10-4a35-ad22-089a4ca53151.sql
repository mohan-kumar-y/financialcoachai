CREATE TABLE public.market_cache (
  cache_key text PRIMARY KEY,
  endpoint text NOT NULL,
  payload jsonb NOT NULL,
  source text NOT NULL DEFAULT 'indianapi.in',
  status text NOT NULL DEFAULT 'ok',
  fetched_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.market_cache TO authenticated;
GRANT ALL ON public.market_cache TO service_role;

ALTER TABLE public.market_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read market cache"
ON public.market_cache
FOR SELECT
TO authenticated
USING (true);

CREATE TABLE public.watchlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
GRANT ALL ON public.watchlist TO service_role;

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlist"
ON public.watchlist
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.financial_plans ADD COLUMN IF NOT EXISTS risk_appetite text NOT NULL DEFAULT 'Moderate';
ALTER TABLE public.financial_plans ADD COLUMN IF NOT EXISTS investment_horizon_years integer NOT NULL DEFAULT 10;