CREATE TABLE public.live_quotes (
  symbol text PRIMARY KEY,
  ltp numeric NOT NULL,
  volume bigint,
  observed_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'ANGEL_ONE',
  quality text NOT NULL DEFAULT 'ok'
);
GRANT SELECT ON public.live_quotes TO authenticated;
GRANT ALL ON public.live_quotes TO service_role;
ALTER TABLE public.live_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read live quotes" ON public.live_quotes FOR SELECT TO authenticated USING (true);

CREATE TABLE public.candles (
  symbol text NOT NULL,
  interval text NOT NULL,
  ts timestamptz NOT NULL,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, interval, ts)
);
GRANT SELECT ON public.candles TO authenticated;
GRANT ALL ON public.candles TO service_role;
ALTER TABLE public.candles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read candles" ON public.candles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.fundamentals_cache (
  symbol text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fundamentals_cache TO authenticated;
GRANT ALL ON public.fundamentals_cache TO service_role;
ALTER TABLE public.fundamentals_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read fundamentals cache" ON public.fundamentals_cache FOR SELECT TO authenticated USING (true);

CREATE TABLE public.market_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  source text NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_events_symbol_type_idx ON public.market_events (symbol, event_type, observed_at DESC);
GRANT SELECT ON public.market_events TO authenticated;
GRANT ALL ON public.market_events TO service_role;
ALTER TABLE public.market_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read market events" ON public.market_events FOR SELECT TO authenticated USING (true);