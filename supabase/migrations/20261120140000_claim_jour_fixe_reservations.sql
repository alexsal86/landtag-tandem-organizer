ALTER TABLE public.quick_notes ADD COLUMN IF NOT EXISTS jour_fixe_reserved_meeting_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS jour_fixe_reserved_meeting_id uuid;
ALTER TABLE public.case_items ADD COLUMN IF NOT EXISTS jour_fixe_reserved_meeting_id uuid;
ALTER TABLE public.task_decisions ADD COLUMN IF NOT EXISTS jour_fixe_reserved_meeting_id uuid;

CREATE OR REPLACE FUNCTION public.claim_jour_fixe_reservations(_meeting_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  meeting public.meetings%ROWTYPE;
  actor uuid := auth.uid();
  today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  block record;
  claimed integer;
  total integer := 0;
  inserted integer;
BEGIN
  SELECT * INTO meeting FROM public.meetings WHERE id = _meeting_id FOR UPDATE;
  IF NOT FOUND OR actor IS NULL OR meeting.tenant_id IS NULL OR meeting.meeting_date < today
    OR meeting.status IS DISTINCT FROM 'planned' OR NOT coalesce(public.is_tenant_member(meeting.tenant_id, actor), false)
    OR (meeting.user_id IS DISTINCT FROM actor AND NOT public.is_meeting_participant(meeting.id)
      AND NOT public.has_active_tenant_role(actor, meeting.tenant_id, ARRAY['abgeordneter', 'bueroleitung'])) THEN
    RETURN 0;
  END IF;

  -- A later agenda must not take the queue away from the next Jour fixe.
  IF EXISTS (
    SELECT 1 FROM public.meetings earlier
    WHERE earlier.tenant_id = meeting.tenant_id AND earlier.status = 'planned'
      AND earlier.meeting_date >= today
      AND (earlier.meeting_date, coalesce(earlier.meeting_time, '23:59:59'::time), earlier.id)
        < (meeting.meeting_date, coalesce(meeting.meeting_time, '23:59:59'::time), meeting.id)
  ) THEN
    RETURN 0;
  END IF;

  FOR block IN SELECT * FROM (VALUES
    ('quick_notes', 'quick_notes', 'Meine Notizen', 'AND source.user_id = $3 AND source.deleted_at IS NULL'),
    ('tasks', 'tasks', 'Aufgaben', 'AND source.status <> ''completed'''),
    ('case_items', 'case_items', 'Vorgänge', 'AND source.status <> ''erledigt'''),
    ('task_decisions', 'decisions', 'Entscheidungen', 'AND source.status = ''active'' AND source.created_by = $3')
  ) AS blocks(source_table, system_type, title, source_filter)
  LOOP
    EXECUTE format($claim$
      UPDATE public.%I source
      SET meeting_id = $1, pending_for_jour_fixe = false, jour_fixe_reserved_meeting_id = $1
      WHERE source.tenant_id = $2 AND source.pending_for_jour_fixe
        AND (source.meeting_id IS NULL OR source.meeting_id = $1 OR EXISTS (
          SELECT 1 FROM public.meetings prior
          WHERE prior.id = source.meeting_id AND prior.tenant_id = $2 AND prior.status = 'archived'
        ))
        %s
    $claim$, block.source_table, block.source_filter)
      USING meeting.id, meeting.tenant_id, actor;
    GET DIAGNOSTICS claimed = ROW_COUNT;
    total := total + claimed;

    -- Recreate a deleted block if it still contains previously claimed entries.
    IF claimed = 0 AND NOT EXISTS (
      SELECT 1 FROM public.meeting_agenda_items WHERE meeting_id = meeting.id AND system_type = block.system_type
    ) THEN
      EXECUTE format(
        'SELECT count(*) FROM public.%I WHERE tenant_id = $1 AND meeting_id = $2 AND jour_fixe_reserved_meeting_id = $2',
        block.source_table
      ) INTO claimed USING meeting.tenant_id, meeting.id;
    END IF;
    IF claimed > 0 THEN
      INSERT INTO public.meeting_agenda_items (meeting_id, title, system_type, order_index, duration_minutes)
      SELECT meeting.id, block.title, block.system_type,
        COALESCE((SELECT max(order_index) + 1 FROM public.meeting_agenda_items WHERE meeting_id = meeting.id), 0), 10
      WHERE NOT EXISTS (
        SELECT 1 FROM public.meeting_agenda_items WHERE meeting_id = meeting.id AND system_type = block.system_type
      );
      GET DIAGNOSTICS inserted = ROW_COUNT;
      total := total + inserted;
    END IF;
  END LOOP;

  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_jour_fixe_reservations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_jour_fixe_reservations(uuid) TO authenticated;
