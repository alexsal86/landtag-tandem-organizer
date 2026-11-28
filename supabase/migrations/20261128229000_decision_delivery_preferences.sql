-- Persönliche Zustellfrequenz und Ruhezeiten für Entscheidungs-Meldungen.
--
-- delivery_mode:
--   immediate – Meldung und Push sofort (Push außerhalb der Ruhezeiten)
--   digest    – Meldung wird gesammelt; Push erst mit dem Digest
--   off       – keine unkritischen Entscheidungs-Meldungen
--
-- Frist- und Rückzugsmeldungen sind kritisch: Sie werden immer erzeugt und immer
-- gepusht, auch während Ruhezeiten oder bei "off". Die typbezogene Abschaltung
-- (user_notification_settings.is_enabled) bleibt davon unberührt.

CREATE TABLE IF NOT EXISTS public.decision_notification_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  delivery_mode text NOT NULL DEFAULT 'immediate'
    CHECK (delivery_mode IN ('immediate', 'digest', 'off')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

ALTER TABLE public.decision_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own decision delivery" ON public.decision_notification_preferences;
CREATE POLICY "Users read own decision delivery"
  ON public.decision_notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "Users write own decision delivery" ON public.decision_notification_preferences;
CREATE POLICY "Users write own decision delivery"
  ON public.decision_notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_tenant_member(tenant_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.decision_notification_preferences TO authenticated;

CREATE OR REPLACE FUNCTION public.set_decision_notification_preference(
  _tenant_id uuid,
  _delivery_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_tenant_member(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diesen Mandanten.' USING ERRCODE = '42501';
  END IF;

  IF _delivery_mode NOT IN ('immediate', 'digest', 'off') THEN
    RAISE EXCEPTION 'Ungültige Zustellfrequenz.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.decision_notification_preferences AS p (user_id, tenant_id, delivery_mode, updated_at)
  VALUES (auth.uid(), _tenant_id, _delivery_mode, now())
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET delivery_mode = excluded.delivery_mode,
        updated_at = now();

  RETURN jsonb_build_object('tenant_id', _tenant_id, 'delivery_mode', _delivery_mode);
END;
$$;

REVOKE ALL ON FUNCTION public.set_decision_notification_preference(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_decision_notification_preference(uuid, text) TO authenticated;

-- Push-Entscheidung zentral, damit Trigger und Tests dieselbe Regel nutzen.
CREATE OR REPLACE FUNCTION public.decision_push_allowed(
  _user_id uuid,
  _tenant_id uuid,
  _type_name text,
  _at timestamptz DEFAULT now()
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

  IF _type_name NOT LIKE 'task_decision_%' THEN
    RETURN true;
  END IF;

  -- Der Digest selbst ist die gebündelte Zustellung und darf nicht an der
  -- Frequenzeinstellung scheitern; Ruhezeiten gelten für ihn weiterhin.
  IF _type_name <> 'task_decision_digest' THEN
    SELECT p.delivery_mode INTO v_mode
    FROM public.decision_notification_preferences p
    WHERE p.user_id = _user_id AND p.tenant_id = _tenant_id;

    IF v_mode IN ('off', 'digest') THEN
      RETURN false;
    END IF;
  END IF;

  SELECT s.quiet_hours_start, s.quiet_hours_end
    INTO v_start, v_end
  FROM public.user_notification_settings s
  JOIN public.notification_types t ON t.id = s.notification_type_id
  WHERE s.user_id = _user_id
    AND t.tenant_id = _tenant_id
    AND t.name = _type_name
  LIMIT 1;

  IF v_start IS NULL OR v_end IS NULL OR v_start = v_end THEN
    RETURN true;
  END IF;

  v_local := (_at AT TIME ZONE 'Europe/Berlin')::time;
  IF v_start < v_end THEN
    RETURN NOT (v_local >= v_start AND v_local < v_end);
  END IF;
  RETURN NOT (v_local >= v_start OR v_local < v_end);
END;
$$;

REVOKE ALL ON FUNCTION public.decision_push_allowed(uuid, uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_push_allowed(uuid, uuid, text, timestamptz) TO authenticated;

-- "off" verhindert das Anlegen unkritischer Entscheidungs-Meldungen. "digest" legt
-- sie weiter an, damit der Flush sie bündeln kann.
CREATE OR REPLACE FUNCTION public.create_notification(
  user_id_param uuid,
  type_name text,
  title_param text,
  message_param text,
  data_param jsonb,
  priority_param text,
  tenant_id_param uuid
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
    SELECT 1
    FROM public.user_tenant_memberships
    WHERE tenant_id = tenant_id_param AND user_id = user_id_param AND is_active
  ) THEN
    RETURN NULL;
  END IF;

  IF type_name LIKE 'task_decision_%'
     AND type_name NOT IN ('task_decision_deadline_changed', 'task_decision_withdrawn', 'task_decision_trigger_alert') THEN
    SELECT p.delivery_mode INTO v_mode
    FROM public.decision_notification_preferences p
    WHERE p.user_id = user_id_param AND p.tenant_id = tenant_id_param;

    IF v_mode = 'off' THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT id INTO notification_type
  FROM public.notification_types
  WHERE tenant_id = tenant_id_param AND name = type_name AND is_active;

  IF notification_type IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO notification_id
  FROM public.notifications
  WHERE tenant_id = tenant_id_param
    AND user_id = user_id_param
    AND notification_type_id = notification_type
    AND data = data_param
    AND created_at > now() - interval '1 minute';

  IF FOUND THEN
    RETURN notification_id;
  END IF;

  INSERT INTO public.user_notification_settings (user_id, notification_type_id, is_enabled, push_enabled)
  VALUES (user_id_param, notification_type, true, true)
  ON CONFLICT (user_id, notification_type_id) DO NOTHING;

  IF EXISTS (
    SELECT 1
    FROM public.user_notification_settings
    WHERE user_id = user_id_param AND notification_type_id = notification_type AND is_enabled
  ) THEN
    INSERT INTO public.notifications (tenant_id, user_id, notification_type_id, title, message, data, priority)
    VALUES (tenant_id_param, user_id_param, notification_type, title_param, message_param, data_param, priority_param)
    RETURNING id INTO notification_id;
  END IF;

  RETURN notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, jsonb, text, uuid)
FROM PUBLIC, anon, authenticated;

-- Push: nur wenn Frequenz und Ruhezeit es erlauben.
CREATE OR REPLACE FUNCTION public.handle_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_settings RECORD;
  v_type_name text;
  v_tenant uuid;
BEGIN
  SELECT nt.name, nt.tenant_id INTO v_type_name, v_tenant
  FROM public.notification_types nt
  WHERE nt.id = NEW.notification_type_id;

  IF NOT public.decision_push_allowed(NEW.user_id, coalesce(v_tenant, NEW.tenant_id), v_type_name, now()) THEN
    RETURN NEW;
  END IF;

  SELECT uns.push_enabled, uns.is_enabled
  INTO user_settings
  FROM public.user_notification_settings uns
  WHERE uns.user_id = NEW.user_id
    AND uns.notification_type_id = NEW.notification_type_id;

  IF user_settings.push_enabled = true AND user_settings.is_enabled = true THEN
    PERFORM net.http_post(
      url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.jwt.claims', true)::json->>'sub'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'message', NEW.message,
        'priority', NEW.priority,
        'data', NEW.data
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Digest nur für Personen mit "gebündelt"; Anfragen werden dann mitgebündelt.
CREATE OR REPLACE FUNCTION public.flush_decision_notification_digests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_group RECORD;
  v_digest uuid;
  v_created integer := 0;
  v_title text;
  v_message text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('decision_notification_digest_flush'));

  FOR v_group IN
    SELECT n.tenant_id,
           n.user_id,
           n.data->>'decision_id' AS decision_id,
           max(coalesce(n.data->>'decision_title', '')) AS decision_title,
           count(*)::integer AS item_count,
           count(*) FILTER (WHERE t.name = 'task_decision_completed')::integer AS result_count,
           count(*) FILTER (WHERE t.name <> 'task_decision_completed')::integer AS other_count,
           array_agg(n.id) AS notification_ids,
           CASE WHEN bool_or(n.priority IN ('high', 'urgent')) THEN 'high' ELSE 'medium' END AS digest_priority,
           s.decision_digest_minutes
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    LEFT JOIN public.task_decisions td ON td.id::text = n.data->>'decision_id'
    LEFT JOIN public.tenant_notification_settings s ON s.tenant_id = n.tenant_id
    WHERE t.name IN (
        'task_decision_request',
        'task_decision_comment_received',
        'task_decision_comment_reply',
        'task_decision_comment_reaction_received',
        'task_decision_completed'
      )
      AND n.data->>'decision_id' IS NOT NULL
      AND NOT n.is_read
      AND coalesce(n.data->>'superseded', 'false') <> 'true'
      AND EXISTS (
        SELECT 1 FROM public.decision_notification_preferences p
        WHERE p.user_id = n.user_id
          AND p.tenant_id = n.tenant_id
          AND p.delivery_mode = 'digest'
      )
      AND (t.name <> 'task_decision_completed' OR td.created_by IS DISTINCT FROM n.user_id)
      AND n.created_at <= now() - make_interval(mins => coalesce(s.decision_digest_minutes, 15))
    GROUP BY n.tenant_id, n.user_id, n.data->>'decision_id', s.decision_digest_minutes
  LOOP
    v_title := CASE
      WHEN v_group.result_count > 0 AND v_group.other_count > 0
        THEN 'Ergebnis und ' || v_group.other_count || ' neue Meldungen zu einer Entscheidung'
      WHEN v_group.result_count > 0
        THEN 'Ergebnis zu einer Entscheidung verfügbar'
      WHEN v_group.item_count = 1
        THEN 'Neue Meldung zu einer Entscheidung'
      ELSE v_group.item_count || ' neue Meldungen zu einer Entscheidung'
    END;

    v_message := CASE
      WHEN v_group.result_count > 0 AND v_group.other_count > 0
        THEN left('Das Ergebnis ist verfügbar; dazu ' || v_group.other_count
          || ' neue Kommentare oder Reaktionen zu "'
          || coalesce(nullif(v_group.decision_title, ''), 'Entscheidung') || '".', 240)
      WHEN v_group.result_count > 0
        THEN left('Alle Antworten für "' || coalesce(nullif(v_group.decision_title, ''), 'Entscheidung')
          || '" sind eingegangen.', 240)
      ELSE left(v_group.item_count || ' neue Meldungen zu "'
        || coalesce(nullif(v_group.decision_title, ''), 'Entscheidung') || '".', 240)
    END;

    v_digest := public.create_notification(
      v_group.user_id,
      'task_decision_digest',
      v_title,
      v_message,
      jsonb_build_object(
        'decision_id', v_group.decision_id,
        'decision_title', v_group.decision_title,
        'tenant_id', v_group.tenant_id,
        'digest', true,
        'count', v_group.item_count,
        'result_count', v_group.result_count,
        'has_result', v_group.result_count > 0,
        'notification_ids', to_jsonb(v_group.notification_ids)
      ),
      v_group.digest_priority,
      v_group.tenant_id
    );

    UPDATE public.notifications
    SET is_read = true,
        read_at = now(),
        data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
          'superseded', true,
          'digest_id', v_digest
        )
    WHERE id = ANY(v_group.notification_ids);

    IF v_digest IS NOT NULL THEN
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.flush_decision_notification_digests() FROM PUBLIC, anon, authenticated;
