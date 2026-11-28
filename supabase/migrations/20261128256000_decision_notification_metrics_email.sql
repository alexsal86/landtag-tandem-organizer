-- Kennzahlen um den neuen E-Mail-Kanal der Entscheidungs-Meldungen ergänzen.
--
-- `deliveries.email_sent`/`email_failed` zählen weiterhin nur die
-- Einladungs-Outbox (decision_invitation_dispatches). Der eigene Kanal für
-- Entscheidungs-Meldungen (decision_notification_email_dispatches) bekommt
-- getrennte Zähler, damit die Wirkungsansicht beides nicht vermischt.

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
  v_notification_email_sent integer;
  v_notification_email_failed integer;
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

  SELECT count(*) FILTER (WHERE d.status = 'sent'),
         count(*) FILTER (WHERE d.status = 'failed')
    INTO v_notification_email_sent, v_notification_email_failed
  FROM public.decision_notification_email_dispatches d
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
      'email_failed', coalesce(v_email_failed, 0),
      'email_notifications_sent', coalesce(v_notification_email_sent, 0),
      'email_notifications_failed', coalesce(v_notification_email_failed, 0)
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
