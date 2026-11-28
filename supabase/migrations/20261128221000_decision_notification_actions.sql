-- P1.8: Meldungen bedienbar machen.
--
-- * respond_to_decision erlaubt die Antwort direkt aus einer Meldung; die RPC prüft
--   Teilnahme, offenen Status und Antworttyp und aktualisiert eine bestehende Antwort.
-- * dashboard_decision_nudges zählt Anstupser, damit „Angestupst“ Person und Anzahl zeigt.
-- * Der Selbsttest prüft Antwort, Aktualisierung, ungültigen Typ und fremde Entscheidung.

ALTER TABLE public.dashboard_decision_nudges
  ADD COLUMN IF NOT EXISTS nudge_count integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.respond_to_decision(_decision_id uuid, _response_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_participant uuid;
  v_response uuid;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Bitte anmelden.' USING ERRCODE = '42501';
  END IF;

  IF _response_type NOT IN ('yes', 'no', 'question') THEN
    RAISE EXCEPTION 'Ungültiger Antworttyp.' USING ERRCODE = '22023';
  END IF;

  SELECT d.status INTO v_status
  FROM public.task_decisions d
  WHERE d.id = _decision_id
    AND public.is_tenant_member(d.tenant_id, auth.uid())
    AND public.user_can_access_task_decision(d.id, auth.uid());

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Diese Entscheidung ist nicht zugänglich.' USING ERRCODE = '42501';
  END IF;

  IF v_status NOT IN ('active', 'open') THEN
    RAISE EXCEPTION 'Diese Entscheidung ist nicht mehr offen.' USING ERRCODE = '22023';
  END IF;

  SELECT p.id INTO v_participant
  FROM public.task_decision_participants p
  WHERE p.decision_id = _decision_id AND p.user_id = auth.uid()
  LIMIT 1;

  IF v_participant IS NULL THEN
    RAISE EXCEPTION 'Du bist nicht Teilnehmer dieser Entscheidung.' USING ERRCODE = '42501';
  END IF;

  SELECT r.id INTO v_response
  FROM public.task_decision_responses r
  WHERE r.decision_id = _decision_id
    AND r.participant_id = v_participant
    AND r.parent_response_id IS NULL
  ORDER BY r.created_at DESC
  LIMIT 1;

  IF v_response IS NULL THEN
    INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type)
    VALUES (_decision_id, v_participant, _response_type)
    RETURNING id INTO v_response;
  ELSE
    UPDATE public.task_decision_responses
    SET response_type = _response_type, updated_at = now()
    WHERE id = v_response;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'response_id', v_response,
    'response_type', _response_type,
    'decision_id', _decision_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_decision(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_decision(uuid, text) TO authenticated;

-- Anstupser zählen: erster Eintrag 1, jeder weitere innerhalb der Sperre ausgeschlossen,
-- nach Ablauf der 24 Stunden wird hochgezählt.
CREATE OR REPLACE FUNCTION public.nudge_dashboard_decision(_decision_id uuid, _note text DEFAULT NULL)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  d public.task_decisions;
  last_nudge timestamptz;
  sent_at timestamptz := now();
  sender_name text;
  recipient record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Bitte anmelden.' USING ERRCODE = '42501'; END IF;
  IF char_length(COALESCE(_note,'')) > 500 THEN RAISE EXCEPTION 'Der Hinweis darf höchstens 500 Zeichen enthalten.'; END IF;
  SELECT * INTO d FROM public.task_decisions WHERE id = _decision_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_active_tenant_role(auth.uid(),d.tenant_id,ARRAY['mitarbeiter','bueroleitung','praktikant'])
    OR NOT public.user_can_access_task_decision(d.id,auth.uid()) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Anstupsen.' USING ERRCODE = '42501';
  END IF;
  IF d.status NOT IN ('active','open') THEN RAISE EXCEPTION 'Die Entscheidung ist nicht mehr offen.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.task_decision_participants p
    JOIN public.user_tenant_memberships m ON m.user_id = p.user_id AND m.tenant_id = d.tenant_id
      AND m.is_active AND m.role = 'abgeordneter'
    WHERE p.decision_id = d.id AND p.user_id <> d.created_by
      AND NOT EXISTS (SELECT 1 FROM public.task_decision_responses r
        WHERE r.participant_id = p.id AND r.decision_id = d.id AND r.parent_response_id IS NULL)
  ) THEN RAISE EXCEPTION 'Hier wartet keine Entscheidung mehr auf den Abgeordneten.'; END IF;

  SELECT nudged_at INTO last_nudge FROM public.dashboard_decision_nudges WHERE decision_id = d.id;
  IF last_nudge > sent_at - interval '24 hours' THEN RAISE EXCEPTION 'Diese Entscheidung wurde bereits innerhalb der letzten 24 Stunden angestupst.'; END IF;
  INSERT INTO public.dashboard_decision_nudges(decision_id,tenant_id,nudged_at,nudged_by,note,nudge_count)
  VALUES(d.id,d.tenant_id,sent_at,auth.uid(),NULLIF(btrim(_note),''),1)
  ON CONFLICT(decision_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id,nudged_at = EXCLUDED.nudged_at,
    nudged_by = EXCLUDED.nudged_by,note = EXCLUDED.note,
    nudge_count = public.dashboard_decision_nudges.nudge_count + 1;
  SELECT display_name INTO sender_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  FOR recipient IN
    SELECT DISTINCT p.user_id FROM public.task_decision_participants p
    JOIN public.user_tenant_memberships m ON m.user_id = p.user_id AND m.tenant_id = d.tenant_id
      AND m.is_active AND m.role = 'abgeordneter'
    WHERE p.decision_id = d.id AND p.user_id <> d.created_by
      AND NOT EXISTS (SELECT 1 FROM public.task_decision_responses r
        WHERE r.participant_id = p.id AND r.decision_id = d.id AND r.parent_response_id IS NULL)
  LOOP
    PERFORM public.create_notification(recipient.user_id,'task_decision_request','Angestupst: ' || d.title,
      COALESCE(sender_name,'Das Büro') || ' erinnert an deine Entscheidung.'
        || COALESCE(' ' || NULLIF(btrim(_note),''),''),
      jsonb_build_object('decision_id',d.id,'nudge',true,'nudged_at',sent_at),'high',d.tenant_id);
  END LOOP;
  RETURN sent_at;
END $$;
REVOKE ALL ON FUNCTION public.nudge_dashboard_decision(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.nudge_dashboard_decision(uuid,text) TO authenticated;

-- Die Rückgabespalte nudge_count ist neu; CREATE OR REPLACE kann den Rückgabetyp
-- nicht ändern.
DROP FUNCTION IF EXISTS public.get_deputy_dashboard_decisions(uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.get_deputy_dashboard_decisions(_tenant_id uuid, _decision_ids uuid[] DEFAULT NULL)
RETURNS TABLE(decision_id uuid, title text, nudged_at timestamptz, nudge_note text, nudged_by_name text, nudge_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT d.id,d.title,n.nudged_at,n.note,
    (SELECT p.display_name FROM public.profiles p WHERE p.user_id = n.nudged_by LIMIT 1),
    COALESCE(n.nudge_count, 0)
  FROM public.task_decisions d
  LEFT JOIN public.dashboard_decision_nudges n ON n.decision_id = d.id AND n.tenant_id = d.tenant_id
  WHERE auth.uid() IS NOT NULL AND d.tenant_id = _tenant_id AND d.status IN ('active','open')
    AND EXISTS (SELECT 1 FROM public.user_tenant_memberships m
      WHERE m.tenant_id = d.tenant_id AND m.user_id = auth.uid() AND m.is_active)
    AND public.user_can_access_task_decision(d.id, auth.uid())
    AND (_decision_ids IS NULL OR d.id = ANY(_decision_ids))
    AND EXISTS (
      SELECT 1 FROM public.task_decision_participants p
      JOIN public.user_tenant_memberships deputy ON deputy.user_id = p.user_id
        AND deputy.tenant_id = d.tenant_id AND deputy.is_active AND deputy.role = 'abgeordneter'
      WHERE p.decision_id = d.id AND p.user_id <> d.created_by
        AND NOT EXISTS (SELECT 1 FROM public.task_decision_responses r
          WHERE r.participant_id = p.id AND r.decision_id = d.id AND r.parent_response_id IS NULL)
    )
  ORDER BY d.response_deadline NULLS LAST,d.created_at,d.id;
$$;
REVOKE ALL ON FUNCTION public.get_deputy_dashboard_decisions(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_deputy_dashboard_decisions(uuid,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.decision_notification_actions_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_decision uuid;
  v_first jsonb;
  v_second jsonb;
  v_first_id uuid;
  v_second_id uuid;
  v_invalid_rejected boolean := false;
  v_foreign_rejected boolean := false;
  v_count integer;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  BEGIN
    INSERT INTO public.task_decisions (title, description, status, created_by, tenant_id)
    VALUES ('[SELFTEST] Meldungsaktionen', '[SELFTEST]', 'open', v_actor, p_tenant)
    RETURNING id INTO v_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_actor);

    v_first := public.respond_to_decision(v_decision, 'yes');
    v_first_id := (v_first->>'response_id')::uuid;

    v_second := public.respond_to_decision(v_decision, 'no');
    v_second_id := (v_second->>'response_id')::uuid;

    BEGIN
      PERFORM public.respond_to_decision(v_decision, 'maybe');
    EXCEPTION WHEN OTHERS THEN
      v_invalid_rejected := true;
    END;

    BEGIN
      PERFORM public.respond_to_decision(gen_random_uuid(), 'yes');
    EXCEPTION WHEN OTHERS THEN
      v_foreign_rejected := true;
    END;

    SELECT count(*) INTO v_count
    FROM public.task_decision_responses r
    WHERE r.decision_id = v_decision AND r.parent_response_id IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_first_id IS NOT NULL AND v_first_id = v_second_id
      AND v_second->>'response_type' = 'no' AND v_count = 1
      AND v_invalid_rejected AND v_foreign_rejected,
    'checks', jsonb_build_object(
      'first_response', v_first_id,
      'updated_same_row', v_first_id = v_second_id,
      'response_type', v_second->>'response_type',
      'invalid_type_rejected', v_invalid_rejected,
      'foreign_decision_rejected', v_foreign_rejected,
      'response_rows', v_count
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decision_notification_actions_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_notification_actions_selftest(uuid) TO authenticated;
