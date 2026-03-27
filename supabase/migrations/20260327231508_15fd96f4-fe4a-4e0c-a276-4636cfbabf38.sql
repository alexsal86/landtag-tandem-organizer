-- Step 0: Fix trigger that references business_description (already dropped column)
CREATE OR REPLACE FUNCTION public.log_contact_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  changed_fields text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO contact_activities (
      contact_id, tenant_id, activity_type, title, 
      description, created_by, metadata
    ) VALUES (
      NEW.id, NEW.tenant_id, 'created', 'Kontakt erstellt',
      'Kontakt "' || NEW.name || '" wurde erstellt.',
      COALESCE(auth.uid(), NEW.user_id),
      jsonb_build_object('contact_type', NEW.contact_type, 'category', NEW.category)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    changed_fields := ARRAY[]::text[];
    
    IF OLD.name IS DISTINCT FROM NEW.name THEN changed_fields := array_append(changed_fields, 'name'); END IF;
    IF OLD.email IS DISTINCT FROM NEW.email THEN changed_fields := array_append(changed_fields, 'email'); END IF;
    IF OLD.phone IS DISTINCT FROM NEW.phone THEN changed_fields := array_append(changed_fields, 'phone'); END IF;
    IF OLD.organization IS DISTINCT FROM NEW.organization THEN changed_fields := array_append(changed_fields, 'organization'); END IF;
    IF OLD.role IS DISTINCT FROM NEW.role THEN changed_fields := array_append(changed_fields, 'role'); END IF;
    IF OLD.category IS DISTINCT FROM NEW.category THEN changed_fields := array_append(changed_fields, 'category'); END IF;
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN changed_fields := array_append(changed_fields, 'priority'); END IF;
    IF OLD.tags IS DISTINCT FROM NEW.tags THEN changed_fields := array_append(changed_fields, 'tags'); END IF;
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN changed_fields := array_append(changed_fields, 'notes'); END IF;
    IF OLD.business_street IS DISTINCT FROM NEW.business_street OR
       OLD.business_city IS DISTINCT FROM NEW.business_city OR
       OLD.business_postal_code IS DISTINCT FROM NEW.business_postal_code THEN
      changed_fields := array_append(changed_fields, 'address');
    END IF;
    
    IF array_length(changed_fields, 1) > 0 THEN
      INSERT INTO contact_activities (
        contact_id, tenant_id, activity_type, title, 
        description, created_by, metadata
      ) VALUES (
        NEW.id, NEW.tenant_id, 'edit', 'Kontakt bearbeitet',
        'Geänderte Felder: ' || array_to_string(changed_fields, ', '),
        COALESCE(auth.uid(), NEW.user_id),
        jsonb_build_object(
          'changed_fields', changed_fields,
          'old_values', jsonb_build_object('name', OLD.name, 'email', OLD.email, 'phone', OLD.phone, 'organization', OLD.organization, 'role', OLD.role, 'category', OLD.category, 'priority', OLD.priority),
          'new_values', jsonb_build_object('name', NEW.name, 'email', NEW.email, 'phone', NEW.phone, 'organization', NEW.organization, 'role', NEW.role, 'category', NEW.category, 'priority', NEW.priority)
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO contact_activities (
      contact_id, tenant_id, activity_type, title, 
      description, created_by, metadata
    ) VALUES (
      OLD.id, OLD.tenant_id, 'deleted', 'Kontakt gelöscht',
      'Kontakt "' || OLD.name || '" wurde gelöscht.',
      COALESCE(auth.uid(), OLD.user_id),
      jsonb_build_object('deleted_contact', jsonb_build_object('name', OLD.name, 'email', OLD.email, 'phone', OLD.phone, 'organization', OLD.organization, 'contact_type', OLD.contact_type, 'category', OLD.category))
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

-- Step 1: Consolidate data before dropping columns
UPDATE contacts SET organization = company WHERE (organization IS NULL OR organization = '') AND company IS NOT NULL AND company != '';
UPDATE contacts SET notes = CASE WHEN (notes IS NULL OR notes = '') THEN additional_info ELSE notes || E'\n\n--- Zusätzliche Info ---\n' || additional_info END WHERE additional_info IS NOT NULL AND additional_info != '';
UPDATE contacts SET phone = private_phone WHERE (phone IS NULL OR phone = '') AND private_phone IS NOT NULL AND private_phone != '';

-- Step 2: Drop 20 columns
ALTER TABLE contacts DROP COLUMN IF EXISTS certifications;
ALTER TABLE contacts DROP COLUMN IF EXISTS marketing_consent;
ALTER TABLE contacts DROP COLUMN IF EXISTS newsletter_subscription;
ALTER TABLE contacts DROP COLUMN IF EXISTS meeting_preferences;
ALTER TABLE contacts DROP COLUMN IF EXISTS gdpr_consent_date;
ALTER TABLE contacts DROP COLUMN IF EXISTS data_protection_notes;
ALTER TABLE contacts DROP COLUMN IF EXISTS company;
ALTER TABLE contacts DROP COLUMN IF EXISTS additional_info;
ALTER TABLE contacts DROP COLUMN IF EXISTS added_at;
ALTER TABLE contacts DROP COLUMN IF EXISTS added_reason;
ALTER TABLE contacts DROP COLUMN IF EXISTS location;
ALTER TABLE contacts DROP COLUMN IF EXISTS private_street;
ALTER TABLE contacts DROP COLUMN IF EXISTS private_house_number;
ALTER TABLE contacts DROP COLUMN IF EXISTS private_postal_code;
ALTER TABLE contacts DROP COLUMN IF EXISTS private_city;
ALTER TABLE contacts DROP COLUMN IF EXISTS private_country;
ALTER TABLE contacts DROP COLUMN IF EXISTS private_phone;
ALTER TABLE contacts DROP COLUMN IF EXISTS private_phone_2;
ALTER TABLE contacts DROP COLUMN IF EXISTS business_phone_2;