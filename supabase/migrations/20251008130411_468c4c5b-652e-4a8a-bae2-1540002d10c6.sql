-- Cleanup duplicate storage policies
DROP POLICY IF EXISTS "Users can upload planning documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own planning documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own planning documents" ON storage.objects;
DROP POLICY IF EXISTS "Collaborators can view planning documents" ON storage.objects;

-- Add tenant_id column to planning_item_documents (nullable first)
ALTER TABLE public.planning_item_documents 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Populate existing records with tenant_id from event_plannings
UPDATE public.planning_item_documents pid
SET tenant_id = ep.tenant_id
FROM public.event_planning_checklist_items epci
JOIN public.event_plannings ep ON ep.id = epci.event_planning_id
WHERE pid.planning_item_id = epci.id;

-- Delete any orphaned records that couldn't be matched
DELETE FROM public.planning_item_documents
WHERE tenant_id IS NULL;

-- Now make tenant_id NOT NULL
ALTER TABLE public.planning_item_documents 
ALTER COLUMN tenant_id SET NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_planning_item_documents_tenant_id 
ON public.planning_item_documents(tenant_id);

-- Update RLS policies to include tenant check
DROP POLICY IF EXISTS "Users can manage their own planning item documents" ON public.planning_item_documents;

CREATE POLICY "Users can view planning item documents in their tenant"
ON public.planning_item_documents
FOR SELECT
TO authenticated
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert planning item documents in their tenant"
ON public.planning_item_documents
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = ANY(get_user_tenant_ids(auth.uid())) AND
  user_id = auth.uid()
);

CREATE POLICY "Users can delete their own planning item documents in their tenant"
ON public.planning_item_documents
FOR DELETE
TO authenticated
USING (
  tenant_id = ANY(get_user_tenant_ids(auth.uid())) AND
  user_id = auth.uid()
);