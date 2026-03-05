-- Case items for structured case work across channels
DO $$
BEGIN
  CREATE TYPE public.case_item_source_channel AS ENUM ('phone', 'email', 'social', 'in_person', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.case_item_status AS ENUM ('active', 'pending', 'closed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.case_item_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.case_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  source_channel public.case_item_source_channel NOT NULL DEFAULT 'other',
  status public.case_item_status NOT NULL DEFAULT 'active',
  priority public.case_item_priority NOT NULL DEFAULT 'medium',
  owner_user_id uuid REFERENCES auth.users(id),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  due_at timestamptz,
  follow_up_at timestamptz,
  resolution_summary text,
  case_file_id uuid REFERENCES public.case_files(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_items_due_after_followup_check CHECK (
    due_at IS NULL OR follow_up_at IS NULL OR due_at >= follow_up_at
  )
);

CREATE TABLE IF NOT EXISTS public.case_item_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_item_id uuid NOT NULL REFERENCES public.case_items(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  interaction_type public.case_item_source_channel NOT NULL,
  interaction_at timestamptz NOT NULL DEFAULT now(),
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound', 'internal')),
  summary text,
  payload jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_item_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_item_id uuid NOT NULL REFERENCES public.case_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'owner')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_item_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.case_item_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_item_id uuid NOT NULL REFERENCES public.case_items(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_item_id, document_id)
);

ALTER TABLE public.case_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_item_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_item_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_item_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view case items in their tenant"
ON public.case_items FOR SELECT
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create case items in their tenant"
ON public.case_items FOR INSERT
WITH CHECK (
  tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  AND user_id = auth.uid()
);

CREATE POLICY "Users can update case items in their tenant"
ON public.case_items FOR UPDATE
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())))
WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete own case items in their tenant"
ON public.case_items FOR DELETE
USING (
  tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  AND user_id = auth.uid()
);

CREATE POLICY "Users can manage case item interactions in their tenant"
ON public.case_item_interactions FOR ALL
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())))
WITH CHECK (
  tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  AND EXISTS (
    SELECT 1
    FROM public.case_items ci
    WHERE ci.id = case_item_interactions.case_item_id
      AND ci.tenant_id = case_item_interactions.tenant_id
  )
);

CREATE POLICY "Users can manage case item participants in their tenant"
ON public.case_item_participants FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.case_items ci
    WHERE ci.id = case_item_participants.case_item_id
      AND ci.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.case_items ci
    WHERE ci.id = case_item_participants.case_item_id
      AND ci.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Users can manage case item attachments in their tenant"
ON public.case_item_attachments FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.case_items ci
    WHERE ci.id = case_item_attachments.case_item_id
      AND ci.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.case_items ci
    WHERE ci.id = case_item_attachments.case_item_id
      AND ci.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  )
);

CREATE INDEX IF NOT EXISTS idx_case_items_tenant_status ON public.case_items(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_case_items_owner_user_id ON public.case_items(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_case_items_contact_id ON public.case_items(contact_id);
CREATE INDEX IF NOT EXISTS idx_case_items_case_file_id ON public.case_items(case_file_id);
CREATE INDEX IF NOT EXISTS idx_case_item_interactions_case_item_id ON public.case_item_interactions(case_item_id);
CREATE INDEX IF NOT EXISTS idx_case_item_interactions_tenant_id ON public.case_item_interactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_case_item_participants_case_item_id ON public.case_item_participants(case_item_id);
CREATE INDEX IF NOT EXISTS idx_case_item_attachments_case_item_id ON public.case_item_attachments(case_item_id);

DROP TRIGGER IF EXISTS update_case_items_updated_at ON public.case_items;
CREATE TRIGGER update_case_items_updated_at
BEFORE UPDATE ON public.case_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
