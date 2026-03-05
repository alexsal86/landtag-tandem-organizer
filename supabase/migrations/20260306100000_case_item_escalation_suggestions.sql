DO $$
BEGIN
  CREATE TYPE public.case_item_escalation_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.case_items
  ADD COLUMN IF NOT EXISTS is_legal_relevant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_political_relevant boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.case_item_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_item_id uuid NOT NULL REFERENCES public.case_items(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event_type text NOT NULL DEFAULT 'note',
  title text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_item_escalation_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_item_id uuid NOT NULL REFERENCES public.case_items(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  status public.case_item_escalation_status NOT NULL DEFAULT 'pending',
  reason_codes text[] NOT NULL DEFAULT '{}',
  suggestion_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested_case_file_id uuid REFERENCES public.case_files(id) ON DELETE SET NULL,
  accepted_case_file_id uuid REFERENCES public.case_files(id) ON DELETE SET NULL,
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_item_escalation_pending_once
ON public.case_item_escalation_suggestions(case_item_id)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_case_item_escalation_tenant_status
ON public.case_item_escalation_suggestions(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_item_timeline_case_item
ON public.case_item_timeline(case_item_id, created_at DESC);

ALTER TABLE public.case_item_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_item_escalation_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage case item timeline in their tenant"
ON public.case_item_timeline FOR ALL
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())))
WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can manage escalation suggestions in their tenant"
ON public.case_item_escalation_suggestions FOR ALL
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())))
WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

DROP TRIGGER IF EXISTS update_case_item_escalation_suggestions_updated_at ON public.case_item_escalation_suggestions;
CREATE TRIGGER update_case_item_escalation_suggestions_updated_at
BEFORE UPDATE ON public.case_item_escalation_suggestions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'suggest-case-escalations-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/suggest-case-escalations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'AUTOMATION_CRON_SECRET' LIMIT 1), ''),
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1), '')
    ),
    body := jsonb_build_object('action', 'run-check')
  );
  $$
);
