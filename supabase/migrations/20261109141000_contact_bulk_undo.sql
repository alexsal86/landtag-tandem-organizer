-- Capture actual before/after values inside the database, never client-supplied snapshots.
CREATE OR REPLACE FUNCTION public.audit_contact_field_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE batch record; undo_id text:=current_setting('app.bulk_undo_id',true);
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF undo_id IS NOT NULL AND EXISTS(SELECT 1 FROM bulk_action_audit WHERE id::text=undo_id AND undone_by=auth.uid() AND undone_at=transaction_timestamp()) THEN RETURN NULL; END IF;
  FOR batch IN
    SELECT n.tenant_id,count(*)::int AS affected,jsonb_agg(jsonb_build_object(
      'id',n.id,'before',jsonb_build_object('tags',o.tags,'category',o.category),
      'after',jsonb_build_object('tags',n.tags,'category',n.category)) ORDER BY n.id) AS changes
    FROM new_contacts n JOIN old_contacts o ON o.id=n.id
    WHERE n.tags IS DISTINCT FROM o.tags OR n.category IS DISTINCT FROM o.category
    GROUP BY n.tenant_id
  LOOP
    INSERT INTO bulk_action_audit(tenant_id,actor_id,action,payload,undo_payload,affected_count)
    VALUES(batch.tenant_id,auth.uid(),'contacts.fields_updated',jsonb_build_object('fields',ARRAY['tags','category']),jsonb_build_object('version',1,'changes',batch.changes),batch.affected);
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER audit_contact_fields AFTER UPDATE ON public.contacts
  REFERENCING OLD TABLE AS old_contacts NEW TABLE AS new_contacts
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_contact_field_updates();

CREATE OR REPLACE FUNCTION public.bulk_update_contact_fields(_tenant_id uuid,_ids uuid[],_operation text,_value jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE affected integer; previous text:=current_setting('app.secured_field_read',true);
BEGIN
  IF auth.uid() IS NULL OR NOT is_tenant_member(_tenant_id,auth.uid()) THEN RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE='42501'; END IF;
  IF _ids IS NULL OR cardinality(_ids)=0 OR cardinality(_ids)>500 OR cardinality(_ids)<>(SELECT count(DISTINCT id) FROM unnest(_ids) id) THEN RAISE EXCEPTION 'Ungültige Kontaktauswahl' USING ERRCODE='22023'; END IF;
  PERFORM set_config('app.secured_field_read','contacts',true);
  IF _operation='tags_add' THEN
    IF jsonb_typeof(_value) IS DISTINCT FROM 'array' OR jsonb_array_length(_value)>50 OR EXISTS(SELECT 1 FROM jsonb_array_elements(_value) item WHERE jsonb_typeof(item)<>'string' OR length(item#>>'{}')>100) THEN RAISE EXCEPTION 'Ungültige Tags' USING ERRCODE='22023'; END IF;
    UPDATE contacts SET tags=ARRAY(SELECT DISTINCT tag FROM unnest(coalesce(tags,'{}'::text[]) || ARRAY(SELECT jsonb_array_elements_text(_value))) tag)
      WHERE tenant_id=_tenant_id AND id=ANY(_ids);
  ELSIF _operation='category_set' THEN
    IF jsonb_typeof(_value) IS DISTINCT FROM 'string' OR length(_value#>>'{}') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Ungültige Kategorie' USING ERRCODE='22023'; END IF;
    UPDATE contacts SET category=_value#>>'{}' WHERE tenant_id=_tenant_id AND id=ANY(_ids);
  ELSE RAISE EXCEPTION 'Unbekannte Sammelaktion' USING ERRCODE='22023';
  END IF;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>cardinality(_ids) THEN RAISE EXCEPTION 'Nicht alle Kontakte sind im Büro verfügbar' USING ERRCODE='42501'; END IF;
  PERFORM set_config('app.secured_field_read',coalesce(previous,''),true);
  RETURN affected;
EXCEPTION WHEN OTHERS THEN PERFORM set_config('app.secured_field_read',coalesce(previous,''),true); RAISE;
END $$;

CREATE OR REPLACE FUNCTION public.undo_contact_bulk_action(_audit_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE audit public.bulk_action_audit; change jsonb; contact public.contacts; restored integer:=0;
BEGIN
  SELECT * INTO audit FROM bulk_action_audit WHERE id=_audit_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT (is_tenant_admin(auth.uid(),audit.tenant_id) OR is_superadmin(auth.uid())) THEN RAISE EXCEPTION 'Keine Berechtigung für diese Sammelaktion' USING ERRCODE='42501'; END IF;
  IF audit.undone_at IS NOT NULL THEN RAISE EXCEPTION 'Bereits rückgängig gemacht' USING ERRCODE='22023'; END IF;
  IF audit.created_at<now()-interval '30 days' OR audit.action<>'contacts.fields_updated' OR audit.undo_payload->>'version' IS DISTINCT FROM '1' OR jsonb_typeof(audit.undo_payload->'changes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Für diese Aktion ist keine Rücknahme verfügbar' USING ERRCODE='22023'; END IF;
  PERFORM set_config('app.bulk_undo_id',audit.id::text,true);
  UPDATE bulk_action_audit SET undone_at=transaction_timestamp(),undone_by=auth.uid() WHERE id=audit.id;
  FOR change IN SELECT value FROM jsonb_array_elements(audit.undo_payload->'changes') LOOP
    SELECT * INTO contact FROM contacts WHERE id=(change->>'id')::uuid AND tenant_id=audit.tenant_id FOR UPDATE;
    IF NOT FOUND OR jsonb_build_object('tags',contact.tags,'category',contact.category) IS DISTINCT FROM change->'after' THEN
      RAISE EXCEPTION 'Kontakt fehlt oder wurde inzwischen verändert. Rücknahme nicht ausgeführt.' USING ERRCODE='22023';
    END IF;
    UPDATE contacts SET category=change->'before'->>'category',tags=CASE WHEN change->'before'->'tags'='null'::jsonb THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text(change->'before'->'tags')) END WHERE id=contact.id;
    restored:=restored+1;
  END LOOP;
  PERFORM set_config('app.bulk_undo_id','',true);
  RETURN restored;
END $$;
REVOKE ALL ON FUNCTION public.bulk_update_contact_fields(uuid,uuid[],text,jsonb), public.undo_contact_bulk_action(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bulk_update_contact_fields(uuid,uuid[],text,jsonb), public.undo_contact_bulk_action(uuid) TO authenticated;
