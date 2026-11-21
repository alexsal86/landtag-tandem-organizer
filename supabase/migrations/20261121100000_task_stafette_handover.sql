ALTER TABLE public.tasks
  ADD COLUMN ball_handed_at timestamptz,
  ADD COLUMN ball_handed_by uuid,
  ADD COLUMN ball_accepted_at timestamptz,
  ADD COLUMN stafette_resume_on date;

CREATE INDEX tasks_stafette_ball_idx ON public.tasks (tenant_id, ball_assignee_id)
  WHERE status <> 'completed' AND parent_task_id IS NULL;
CREATE INDEX tasks_stafette_sender_idx ON public.tasks (tenant_id, ball_handed_by)
  WHERE status <> 'completed' AND parent_task_id IS NULL;

UPDATE public.tasks t SET ball_assignee_id = (
  SELECT m.user_id FROM public.user_tenant_memberships m
  WHERE m.tenant_id = t.tenant_id AND m.is_active AND m.role = 'abgeordneter'
  ORDER BY m.user_id LIMIT 1
)
WHERE t.ball_owner = 'deputy' AND t.ball_assignee_id IS NULL AND t.status <> 'completed'
  AND EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.tenant_id = t.tenant_id AND m.is_active AND m.role = 'abgeordneter'
  );

CREATE FUNCTION public.record_task_stafette_handover() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  actor uuid := auth.uid();
  event_text text;
BEGIN
  IF NEW.ball_owner = 'deputy' AND NEW.ball_assignee_id IS NULL
    AND (NEW.ball_owner IS DISTINCT FROM OLD.ball_owner OR OLD.ball_assignee_id IS NOT NULL) THEN
    SELECT deputy.id INTO NEW.ball_assignee_id
    FROM public.list_task_deputy_ids(NEW.tenant_id) AS deputy(id)
    ORDER BY deputy.id LIMIT 1;
  END IF;

  IF ROW(NEW.ball_owner, NEW.ball_assignee_id, NEW.ball_external_label)
    IS DISTINCT FROM ROW(OLD.ball_owner, OLD.ball_assignee_id, OLD.ball_external_label) THEN
    IF actor IS NOT NULL AND NEW.ball_assignee_id IS NOT NULL
      AND NOT public.is_tenant_member(NEW.tenant_id, NEW.ball_assignee_id) THEN
      RAISE EXCEPTION 'Die empfangende Person gehört nicht zu diesem Büro';
    END IF;
    NEW.ball_handed_by := actor;
    NEW.ball_handed_at := now();
    NEW.ball_accepted_at := NULL;
    NEW.stafette_resume_on := NULL;
    NEW.nudge_seen_at := CASE WHEN OLD.nudged_at IS NOT NULL THEN now() END;
    IF NEW.ball_owner <> 'external' AND NEW.reminder_at IS NOT DISTINCT FROM OLD.reminder_at THEN
      NEW.reminder_at := NULL;
      NEW.reminder_note := NULL;
    END IF;
    event_text := CASE NEW.ball_owner
      WHEN 'external' THEN 'Wartet auf ' || COALESCE(NEW.ball_external_label, 'externe Rückmeldung')
      WHEN 'deputy' THEN 'An Abgeordnete/n übergeben'
      ELSE 'Ans Büro übergeben'
    END;
  ELSIF NEW.ball_accepted_at IS DISTINCT FROM OLD.ball_accepted_at THEN
    IF actor IS NULL OR actor IS DISTINCT FROM OLD.ball_assignee_id OR OLD.ball_owner = 'external'
       OR OLD.ball_handed_at IS NULL OR OLD.ball_accepted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Diese Übergabe kann nur die empfangende Person übernehmen';
    END IF;
    NEW.ball_accepted_at := now();
    event_text := 'Übergabe übernommen';
  ELSE
    NEW.ball_handed_at := OLD.ball_handed_at;
    NEW.ball_handed_by := OLD.ball_handed_by;
  END IF;

  IF event_text IS NOT NULL THEN
    NEW.timeline := COALESCE(NEW.timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'type', 'system', 'at', now(), 'text', event_text,
      'actorId', actor, 'recipientId', NEW.ball_assignee_id, 'nextAction', NEW.next_action
    ));
  END IF;
  IF NEW.reminder_at IS DISTINCT FROM OLD.reminder_at THEN
    NEW.reminder_notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER record_task_stafette_handover
BEFORE UPDATE OF ball_owner, ball_assignee_id, ball_external_label, ball_handed_at,
  ball_handed_by, ball_accepted_at, reminder_at ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.record_task_stafette_handover();
