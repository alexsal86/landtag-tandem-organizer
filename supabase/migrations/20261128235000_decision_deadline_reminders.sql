-- Frist-Erinnerungen 24 h und 2 h vor Ablauf, höchstens einmal je Person und Stufe.
-- Ruhezeiten werden beachtet; die Erinnerung ist nicht gebündelt und erreicht die
-- Person auch bei delivery_mode "off"/"digest".

INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id, 'task_decision_deadline_reminder', 'Frist-Erinnerung',
  'Erinnert offene Teilnehmende vor Ablauf der Antwortfrist.', 'decisions', true
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_decision_deadline_reminder_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (NEW.id, 'task_decision_deadline_reminder', 'Frist-Erinnerung',
    'Erinnert offene Teilnehmende vor Ablauf der Antwortfrist.', 'decisions', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.seed_decision_deadline_reminder_type() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS seed_decision_deadline_reminder_type ON public.tenants;
CREATE TRIGGER seed_decision_deadline_reminder_type
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_decision_deadline_reminder_type();

CREATE TABLE IF NOT EXISTS public.decision_deadline_reminders (
  decision_id uuid NOT NULL REFERENCES public.task_decisions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('24h', '2h')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (decision_id, user_id, stage)
);

ALTER TABLE public.decision_deadline_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.decision_deadline_reminders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.decision_deadline_reminders TO authenticated;

DROP POLICY IF EXISTS "Recipients read own decision reminders" ON public.decision_deadline_reminders;
CREATE POLICY "Recipients read own decision reminders"
  ON public.decision_deadline_reminders FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_tenant_member(tenant_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.decision_quiet_hours_active(
  _user_id uuid, _tenant_id uuid, _type_name text, _at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_start time;
  v_end time;
  v_local time;
BEGIN
  SELECT s.quiet_hours_start, s.quiet_hours_end INTO v_start, v_end
  FROM public.user_notification_settings s
  JOIN public.notification_types t ON t.id = s.notification_type_id
  WHERE s.user_id = _user_id AND t.tenant_id = _tenant_id AND t.name = _type_name
  LIMIT 1;

  IF v_start IS NULL OR v_end IS NULL OR v_start = v_end THEN RETURN false; END IF;
  v_local := (_at AT TIME ZONE 'Europe/Berlin')::time;
  IF v_start < v_end THEN RETURN v_local >= v_start AND v_local < v_end; END IF;
  RETURN v_local >= v_start OR v_local < v_end;
END;
$$;
REVOKE ALL ON FUNCTION public.decision_quiet_hours_active(uuid, uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_quiet_hours_active(uuid, uuid, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_notification(
  user_id_param uuid, type_name text, title_param text, message_param text,
  data_param jsonb, priority_param text, tenant_id_param uuid
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  notification_type uuid;
  notification_id uuid;
  v_mode text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_tenant_memberships
    WHERE tenant_id = tenant_id_param AND user_id = user_id_param AND is_active
  ) THEN
    RETURN NULL;
  END IF;

  IF type_name LIKE 'task_decision_%'
     AND type_name NOT IN ('task_decision_deadline_changed', 'task_decision_withdrawn',
                           'task_decision_trigger_alert', 'task_decision_mention',
                           'task_decision_deadline_reminder') THEN
    SELECT p.delivery_mode INTO v_mode
    FROM public.decision_notification_preferences p
    WHERE p.user_id = user_id_param AND p.tenant_id = tenant_id_param;
    IF v_mode = 'off' THEN RETURN NULL; END IF;
  END IF;

  SELECT id INTO notification_type
  FROM public.notification_types
  WHERE tenant_id = tenant_id_param AND name = type_name AND is_active;
  IF notification_type IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO notification_id
  FROM public.notifications
  WHERE tenant_id = tenant_id_param AND user_id = user_id_param
    AND notification_type_id = notification_type
    AND data = data_param
    AND created_at > now() - interval '1 minute';
  IF FOUND THEN RETURN notification_id; END IF;

  INSERT INTO public.user_notification_settings (user_id, notification_type_id, is_enabled, push_enabled)
  VALUES (user_id_param, notification_type, true, true)
  ON CONFLICT (user_id, notification_type_id) DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM public.user_notification_settings
    WHERE user_id = user_id_param AND notification_type_id = notification_type AND is_enabled
  ) THEN
    INSERT INTO public.notifications (tenant_id, user_id, notification_type_id, title, message, data, priority)
    VALUES (tenant_id_param, user_id_param, notification_type, title_param, message_param, data_param, priority_param)
    RETURNING id INTO notification_id;
  END IF;
  RETURN notification_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.decision_push_allowed(
  _user_id uuid, _tenant_id uuid, _type_name text, _at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_mode text;
  v_start time;
  v_end time;
  v_local time;
BEGIN
  IF _type_name IN ('task_decision_deadline_changed', 'task_decision_withdrawn', 'task_decision_trigger_alert') THEN
    RETURN true;
  END IF;
  IF _type_name NOT LIKE 'task_decision_%' THEN RETURN true; END IF;

  IF _type_name NOT IN ('task_decision_digest', 'task_decision_mention', 'task_decision_deadline_reminder') THEN
    SELECT p.delivery_mode INTO v_mode
    FROM public.decision_notification_preferences p
    WHERE p.user_id = _user_id AND p.tenant_id = _tenant_id;
    IF v_mode IN ('off', 'digest') THEN RETURN false; END IF;
  END IF;

  IF public.decision_quiet_hours_active(_user_id, _tenant_id, _type_name, _at) THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.decision_push_allowed(uuid, uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_push_allowed(uuid, uuid, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_decision_deadline_reminders(_at timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row RECORD;
  v_stage text;
  v_reminder_id uuid;
  v_notification uuid;
  v_created integer := 0;
  v_title text;
  v_message text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('decision_deadline_reminder_dispatch'));

  FOR v_row IN
    SELECT d.id AS decision_id, d.tenant_id, d.title, d.response_deadline,
           p.user_id,
           CASE WHEN d.response_deadline <= _at + interval '2 hours' THEN '2h' ELSE '24h' END AS stage
    FROM public.task_decisions d
    JOIN public.task_decision_participants p ON p.decision_id = d.id
    JOIN public.user_tenant_memberships m
      ON m.user_id = p.user_id AND m.tenant_id = d.tenant_id AND m.is_active
    WHERE d.status IN ('active', 'open')
      AND d.response_deadline IS NOT NULL
      AND d.response_deadline > _at
      AND d.response_deadline <= _at + interval '24 hours'
      AND p.user_id <> d.created_by
      AND NOT EXISTS (
        SELECT 1 FROM public.task_decision_responses r
        WHERE r.participant_id = p.id
          AND r.decision_id = d.id
          AND r.parent_response_id IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.decision_deadline_reminders x
        WHERE x.decision_id = d.id AND x.user_id = p.user_id
          AND x.stage = CASE WHEN d.response_deadline <= _at + interval '2 hours' THEN '2h' ELSE '24h' END
      )
  LOOP
    v_stage := v_row.stage;

    IF public.decision_quiet_hours_active(v_row.user_id, v_row.tenant_id, 'task_decision_deadline_reminder', _at) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.decision_deadline_reminders (decision_id, user_id, tenant_id, stage, sent_at)
    VALUES (v_row.decision_id, v_row.user_id, v_row.tenant_id, v_stage, _at)
    ON CONFLICT (decision_id, user_id, stage) DO NOTHING
    RETURNING decision_id INTO v_reminder_id;
    IF v_reminder_id IS NULL THEN CONTINUE; END IF;

    v_title := CASE WHEN v_stage = '2h'
      THEN 'Frist in 2 Stunden: ' || v_row.title
      ELSE 'Frist in 24 Stunden: ' || v_row.title END;
    v_message := CASE WHEN v_stage = '2h'
      THEN 'Die Antwortfrist für "' || v_row.title || '" endet in wenigen Stunden. Bitte antworte jetzt.'
      ELSE 'Die Antwortfrist für "' || v_row.title || '" endet innerhalb von 24 Stunden.' END;

    v_notification := public.create_notification(
      v_row.user_id,
      'task_decision_deadline_reminder',
      v_title,
      left(v_message, 240),
      jsonb_build_object(
        'decision_id', v_row.decision_id,
        'decision_title', v_row.title,
        'response_deadline', v_row.response_deadline,
        'reminder_stage', v_stage,
        'deadline_reminder', true,
        'tenant_id', v_row.tenant_id
      ),
      CASE WHEN v_stage = '2h' THEN 'high' ELSE 'medium' END,
      v_row.tenant_id
    );

    IF v_notification IS NULL THEN
      DELETE FROM public.decision_deadline_reminders
      WHERE decision_id = v_row.decision_id AND user_id = v_row.user_id AND stage = v_stage;
      CONTINUE;
    END IF;

    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_decision_deadline_reminders(timestamptz) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('dispatch-decision-deadline-reminders')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-decision-deadline-reminders');
    PERFORM cron.schedule(
      'dispatch-decision-deadline-reminders',
      '5 * * * *',
      $job$SELECT public.dispatch_decision_deadline_reminders();$job$
    );
  END IF;
END $$;
