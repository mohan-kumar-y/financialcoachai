CREATE TABLE public.anomaly_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL,
  flagged boolean NOT NULL DEFAULT false,
  deviation_score numeric,
  volume_ratio numeric,
  driver_class text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.anomaly_flags TO authenticated;
GRANT ALL ON public.anomaly_flags TO service_role;

ALTER TABLE public.anomaly_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read anomaly flags"
ON public.anomaly_flags
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX anomaly_flags_symbol_created_idx ON public.anomaly_flags (symbol, created_at DESC);