-- Trigger-Funktion für automatische Kontakt-Aktivitätsprotokollierung
CREATE OR REPLACE FUNCTION log_contact_activity()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields text[];
BEGIN
  -- Bei INSERT: "Kontakt erstellt" protokollieren
  IF TG_OP = 'INSERT' THEN
    INSERT INTO contact_activities (
      contact_id, tenant_id, activity_type, title, 
      description, created_by, metadata
    ) VALUES (
      NEW.id, 
      NEW.tenant_id, 
      'created', 
      'Kontakt erstellt',
      'Kontakt "' || NEW.name || '" wurde erstellt.',
      COALESCE(auth.uid(), NEW.user_id),
      jsonb_build_object(
        'contact_type', NEW.contact_type,
        'category', NEW.category
      )
    );
    RETURN NEW;
  END IF;

  -- Bei UPDATE: Geänderte Felder ermitteln und protokollieren
  IF TG_OP = 'UPDATE' THEN
    changed_fields := ARRAY[]::text[];
    
    -- Wichtige Felder auf Änderungen prüfen
    IF OLD.name IS DISTINCT FROM NEW.name THEN
      changed_fields := array_append(changed_fields, 'name');
    END IF;
    IF OLD.email IS DISTINCT FROM NEW.email THEN
      changed_fields := array_append(changed_fields, 'email');
    END IF;
    IF OLD.phone IS DISTINCT FROM NEW.phone THEN
      changed_fields := array_append(changed_fields, 'phone');
    END IF;
    IF OLD.organization IS DISTINCT FROM NEW.organization THEN
      changed_fields := array_append(changed_fields, 'organization');
    END IF;
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      changed_fields := array_append(changed_fields, 'role');
    END IF;
    IF OLD.category IS DISTINCT FROM NEW.category THEN
      changed_fields := array_append(changed_fields, 'category');
    END IF;
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      changed_fields := array_append(changed_fields, 'priority');
    END IF;
    IF OLD.tags IS DISTINCT FROM NEW.tags THEN
      changed_fields := array_append(changed_fields, 'tags');
    END IF;
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      changed_fields := array_append(changed_fields, 'notes');
    END IF;
    IF OLD.business_description IS DISTINCT FROM NEW.business_description THEN
      changed_fields := array_append(changed_fields, 'business_description');
    END IF;
    IF OLD.business_street IS DISTINCT FROM NEW.business_street OR
       OLD.business_city IS DISTINCT FROM NEW.business_city OR
       OLD.business_postal_code IS DISTINCT FROM NEW.business_postal_code THEN
      changed_fields := array_append(changed_fields, 'address');
    END IF;
    
    -- Nur protokollieren wenn sich etwas geändert hat
    IF array_length(changed_fields, 1) > 0 THEN
      INSERT INTO contact_activities (
        contact_id, tenant_id, activity_type, title, 
        description, created_by, metadata
      ) VALUES (
        NEW.id,
        NEW.tenant_id,
        'edit',
        'Kontakt bearbeitet',
        'Geänderte Felder: ' || array_to_string(changed_fields, ', '),
        COALESCE(auth.uid(), NEW.user_id),
        jsonb_build_object(
          'changed_fields', changed_fields,
          'old_values', jsonb_build_object(
            'name', OLD.name,
            'email', OLD.email,
            'phone', OLD.phone,
            'organization', OLD.organization,
            'role', OLD.role,
            'category', OLD.category,
            'priority', OLD.priority
          ),
          'new_values', jsonb_build_object(
            'name', NEW.name,
            'email', NEW.email,
            'phone', NEW.phone,
            'organization', NEW.organization,
            'role', NEW.role,
            'category', NEW.category,
            'priority', NEW.priority
          )
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Bei DELETE: "Kontakt gelöscht" protokollieren
  IF TG_OP = 'DELETE' THEN
    INSERT INTO contact_activities (
      contact_id, tenant_id, activity_type, title, 
      description, created_by, metadata
    ) VALUES (
      OLD.id,
      OLD.tenant_id,
      'deleted',
      'Kontakt gelöscht',
      'Kontakt "' || OLD.name || '" wurde gelöscht.',
      COALESCE(auth.uid(), OLD.user_id),
      jsonb_build_object(
        'deleted_contact', jsonb_build_object(
          'name', OLD.name,
          'email', OLD.email,
          'phone', OLD.phone,
          'organization', OLD.organization,
          'contact_type', OLD.contact_type,
          'category', OLD.category
        )
      )
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger auf contacts-Tabelle
DROP TRIGGER IF EXISTS contact_audit_trail_trigger ON contacts;
CREATE TRIGGER contact_audit_trail_trigger
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION log_contact_activity();