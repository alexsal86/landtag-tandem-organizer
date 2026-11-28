-- P1.9: Wirkung der Entscheidungs-Meldungen messen.
--
-- Kennzahlen je Mandant und Zeitraum:
--   * Zustellungen: In-App, Push, E-Mail (Outbox sent/failed)
--   * Abschaltquote je Entscheidungstyp
--   * Zeit bis zur ersten Antwort (Durchschnitt und Median)
--   * Anstupser-Wirkung: Antwort innerhalb von 24 Stunden
--   * Trigger-Fehlerquote und Alarm bei Ausnahmen der letzten 24 Stunden
--
-- Trigger-Ausnahmen werden protokolliert, statt nur als WARNING im Log zu verschwinden.

CREATE TABLE IF NOT EXISTS public.decision_notification_trigger_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES public.task_decisions(id) ON DELETE SET NULL,
  source text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_notification_trigger_errors_tenant_time
  ON public.decision_notification_trigger_errors (tenant_id, created_at DESC);

ALTER TABLE public.decision_notification_trigger_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Office leads read trigger errors" ON public.decision_notification_trigger_errors;
CREATE POLICY "Office leads read trigger errors"
  ON public.decision_notification_trigger_errors FOR SELECT TO authenticated
  USING (public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['bueroleitung']));
GRANT SELECT ON public.decision_notification_trigger_errors TO authenticated;

-- Alarmtyp für protokollierte Trigger-Ausnahmen.
INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id, 'task_decision_trigger_alert', 'Meldungsfehler protokolliert',
       'Ein Entscheidungs-Trigger konnte eine Meldung nicht zustellen; die Änderung selbst blieb erhalten.', 'decisions', true
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_decision_trigger_alert_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (NEW.id, 'task_decision_trigger_alert', 'Meldungsfehler protokolliert',
          'Ein Entscheidungs-Trigger konnte eine Meldung nicht zustellen; die Änderung selbst blieb erhalten.', 'decisions', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.seed_decision_trigger_alert_type() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS seed_decision_trigger_alert_type ON public.tenants;
CREATE TRIGGER seed_decision_trigger_alert_type
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_decision_trigger_alert_type();

CREATE OR REPLACE FUNCTION public.log_decision_notification_error(
  _source text,
  _tenant_id uuid,
  _decision_id uuid,
  _message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_recipient uuid;
BEGIN
  INSERT INTO public.decision_notification_trigger_errors (source, tenant_id, decision_id, message)
  VALUES (left(coalesce(_source, 'unbekannt'), 120), _tenant_id, _decision_id, left(coalesce(_message, 'unbekannt'), 500));

  BEGIN
    -- Büroleitung alarmieren, höchstens einmal je Mandant und Stunde.
    IF _tenant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.tenant_id = _tenant_id
      AND t.name = 'task_decision_trigger_alert'
      AND n.created_at > now() - interval '1 hour'
  ) THEN
    FOR v_recipient IN
      SELECT m.user_id FROM public.user_tenant_memberships m
      WHERE m.tenant_id = _tenant_id AND m.is_active AND m.role = 'bueroleitung'
    LOOP
      PERFORM public.create_notification(
        v_recipient,
        'task_decision_trigger_alert',
        'Meldungsfehler protokolliert',
        'Ein Entscheidungs-Trigger konnte eine Meldung nicht zustellen; die Änderung blieb erhalten.',
        jsonb_build_object('tenant_id', _tenant_id, 'decision_id', _decision_id, 'source', _source, 'alarm', true),
        'high',
        _tenant_id
      );
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
EXCEPTION WHEN OTHERS THEN
  -- Die Protokollierung darf niemals die auslösende Änderung kippen.
  NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_decision_notification_error(text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- Alle Entscheidungs-Trigger protokollieren ihre Ausnahmen. Die Funktionen fangen
-- Fehler bereits ab (die Änderung bleibt bestehen); hier kommt nur die Protokollzeile
-- dazu. Der Patch ist idempotent und prüft, dass alle erwarteten Funktionen erfasst sind.
DO $patch$
DECLARE
  r RECORD;
  v_def text;
  v_patched integer := 0;
  v_target constant text := 'RAISE WARNING ''Entscheidungs-Meldung (%) fehlgeschlagen: %'', TG_NAME, SQLERRM;';
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'notify_decision_participant_added',
        'notify_decision_comment',
        'notify_decision_comment_reaction',
        'notify_decision_response_events',
        'notify_decision_visible_to_all',
        'notify_decision_result_participants',
        'notify_decision_lifecycle_changes'
      )
  LOOP
    v_def := pg_get_functiondef(r.oid);
    IF position('log_decision_notification_error' IN v_def) > 0 THEN
      v_patched := v_patched + 1;
      CONTINUE;
    END IF;
    IF position(v_target IN v_def) = 0 THEN
      RAISE EXCEPTION 'Trigger-Funktion % ohne erwarteten Ausnahme-Handler', r.oid::regprocedure;
    END IF;

    EXECUTE replace(
      v_def,
      v_target,
      $inject$PERFORM public.log_decision_notification_error(
        TG_TABLE_NAME,
        CASE WHEN to_jsonb(NEW) ? 'tenant_id' THEN (to_jsonb(NEW)->>'tenant_id')::uuid END,
        CASE WHEN to_jsonb(NEW) ? 'decision_id' THEN (to_jsonb(NEW)->>'decision_id')::uuid
             WHEN TG_TABLE_NAME = 'task_decisions' THEN (to_jsonb(NEW)->>'id')::uuid END,
        SQLERRM
      );
      RAISE WARNING 'Entscheidungs-Meldung (%) fehlgeschlagen: %', TG_NAME, SQLERRM;$inject$
    );
    v_patched := v_patched + 1;
  END LOOP;

  IF v_patched <> 7 THEN
    RAISE EXCEPTION 'Erwartet 7 Entscheidungs-Trigger, gepatcht: %', v_patched;
  END IF;
END $patch$;

CREATE OR REPLACE FUNCTION public.notification_metrics(_tenant_id uuid, _days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_since timestamptz;
  v_members integer;
  v_in_app integer;
  v_push integer;
  v_email_sent integer;
  v_email_failed integer;
  v_trigger_errors integer;
  v_trigger_errors_24h integer;
  v_notifications integer;
  v_opt_out jsonb;
  v_first_response jsonb;
  v_nudges integer;
  v_nudged_responses integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_tenant_member(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diesen Mandanten.' USING ERRCODE = '42501';
  END IF;

  v_since := now() - make_interval(days => greatest(1, least(coalesce(_days, 30), 365)));

  SELECT count(*) INTO v_members
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = _tenant_id AND m.is_active;

  SELECT count(*) INTO v_notifications
  FROM public.notifications n
  WHERE n.tenant_id = _tenant_id AND n.created_at >= v_since;

  v_in_app := v_notifications;

  SELECT count(*) INTO v_push
  FROM public.notifications n
  WHERE n.tenant_id = _tenant_id AND n.created_at >= v_since
    AND (n.is_pushed OR n.push_sent_at IS NOT NULL);

  SELECT count(*) FILTER (WHERE d.status = 'sent'),
         count(*) FILTER (WHERE d.status = 'failed')
    INTO v_email_sent, v_email_failed
  FROM public.decision_invitation_dispatches d
  WHERE d.tenant_id = _tenant_id
    AND coalesce(d.processed_at, d.created_at) >= v_since;

  SELECT count(*),
         count(*) FILTER (WHERE e.created_at >= now() - interval '24 hours')
    INTO v_trigger_errors, v_trigger_errors_24h
  FROM public.decision_notification_trigger_errors e
  WHERE e.tenant_id = _tenant_id AND e.created_at >= v_since;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'name', t.name,
           'label', t.label,
           'disabled', coalesce(s.disabled, 0),
           'members', v_members,
           'rate', CASE WHEN v_members > 0 THEN round(coalesce(s.disabled, 0)::numeric / v_members, 4) ELSE 0 END
         ) ORDER BY t.label), '[]'::jsonb)
    INTO v_opt_out
  FROM public.notification_types t
  LEFT JOIN (
    SELECT uns.notification_type_id, count(*) FILTER (WHERE NOT uns.is_enabled) AS disabled
    FROM public.user_notification_settings uns
    GROUP BY uns.notification_type_id
  ) s ON s.notification_type_id = t.id
  WHERE t.tenant_id = _tenant_id AND t.category = 'decisions';

  SELECT jsonb_build_object(
           'decisions', count(*),
           'avg_minutes', round(avg(x.minutes)::numeric, 1),
           'median_minutes', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY x.minutes)::numeric, 1)
         )
    INTO v_first_response
  FROM (
    SELECT td.id,
           extract(epoch FROM (
             (SELECT min(r.created_at) FROM public.task_decision_responses r WHERE r.decision_id = td.id)
             - (SELECT min(p.created_at) FROM public.task_decision_participants p WHERE p.decision_id = td.id)
           )) / 60 AS minutes
    FROM public.task_decisions td
    WHERE td.tenant_id = _tenant_id AND td.created_at >= v_since
      AND EXISTS (SELECT 1 FROM public.task_decision_responses r WHERE r.decision_id = td.id)
      AND EXISTS (SELECT 1 FROM public.task_decision_participants p WHERE p.decision_id = td.id)
  ) x;

  SELECT count(*),
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM public.task_decision_responses r
           WHERE r.decision_id = n.decision_id
             AND r.created_at >= n.nudged_at
             AND r.created_at <= n.nudged_at + interval '24 hours'
         ))
    INTO v_nudges, v_nudged_responses
  FROM public.dashboard_decision_nudges n
  WHERE n.tenant_id = _tenant_id AND n.nudged_at >= v_since;

  RETURN jsonb_build_object(
    'tenant_id', _tenant_id,
    'days', greatest(1, least(coalesce(_days, 30), 365)),
    'since', v_since,
    'deliveries', jsonb_build_object(
      'in_app', v_in_app,
      'push', v_push,
      'email_sent', coalesce(v_email_sent, 0),
      'email_failed', coalesce(v_email_failed, 0)
    ),
    'opt_out_by_type', v_opt_out,
    'first_response', v_first_response,
    'nudges', jsonb_build_object(
      'total', v_nudges,
      'answered_within_24h', v_nudged_responses,
      'rate', CASE WHEN v_nudges > 0 THEN round(v_nudged_responses::numeric / v_nudges, 4) ELSE 0 END
    ),
    'trigger_errors', jsonb_build_object(
      'total', v_trigger_errors,
      'last_24h', v_trigger_errors_24h,
      'rate', CASE WHEN v_notifications + v_trigger_errors > 0
        THEN round(v_trigger_errors::numeric / (v_notifications + v_trigger_errors), 4) ELSE 0 END,
      'alarm', v_trigger_errors_24h > 0
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notification_metrics(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notification_metrics(uuid, integer) TO authenticated;
