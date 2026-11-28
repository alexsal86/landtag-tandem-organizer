-- Archiv ist ein Status, kein Kontakttyp.
--
-- Bisher galt ein Kontakt als archiviert, wenn contact_type = 'archive' war
-- (das erzeugten nur Anruf-Follow-ups unbekannter Nummern) oder wenn er
-- "Archivierter Kontakt" hieß. Der Name wurde nirgends geschrieben, der Zähler
-- zählte distinct phone dieser Phantomzeilen. Auswahlfelder schlossen den Typ
-- 'archive' aus, die Zeilen waren dadurch unsichtbar; ein Kontakt, der nur so
-- hieß, galt umgekehrt als archiviert.
--
-- Neue Regel: archived_at + archive_reason + archived_by. Archivierte Kontakte
-- bleiben lesbar (Aufbewahrung, Historie, Verknüpfungen), sind aber aus Listen,
-- Auswahlfeldern und Zählern ausgeblendet und jederzeit wiederherstellbar.
-- Löschen bleibt der getrennte DSGVO-Pfad (gdpr_requests).

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

COMMENT ON COLUMN public.contacts.archived_at IS
  'Archivstatus: gesetzt = aus Listen/Auswahlfeldern ausgeblendet, aber lesbar und wiederherstellbar.';
COMMENT ON COLUMN public.contacts.archive_reason IS
  'Freitextgrund der Archivierung.';
COMMENT ON COLUMN public.contacts.archived_by IS
  'auth.uid() der archivierenden Person.';

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_archived
  ON public.contacts (tenant_id, archived_at);

-- Anruf-Follow-ups unbekannter Nummern sind keine archivierten Kontakte,
-- sondern unvollständige Personen. Sie werden sichtbar und als Herkunft
-- gekennzeichnet, damit sie vervollständigt oder gelöscht werden können.
UPDATE public.contacts
   SET contact_type = 'person',
       source_origin = COALESCE(NULLIF(source_origin, ''), 'call_followup'),
       archived_at = NULL
 WHERE contact_type = 'archive';

-- Der Typ 'archive' entfällt; person/organization bleiben.
DO $$
DECLARE
  check_constraint record;
BEGIN
  FOR check_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.contacts'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%contact_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.contacts DROP CONSTRAINT %I', check_constraint.conname);
  END LOOP;
END $$;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_contact_type_check
  CHECK (
    contact_type IS NULL
    OR contact_type = ANY (ARRAY['person', 'organization']::text[])
  ) NOT VALID;

-- Zähler: Personen und Organisationen ohne Archiv, Archiv als eigener Bestand.
CREATE OR REPLACE FUNCTION public.get_contact_counts(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contacts_count integer := 0;
  v_stakeholders_count integer := 0;
  v_archive_count integer := 0;
  v_distribution_lists_count integer := 0;
BEGIN
  IF NOT public.user_belongs_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Büro.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_contacts_count
  FROM contacts c
  WHERE c.tenant_id = p_tenant_id
    AND c.contact_type = 'person'
    AND c.archived_at IS NULL;

  SELECT count(*) INTO v_stakeholders_count
  FROM contacts c
  WHERE c.tenant_id = p_tenant_id
    AND c.contact_type = 'organization'
    AND c.archived_at IS NULL;

  SELECT count(*) INTO v_archive_count
  FROM contacts c
  WHERE c.tenant_id = p_tenant_id
    AND c.archived_at IS NOT NULL;

  SELECT count(*) INTO v_distribution_lists_count
  FROM distribution_lists dl
  WHERE dl.tenant_id = p_tenant_id
    OR dl.tenant_id IS NULL;

  RETURN jsonb_build_object(
    'contactsCount', v_contacts_count,
    'stakeholdersCount', v_stakeholders_count,
    'archiveCount', v_archive_count,
    'distributionListsCount', v_distribution_lists_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_contact_counts(uuid) TO authenticated;

-- Archivieren und Wiederherstellen laufen über eine mandantengeprüfte RPC,
-- damit Status, Grund und Person nicht in getrennten Schreibvorgängen driften.
CREATE OR REPLACE FUNCTION public.archive_contact(
  p_contact_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact public.contacts;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet.' USING ERRCODE = '42501';
  END IF;
  IF p_contact_id IS NULL THEN
    RAISE EXCEPTION 'Kein Kontakt angegeben.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_contact FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF v_contact.id IS NULL THEN
    RAISE EXCEPTION 'Kontakt nicht gefunden.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.user_belongs_to_tenant(v_contact.tenant_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Büro.' USING ERRCODE = '42501';
  END IF;

  IF v_contact.archived_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', v_contact.id, 'status', 'already_archived', 'archived_at', v_contact.archived_at
    );
  END IF;

  UPDATE public.contacts
     SET archived_at = now(),
         archive_reason = NULLIF(btrim(coalesce(p_reason, '')), ''),
         archived_by = v_actor,
         updated_at = now()
   WHERE id = v_contact.id;

  RETURN jsonb_build_object('id', v_contact.id, 'status', 'archived', 'archived_at', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.unarchive_contact(p_contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact public.contacts;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet.' USING ERRCODE = '42501';
  END IF;
  IF p_contact_id IS NULL THEN
    RAISE EXCEPTION 'Kein Kontakt angegeben.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_contact FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF v_contact.id IS NULL THEN
    RAISE EXCEPTION 'Kontakt nicht gefunden.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.user_belongs_to_tenant(v_contact.tenant_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Büro.' USING ERRCODE = '42501';
  END IF;

  IF v_contact.archived_at IS NULL THEN
    RETURN jsonb_build_object('id', v_contact.id, 'status', 'not_archived');
  END IF;

  UPDATE public.contacts
     SET archived_at = NULL,
         archive_reason = NULL,
         archived_by = NULL,
         updated_at = now()
   WHERE id = v_contact.id;

  RETURN jsonb_build_object('id', v_contact.id, 'status', 'restored');
END;
$$;

REVOKE ALL ON FUNCTION public.archive_contact(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unarchive_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_contact(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unarchive_contact(uuid) TO authenticated;
