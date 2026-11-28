-- Ruhezeiten-Catch-up für Entscheidungs-Pushes.
--
-- Bisher wurde ein Push während der Ruhezeit einfach unterdrückt; die Meldung
-- blieb in der App liegen, wurde aber nie gepusht. Jetzt wird die Meldung mit
-- push_deferred_until markiert und nach Ende der Ruhezeit genau einmal über
-- dispatch_deferred_decision_pushes nachgeholt.
--
-- Der bisherige generische Push-Trigger (trigger_push_on_notification) hatte die
-- Ruhezeit-/Frequenzprüfung nicht aufgerufen. Er wird durch notification_push_trigger
-- ersetzt; der Mobile-Trigger bekommt dieselbe Prüfung, damit kein Kanal die
-- Ruhezeit umgeht.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_deferred_until timestamptz,
  ADD COLUMN IF NOT EXISTS push_catchup_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_push_deferred
  ON public.notifications (push_deferred_until)
  WHERE push_deferred_until IS NOT NULL;

CREATE OR REPLACE FUNCTION public.decision_quiet_hours_end_at(
  _user_id uuid,
  _tenant_id uuid,
  _type_name text,
  _at timestamptz DEFAULT now()
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_start time;
  v_end time;
  v_local timestamp;
BEGIN
  SELECT s.quiet_hours_start, s.quiet_hours_end
    INTO v_start, v_end
  FROM public.user_notification_settings s
  JOIN public.notification_types t ON t.id = s.notification_type_id
  WHERE s.user_id = _user_id
    AND t.tenant_id = _tenant_id
    AND t.name = _type_name
  LIMIT 1;

  IF v_start IS NULL OR v_end IS NULL OR v_start = v_end THEN
    RETURN NULL;
  END IF;

  v_local := _at AT TIME ZONE 'Europe/Berlin';
  IF v_start < v_end THEN
    IF v_local::time >= v_start AND v_local::time < v_end THEN
      RETURN (v_local::date + v_end) AT TIME ZONE 'Europe/Berlin';
    END IF;
  ELSE
    IF v_local::time >= v_start THEN
      RETURN ((v_local::date + 1) + v_end) AT TIME ZONE 'Europe/Berlin';
    ELSIF v_local::time < v_end THEN
      RETURN (v_local::date + v_end) AT TIME ZONE 'Europe/Berlin';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.decision_quiet_hours_end_at(uuid, uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_quiet_hours_end_at(uuid, uuid, text, timestamptz) TO authenticated;

-- Zentraler Web-Push. Prüft Frequenz und Ruhezeiten; außerhalb der Ruhezeit
-- wird wie bisher über die Edge Function versendet.
CREATE OR REPLACE FUNCTION public.handle_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_type_name text;
  v_tenant uuid;
  v_mode text;
  v_push_enabled boolean;
  v_is_enabled boolean;
  v_until timestamptz;
  v_has_web boolean;
  v_has_mobile boolean;
  v_url text;
  v_key text;
BEGIN
  SELECT nt.name, nt.tenant_id
    INTO v_type_name, v_tenant
  FROM public.notification_types nt
  WHERE nt.id = NEW.notification_type_id;

  v_tenant := coalesce(v_tenant, NEW.tenant_id);

  -- Für Entscheidungs-Meldungen gelten die persönlichen Einstellungen und die
  -- Zustellfrequenz. Andere Typen behalten das bisherige Verhalten des
  -- generischen Push-Triggers.
  IF v_type_name LIKE 'task_decision_%' THEN
    SELECT s.push_enabled, s.is_enabled
      INTO v_push_enabled, v_is_enabled
    FROM public.user_notification_settings s
    WHERE s.user_id = NEW.user_id
      AND s.notification_type_id = NEW.notification_type_id
    LIMIT 1;

    IF coalesce(v_push_enabled, false) = false OR coalesce(v_is_enabled, false) = false THEN
      RETURN NEW;
    END IF;
  END IF;

  IF v_type_name LIKE 'task_decision_%'
     AND NOT public.decision_push_allowed(NEW.user_id, v_tenant, v_type_name, now()) THEN
    -- Nur echte Ruhezeit-Fälle zurückstellen. Bei "gebündelt"/"aus" werden
    -- Einzelmeldungen absichtlich nicht gepusht; der Digest übernimmt das.
    IF public.decision_quiet_hours_active(NEW.user_id, v_tenant, v_type_name, now()) THEN
      SELECT p.delivery_mode INTO v_mode
      FROM public.decision_notification_preferences p
      WHERE p.user_id = NEW.user_id AND p.tenant_id = v_tenant;

      IF v_type_name IN (
           'task_decision_digest',
           'task_decision_mention',
           'task_decision_deadline_reminder',
           'task_decision_daily_digest',
           'task_decision_deadline_changed',
           'task_decision_withdrawn',
           'task_decision_trigger_alert'
         )
         OR coalesce(v_mode, 'immediate') = 'immediate' THEN
        SELECT EXISTS (
          SELECT 1 FROM public.push_subscriptions ps
          WHERE ps.user_id = NEW.user_id AND ps.is_active
        ) INTO v_has_web;
        SELECT EXISTS (
          SELECT 1 FROM public.mobile_push_tokens mt
          WHERE mt.user_id = NEW.user_id AND mt.is_active
        ) INTO v_has_mobile;

        IF v_has_web OR v_has_mobile THEN
          v_until := public.decision_quiet_hours_end_at(NEW.user_id, v_tenant, v_type_name, now());
          IF v_until IS NOT NULL THEN
            UPDATE public.notifications
            SET push_deferred_until = v_until
            WHERE id = NEW.id;
          END IF;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.push_subscriptions ps
    WHERE ps.user_id = NEW.user_id AND ps.is_active
  ) THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  IF v_url IS NULL THEN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  END IF;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'Push nicht versendet: Vault-Konfiguration fehlt';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'priority', coalesce(NEW.priority, 'medium'),
      'data', coalesce(NEW.data, '{}'::jsonb),
      'from_trigger', true
    )
  );

  UPDATE public.notifications
  SET is_pushed = true,
      push_sent_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push-Meldung (%) fehlgeschlagen: %', TG_NAME, SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_notification_push() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_push_on_notification ON public.notifications;
DROP TRIGGER IF EXISTS push_notification_trigger ON public.notifications;
DROP TRIGGER IF EXISTS notification_push_trigger ON public.notifications;
CREATE TRIGGER notification_push_trigger
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_notification_push();

-- Mobile Push darf die Ruhezeit ebenfalls nicht umgehen. Der Catch-up sendet
-- anschließend beide Kanäle, sofern sie aktiv sind.
CREATE OR REPLACE FUNCTION public.dispatch_mobile_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  has_active_token boolean;
  project_url text;
  service_key text;
  v_type_name text;
  v_tenant uuid;
BEGIN
  SELECT nt.name, nt.tenant_id
    INTO v_type_name, v_tenant
  FROM public.notification_types nt
  WHERE nt.id = NEW.notification_type_id;

  v_tenant := coalesce(v_tenant, NEW.tenant_id);

  IF v_type_name LIKE 'task_decision_%' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_notification_settings s
      WHERE s.user_id = NEW.user_id
        AND s.notification_type_id = NEW.notification_type_id
        AND s.is_enabled AND s.push_enabled
    ) THEN
      RETURN NEW;
    END IF;

    IF NOT public.decision_push_allowed(NEW.user_id, v_tenant, v_type_name, now()) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.mobile_push_tokens
    WHERE user_id = NEW.user_id AND is_active = true
  ) INTO has_active_token;

  IF NOT has_active_token THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO project_url
    FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
    IF project_url IS NULL THEN
      SELECT decrypted_secret INTO project_url
      FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
    END IF;
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF project_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := project_url || '/functions/v1/dispatch-mobile-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'priority', coalesce(NEW.priority, 'medium'),
      'data', coalesce(NEW.data, '{}'::jsonb) || jsonb_build_object('notification_id', NEW.id)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Mobile Push-Meldung (%) fehlgeschlagen: %', TG_NAME, SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_mobile_push_on_notification() FROM PUBLIC, anon, authenticated;

-- Einmaliger Nachholversand nach Ende der Ruhezeit. _deliver=false wird nur
-- vom Selbsttest genutzt, damit dort kein echter HTTP-Aufruf entsteht.
CREATE OR REPLACE FUNCTION public.dispatch_deferred_decision_pushes(
  _at timestamptz DEFAULT now(),
  _deliver boolean DEFAULT true
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row RECORD;
  v_type_name text;
  v_tenant uuid;
  v_until timestamptz;
  v_has_web boolean;
  v_has_mobile boolean;
  v_url text;
  v_key text;
  v_created integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('decision_deferred_push_dispatch'));

  -- Gelesene oder verfallene Meldungen brauchen keinen Nachhol-Push.
  UPDATE public.notifications n
  SET push_deferred_until = NULL
  WHERE n.push_deferred_until IS NOT NULL
    AND (n.is_read OR coalesce(n.data->>'expired', 'false') = 'true');

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  IF v_url IS NULL THEN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  END IF;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  FOR v_row IN
    SELECT n.id, n.user_id, n.tenant_id, n.title, n.message, n.priority, n.data,
           t.name AS type_name, t.tenant_id AS type_tenant
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.push_deferred_until IS NOT NULL
      AND n.push_deferred_until <= _at
      AND NOT n.is_read
      AND coalesce(n.data->>'expired', 'false') <> 'true'
      AND t.name LIKE 'task_decision_%'
      AND EXISTS (
        SELECT 1 FROM public.user_tenant_memberships m
        WHERE m.user_id = n.user_id AND m.tenant_id = n.tenant_id AND m.is_active
      )
    ORDER BY n.push_deferred_until, n.created_at
    FOR UPDATE OF n SKIP LOCKED
  LOOP
    v_type_name := v_row.type_name;
    v_tenant := coalesce(v_row.type_tenant, v_row.tenant_id);

    IF NOT EXISTS (
      SELECT 1 FROM public.user_notification_settings s
      WHERE s.user_id = v_row.user_id
        AND s.notification_type_id = (
          SELECT id FROM public.notification_types
          WHERE tenant_id = v_tenant AND name = v_type_name LIMIT 1
        )
        AND s.is_enabled AND s.push_enabled
    ) THEN
      UPDATE public.notifications SET push_deferred_until = NULL WHERE id = v_row.id;
      CONTINUE;
    END IF;

    IF public.decision_quiet_hours_active(v_row.user_id, v_tenant, v_type_name, _at) THEN
      v_until := public.decision_quiet_hours_end_at(v_row.user_id, v_tenant, v_type_name, _at);
      UPDATE public.notifications
      SET push_deferred_until = coalesce(v_until, _at + interval '1 hour')
      WHERE id = v_row.id;
      CONTINUE;
    END IF;

    IF NOT public.decision_push_allowed(v_row.user_id, v_tenant, v_type_name, _at) THEN
      UPDATE public.notifications SET push_deferred_until = NULL WHERE id = v_row.id;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.push_subscriptions ps
      WHERE ps.user_id = v_row.user_id AND ps.is_active
    ) INTO v_has_web;
    SELECT EXISTS (
      SELECT 1 FROM public.mobile_push_tokens mt
      WHERE mt.user_id = v_row.user_id AND mt.is_active
    ) INTO v_has_mobile;

    IF NOT v_has_web AND NOT v_has_mobile THEN
      UPDATE public.notifications SET push_deferred_until = NULL WHERE id = v_row.id;
      CONTINUE;
    END IF;

    IF _deliver AND (v_url IS NULL OR v_key IS NULL) THEN
      RAISE WARNING 'Nachhol-Push nicht versendet: Vault-Konfiguration fehlt';
      CONTINUE;
    END IF;

    -- Vor dem externen Aufruf beanspruchen, damit parallele oder spätere Läufe
    -- dieselbe Meldung nicht erneut senden.
    UPDATE public.notifications
    SET push_deferred_until = NULL
    WHERE id = v_row.id;

    IF _deliver THEN
      IF v_has_web THEN
        PERFORM net.http_post(
          url := v_url || '/functions/v1/send-push-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
          ),
          body := jsonb_build_object(
            'user_id', v_row.user_id,
            'title', v_row.title,
            'message', v_row.message,
            'priority', coalesce(v_row.priority, 'medium'),
            'data', coalesce(v_row.data, '{}'::jsonb),
            'from_trigger', true
          )
        );
      END IF;

      IF v_has_mobile THEN
        PERFORM net.http_post(
          url := v_url || '/functions/v1/dispatch-mobile-push',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
          ),
          body := jsonb_build_object(
            'user_id', v_row.user_id,
            'title', v_row.title,
            'message', v_row.message,
            'priority', coalesce(v_row.priority, 'medium'),
            'data', coalesce(v_row.data, '{}'::jsonb)
              || jsonb_build_object('notification_id', v_row.id)
          )
        );
      END IF;
    END IF;

    UPDATE public.notifications
    SET is_pushed = is_pushed OR _deliver,
        push_sent_at = CASE WHEN _deliver THEN _at ELSE push_sent_at END,
        push_catchup_sent_at = _at
    WHERE id = v_row.id;

    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_deferred_decision_pushes(timestamptz, boolean) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('dispatch-deferred-decision-pushes')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-deferred-decision-pushes');
    PERFORM cron.schedule(
      'dispatch-deferred-decision-pushes',
      '*/5 * * * *',
      $job$SELECT public.dispatch_deferred_decision_pushes();$job$
    );
  END IF;
END $$;
