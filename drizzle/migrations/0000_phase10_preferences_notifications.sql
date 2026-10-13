CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY,
  risk_tolerance text NULL CHECK (risk_tolerance IN ('CONSERVATIVE','MODERATE','AGGRESSIVE')),
  preferred_sectors text[] NULL,
  notify_email boolean NOT NULL DEFAULT false,
  notify_push boolean NOT NULL DEFAULT false,
  email_address text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON public.user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('DASHBOARD','EMAIL','PUSH')),
  subject text NOT NULL,
  body text NOT NULL,
  related_decision_id uuid NULL,
  related_alert_id uuid NULL REFERENCES public.watchlist_alerts(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('PENDING','SENT','FAILED','NOT_IMPLEMENTED')),
  failure_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL
);
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);