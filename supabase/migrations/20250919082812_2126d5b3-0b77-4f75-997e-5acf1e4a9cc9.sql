-- Migration to create organizations from existing organization names and link contacts

-- First, create organization contacts from unique organization names
INSERT INTO public.contacts (
  user_id, tenant_id, name, contact_type, created_at, updated_at
)
SELECT DISTINCT 
  user_id,
  tenant_id,
  organization as name,
  'organization'::text as contact_type,
  now() as created_at,
  now() as updated_at
FROM public.contacts 
WHERE organization IS NOT NULL 
  AND organization != '' 
  AND contact_type = 'person'
  AND NOT EXISTS (
    SELECT 1 FROM public.contacts c2 
    WHERE c2.name = contacts.organization 
    AND c2.contact_type = 'organization'
    AND c2.tenant_id = contacts.tenant_id
  );

-- Update person contacts to link to their organization contacts
UPDATE public.contacts 
SET organization_id = (
  SELECT org.id 
  FROM public.contacts org 
  WHERE org.name = contacts.organization 
    AND org.contact_type = 'organization'
    AND org.tenant_id = contacts.tenant_id
  LIMIT 1
)
WHERE contact_type = 'person' 
  AND organization IS NOT NULL 
  AND organization != ''
  AND organization_id IS NULL;