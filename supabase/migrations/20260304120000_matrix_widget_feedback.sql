-- Matrix website widget: feedback capture + admin analytics + improvement triggers

CREATE TABLE IF NOT EXISTS public.matrix_widget_message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  conversation_id TEXT NOT NULL,
  widget_message_id TEXT NOT NULL,
  matrix_event_id TEXT,
  response_role TEXT NOT NULL CHECK (response_role IN ('bot', 'team')),
  is_helpful BOOLEAN NOT NULL,
  feedback_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT matrix_widget_feedback_unique_per_user_message UNIQUE (user_id, conversation_id, widget_message_id)
);

CREATE INDEX IF NOT EXISTS idx_matrix_widget_feedback_tenant_created
  ON public.matrix_widget_message_feedback (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_matrix_widget_feedback_helpful
  ON public.matrix_widget_message_feedback (tenant_id, is_helpful);

CREATE TABLE IF NOT EXISTS public.matrix_widget_improvement_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL UNIQUE REFERENCES public.matrix_widget_message_feedback(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  widget_message_id TEXT NOT NULL,
  matrix_event_id TEXT,
  trigger_reason TEXT NOT NULL DEFAULT 'negative_feedback',
  suggested_channel TEXT NOT NULL CHECK (suggested_channel IN ('faq', 'routing')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matrix_widget_improvement_triggers_tenant_status
  ON public.matrix_widget_improvement_triggers (tenant_id, status, created_at DESC);

ALTER TABLE public.matrix_widget_message_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matrix_widget_improvement_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can insert matrix widget feedback"
ON public.matrix_widget_message_feedback
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.user_tenant_memberships utm
    WHERE utm.tenant_id = matrix_widget_message_feedback.tenant_id
      AND utm.user_id = auth.uid()
      AND utm.is_active = true
  )
);

CREATE POLICY "Tenant admins can view matrix widget feedback"
ON public.matrix_widget_message_feedback
FOR SELECT
USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can view matrix widget improvement triggers"
ON public.matrix_widget_improvement_triggers
FOR SELECT
USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE OR REPLACE FUNCTION public.create_matrix_widget_improvement_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NEW.is_helpful = false THEN
    INSERT INTO public.matrix_widget_improvement_triggers (
      tenant_id,
      feedback_id,
      conversation_id,
      widget_message_id,
      matrix_event_id,
      suggested_channel
    )
    VALUES (
      NEW.tenant_id,
      NEW.id,
      NEW.conversation_id,
      NEW.widget_message_id,
      NEW.matrix_event_id,
      CASE
        WHEN coalesce(NEW.feedback_context->>'visitor_message', '') ILIKE '%?%' THEN 'faq'
        WHEN coalesce(NEW.feedback_context->>'visitor_message', '') ILIKE ANY (ARRAY['%weiterleiten%', '%kontakt%', '%termin%', '%zuständig%']) THEN 'routing'
        ELSE 'faq'
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matrix_widget_feedback_to_improvement
ON public.matrix_widget_message_feedback;

CREATE TRIGGER trg_matrix_widget_feedback_to_improvement
AFTER INSERT ON public.matrix_widget_message_feedback
FOR EACH ROW
EXECUTE FUNCTION public.create_matrix_widget_improvement_trigger();

CREATE OR REPLACE VIEW public.matrix_widget_feedback_admin_stats
WITH (security_invoker = true)
AS
SELECT
  f.tenant_id,
  COUNT(*)::int AS total_feedback,
  COUNT(*) FILTER (WHERE f.is_helpful)::int AS helpful_count,
  COUNT(*) FILTER (WHERE NOT f.is_helpful)::int AS not_helpful_count,
  ROUND((COUNT(*) FILTER (WHERE f.is_helpful)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS helpful_ratio,
  ROUND((COUNT(*) FILTER (WHERE NOT f.is_helpful)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS not_helpful_ratio,
  MAX(f.created_at) AS last_feedback_at,
  COUNT(t.id) FILTER (WHERE t.status = 'open')::int AS open_improvement_triggers
FROM public.matrix_widget_message_feedback f
LEFT JOIN public.matrix_widget_improvement_triggers t
  ON t.feedback_id = f.id
GROUP BY f.tenant_id;
