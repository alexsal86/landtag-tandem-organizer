-- Add missing tenant memberships for users without tenant access
INSERT INTO public.user_tenant_memberships (user_id, tenant_id, role, is_active)
SELECT 
  p.user_id,
  '2650522d-3c39-4734-b717-af3c188cc57c', -- Standard Büro tenant
  'mitarbeiter', -- Default role
  true
FROM public.profiles p
LEFT JOIN public.user_tenant_memberships utm ON p.user_id = utm.user_id
WHERE utm.user_id IS NULL;