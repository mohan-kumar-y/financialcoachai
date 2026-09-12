-- Strategy Registry (LLD §11). Config table, not user data.
-- Signal weight judgment calls: only TECHNICAL and FUNDAMENTAL signal engines
-- exist today, so every other engine is omitted (weight 0). Revisit once
-- Phase 9/11 add sentiment, derivatives, institutional flow and macro engines.
CREATE TABLE public.strategies (
  id text PRIMARY KEY,
  signal_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  horizon text NOT NULL,
  risk_profile text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.strategies TO authenticated;
GRANT ALL ON public.strategies TO service_role;

ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read strategies"
  ON public.strategies FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_strategies_updated_at
  BEFORE UPDATE ON public.strategies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the 8 packs.
-- thresholds keys: minConfidence (0-100, minimum calibrated confidence before
-- an actionable call is allowed), maxPositionPct (max % of portfolio value a
-- single position under this pack may reach), confidenceCeiling (0-100, caps
-- confidence where the pack's data coverage is known to be incomplete).
INSERT INTO public.strategies (id, signal_weights, thresholds, horizon, risk_profile, notes) VALUES
  ('LONG_TERM', '{"FUNDAMENTAL":0.7,"TECHNICAL":0.3}',
   '{"minConfidence":70,"maxPositionPct":15,"confidenceCeiling":100}',
   'LONG_TERM', 'MODERATE',
   'Fundamental-heavy; technicals only time the entry.'),
  ('SWING', '{"TECHNICAL":0.7,"FUNDAMENTAL":0.3}',
   '{"minConfidence":65,"maxPositionPct":10,"confidenceCeiling":100}',
   'SWING', 'AGGRESSIVE',
   'Technical-heavy on daily candles; fundamentals act as a quality filter.'),
  ('INTRADAY', '{"TECHNICAL":1.0}',
   '{"minConfidence":85,"maxPositionPct":5,"confidenceCeiling":70}',
   'INTRADAY', 'AGGRESSIVE',
   'Not genuinely usable until Phase 11 supplies intraday bars; only daily candles exist today, so minConfidence is deliberately punitive and confidence is capped.'),
  ('ETF', '{"FUNDAMENTAL":0.6,"TECHNICAL":0.4}',
   '{"minConfidence":60,"maxPositionPct":25,"confidenceCeiling":90}',
   'LONG_TERM', 'CONSERVATIVE',
   'ETFs track an index, so single-stock technique carries less weight; larger position size is acceptable because the instrument is already diversified.'),
  ('MUTUAL_FUND', '{"FUNDAMENTAL":0.9,"TECHNICAL":0.1}',
   '{"minConfidence":60,"maxPositionPct":30,"confidenceCeiling":85}',
   'LONG_TERM', 'MODERATE',
   'NAV series carries no meaningful intraday technique; almost entirely fundamental.'),
  ('SIP', '{"FUNDAMENTAL":0.8,"TECHNICAL":0.2}',
   '{"minConfidence":50,"maxPositionPct":30,"confidenceCeiling":100}',
   'LONG_TERM', 'CONSERVATIVE',
   'Recurring, lower-stakes decisions, so a lower confidence bar than LONG_TERM.'),
  ('IPO', '{"FUNDAMENTAL":0.5,"TECHNICAL":0.5}',
   '{"minConfidence":80,"maxPositionPct":5,"confidenceCeiling":50}',
   'LONG_TERM', 'AGGRESSIVE',
   'Under-supported: no IPO-specific signal is wired up (the provider IPO endpoint feeds no engine), and a pre-listing instrument has neither candles nor fundamentals cache. Weights are placeholders and confidence is hard-capped.'),
  ('PORTFOLIO_REVIEW', '{"FUNDAMENTAL":0.5,"TECHNICAL":0.5}',
   '{"minConfidence":60,"maxPositionPct":20,"confidenceCeiling":100}',
   'LONG_TERM', 'MODERATE',
   'Balanced; this pack leans mainly on the Rules Engine and Portfolio Engine, which are outside signal_weights by design.');