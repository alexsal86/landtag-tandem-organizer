-- Schnellabstimmung an die konfigurierten Antwortoptionen binden und den Ersteller
-- serverseitig ausschließen. Die Detailansicht blockiert ihn bereits im Client; hier
-- gilt dieselbe Regel auch für Meldungs-Buttons und direkte RPC-Aufrufe.
-- Die alte Zwei-Argument-Fassung würde die neuen Prüfungen umgehen.
DROP FUNCTION IF EXISTS public.respond_to_decision(uuid, text);

CREATE OR REPLACE FUNCTION public.respond_to_decision(
  _decision_id uuid,
  _response_type text,
  _comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_decision public.task_decisions;
  v_options jsonb;
  v_participant uuid;
  v_response uuid;
  v_requires_comment boolean := false;
  v_comment text := nullif(btrim(coalesce(_comment, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Bitte anmelden.' USING ERRCODE = '42501';
  END IF;

  SELECT d.* INTO v_decision
  FROM public.task_decisions d
  WHERE d.id = _decision_id
    AND public.is_tenant_member(d.tenant_id, auth.uid())
    AND public.user_can_access_task_decision(d.id, auth.uid());

  IF v_decision.id IS NULL THEN
    RAISE EXCEPTION 'Diese Entscheidung ist nicht zugänglich.' USING ERRCODE = '42501';
  END IF;

  IF v_decision.created_by = auth.uid() THEN
    RAISE EXCEPTION 'Der Ersteller kann nicht abstimmen.' USING ERRCODE = '42501';
  END IF;

  IF v_decision.status NOT IN ('active', 'open') THEN
    RAISE EXCEPTION 'Diese Entscheidung ist nicht mehr offen.' USING ERRCODE = '22023';
  END IF;

  v_options := CASE
    WHEN v_decision.response_options IS NULL OR jsonb_array_length(v_decision.response_options) = 0
      THEN '[{"key":"yes"},{"key":"no"},{"key":"question"}]'::jsonb
    ELSE v_decision.response_options
  END;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_options) AS option
    WHERE option->>'key' = _response_type
  ) THEN
    RAISE EXCEPTION 'Diese Antwortoption ist für die Entscheidung nicht konfiguriert.' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce((option->>'requires_comment')::boolean, false)
    INTO v_requires_comment
  FROM jsonb_array_elements(v_options) AS option
  WHERE option->>'key' = _response_type
  LIMIT 1;

  IF v_requires_comment AND v_comment IS NULL THEN
    RAISE EXCEPTION 'Diese Antwortoption benötigt einen Kommentar.' USING ERRCODE = '22023';
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
    INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type, comment)
    VALUES (_decision_id, v_participant, _response_type, v_comment)
    RETURNING id INTO v_response;
  ELSE
    UPDATE public.task_decision_responses
    SET response_type = _response_type,
        comment = v_comment,
        updated_at = now()
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

REVOKE ALL ON FUNCTION public.respond_to_decision(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_decision(uuid, text, text) TO authenticated;

-- Selbsttest: fremder Ersteller, eigene Optionen, Kommentarpflicht, Ersteller-Sperre.
CREATE OR REPLACE FUNCTION public.decision_notification_actions_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_other uuid;
  v_decision uuid;
  v_creator_decision uuid;
  v_first jsonb;
  v_second jsonb;
  v_first_id uuid;
  v_second_id uuid;
  v_options_rejected boolean := false;
  v_comment_required boolean := false;
  v_foreign_rejected boolean := false;
  v_creator_rejected boolean := false;
  v_count integer;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT m.user_id INTO v_other
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant AND m.user_id <> v_actor AND m.is_active
  ORDER BY m.user_id
  LIMIT 1;

  IF v_other IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – Schnellabstimmung nicht prüfbar.');
  END IF;

  BEGIN
    -- Entscheidung einer anderen Person mit eigenen Optionen.
    INSERT INTO public.task_decisions (title, description, status, created_by, tenant_id, response_options)
    VALUES ('[SELFTEST] Meldungsaktionen', '[SELFTEST]', 'open', v_other, p_tenant,
            '[{"key":"a","label":"Variante A"},{"key":"b","label":"Variante B"},{"key":"c","label":"Mit Kommentar","requires_comment":true}]'::jsonb)
    RETURNING id INTO v_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_actor);

    v_first := public.respond_to_decision(v_decision, 'a');
    v_first_id := (v_first->>'response_id')::uuid;

    v_second := public.respond_to_decision(v_decision, 'b');
    v_second_id := (v_second->>'response_id')::uuid;

    BEGIN
      PERFORM public.respond_to_decision(v_decision, 'yes');
    EXCEPTION WHEN OTHERS THEN
      v_options_rejected := true;
    END;

    BEGIN
      PERFORM public.respond_to_decision(v_decision, 'c');
    EXCEPTION WHEN OTHERS THEN
      v_comment_required := true;
    END;

    BEGIN
      PERFORM public.respond_to_decision(gen_random_uuid(), 'a');
    EXCEPTION WHEN OTHERS THEN
      v_foreign_rejected := true;
    END;

    -- Der Ersteller darf auch als eingetragener Teilnehmer nicht abstimmen.
    INSERT INTO public.task_decisions (title, description, status, created_by, tenant_id)
    VALUES ('[SELFTEST] Ersteller-Sperre', '[SELFTEST]', 'open', v_actor, p_tenant)
    RETURNING id INTO v_creator_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_creator_decision, v_actor);

    BEGIN
      PERFORM public.respond_to_decision(v_creator_decision, 'yes');
    EXCEPTION WHEN OTHERS THEN
      v_creator_rejected := true;
    END;

    SELECT count(*) INTO v_count
    FROM public.task_decision_responses r
    WHERE r.decision_id = v_decision AND r.parent_response_id IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_first_id IS NOT NULL AND v_first_id = v_second_id
      AND v_second->>'response_type' = 'b' AND v_count = 1
      AND v_options_rejected AND v_comment_required AND v_foreign_rejected AND v_creator_rejected,
    'checks', jsonb_build_object(
      'first_response', v_first_id,
      'updated_same_row', v_first_id = v_second_id,
      'response_type', v_second->>'response_type',
      'unconfigured_option_rejected', v_options_rejected,
      'comment_required', v_comment_required,
      'foreign_decision_rejected', v_foreign_rejected,
      'creator_rejected', v_creator_rejected,
      'response_rows', v_count
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decision_notification_actions_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_notification_actions_selftest(uuid) TO authenticated;
