CREATE TABLE public.selftest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  scenario_id text NOT NULL,
  scenario_title text NOT NULL,
  status text NOT NULL,
  keep_data boolean NOT NULL DEFAULT false,
  duration_ms integer,
  failed_steps integer NOT NULL DEFAULT 0,
  total_steps integer NOT NULL DEFAULT 0,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  cleanup jsonb,
  app_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.selftest_runs TO authenticated;
GRANT ALL ON public.selftest_runs TO service_role;
ALTER TABLE public.selftest_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read selftest runs" ON public.selftest_runs FOR SELECT TO authenticated
  USING (tenant_id = ANY (public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users insert own selftest runs" ON public.selftest_runs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tenant_id = ANY (public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users delete own selftest runs" ON public.selftest_runs FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX selftest_runs_tenant_scenario_idx ON public.selftest_runs (tenant_id, scenario_id, created_at DESC);