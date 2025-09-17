-- Add tags array column if it doesn't exist and create function for tag inheritance
DO $$ 
BEGIN
  -- Add tags column to contacts table if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'tags' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.contacts 
    ADD COLUMN tags text[] DEFAULT '{}';
  END IF;
END $$;

-- Create function to inherit tags from organization to associated contacts
CREATE OR REPLACE FUNCTION inherit_organization_tags()
RETURNS TRIGGER AS $$
BEGIN
  -- When an organization's tags are updated, update all associated contacts
  IF NEW.contact_type = 'organization' AND (OLD.tags IS DISTINCT FROM NEW.tags) THEN
    UPDATE public.contacts 
    SET tags = array_cat(
      -- Keep direct tags (tags that don't come from organization)
      COALESCE(array_agg(DISTINCT tag) FILTER (WHERE tag != ALL(COALESCE(OLD.tags, '{}'))), '{}'),
      -- Add new organization tags
      COALESCE(NEW.tags, '{}')
    )
    FROM unnest(COALESCE(contacts.tags, '{}')) AS tag
    WHERE organization_id = NEW.id 
    AND contact_type = 'person'
    GROUP BY contacts.id;
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

-- Create function to get inherited tags for a contact
CREATE OR REPLACE FUNCTION get_contact_tags(contact_id uuid)
RETURNS jsonb AS $$
DECLARE
  contact_row record;
  org_tags text[] := '{}';
  direct_tags text[] := '{}';
  inherited_tags text[] := '{}';
BEGIN
  -- Get the contact and its organization
  SELECT c.tags, c.organization_id, org.tags as org_tags
  INTO contact_row
  FROM contacts c
  LEFT JOIN contacts org ON org.id = c.organization_id
  WHERE c.id = contact_id;
  
  -- Set direct tags
  direct_tags := COALESCE(contact_row.tags, '{}');
  
  -- Set inherited tags from organization if exists
  IF contact_row.organization_id IS NOT NULL THEN
    org_tags := COALESCE(contact_row.org_tags, '{}');
    inherited_tags := org_tags;
  END IF;
  
  -- Return JSON with separated tag types
  RETURN jsonb_build_object(
    'direct_tags', direct_tags,
    'inherited_tags', inherited_tags,
    'all_tags', array_cat(direct_tags, inherited_tags)
  );
END;
$$ LANGUAGE plpgsql;