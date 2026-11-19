ALTER TABLE public.tasks ADD COLUMN completed_at timestamptz;

CREATE FUNCTION public.stamp_task_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.completed_at := now();
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.completed_at := now();
  ELSE
    NEW.completed_at := OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stamp_task_completion
BEFORE INSERT OR UPDATE OF status, completed_at ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.stamp_task_completion();

CREATE TABLE public.meeting_protocol_details (
  meeting_id uuid PRIMARY KEY REFERENCES public.meetings(id) ON DELETE CASCADE,
  recorder_name text NOT NULL,
  attendance jsonb NOT NULL,
  guests text NOT NULL DEFAULT '',
  approved_by uuid,
  approver_name text,
  approver_role text,
  approved_at timestamptz
);

CREATE TABLE public.meeting_protocol_addenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX meeting_protocol_addenda_meeting ON public.meeting_protocol_addenda (meeting_id, created_at);
ALTER TABLE public.meeting_protocol_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_protocol_addenda ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meeting_protocol_details, public.meeting_protocol_addenda FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.meeting_protocol_details, public.meeting_protocol_addenda TO authenticated;

CREATE POLICY meeting_protocol_details_read ON public.meeting_protocol_details FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND public.is_tenant_member(m.tenant_id, auth.uid())));
CREATE POLICY meeting_protocol_addenda_read ON public.meeting_protocol_addenda FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND public.is_tenant_member(m.tenant_id, auth.uid())));

CREATE FUNCTION public.update_meeting_protocol(
  _meeting_id uuid, _action text, _data jsonb DEFAULT '{}'::jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  m public.meetings;
  actor uuid := auth.uid();
  actor_name text;
  lead_role text;
  recorder text := btrim(coalesce(_data->>'recorder', ''));
  attendance jsonb := coalesce(_data->'attendance', '{}'::jsonb);
  guests text := btrim(coalesce(_data->>'guests', ''));
  body text := btrim(coalesce(_data->>'body', ''));
BEGIN
  SELECT * INTO m FROM public.meetings WHERE id = _meeting_id FOR UPDATE;
  IF actor IS NULL OR NOT FOUND OR m.status <> 'archived'
    OR NOT coalesce(public.is_tenant_member(m.tenant_id, actor), false) THEN
    RAISE EXCEPTION 'Protokoll nicht zugänglich' USING ERRCODE = '42501';
  END IF;

  lead_role := CASE
    WHEN public.has_active_tenant_role(actor, m.tenant_id, ARRAY['abgeordneter']) THEN 'Abgeordnete(r)'
    WHEN public.has_active_tenant_role(actor, m.tenant_id, ARRAY['bueroleitung']) THEN 'Büroleitung'
  END;

  IF actor <> m.user_id AND lead_role IS NULL AND NOT public.is_meeting_participant(m.id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Protokoll' USING ERRCODE = '42501';
  END IF;

  SELECT nullif(btrim(display_name), '') INTO actor_name
    FROM public.profiles WHERE user_id = actor AND tenant_id = m.tenant_id LIMIT 1;
  actor_name := coalesce(actor_name, actor::text);

  CASE _action
    WHEN 'details' THEN
      IF char_length(recorder) NOT BETWEEN 1 AND 200 OR char_length(guests) > 4000
        OR jsonb_typeof(attendance) <> 'object' THEN
        RAISE EXCEPTION 'Ungültige Angaben zur Protokollführung oder Anwesenheit';
      END IF;
      IF EXISTS (
        SELECT 1 FROM jsonb_each_text(attendance) a
        WHERE a.value IS NULL OR a.value NOT IN ('present', 'excused', 'guest')
          OR (a.key <> m.user_id::text AND NOT EXISTS (
            SELECT 1 FROM public.meeting_participants p
            WHERE p.meeting_id = m.id AND p.user_id::text = a.key
          ))
      ) THEN
        RAISE EXCEPTION 'Ungültige Anwesenheitsangabe';
      END IF;

      INSERT INTO public.meeting_protocol_details AS d (meeting_id, recorder_name, attendance, guests)
      VALUES (m.id, recorder, attendance, guests)
      ON CONFLICT (meeting_id) DO UPDATE SET
        recorder_name = excluded.recorder_name, attendance = excluded.attendance, guests = excluded.guests
      WHERE d.approved_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Das Protokoll wurde bereits freigegeben'; END IF;
    WHEN 'approve' THEN
      IF lead_role IS NULL THEN
        RAISE EXCEPTION 'Die Freigabe ist Büroleitung und Abgeordneten vorbehalten' USING ERRCODE = '42501';
      END IF;
      UPDATE public.meeting_protocol_details
      SET approved_by = actor, approver_name = actor_name, approver_role = lead_role, approved_at = now()
      WHERE meeting_id = m.id AND approved_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Protokollangaben fehlen oder das Protokoll wurde bereits freigegeben'; END IF;
    WHEN 'addendum' THEN
      IF char_length(body) NOT BETWEEN 1 AND 8000 THEN
        RAISE EXCEPTION 'Nachträge müssen zwischen 1 und 8000 Zeichen lang sein';
      END IF;
      INSERT INTO public.meeting_protocol_addenda (meeting_id, body, author_id, author_name)
      VALUES (m.id, body, actor, actor_name);
    ELSE
      RAISE EXCEPTION 'Unbekannte Protokollaktion';
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.update_meeting_protocol(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_meeting_protocol(uuid, text, jsonb) TO authenticated;

-- The task archive normally deletes the live row. Preserve its Jour-fixe provenance.
ALTER TABLE public.archived_tasks
  ADD COLUMN meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  ADD COLUMN source_type text,
  ADD COLUMN source_id uuid,
  ADD COLUMN parent_task_id uuid;

CREATE INDEX archived_tasks_jour_fixe_meeting ON public.archived_tasks (meeting_id, task_id)
WHERE meeting_id IS NOT NULL;

CREATE FUNCTION public.capture_archived_jour_fixe_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t public.tasks;
BEGIN
  NEW.meeting_id := NULL;
  NEW.source_type := NULL;
  NEW.source_id := NULL;
  NEW.parent_task_id := NULL;

  SELECT * INTO t FROM public.tasks WHERE id = NEW.task_id;
  IF FOUND AND starts_with(t.source_type, 'jour_fixe_') AND t.meeting_id IS NOT NULL
    AND public.is_tenant_member(t.tenant_id, auth.uid())
    AND EXISTS (
      WITH RECURSIVE ancestors AS (
        SELECT t.id AS id, t.parent_task_id AS parent_task_id, t.user_id AS user_id, t.assigned_to AS assigned_to
        UNION
        SELECT p.id, p.parent_task_id, p.user_id, p.assigned_to
        FROM public.tasks p JOIN ancestors a ON a.parent_task_id = p.id
        WHERE p.tenant_id = t.tenant_id
      )
      SELECT 1 FROM ancestors a
      WHERE a.user_id = auth.uid() OR auth.uid() = ANY(public.parse_task_assignee_ids(a.assigned_to))
        OR EXISTS (SELECT 1 FROM public.task_assignees x WHERE x.task_id = a.id AND x.user_id = auth.uid())
    ) THEN
    NEW.meeting_id := t.meeting_id;
    NEW.source_type := t.source_type;
    NEW.source_id := t.source_id;
    NEW.parent_task_id := t.parent_task_id;
    NEW.title := t.title;
    NEW.description := t.description;
    NEW.assigned_to := t.assigned_to;
    NEW.completed_at := coalesce(t.completed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER capture_archived_jour_fixe_task BEFORE INSERT ON public.archived_tasks
FOR EACH ROW EXECUTE FUNCTION public.capture_archived_jour_fixe_task();

CREATE FUNCTION public.restore_jour_fixe_task_provenance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a public.archived_tasks;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT archived.* INTO a
  FROM public.archived_tasks archived JOIN public.meetings m ON m.id = archived.meeting_id
  WHERE archived.task_id = NEW.id AND archived.user_id = auth.uid() AND m.tenant_id = NEW.tenant_id
  ORDER BY archived.archived_at DESC, archived.id DESC LIMIT 1;
  IF FOUND THEN
    NEW.meeting_id := a.meeting_id;
    NEW.source_type := a.source_type;
    NEW.source_id := a.source_id;
    IF EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = a.parent_task_id AND t.tenant_id = NEW.tenant_id) THEN
      NEW.parent_task_id := a.parent_task_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER restore_jour_fixe_task_provenance BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.restore_jour_fixe_task_provenance();

-- Expose only protocol-related archive fields while keeping personal archive policies intact.
CREATE VIEW public.archived_meeting_protocol_tasks WITH (security_barrier = true) AS
SELECT a.task_id AS id, a.meeting_id, m.tenant_id, a.title, a.description, a.assigned_to, a.parent_task_id,
  a.due_date, a.completed_at, a.archived_at, a.id AS archive_id
FROM public.archived_tasks a JOIN public.meetings m ON m.id = a.meeting_id
WHERE public.is_tenant_member(m.tenant_id, auth.uid());

REVOKE ALL ON public.archived_meeting_protocol_tasks FROM PUBLIC, anon;
GRANT SELECT ON public.archived_meeting_protocol_tasks TO authenticated;

CREATE VIEW public.meeting_protocol_tasks WITH (security_invoker = true) AS
SELECT t.id, t.meeting_id, t.tenant_id, t.title, t.assigned_to, t.parent_task_id,
  t.status, t.due_date, t.completed_at, false AS archived
FROM public.tasks t
WHERE t.meeting_id IS NOT NULL AND starts_with(t.source_type, 'jour_fixe_')
UNION ALL
(SELECT DISTINCT ON (a.id)
  a.id, a.meeting_id, a.tenant_id, a.title, a.assigned_to, a.parent_task_id,
  'completed'::text, a.due_date, a.completed_at, true
FROM public.archived_meeting_protocol_tasks a
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = a.id)
ORDER BY a.id, a.archived_at DESC, a.archive_id DESC);
REVOKE ALL ON public.meeting_protocol_tasks FROM PUBLIC, anon;
GRANT SELECT ON public.meeting_protocol_tasks TO authenticated;

CREATE FUNCTION public.get_meeting_protocol_participants(_meeting_id uuid)
RETURNS TABLE (user_id uuid, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.user_id, p.role::text
  FROM public.meeting_participants p JOIN public.meetings m ON m.id = p.meeting_id
  WHERE m.id = _meeting_id AND m.status = 'archived'
    AND public.is_tenant_member(m.tenant_id, auth.uid());
$$;
REVOKE ALL ON FUNCTION public.get_meeting_protocol_participants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meeting_protocol_participants(uuid) TO authenticated;
