-- Votum zurücknehmen: Snapshot statt geratenem Vorher-Zustand.
--
-- Der Trigger return_task_ball_after_vote überschreibt beim Votum Ball, nächsten
-- Schritt und Frist der verknüpften Aufgabe und hängt einen Timeline-Eintrag an.
-- Die Rücknahme im Dashboard löschte bisher nur die Antwortzeile; die Aufgabe
-- blieb auf "Ball beim Büro / Freigabe umsetzen" stehen und behauptete in ihrem
-- Verlauf ein Votum, das es nicht mehr gibt.
--
-- Deshalb legt der Trigger vor dem Überschreiben einen Datensatz in
-- task_decision_vote_effects ab (Vorher-Werte und IDs der Timeline-Einträge).
-- withdraw_decision_response(...) löscht Antwort und Effekt in einer
-- Transaktion und stellt die Vorher-Werte nur wieder her, solange die Aufgabe
-- noch exakt dem Votum-Ergebnis entspricht. Ist sie weitergelaufen, bleibt sie
-- unverändert und bekommt stattdessen einen Rücknahme-Vermerk. Das direkte
-- DELETE-Recht auf task_decision_responses wird entzogen, damit der Zustand
-- nicht wieder am RPC vorbei zerlegt werden kann.

CREATE TABLE IF NOT EXISTS public.task_decision_vote_effects (
  response_id uuid PRIMARY KEY REFERENCES public.task_decision_responses(id) ON DELETE CASCADE,
  decision_id uuid NOT NULL REFERENCES public.task_decisions(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Zustand der Aufgabe unmittelbar vor dem ersten Votum dieser Antwort.
  previous_ball_owner text,
  previous_ball_assignee_id uuid,
  previous_next_action text,
  previous_next_action_due timestamptz,
  -- Zustand, den das Votum geschrieben hat; nur darauf darf zurückgesetzt werden.
  applied_ball_owner text NOT NULL,
  applied_ball_assignee_id uuid,
  applied_next_action text,
  applied_next_action_due timestamptz,
  -- IDs der Timeline-Einträge, die dieses Votum angehängt hat.
  timeline_entry_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_decision_vote_effects ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS a00_guard_tenant_references ON public.task_decision_vote_effects;
CREATE TRIGGER a00_guard_tenant_references BEFORE INSERT OR UPDATE
ON public.task_decision_vote_effects FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_references();
-- Kein Clientzugriff: gelesen und geschrieben wird ausschließlich über die
-- Trigger- und RPC-Funktionen dieses Skripts.
REVOKE ALL ON public.task_decision_vote_effects FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.return_task_ball_after_vote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d record;
  t record;
  label text;
  entry_id text;
  next_action_value text;
  next_assignee uuid;
BEGIN
  IF NEW.parent_response_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT id, task_id, created_by, title, tenant_id INTO d FROM task_decisions WHERE id = NEW.decision_id;
  IF d.task_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, timeline, user_id, tenant_id, ball_owner, ball_assignee_id, next_action, next_action_due
    INTO t FROM tasks WHERE id = d.task_id AND tenant_id = d.tenant_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Decision task belongs to another tenant' USING ERRCODE = '42501'; END IF;
  label := CASE NEW.response_type WHEN 'yes' THEN 'Freigegeben' WHEN 'no' THEN 'Abgelehnt' WHEN 'question' THEN 'Rückfrage' ELSE COALESCE(NEW.response_type, 'Votum') END;
  next_action_value := CASE
    WHEN NEW.response_type = 'yes' THEN 'Freigabe umsetzen'
    WHEN NEW.response_type = 'question' THEN 'Rückfrage beantworten'
    ELSE 'Votum umsetzen'
  END;
  next_assignee := COALESCE(d.created_by, t.user_id);
  entry_id := gen_random_uuid()::text;

  -- Vorher-Werte nur beim ersten Votum dieser Antwort sichern; ein späterer
  -- Wechsel der Antwort (yes -> no) behält den ursprünglichen Ausgangszustand
  -- und ergänzt nur den neuen Effekt und den neuen Timeline-Eintrag.
  INSERT INTO public.task_decision_vote_effects AS effect (
    response_id, decision_id, task_id, tenant_id,
    previous_ball_owner, previous_ball_assignee_id, previous_next_action, previous_next_action_due,
    applied_ball_owner, applied_ball_assignee_id, applied_next_action, applied_next_action_due,
    timeline_entry_ids
  ) VALUES (
    NEW.id, d.id, t.id, d.tenant_id,
    t.ball_owner, t.ball_assignee_id, t.next_action, t.next_action_due,
    'office', next_assignee, next_action_value, NULL,
    jsonb_build_array(entry_id)
  )
  ON CONFLICT (response_id) DO UPDATE SET
    applied_ball_owner = EXCLUDED.applied_ball_owner,
    applied_ball_assignee_id = EXCLUDED.applied_ball_assignee_id,
    applied_next_action = EXCLUDED.applied_next_action,
    applied_next_action_due = EXCLUDED.applied_next_action_due,
    timeline_entry_ids = effect.timeline_entry_ids || EXCLUDED.timeline_entry_ids,
    updated_at = now();

  UPDATE tasks SET
    ball_owner = 'office',
    ball_assignee_id = next_assignee,
    next_action = next_action_value,
    next_action_due = NULL,
    timeline = COALESCE(t.timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', entry_id, 'type', 'system', 'at', now(),
      'text', 'Votum zu „' || d.title || '“: ' || label || COALESCE(' – ' || NULLIF(NEW.comment, ''), '') || ' · Am Zug: Büro'))
  WHERE id = t.id AND tenant_id = d.tenant_id;
  IF d.created_by IS NOT NULL AND EXISTS (
    SELECT 1 FROM user_tenant_memberships WHERE user_id = d.created_by AND tenant_id = d.tenant_id AND is_active
  ) THEN
    BEGIN
      PERFORM create_notification(d.created_by, 'task_updated', 'Votum eingegangen: ' || label, d.title,
        jsonb_build_object('task_id', t.id, 'decision_id', d.id, 'tenant_id', d.tenant_id), 'medium');
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'vote notification failed';
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.return_task_ball_after_vote() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_return_task_ball_after_vote ON public.task_decision_responses;
CREATE TRIGGER trg_return_task_ball_after_vote AFTER INSERT OR UPDATE OF response_type ON public.task_decision_responses
FOR EACH ROW EXECUTE FUNCTION public.return_task_ball_after_vote();

CREATE OR REPLACE FUNCTION public.withdraw_decision_response(_decision_id uuid, _participant_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  d record;
  p record;
  r record;
  effect record;
  task record;
  entry_ids text[];
  new_timeline jsonb;
  task_found boolean := false;
  restored int := 0;
  annotated int := 0;
  without_effect int := 0;
  removed_entries int := 0;
  results jsonb := '[]'::jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Bitte anmelden.' USING ERRCODE = '42501'; END IF;
  SELECT id, task_id, tenant_id, title, status INTO d FROM public.task_decisions WHERE id = _decision_id;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Entscheidung nicht gefunden.' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.tenant_id = d.tenant_id AND m.user_id = actor AND m.is_active
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Entscheidung.' USING ERRCODE = '42501';
  END IF;
  IF d.status NOT IN ('active', 'open') THEN
    RAISE EXCEPTION 'Die Entscheidung ist nicht mehr offen.' USING ERRCODE = '42501';
  END IF;
  IF _participant_id IS NOT NULL THEN
    SELECT id, user_id INTO p FROM public.task_decision_participants
    WHERE id = _participant_id AND decision_id = d.id AND user_id = actor;
  ELSE
    SELECT id, user_id INTO p FROM public.task_decision_participants
    WHERE decision_id = d.id AND user_id = actor ORDER BY id LIMIT 1;
  END IF;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Für diese Entscheidung liegt keine eigene Teilnahme vor.' USING ERRCODE = '42501';
  END IF;

  -- Alle eigenen Wurzelantworten dieser Entscheidung; Kinder hängen per
  -- ON DELETE CASCADE an ihrer Wurzel.
  FOR r IN
    SELECT id FROM public.task_decision_responses
    WHERE decision_id = d.id AND participant_id = p.id AND parent_response_id IS NULL
    ORDER BY created_at, id
  LOOP
    SELECT * INTO effect FROM public.task_decision_vote_effects WHERE response_id = r.id FOR UPDATE;
    task_found := false;
    IF effect.response_id IS NOT NULL THEN
      SELECT * INTO task FROM public.tasks WHERE id = effect.task_id AND tenant_id = effect.tenant_id FOR UPDATE;
      task_found := FOUND;
    ELSIF d.task_id IS NOT NULL THEN
      SELECT * INTO task FROM public.tasks WHERE id = d.task_id AND tenant_id = d.tenant_id FOR UPDATE;
      task_found := FOUND;
    END IF;
    DELETE FROM public.task_decision_responses WHERE id = r.id;

    IF NOT task_found THEN
      without_effect := without_effect + 1;
      results := results || jsonb_build_array(jsonb_build_object('response_id', r.id, 'status', 'without_effect'));
      CONTINUE;
    END IF;

    IF effect.response_id IS NULL THEN
      -- Votum aus der Zeit vor dem Snapshot: der Vorher-Zustand ist unbekannt,
      -- die Aufgabe bleibt deshalb stehen und erhält nur einen Vermerk.
      UPDATE public.tasks SET timeline = COALESCE(task.timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text, 'type', 'system', 'at', now(),
        'text', 'Votum zu „' || d.title || '“ zurückgenommen · kein Vorher-Zustand gespeichert, Ball bleibt beim Büro'))
      WHERE id = task.id AND tenant_id = task.tenant_id;
      annotated := annotated + 1;
      results := results || jsonb_build_array(jsonb_build_object('response_id', r.id, 'status', 'annotated', 'reason', 'ohne_snapshot'));
      CONTINUE;
    END IF;

    IF task.ball_owner IS NOT DISTINCT FROM effect.applied_ball_owner
      AND task.ball_assignee_id IS NOT DISTINCT FROM effect.applied_ball_assignee_id
      AND task.next_action IS NOT DISTINCT FROM effect.applied_next_action
      AND task.next_action_due IS NOT DISTINCT FROM effect.applied_next_action_due THEN
      -- Die Aufgabe steht noch genau auf dem Votum-Ergebnis: Vorher-Zustand
      -- wiederherstellen und die Votum-Einträge aus dem Verlauf entfernen.
      entry_ids := ARRAY(SELECT jsonb_array_elements_text(effect.timeline_entry_ids));
      new_timeline := COALESCE((
        SELECT jsonb_agg(part.entry ORDER BY part.ord)
        FROM jsonb_array_elements(COALESCE(task.timeline, '[]'::jsonb)) WITH ORDINALITY AS part(entry, ord)
        WHERE NOT (part.entry->>'id' = ANY (entry_ids))
      ), '[]'::jsonb);
      removed_entries := removed_entries + jsonb_array_length(COALESCE(task.timeline, '[]'::jsonb)) - jsonb_array_length(new_timeline);
      UPDATE public.tasks SET
        ball_owner = effect.previous_ball_owner,
        ball_assignee_id = effect.previous_ball_assignee_id,
        next_action = effect.previous_next_action,
        next_action_due = effect.previous_next_action_due,
        timeline = new_timeline
      WHERE id = task.id AND tenant_id = task.tenant_id;
      restored := restored + 1;
      results := results || jsonb_build_array(jsonb_build_object('response_id', r.id, 'status', 'restored'));
    ELSE
      -- Das Büro hat nach dem Votum gehandelt: nicht zurücksetzen, nur vermerken.
      UPDATE public.tasks SET timeline = COALESCE(task.timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text, 'type', 'system', 'at', now(),
        'text', 'Votum zu „' || d.title || '“ zurückgenommen · Aufgabe ist bereits weitergelaufen, Ball bleibt unverändert'))
      WHERE id = task.id AND tenant_id = task.tenant_id;
      annotated := annotated + 1;
      results := results || jsonb_build_array(jsonb_build_object('response_id', r.id, 'status', 'annotated', 'reason', 'weitergelaufen'));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status', CASE
      WHEN restored > 0 THEN 'restored'
      WHEN annotated > 0 THEN 'annotated'
      WHEN without_effect > 0 THEN 'without_effect'
      ELSE 'no_response'
    END,
    'decision_id', d.id,
    'task_id', d.task_id,
    'restored', restored,
    'annotated', annotated,
    'without_effect', without_effect,
    'removed_timeline_entries', removed_entries,
    'responses', results
  );
END $$;
REVOKE ALL ON FUNCTION public.withdraw_decision_response(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_decision_response(uuid, uuid) TO authenticated;

-- Ab hier ist der RPC der einzige Weg, ein Votum zurückzunehmen: der direkte
-- DELETE hätte Antwort und Aufgabenwirkung wieder auseinandergerissen.
DROP POLICY IF EXISTS "Participants can withdraw own open decision response" ON public.task_decision_responses;
REVOKE DELETE ON public.task_decision_responses FROM authenticated;
