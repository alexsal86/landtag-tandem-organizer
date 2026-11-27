-- Folgeaufgabe zum versendeten Brief: ein kanonischer Weg in der Datenbank.
--
-- Hinweis: Die Suche über den zusammengebauten Titel unten ist durch
-- 20261127210000_letter_follow_up_source_link.sql überholt. Dort stempelt der
-- Trigger source_type/source_id, und das RPC sucht zuerst über diese
-- Verknüpfung; der Titel bleibt nur Rückfall für den Altbestand.
--
-- Der Brief-Selbsttest meldet „Archivdokument oder Folgeaufgabe fehlt.“, obwohl
-- das Archiv-PDF und der Dokumenteintrag entstehen. Ursache ist die
-- Folgeaufgabe: `archive-letter` legt sie selbst an und verschluckt einen
-- Einfügefehler (nur `console.error`), `followUpTaskId` bleibt dann null. Die
-- Regeln der Aufgabe stehen an drei Stellen (Trigger `trigger_letter_followup_task`
-- aus 20250901095901, Edge Function, Client) und liefen auseinander – zuletzt an
-- der Kategorie-Schreibweise, die den Einfügeversuch mit 23514 abbrach.
--
-- Diese Migration macht die Folgeaufgabe zu einer Datenbankfunktion:
--   * Sie sucht die bereits vorhandene Aufgabe des Briefes (der Trigger legt sie
--     beim Wechsel auf `sent` an) und liefert deren ID zurück.
--   * Fehlt sie – etwa weil der Trigger in einer Umgebung nicht greift –, legt
--     sie eine kanonische Aufgabe an: Kategorie `abgeordnetenbrief` (die einzige
--     Schreibweise, die tasks_category_check zulässt), Status `todo`, Frist aus
--     expected_response_date bzw. 21 Tage nach Versand.
--   * Anmeldung, Mandantzugehörigkeit, Zugriff auf den Brief und der Status
--     `sent` werden geprüft; die Funktion ist wiederholbar und erzeugt keine
--     zweite Aufgabe.
--
-- Der Client ruft sie nach erfolgreicher Archivierung auf, wenn die
-- Archivfunktion keine ID meldet. Damit hängt der Versand nicht mehr davon ab,
-- welche Fassung der Edge Function gerade eingesetzt ist.

CREATE OR REPLACE FUNCTION public.create_letter_archive_follow_up_task(_letter_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_letter public.letters;
  v_sent_at timestamptz;
  v_title text;
  v_description text;
  v_due timestamptz;
  v_task uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Anmeldung fehlt' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_letter FROM public.letters WHERE id = _letter_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brief nicht gefunden' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_tenant_member(v_letter.tenant_id, v_actor) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diesen Brief' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    v_letter.created_by = v_actor
    OR EXISTS (
      SELECT 1 FROM public.letter_collaborators lc
      WHERE lc.letter_id = v_letter.id AND lc.user_id = v_actor
    )
    OR public.has_active_tenant_role(v_actor, v_letter.tenant_id, ARRAY['abgeordneter', 'bueroleitung'])
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diesen Brief' USING ERRCODE = '42501';
  END IF;

  IF v_letter.status <> 'sent' THEN
    RAISE EXCEPTION 'Folgeaufgabe nur für versendete Briefe' USING ERRCODE = '22023';
  END IF;

  v_sent_at := coalesce(v_letter.sent_at, now());
  -- Titel wie im Trigger und in der Archivfunktion, damit die vorhandene
  -- Aufgabe wiedergefunden wird und keine zweite entsteht.
  v_title := 'Abgeordnetenbrief "'
    || coalesce(nullif(v_letter.subject, ''), nullif(v_letter.title, ''), 'Ohne Betreff')
    || '" vom '
    || to_char(coalesce(v_letter.sent_date, (v_sent_at AT TIME ZONE 'Europe/Berlin')::date), 'DD.MM.YYYY');

  SELECT t.id INTO v_task
  FROM public.tasks t
  WHERE t.tenant_id = v_letter.tenant_id
    AND t.category = 'abgeordnetenbrief'
    AND t.title = v_title
  ORDER BY t.created_at, t.id
  LIMIT 1;

  IF v_task IS NOT NULL THEN
    RETURN v_task;
  END IF;

  v_description := left(
    btrim(regexp_replace(coalesce(nullif(v_letter.content_html, ''), v_letter.content, ''), '<[^>]*>', ' ', 'g')),
    300
  );

  v_due := coalesce(
    v_letter.expected_response_date::timestamptz,
    v_sent_at + interval '21 days'
  );

  INSERT INTO public.tasks (
    user_id, tenant_id, title, description, due_date, priority, status, category, assigned_to
  ) VALUES (
    coalesce(v_letter.sent_by, v_letter.created_by, v_actor),
    v_letter.tenant_id,
    v_title,
    v_description,
    v_due,
    'medium',
    'todo',
    'abgeordnetenbrief',
    NULL
  )
  RETURNING id INTO v_task;

  RETURN v_task;
END;
$$;

REVOKE ALL ON FUNCTION public.create_letter_archive_follow_up_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_letter_archive_follow_up_task(uuid) TO authenticated;

COMMENT ON FUNCTION public.create_letter_archive_follow_up_task(uuid) IS
  'Liefert die Folgeaufgabe eines versendeten Briefes oder legt sie kanonisch an; prüft Anmeldung, Mandant, Briefzugriff, Status sent und ist je Brief idempotent.';

NOTIFY pgrst, 'reload schema';
