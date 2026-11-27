-- Selbsttest für das Anmahnen offener Entscheidungen.
--
-- Der Ablauf ruft den echten RPC nudge_dashboard_decision auf und wird danach in
-- einer Untertransaktion vollständig zurückgerollt. Dadurch bleiben weder ein
-- Anstups-Eintrag noch eine Benachrichtigung an eine echte Person zurück
-- (Muster: knowledge_qa_selftest).
--
-- Geprüft wird:
-- - Anmahnen ist für Mitarbeitende, Büroleitung und Praktikanten erlaubt,
-- - der Anstups-Eintrag landet mit Absender und Notiz in dashboard_decision_nudges,
-- - eine zweite Mahnung innerhalb von 24 Stunden wird abgewiesen.
-- Ohne zweites Abgeordnetenkonto bzw. mit einer nicht anmahnenden Rolle prüft
-- der Aufruf die jeweilige Abweisung und meldet das im Feld mode.
CREATE OR REPLACE FUNCTION public.decision_nudge_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
  caller_role text;
  deputy uuid;
  target uuid;
  allowed boolean := false;
  stored boolean := false;
  repeat_blocked boolean := false;
  role_denied boolean := false;
  no_deputy boolean := false;
  ok boolean := false;
  denied_reason text;
  checks jsonb := '{}'::jsonb;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Bitte anmelden.' USING ERRCODE = '42501';
  END IF;

  SELECT m.role INTO caller_role
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant AND m.user_id = actor AND m.is_active
  LIMIT 1;
  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft.' USING ERRCODE = '42501';
  END IF;

  BEGIN
    INSERT INTO public.task_decisions (title, description, status, created_by, tenant_id, visible_to_all, priority)
    VALUES ('Selbsttest: Anmahnen offener Entscheidungen', 'Selbsttest', 'open', actor, p_tenant, false, 1)
    RETURNING id INTO target;

    SELECT m.user_id INTO deputy
    FROM public.user_tenant_memberships m
    WHERE m.tenant_id = p_tenant AND m.is_active AND m.role = 'abgeordneter' AND m.user_id <> actor
    LIMIT 1;

    IF deputy IS NOT NULL THEN
      INSERT INTO public.task_decision_participants (decision_id, user_id) VALUES (target, deputy);
    END IF;

    BEGIN
      PERFORM public.nudge_dashboard_decision(target, 'Selbsttest Anmahnen');
      allowed := true;
    EXCEPTION WHEN OTHERS THEN
      denied_reason := SQLERRM;
    END;

    IF allowed THEN
      stored := EXISTS (
        SELECT 1 FROM public.dashboard_decision_nudges n
        WHERE n.decision_id = target AND n.nudged_by = actor AND n.note = 'Selbsttest Anmahnen'
      );
      BEGIN
        PERFORM public.nudge_dashboard_decision(target, 'Nochmal');
      EXCEPTION WHEN OTHERS THEN
        repeat_blocked := SQLERRM LIKE '%24 Stunden%';
      END;
      ok := stored AND repeat_blocked;
    ELSIF caller_role NOT IN ('mitarbeiter', 'bueroleitung', 'praktikant') THEN
      role_denied := true;
      ok := COALESCE(denied_reason LIKE '%Keine Berechtigung%', false);
    ELSIF deputy IS NULL THEN
      no_deputy := true;
      ok := COALESCE(denied_reason LIKE '%wartet keine Entscheidung%', false);
    ELSE
      ok := false;
    END IF;

    checks := jsonb_build_object(
      'deputy_available', deputy IS NOT NULL,
      'nudge_allowed', allowed,
      'nudge_stored', stored,
      'repeat_blocked', repeat_blocked,
      'role_denied', role_denied,
      'no_waiting_deputy', no_deputy,
      'reason', denied_reason
    );

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX001';
  EXCEPTION
    WHEN SQLSTATE 'ZX001' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM, 'checks', checks);
  END;

  RETURN jsonb_build_object(
    'ok', ok,
    'mode', CASE
      WHEN allowed THEN 'checked'
      WHEN role_denied THEN 'role_denied'
      WHEN no_deputy THEN 'no_deputy'
      ELSE 'denied'
    END,
    'message', denied_reason,
    'checks', checks
  );
END $$;

REVOKE ALL ON FUNCTION public.decision_nudge_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_nudge_selftest(uuid) TO authenticated;
