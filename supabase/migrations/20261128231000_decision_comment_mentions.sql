-- Direkte @-Erwähnungen in Entscheidungskommentaren.
--
-- Erkannt wird "@Anzeigename" als eigenes Wort (Groß-/Kleinschreibung egal). Die
-- Erwähnung erzeugt einen eigenen Typ, wird nie gebündelt und erreicht die Person auch
-- bei delivery_mode "off" oder "digest". Ruhezeiten gelten weiterhin; kritische
-- Frist-/Rückzugsmeldungen bleiben davon unabhängig.

CREATE OR REPLACE FUNCTION public.decision_comment_mentions(_content text, _tenant_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_profile RECORD;
  v_pattern text;
  v_lower text := lower(coalesce(_content, ''));
  v_from integer;
  v_idx integer;
  v_before text;
  v_after text;
BEGIN
  FOR v_profile IN
    SELECT p.user_id, p.display_name
    FROM public.profiles p
    WHERE p.tenant_id = _tenant_id AND nullif(btrim(p.display_name), '') IS NOT NULL
  LOOP
    v_pattern := '@' || lower(btrim(v_profile.display_name));
    v_from := 1;
    LOOP
      v_idx := strpos(substr(v_lower, v_from), v_pattern);
      EXIT WHEN v_idx = 0;
      v_idx := v_idx + v_from - 1;
      v_before := CASE WHEN v_idx > 1 THEN substr(v_lower, v_idx - 1, 1) ELSE ' ' END;
      v_after := substr(v_lower, v_idx + length(v_pattern), 1);
      IF v_before !~ '[[:alnum:]_äöüß]'
         AND (v_after = '' OR v_after !~ '[[:alnum:]_äöüß]') THEN
        user_id := v_profile.user_id;
        RETURN NEXT;
        EXIT;
      END IF;
      v_from := v_idx + 1;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.decision_comment_mentions(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_comment_mentions(text, uuid) TO authenticated;

INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id, 'task_decision_mention', 'Direkte Erwähnung', 'Du wurdest in einem Entscheidungskommentar direkt erwähnt.', 'decisions', true
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_decision_mention_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (NEW.id, 'task_decision_mention', 'Direkte Erwähnung', 'Du wurdest in einem Entscheidungskommentar direkt erwähnt.', 'decisions', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.seed_decision_mention_type() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS seed_decision_mention_type ON public.tenants;
CREATE TRIGGER seed_decision_mention_type
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_decision_mention_type();

-- Erwähnungen umgehen "off"/"digest" beim Anlegen, nicht aber die Typ-Abschaltung.
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
                           'task_decision_trigger_alert', 'task_decision_mention') THEN
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
  IF _type_name NOT LIKE 'task_decision_%' THEN
    RETURN true;
  END IF;

  -- Digest und direkte Erwähnung sind von der Frequenz ausgenommen; Ruhezeiten gelten.
  IF _type_name NOT IN ('task_decision_digest', 'task_decision_mention') THEN
    SELECT p.delivery_mode INTO v_mode
    FROM public.decision_notification_preferences p
    WHERE p.user_id = _user_id AND p.tenant_id = _tenant_id;
    IF v_mode IN ('off', 'digest') THEN
      RETURN false;
    END IF;
  END IF;

  SELECT s.quiet_hours_start, s.quiet_hours_end INTO v_start, v_end
  FROM public.user_notification_settings s
  JOIN public.notification_types t ON t.id = s.notification_type_id
  WHERE s.user_id = _user_id AND t.tenant_id = _tenant_id AND t.name = _type_name
  LIMIT 1;

  IF v_start IS NULL OR v_end IS NULL OR v_start = v_end THEN RETURN true; END IF;
  v_local := (_at AT TIME ZONE 'Europe/Berlin')::time;
  IF v_start < v_end THEN
    RETURN NOT (v_local >= v_start AND v_local < v_end);
  END IF;
  RETURN NOT (v_local >= v_start OR v_local < v_end);
END;
$$;
REVOKE ALL ON FUNCTION public.decision_push_allowed(uuid, uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_push_allowed(uuid, uuid, text, timestamptz) TO authenticated;

-- Kommentar-Trigger: Erwähnungen zuerst, dann Antwort auf Elternkommentar, dann
-- allgemeine Kommentarmeldung ohne die bereits erwähnten Personen.
CREATE OR REPLACE FUNCTION public.notify_decision_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant uuid;
  v_title text;
  v_creator uuid;
  v_parent_author uuid;
  v_actor text;
  v_recipient uuid;
  v_mentioned uuid[] := ARRAY[]::uuid[];
BEGIN
  BEGIN
    SELECT td.tenant_id, td.title, td.created_by
      INTO v_tenant, v_title, v_creator
    FROM public.task_decisions td
    WHERE td.id = NEW.decision_id;
    IF v_tenant IS NULL THEN RETURN NEW; END IF;

    SELECT p.display_name INTO v_actor
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id AND p.tenant_id = v_tenant
    LIMIT 1;

    SELECT coalesce(array_agg(m.user_id), ARRAY[]::uuid[]) INTO v_mentioned
    FROM public.decision_comment_mentions(NEW.content, v_tenant) m
    WHERE m.user_id <> NEW.user_id
      AND public.is_tenant_member(v_tenant, m.user_id);

    FOREACH v_recipient IN ARRAY v_mentioned LOOP
      PERFORM public.create_notification(
        v_recipient,
        'task_decision_mention',
        'Du wurdest erwähnt',
        left(coalesce(v_actor, 'Ein Teammitglied')
          || ' hat dich in einem Kommentar zu "' || coalesce(v_title, '') || '" erwähnt.', 240),
        jsonb_build_object(
          'decision_id', NEW.decision_id,
          'decision_title', v_title,
          'comment_id', NEW.id,
          'mention', true,
          'tenant_id', v_tenant
        ),
        'high',
        v_tenant
      );
    END LOOP;

    IF NEW.parent_id IS NOT NULL THEN
      SELECT c.user_id INTO v_parent_author
      FROM public.task_decision_comments c
      WHERE c.id = NEW.parent_id;

      IF v_parent_author IS NOT NULL
         AND v_parent_author <> NEW.user_id
         AND NOT (v_parent_author = ANY(v_mentioned))
         AND public.is_tenant_member(v_tenant, v_parent_author) THEN
        PERFORM public.create_notification(
          v_parent_author,
          'task_decision_comment_reply',
          'Antwort auf deinen Kommentar',
          left(coalesce(v_actor, 'Ein Teammitglied')
            || ' hat auf deinen Kommentar zu "' || coalesce(v_title, '') || '" geantwortet.', 240),
          jsonb_build_object(
            'decision_id', NEW.decision_id,
            'decision_title', v_title,
            'comment_id', NEW.id,
            'parent_comment_id', NEW.parent_id,
            'tenant_id', v_tenant
          ),
          'medium',
          v_tenant
        );
      END IF;
    END IF;

    FOR v_recipient IN
      SELECT DISTINCT candidate.user_id
      FROM (
        SELECT v_creator AS user_id
        UNION
        SELECT p.user_id FROM public.task_decision_participants p
        WHERE p.decision_id = NEW.decision_id
      ) AS candidate
      WHERE candidate.user_id IS NOT NULL
        AND candidate.user_id <> NEW.user_id
        AND candidate.user_id <> coalesce(v_parent_author, NEW.user_id)
        AND NOT (candidate.user_id = ANY(v_mentioned))
    LOOP
      IF NOT public.is_tenant_member(v_tenant, v_recipient) THEN CONTINUE; END IF;

      PERFORM public.create_notification(
        v_recipient,
        'task_decision_comment_received',
        'Neuer Kommentar',
        left(coalesce(v_actor, 'Ein Teammitglied')
          || ' hat einen Kommentar zu "' || coalesce(v_title, '') || '" hinterlassen.', 240),
        jsonb_build_object(
          'decision_id', NEW.decision_id,
          'decision_title', v_title,
          'comment_id', NEW.id,
          'tenant_id', v_tenant
        ),
        'low',
        v_tenant
      );
    END LOOP;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Entscheidungs-Meldung (%) fehlgeschlagen: %', TG_NAME, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_decision_comment() FROM PUBLIC, anon, authenticated;
