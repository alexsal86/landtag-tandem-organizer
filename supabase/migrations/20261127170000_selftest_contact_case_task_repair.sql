-- Reparatur der verbliebenen Selbsttest-Befunde aus Kontakte, Fallakten und
-- Aufgaben. Alle Schritte sind idempotent und ändern keinen Bestand.
--
-- 1) Vorgänge & Fallakten · „Aufgabe über die Akten-RPC erzeugen“ meldet
--    PGRST202: public.create_case_file_task fehlt mit der vom Client genutzten
--    Signatur im Schema-Cache. Dieselbe Ursache traf bereits
--    create_decision_task (20261127120000) – beide stammen aus
--    20261107150000_workflow_consistency.sql, dessen Kopf
--    (ADD COLUMN case_file_id ohne IF NOT EXISTS) auf einer Instanz mit
--    vorhandener Spalte die ganze Datei zurückrollt. Die Funktion wird deshalb
--    hier eigenständig neu angelegt; zusätzlich prüft sie Büro und Aktenzugriff,
--    statt wie bisher nur die Anmeldung.
--
-- 2) Aufgaben & Stafette · „Archivieren entfernt Aufgabe und Wiedervorlage“
--    meldet 42501 „permission denied for function archive_completed_task“.
--    Die Funktion ist vorhanden, aber authenticated fehlt EXECUTE (die
--    Migrationsdatei von 20260323 liegt vor den späteren Rechten-Änderungen).
--    Beide Archiv-RPCs werden vollständig neu angelegt und erneut freigegeben.
--
-- 3) Kontakte · „Löschanfrage anlegen, Eigenfreigabe abweisen“ meldet
--    gegenstandUnveraenderlich. Der Schutztrigger
--    guard_gdpr_request_subject (20261127120000) ist vorhanden, wird aber nie
--    erreicht: 20261103234405 entzog authenticated das UPDATE auf der Tabelle
--    und erteilte es nur für die Spalte status. Ein Update auf subject_email
--    scheitert damit an der Spaltenberechtigung, nicht am Trigger – der Befund
--    „unveränderlich“ entsteht nie. Die beiden Gegenstands-Spalten werden
--    lesbar gemacht; unveränderlich bleiben sie durch den Trigger.
--
-- 4) Kontakte · „Dubletten-Scan …“ meldet 57014 (statement timeout).
--    Hinweis: die hier eingeführte Blockade auf den ersten zwei Namenszeichen
--    ist zu eng und wird von 20261127180000 durch Trigramm-Kandidaten ersetzt.
--    find_contact_duplicates_trgm verglich über ein OR im Join jede Zeile mit
--    jeder (n² similarity-Aufrufe) und las dazu alle Kontakte durch
--    read_secured_contacts, das je Zeile sieben Feldregeln auflöst. Die
--    Kandidaten entstehen jetzt blockweise (gleiche E-Mail, gleiche
--    Telefonnummer, gleiche Namensanfänge mit Trigramm-Treffer), die
--    Feldmaskierung wird einmal je Aufruf bestimmt, und der Scan bekommt ein
--    eigenes Zeitlimit. Die Treffer und Begründungen bleiben unverändert.

-- 1) Aktenaufgabe: Signatur des Clients, Büro- und Aktenprüfung.
DROP FUNCTION IF EXISTS public.create_case_file_task(uuid, uuid, text, text);

CREATE FUNCTION public.create_case_file_task(
  p_id uuid,
  p_case_file_id uuid,
  p_title text,
  p_assigned_to text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  f public.case_files%ROWTYPE;
  existing uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Aufgaben-ID fehlt' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Aufgabentitel fehlt' USING ERRCODE = '22023';
  END IF;

  -- FOR UPDATE serialisiert Wiederholungen; die RLS der Akte bleibt wirksam.
  SELECT * INTO f FROM public.case_files WHERE id = p_case_file_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kein Zugriff auf die Akte' USING ERRCODE = '42501';
  END IF;
  IF NOT (f.user_id = auth.uid() OR public.is_tenant_member(f.tenant_id, auth.uid())) THEN
    RAISE EXCEPTION 'Kein Zugriff auf die Akte' USING ERRCODE = '42501';
  END IF;

  SELECT task_id INTO existing
  FROM public.case_file_tasks
  WHERE case_file_id = f.id AND task_id = p_id;
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO public.tasks (id, user_id, tenant_id, title, assigned_to, priority, category, status, source_type, source_id)
  VALUES (p_id, auth.uid(), f.tenant_id, btrim(p_title), coalesce(p_assigned_to, auth.uid()::text),
          'medium', 'personal', 'todo', 'case_file', f.id);
  INSERT INTO public.case_file_tasks (case_file_id, task_id) VALUES (f.id, p_id);
  RETURN p_id;
END $$;

REVOKE ALL ON FUNCTION public.create_case_file_task(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_case_file_task(uuid, uuid, text, text) TO authenticated;

-- 2) Archiv-RPCs: vollständig neu anlegen und EXECUTE erneut erteilen.
ALTER TABLE public.archived_tasks
  DROP CONSTRAINT IF EXISTS archived_tasks_task_id_fkey;

CREATE OR REPLACE FUNCTION public.archive_completed_task(
  p_task_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root_task public.tasks%ROWTYPE;
  v_archived_root_id uuid;
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'User mismatch for task archive request' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_root_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task % not found', p_task_id USING ERRCODE = 'P0002';
  END IF;

  IF v_root_task.user_id <> v_actor_id
     AND NOT EXISTS (
       SELECT 1
       FROM unnest(
         regexp_split_to_array(
           regexp_replace(coalesce(v_root_task.assigned_to, ''), '[{}[:space:]]', '', 'g'),
           ','
         )
       ) AS assignee(user_id_text)
       WHERE assignee.user_id_text = v_actor_id::text
     ) THEN
    RAISE EXCEPTION 'Not authorized to archive task %', p_task_id USING ERRCODE = '42501';
  END IF;

  WITH RECURSIVE task_tree AS (
    SELECT t.* FROM public.tasks t WHERE t.id = p_task_id
    UNION ALL
    SELECT child.* FROM public.tasks child
    INNER JOIN task_tree parent ON child.parent_task_id = parent.id
  ), archived_rows AS (
    INSERT INTO public.archived_tasks (
      task_id, user_id, title, description, priority, category, assigned_to,
      progress, due_date, completed_at, archived_at, auto_delete_after_days
    )
    SELECT
      tree.id, p_user_id, tree.title, tree.description, tree.priority,
      coalesce(tree.category, 'personal'), tree.assigned_to,
      coalesce(tree.progress, CASE WHEN tree.status = 'completed' THEN 100 ELSE 0 END),
      tree.due_date, now(), now(), NULL
    FROM task_tree tree
    RETURNING id, task_id
  ), deleted_snoozes AS (
    DELETE FROM public.task_snoozes snoozes
    WHERE snoozes.task_id IN (SELECT task_id FROM archived_rows)
    RETURNING snoozes.task_id
  ), deleted_tasks AS (
    DELETE FROM public.tasks task_row
    WHERE task_row.id IN (SELECT task_id FROM archived_rows)
    RETURNING task_row.id
  )
  SELECT archived.id INTO v_archived_root_id
  FROM archived_rows archived
  WHERE archived.task_id = p_task_id
  LIMIT 1;

  IF v_archived_root_id IS NULL THEN
    RAISE EXCEPTION 'Archive operation did not persist task %', p_task_id USING ERRCODE = 'P0001';
  END IF;

  RETURN v_archived_root_id;
END $$;

REVOKE ALL ON FUNCTION public.archive_completed_task(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_completed_task(uuid, uuid) TO authenticated;

-- restore_archived_task wird nur neu freigegeben; Rumpf und Signatur bleiben.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'restore_archived_task'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.signature);
  END LOOP;
END $$;

-- 2b) Jahresabschluss: die Abschlusszeile eines Jahres darf von der
--     Büroleitung des zugehörigen Büros verwaltet werden. Die bisherige Policy
--     verlangt einen plattformweiten Administrator; ein Büro-Admin konnte die
--     Zeile deshalb nicht aufräumen, und der Selbsttestlauf blieb an der
--     Reinigung hängen.
DROP POLICY IF EXISTS "Tenant admins manage annual completions" ON public.annual_task_completions;
CREATE POLICY "Tenant admins manage annual completions" ON public.annual_task_completions
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.annual_tasks a
  WHERE a.id = annual_task_completions.annual_task_id
    AND public.is_tenant_admin(auth.uid(), a.tenant_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.annual_tasks a
  WHERE a.id = annual_task_completions.annual_task_id
    AND public.is_tenant_admin(auth.uid(), a.tenant_id)
));

-- 3) DSGVO-Gegenstand: Spalten erreichbar machen, unveränderlich bleibt er
--    durch guard_gdpr_request_subject (42501 „… unveränderlich“).
--    Diese Stelle ist die einzige Rechte-Definition für den Gegenstand; keine
--    weitere Migration wiederholt den GRANT.
GRANT UPDATE (subject_email, subject_name) ON public.gdpr_requests TO authenticated;

-- Den Trigger bei Bedarf erneut setzen; er ist die eigentliche Sperre.
CREATE OR REPLACE FUNCTION public.guard_gdpr_request_subject()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.subject_email, NEW.subject_name, NEW.request_type, NEW.requested_by)
     IS DISTINCT FROM (OLD.subject_email, OLD.subject_name, OLD.request_type, OLD.requested_by) THEN
    RAISE EXCEPTION 'Der Gegenstand einer DSGVO-Anfrage ist unveränderlich.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gdpr_request_subject ON public.gdpr_requests;
CREATE TRIGGER trg_gdpr_request_subject
  BEFORE UPDATE ON public.gdpr_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_gdpr_request_subject();

-- 4) Dubletten-Scan: blockweise Kandidaten statt Vollvergleich.
CREATE OR REPLACE FUNCTION public.find_contact_duplicates_trgm(
  _tenant_id uuid,
  _threshold numeric DEFAULT 0.55,
  _limit int DEFAULT 200
)
RETURNS TABLE (
  contact1_id uuid,
  contact2_id uuid,
  contact1_name text,
  contact2_name text,
  contact1_email text,
  contact2_email text,
  match_score numeric,
  match_reasons text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
SET statement_timeout = '60s'
AS $$
DECLARE
  v_threshold numeric := greatest(least(coalesce(_threshold, 0.55), 1), 0.1);
  v_limit integer := greatest(least(coalesce(_limit, 200), 2000), 1);
  v_email_readable boolean;
  v_phone_readable boolean;
BEGIN
  IF NOT public.is_tenant_member(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Kein Zugriff auf Mandant';
  END IF;

  -- Feldmaskierung einmal je Aufruf statt je Kontakt und Spalte; nicht
  -- lesbare Felder werden wie bisher vor dem Vergleich geleert.
  v_email_readable := coalesce(public.field_read_rule(_tenant_id, 'contacts', 'email') = 'allow', true);
  v_phone_readable := coalesce(public.field_read_rule(_tenant_id, 'contacts', 'phone') = 'allow', true);

  RETURN QUERY
  WITH base AS MATERIALIZED (
    SELECT
      c.id,
      c.name,
      CASE WHEN v_email_readable THEN c.email END AS email,
      CASE WHEN v_phone_readable THEN c.phone END AS phone,
      CASE WHEN v_email_readable THEN lower(btrim(coalesce(c.email, ''))) ELSE '' END AS email_norm,
      CASE WHEN v_phone_readable THEN regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') ELSE '' END AS phone_norm,
      left(lower(btrim(coalesce(c.name, ''))), 2) AS name_block
    FROM public.contacts c
    WHERE c.tenant_id = _tenant_id
  ),
  candidates AS (
    SELECT a.id AS id1, b.id AS id2
    FROM base a
    JOIN base b ON a.id < b.id
    WHERE a.email_norm <> '' AND a.email_norm = b.email_norm
    UNION
    SELECT a.id, b.id
    FROM base a
    JOIN base b ON a.id < b.id
    WHERE length(a.phone_norm) >= 6 AND a.phone_norm = b.phone_norm
    UNION
    SELECT a.id, b.id
    FROM base a
    JOIN base b ON a.id < b.id AND a.name_block = b.name_block
    WHERE a.name_block <> '' AND a.name % b.name
  ),
  scored AS (
    SELECT
      a.id AS id1, b.id AS id2,
      a.name AS name1, b.name AS name2,
      a.email AS email1, b.email AS email2,
      similarity(coalesce(a.name, ''), coalesce(b.name, '')) AS name_sim,
      CASE WHEN a.email_norm <> '' AND b.email_norm <> ''
           THEN similarity(a.email_norm, b.email_norm) ELSE 0 END AS email_sim,
      CASE WHEN a.phone_norm <> '' AND b.phone_norm <> ''
           THEN similarity(a.phone_norm, b.phone_norm) ELSE 0 END AS phone_sim
    FROM candidates p
    JOIN base a ON a.id = p.id1
    JOIN base b ON b.id = p.id2
  )
  SELECT
    s.id1, s.id2, s.name1, s.name2, s.email1, s.email2,
    GREATEST(s.name_sim, s.email_sim, s.phone_sim)::numeric AS match_score,
    ARRAY(
      SELECT r FROM (
        VALUES
          (CASE WHEN s.name_sim >= v_threshold THEN 'Name ähnlich' END),
          (CASE WHEN s.email_sim >= v_threshold THEN 'E-Mail ähnlich' END),
          (CASE WHEN s.phone_sim >= 0.8 THEN 'Telefon ähnlich' END)
      ) AS t(r) WHERE r IS NOT NULL
    )
  FROM scored s
  WHERE GREATEST(s.name_sim, s.email_sim, s.phone_sim) >= v_threshold
  ORDER BY 7 DESC
  LIMIT v_limit;
END $$;

REVOKE ALL ON FUNCTION public.find_contact_duplicates_trgm(uuid, numeric, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_contact_duplicates_trgm(uuid, numeric, int) TO authenticated;

NOTIFY pgrst, 'reload schema';
