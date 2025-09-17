-- Create simplified function for tag inheritance from organization to associated contacts
CREATE OR REPLACE FUNCTION inherit_organization_tags()
RETURNS TRIGGER AS $$
BEGIN
  -- When an organization's tags are updated, update all associated contacts
  IF NEW.contact_type = 'organization' AND (OLD.tags IS DISTINCT FROM NEW.tags) THEN
    -- Update all contacts that belong to this organization
    UPDATE public.contacts 
    SET tags = COALESCE(NEW.tags, '{}')
    WHERE organization_id = NEW.id 
    AND contact_type = 'person';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tag inheritance
DROP TRIGGER IF EXISTS trigger_inherit_organization_tags ON public.contacts;
CREATE TRIGGER trigger_inherit_organization_tags
  AFTER UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION inherit_organization_tags();

-- Create function to assign contact to organization and inherit tags
CREATE OR REPLACE FUNCTION assign_contact_to_organization(contact_id uuid, org_id uuid)
RETURNS void AS $$
DECLARE
  org_tags text[] := '{}';
BEGIN
  -- Get organization tags
  SELECT tags INTO org_tags
  FROM public.contacts 
  WHERE id = org_id AND contact_type = 'organization';
  
  -- Update contact with organization_id and inherit tags
  UPDATE public.contacts 
  SET 
    organization_id = org_id,
    tags = COALESCE(org_tags, '{}'),
    updated_at = now()
  WHERE id = contact_id;
END;
$$ LANGUAGE plpgsql;