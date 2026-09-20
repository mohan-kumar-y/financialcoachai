ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS target_price numeric NULL,
  ADD COLUMN IF NOT EXISTS target_direction text NULL;

ALTER TABLE public.watchlist
  DROP CONSTRAINT IF EXISTS watchlist_target_direction_check;
ALTER TABLE public.watchlist
  ADD CONSTRAINT watchlist_target_direction_check
  CHECK (target_direction IS NULL OR target_direction IN ('ABOVE','BELOW'));

CREATE TABLE public.watchlist_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  watchlist_id uuid NOT NULL REFERENCES public.watchlist(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  target_price numeric NOT NULL,
  direction text NOT NULL CHECK (direction IN ('ABOVE','BELOW')),
  ltp_at_trigger numeric NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, DELETE ON public.watchlist_alerts TO authenticated;
GRANT ALL ON public.watchlist_alerts TO service_role;

ALTER TABLE public.watchlist_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own watchlist alerts"
  ON public.watchlist_alerts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watchlist alerts"
  ON public.watchlist_alerts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX watchlist_alerts_user_triggered_idx
  ON public.watchlist_alerts (user_id, triggered_at DESC);
CREATE INDEX watchlist_alerts_watchlist_triggered_idx
  ON public.watchlist_alerts (watchlist_id, triggered_at DESC);
CREATE INDEX watchlist_target_symbol_idx
  ON public.watchlist (symbol) WHERE target_price IS NOT NULL;