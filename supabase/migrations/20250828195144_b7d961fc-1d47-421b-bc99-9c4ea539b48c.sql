-- Update existing event_plannings with NULL tenant_id to use their user's primary tenant
UPDATE public.event_plannings 
SET tenant_id = (
  SELECT utm.tenant_id 
  FROM public.user_tenant_memberships utm 
  WHERE utm.user_id = event_plannings.user_id 
  AND utm.is_active = true 
  ORDER BY utm.created_at ASC 
  LIMIT 1
)
WHERE tenant_id IS NULL;