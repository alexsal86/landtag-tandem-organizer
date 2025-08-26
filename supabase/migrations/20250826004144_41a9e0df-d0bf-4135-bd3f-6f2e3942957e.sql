-- Create a default tenant for the application
DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  -- Check if a default tenant already exists
  SELECT id INTO default_tenant_id 
  FROM public.tenants 
  WHERE name = 'Standard Organisation' 
  LIMIT 1;
  
  -- If no default tenant exists, create one
  IF default_tenant_id IS NULL THEN
    INSERT INTO public.tenants (id, name, description, settings, is_active)
    VALUES (
      gen_random_uuid(), 
      'Standard Organisation', 
      'Standard Tenant für alle Benutzer', 
      '{"default": true}'::jsonb, 
      true
    )
    RETURNING id INTO default_tenant_id;
  END IF;
  
  -- Add all existing users without tenant memberships to the default tenant
  INSERT INTO public.user_tenant_memberships (user_id, tenant_id, role, is_active)
  SELECT 
    p.user_id,
    default_tenant_id,
    'mitarbeiter'::text,
    true
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_tenant_memberships utm 
    WHERE utm.user_id = p.user_id AND utm.is_active = true
  )
  ON CONFLICT (user_id, tenant_id) DO NOTHING;
  
  -- Update any records with invalid tenant_id strings to use the default tenant
  UPDATE public.tasks 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id::text IN ('default-tenant-id', '') 
  OR tenant_id IS NULL;
  
  UPDATE public.appointments 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id::text IN ('default-tenant-id', '') 
  OR tenant_id IS NULL;
  
  UPDATE public.documents 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id::text IN ('default-tenant-id', '') 
  OR tenant_id IS NULL;
  
  UPDATE public.todos 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id::text IN ('default-tenant-id', '') 
  OR tenant_id IS NULL;
  
  UPDATE public.contacts 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id::text IN ('default-tenant-id', '') 
  OR tenant_id IS NULL;
  
  UPDATE public.profiles 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id::text IN ('default-tenant-id', '') 
  OR tenant_id IS NULL;
  
  UPDATE public.user_status 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id::text IN ('default-tenant-id', '') 
  OR tenant_id IS NULL;
  
  UPDATE public.time_entries 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id::text IN ('default-tenant-id', '') 
  OR tenant_id IS NULL;
  
  UPDATE public.distribution_lists 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id::text IN ('default-tenant-id', '') 
  OR tenant_id IS NULL;
  
  UPDATE public.planning_templates 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id::text IN ('default-tenant-id', '') 
  OR tenant_id IS NULL;
  
  UPDATE public.team_dashboards 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id::text IN ('default-tenant-id', '') 
  OR tenant_id IS NULL;
  
  RAISE NOTICE 'Default tenant setup completed with ID: %', default_tenant_id;
END $$;