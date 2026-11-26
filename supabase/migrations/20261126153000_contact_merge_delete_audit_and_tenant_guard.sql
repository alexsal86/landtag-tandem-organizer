-- Kontakt zusammenführen scheiterte mit
--   Code 42501 · "Cross-tenant reference is forbidden"
--
-- Zwei Ursachen, beide im Löschen des Zweitkontakts:
--
-- 1. guard_tenant_references verlor mit 20261115075450 die FOUND-Prüfung.
--    Ohne sie galt jede Elternzeile, die (noch) nicht existiert, als fremder
--    Mandant: parent_tenant blieb NULL, und `NULL IS DISTINCT FROM <Mandant>`
--    ist wahr. Genau das trifft den Audit-Trigger beim Löschen: Er schreibt
--    eine Aktivität mit der ID des gerade gelöschten Kontakts, deren
--    Elternzeile nicht mehr auffindbar ist. Die FOUND-Prüfung ist wieder da;
--    ob ein Elternteil existiert, entscheidet wie bisher der Fremdschlüssel
--    (23503), nicht der Mandantenwächter.
--
-- 2. log_contact_activity schrieb beim Löschen eine Aktivität mit
--    activity_type 'deleted'. Diesen Wert erlaubt der CHECK auf
--    contact_activities nicht, und contact_id verweist mit ON DELETE CASCADE
--    auf den gerade gelöschten Kontakt. Löschen war damit grundsätzlich
--    unmöglich, also auch das Zusammenführen. Die Aktivitäten eines
--    gelöschten Kontakts würden ohnehin mitkaskadiert; den Vorgang belegt
--    merge_contacts selbst mit seiner Aktivität am erhaltenen Kontakt.
--    Andere Löschpfade auf contacts gibt es nicht.

CREATE OR REPLACE FUNCTION public.guard_tenant_references() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE payload jsonb:=to_jsonb(NEW); previous jsonb; target_tenant uuid; parent_tenant uuid; ref record; value text;
BEGIN
 target_tenant:=(payload->>'tenant_id')::uuid;
 IF TG_OP='UPDATE' THEN
  previous:=to_jsonb(OLD);
  IF previous->>'tenant_id' IS DISTINCT FROM payload->>'tenant_id' THEN RAISE EXCEPTION 'Tenant reassignment is forbidden' USING ERRCODE='42501'; END IF;
 END IF;
 FOR ref IN
  SELECT a.attname AS col, pn.nspname AS parent_schema, pc.relname AS parent_table, pa.attname AS parent_col, format_type(pa.atttypid,pa.atttypmod) AS parent_type
  FROM pg_constraint f JOIN pg_class pc ON pc.oid=f.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace
  JOIN pg_attribute a ON a.attrelid=f.conrelid AND a.attnum=f.conkey[1]
  JOIN pg_attribute pa ON pa.attrelid=f.confrelid AND pa.attnum=f.confkey[1]
  WHERE f.contype='f' AND f.conrelid=TG_RELID AND cardinality(f.conkey)=1
   AND pn.nspname='public' AND pc.relname NOT IN ('profiles','tenants','user_tenant_memberships')
   AND EXISTS(SELECT 1 FROM pg_attribute x WHERE x.attrelid=pc.oid AND x.attname='tenant_id' AND NOT x.attisdropped)
 LOOP
  value:=payload->>ref.col;
  IF value IS NULL THEN CONTINUE; END IF;
  EXECUTE format('SELECT tenant_id FROM %I.%I WHERE %I=$1::%s FOR KEY SHARE',ref.parent_schema,ref.parent_table,ref.parent_col,ref.parent_type) INTO parent_tenant USING value;
  IF FOUND AND parent_tenant IS DISTINCT FROM target_tenant THEN RAISE EXCEPTION 'Cross-tenant reference is forbidden' USING ERRCODE='42501'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_tenant_references() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.log_contact_activity()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE changed_fields text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO contact_activities (contact_id, tenant_id, activity_type, title, description, created_by, metadata)
    VALUES (NEW.id, NEW.tenant_id, 'created', 'Kontakt erstellt', 'Kontakt "' || NEW.name || '" wurde erstellt.',
      COALESCE(auth.uid(), NEW.user_id), jsonb_build_object('contact_type', NEW.contact_type, 'category', NEW.category));
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    changed_fields := ARRAY[]::text[];
    IF OLD.name IS DISTINCT FROM NEW.name THEN changed_fields := array_append(changed_fields, 'name'); END IF;
    IF OLD.email IS DISTINCT FROM NEW.email THEN changed_fields := array_append(changed_fields, 'email'); END IF;
    IF OLD.phone IS DISTINCT FROM NEW.phone THEN changed_fields := array_append(changed_fields, 'phone'); END IF;
    IF OLD.organization IS DISTINCT FROM NEW.organization THEN changed_fields := array_append(changed_fields, 'organization'); END IF;
    IF OLD.position IS DISTINCT FROM NEW.position THEN changed_fields := array_append(changed_fields, 'position'); END IF;
    IF OLD.category IS DISTINCT FROM NEW.category THEN changed_fields := array_append(changed_fields, 'category'); END IF;
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN changed_fields := array_append(changed_fields, 'priority'); END IF;
    IF OLD.tags IS DISTINCT FROM NEW.tags THEN changed_fields := array_append(changed_fields, 'tags'); END IF;
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN changed_fields := array_append(changed_fields, 'notes'); END IF;
    IF OLD.business_street IS DISTINCT FROM NEW.business_street OR OLD.business_city IS DISTINCT FROM NEW.business_city
       OR OLD.business_postal_code IS DISTINCT FROM NEW.business_postal_code THEN
      changed_fields := array_append(changed_fields, 'address');
    END IF;
    IF array_length(changed_fields, 1) > 0 THEN
      INSERT INTO contact_activities (contact_id, tenant_id, activity_type, title, description, created_by, metadata)
      VALUES (NEW.id, NEW.tenant_id, 'edit', 'Kontakt bearbeitet', 'Geänderte Felder: ' || array_to_string(changed_fields, ', '),
        COALESCE(auth.uid(), NEW.user_id),
        jsonb_build_object('changed_fields', changed_fields,
          'old_values', jsonb_build_object('name', OLD.name, 'email', OLD.email, 'phone', OLD.phone, 'organization', OLD.organization, 'position', OLD.position, 'category', OLD.category, 'priority', OLD.priority),
          'new_values', jsonb_build_object('name', NEW.name, 'email', NEW.email, 'phone', NEW.phone, 'organization', NEW.organization, 'position', NEW.position, 'category', NEW.category, 'priority', NEW.priority)));
    END IF;
    RETURN NEW;
  END IF;
  -- Löschen: keine Aktivität mehr. contact_activities kennt 'deleted' nicht und
  -- würde mit dem gelöschten Kontakt kaskadieren; merge_contacts protokolliert
  -- die Zusammenführung selbst am erhaltenen Kontakt.
  RETURN OLD;
END;
$function$;
