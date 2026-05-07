
-- 1. Preparation Templates
CREATE TABLE public.preparation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  anlasstyp TEXT,
  description TEXT,
  preparation_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.preparation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view templates"
  ON public.preparation_templates FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can manage templates"
  ON public.preparation_templates FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE TRIGGER trg_preparation_templates_updated_at
  BEFORE UPDATE ON public.preparation_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_preparation_templates_tenant ON public.preparation_templates(tenant_id);

-- 2. Sharing on appointment_preparations
ALTER TABLE public.appointment_preparations
  ADD COLUMN IF NOT EXISTS shared_with UUID[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_appointment_preparations_shared_with
  ON public.appointment_preparations USING GIN(shared_with);

-- Add SELECT policy for shared users (in addition to existing policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'appointment_preparations'
      AND policyname = 'Shared users can view preparation'
  ) THEN
    CREATE POLICY "Shared users can view preparation"
      ON public.appointment_preparations FOR SELECT
      USING (auth.uid() = ANY(shared_with));
  END IF;
END$$;

-- 3. Seed a few default templates per tenant on demand: leave to UI

COMMENT ON COLUMN public.appointment_preparations.shared_with IS 'Auth user IDs the preparation has been shared with (read access)';
