-- Folgeaufgabe am Brief verankern: source_type/source_id statt Titelvergleich.
--
-- `create_letter_archive_follow_up_task` (20261127200000) fand die Folgeaufgabe
-- über den zusammengebauten Titel. Der Titel entsteht an drei Stellen (Trigger,
-- RPC, Altbestand aus der früheren Archivfunktion); sobald eine davon anders
-- formatiert, entsteht trotz gleicher Aufgabe eine zweite. Der Trigger
-- `trigger_letter_followup_task` schrieb bisher **keine** Verknüpfung – geprüft
-- in 20250901095901, 20250901095950, 20250901100427 und der dynamischen
-- Nachbesserung aus 20261115075438: die Einfügung setzt nur user_id, tenant_id,
-- title, description, due_date, priority, status, category, assigned_to.
--
-- Diese Migration ergänzt die stabile Verknüpfung:
--   * Der Trigger stempelt `source_type = 'letter_followup'`, `source_id = <Brief-ID>`
--     und legt bei vorhandener Verknüpfung keine zweite Aufgabe an.
--   * Das RPC sucht zuerst über diese Verknüpfung; der Titel dient nur noch dem
--     Bestand von vor dieser Migration, dessen Verknüpfung dabei nachgetragen
--     wird.
--   * Ein partieller Unique-Index hält die Verknüpfung eindeutig: genau eine
--     Folgeaufgabe je Brief. Der Index erfasst nur neue Zeilen mit gesetzter
--     Verknüpfung, ältere Doppelungen ohne Verknüpfung blockieren ihn nicht.
--   * Ein einmaliger Abgleich trägt die Verknüpfung für bestehende Aufgaben nach
--     (je Brief die älteste), damit auch der Altbestand ohne Titelbezug gefunden
--     wird.

CREATE UNIQUE INDEX IF NOT EXISTS tasks_letter_followup_source_unique
  ON public.tasks (tenant_id, source_type, source_id)
  WHERE source_type = 'letter_followup' AND source_id IS NOT NULL;

-- 1. Der Erzeuger stempelt die Verknüpfung.
--    Basis ist die Fassung aus 20250901100427 einschließlich der
--    Mandantenprüfung der Vorlage aus 20261115075438.
CREATE OR REPLACE FUNCTION public.create_letter_followup_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    template_response_days INTEGER := 21;
    task_title TEXT;
    task_description TEXT;
    content_text TEXT;
    due_date_calc TIMESTAMPTZ;
    task_id UUID;
BEGIN
    -- Only proceed if status changed to 'sent'
    IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN

        -- Stabile Verknüpfung: genau eine Folgeaufgabe je Brief, unabhängig vom Titel.
        IF EXISTS (
            SELECT 1 FROM tasks
            WHERE tenant_id = NEW.tenant_id
              AND source_type = 'letter_followup'
              AND source_id = NEW.id
        ) THEN
            RAISE NOTICE 'Follow-up task for letter % already exists', NEW.id;
            RETURN NEW;
        END IF;

        -- Log trigger execution (for debugging)
        RAISE NOTICE 'Creating follow-up task for letter: % (title: %)', NEW.id, NEW.title;

        -- Get response time from template if available
        IF NEW.template_id IS NOT NULL THEN
            SELECT response_time_days INTO template_response_days
            FROM letter_templates
            WHERE id = NEW.template_id AND tenant_id = NEW.tenant_id;

            IF template_response_days IS NULL THEN
                template_response_days := 21;
            END IF;
        END IF;

        -- Calculate due date
        due_date_calc := CURRENT_DATE + INTERVAL '1 day' * template_response_days;

        -- Create task title
        task_title := 'Abgeordnetenbrief "' || COALESCE(NEW.subject, NEW.title) || '" vom ' ||
                     TO_CHAR(COALESCE(NEW.sent_date::DATE, CURRENT_DATE), 'DD.MM.YYYY');

        -- Create task description from letter content (first 300 chars)
        content_text := COALESCE(NEW.content, '');
        IF LENGTH(content_text) > 300 THEN
            task_description := LEFT(content_text, 300) || '...';
        ELSE
            task_description := content_text;
        END IF;

        -- Insert the follow-up task, assigned to the letter creator
        INSERT INTO tasks (
            user_id,
            tenant_id,
            title,
            description,
            due_date,
            priority,
            status,
            category,
            assigned_to,
            source_type,
            source_id
        ) VALUES (
            NEW.created_by,
            NEW.tenant_id,
            task_title,
            task_description,
            due_date_calc,
            'medium',
            'todo',
            'abgeordnetenbrief',
            NEW.created_by::text,  -- Assign to letter creator
            'letter_followup',
            NEW.id
        ) RETURNING id INTO task_id;

        RAISE NOTICE 'Follow-up task created with ID: % and assigned to: %', task_id, NEW.created_by;

    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the letter update
        RAISE NOTICE 'Error creating follow-up task for letter %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$function$;

-- 2. Das RPC findet die Aufgabe über die Verknüpfung; der Titel bleibt nur
--    Rückfall für den Bestand und wird dabei in die Verknüpfung überführt.
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
  v_template_days integer := 21;
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

  -- Maßgeblich ist die Verknüpfung, nicht der Titeltext.
  SELECT t.id INTO v_task
  FROM public.tasks t
  WHERE t.tenant_id = v_letter.tenant_id
    AND t.source_type = 'letter_followup'
    AND t.source_id = v_letter.id
  LIMIT 1;

  IF v_task IS NOT NULL THEN
    RETURN v_task;
  END IF;

  -- Bestand von vor dieser Migration: einmalig über den Titel finden und die
  -- Verknüpfung nachtragen. Danach entscheidet nur noch source_id.
  v_sent_at := coalesce(v_letter.sent_at, now());
  v_title := 'Abgeordnetenbrief "'
    || coalesce(nullif(v_letter.subject, ''), nullif(v_letter.title, ''), 'Ohne Betreff')
    || '" vom '
    || to_char(coalesce(v_letter.sent_date, (v_sent_at AT TIME ZONE 'Europe/Berlin')::date), 'DD.MM.YYYY');

  SELECT t.id INTO v_task
  FROM public.tasks t
  WHERE t.tenant_id = v_letter.tenant_id
    AND t.category = 'abgeordnetenbrief'
    AND t.source_id IS NULL
    AND t.title = v_title
  ORDER BY t.created_at, t.id
  LIMIT 1;

  IF v_task IS NOT NULL THEN
    UPDATE public.tasks
    SET source_type = 'letter_followup', source_id = v_letter.id
    WHERE id = v_task AND source_id IS NULL;
    RETURN v_task;
  END IF;

  v_description := left(
    btrim(regexp_replace(coalesce(nullif(v_letter.content_html, ''), v_letter.content, ''), '<[^>]*>', ' ', 'g')),
    300
  );

  -- Frist wie im Trigger: Vorlage, sonst 21 Tage; ein gepflegtes Antwortdatum hat Vorrang.
  IF v_letter.template_id IS NOT NULL THEN
    SELECT lt.response_time_days INTO v_template_days
    FROM public.letter_templates lt
    WHERE lt.id = v_letter.template_id AND lt.tenant_id = v_letter.tenant_id;
    v_template_days := coalesce(v_template_days, 21);
  END IF;

  v_due := coalesce(
    v_letter.expected_response_date::timestamptz,
    v_sent_at + make_interval(days => v_template_days)
  );

  INSERT INTO public.tasks (
    user_id, tenant_id, title, description, due_date, priority, status, category, assigned_to,
    source_type, source_id
  ) VALUES (
    coalesce(v_letter.sent_by, v_letter.created_by, v_actor),
    v_letter.tenant_id,
    v_title,
    v_description,
    v_due,
    'medium',
    'todo',
    'abgeordnetenbrief',
    NULL,
    'letter_followup',
    v_letter.id
  )
  RETURNING id INTO v_task;

  RETURN v_task;
END;
$$;

REVOKE ALL ON FUNCTION public.create_letter_archive_follow_up_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_letter_archive_follow_up_task(uuid) TO authenticated;

COMMENT ON FUNCTION public.create_letter_archive_follow_up_task(uuid) IS
  'Liefert die über source_type/source_id verknüpfte Folgeaufgabe eines versendeten Briefes oder legt sie an; prüft Anmeldung, Mandant, Briefzugriff und Status sent.';

-- 3. Bestehende Aufgaben einmalig verknüpfen (je Brief die älteste passende).
WITH candidates AS (
  SELECT DISTINCT ON (t.id)
         t.id AS task_id,
         t.created_at,
         l.id AS letter_id,
         l.tenant_id
  FROM public.tasks t
  JOIN public.letters l
    ON l.tenant_id = t.tenant_id
   AND t.title = 'Abgeordnetenbrief "' || COALESCE(l.subject, l.title) || '" vom ' ||
        to_char(COALESCE(l.sent_date, (COALESCE(l.sent_at, now()) AT TIME ZONE 'Europe/Berlin')::date), 'DD.MM.YYYY')
  WHERE t.category = 'abgeordnetenbrief'
    AND t.source_id IS NULL
    AND l.status = 'sent'
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks x
      WHERE x.tenant_id = l.tenant_id
        AND x.source_type = 'letter_followup'
        AND x.source_id = l.id
    )
  ORDER BY t.id, t.created_at, l.id
), ranked AS (
  SELECT task_id, letter_id,
         row_number() OVER (PARTITION BY tenant_id, letter_id ORDER BY created_at, task_id) AS position
  FROM candidates
)
UPDATE public.tasks t
SET source_type = 'letter_followup', source_id = r.letter_id
FROM ranked r
WHERE t.id = r.task_id AND r.position = 1;

NOTIFY pgrst, 'reload schema';
