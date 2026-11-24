-- Redaktion: Eine erteilte Freigabe muss bei der Redaktion ankommen.
--
-- approval_state = 'approved' protokolliert log_social_content_approval_event als Ereignis
-- 'approved' (20261124200000). Für den Rücksprung hängt 20261124280000 Meldung und Aufgabe an
-- dieses Protokoll; für die Freigabe selbst existierte nur der Benachrichtigungstyp
-- (seed: supabase/functions/_shared/tenant-seed.ts), aber kein Erzeuger. Der Deep-Link
-- /mywork?tab=redaktion&highlight=<Beitrag> lief damit ins Leere.
--
-- Diese Migration meldet jede Freigabe genau einmal, direkt am Protokolleintrag: der Eintrag
-- entsteht nur bei einem echten Zustandswechsel, egal ob über die Beitragsfelder oder über eine
-- Kanalvariante freigegeben wurde. Empfänger ist die verantwortliche Person, sonst die Person,
-- die den Beitrag angelegt hat; wer selbst freigegeben hat, bekommt keine Meldung. Fehlt ein
-- Empfänger, bleibt es still: eine Freigabe ist keine Aufgabe für die ganze Leitung.
--
-- Die Meldung trägt content_item_id und die Ereignis-ID. Letztere macht sie eindeutig, sonst
-- würde create_notification einen zweiten Vorgang innerhalb einer Minute als Dublette verwerfen.

-- 1) Benachrichtigungstyp für bestehende Mandanten (create_notification ohne Typ => NULL).
INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id,
       'social_post_approved',
       'Social Post – Freigegeben',
       'Ein Redaktionsbeitrag wurde freigegeben und kann veröffentlicht werden.',
       'editorial',
       true
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Neue Mandanten erhalten den Typ sofort, damit die Meldung nicht stillschweigend entfällt.
CREATE OR REPLACE FUNCTION public.seed_social_post_approved_notification_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (NEW.id,
          'social_post_approved',
          'Social Post – Freigegeben',
          'Ein Redaktionsbeitrag wurde freigegeben und kann veröffentlicht werden.',
          'editorial',
          true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_social_post_approved_notification_type ON public.tenants;
CREATE TRIGGER seed_social_post_approved_notification_type
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_social_post_approved_notification_type();

REVOKE ALL ON FUNCTION public.seed_social_post_approved_notification_type() FROM PUBLIC, anon, authenticated;

-- 2) Meldung zur Freigabe.
--    SECURITY DEFINER, weil die Meldung als Folge einer normalen Beitragsänderung entsteht und
--    die Redaktion selbst keine Benachrichtigungen für andere verschicken darf.
CREATE OR REPLACE FUNCTION public.notify_social_post_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item public.social_content_items;
  v_topic text;
  v_recipient uuid;
  v_message text;
BEGIN
  IF NEW.action IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_item FROM public.social_content_items WHERE id = NEW.content_item_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_topic := (SELECT tr.topic FROM public.topic_backlog tr WHERE tr.id = v_item.topic_backlog_id);

  -- responsible_user_id trägt laut Board-Auswahl die Login-ID, laut Fremdschlüssel die Profil-ID.
  -- Beide Auslegungen werden aufgelöst; danach gilt die anlegende Person.
  v_recipient := coalesce(
    (SELECT p.user_id FROM public.profiles p WHERE p.id = v_item.responsible_user_id),
    (SELECT p.user_id FROM public.profiles p WHERE p.user_id = v_item.responsible_user_id),
    (SELECT p.user_id FROM public.profiles p WHERE p.id = v_item.created_by)
  );

  -- Ausgeschiedene Empfänger bekommen keine Meldung, und wer selbst freigegeben hat, auch nicht.
  IF v_recipient IS NOT NULL
     AND NOT public.is_tenant_member(v_item.tenant_id, v_recipient) THEN
    v_recipient := NULL;
  END IF;
  IF v_recipient IS NULL OR v_recipient = NEW.actor_user_id THEN
    RETURN NEW;
  END IF;

  v_message := coalesce(NEW.actor_name, 'Die Leitung') || ' hat den Beitrag freigegeben.';
  IF v_item.scheduled_for IS NOT NULL THEN
    v_message := v_message || ' Veröffentlichung: '
      || to_char(v_item.scheduled_for AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY, HH24:MI') || ' Uhr.';
  END IF;

  PERFORM public.create_notification(
    v_recipient,
    'social_post_approved',
    left('Freigegeben: ' || coalesce(v_topic, 'Social Post'), 120),
    left(v_message, 240),
    jsonb_build_object(
      'content_item_id', v_item.id,
      'event_id', NEW.id,
      'route', '/redaktion?highlight=' || v_item.id::text
    ),
    'medium',
    v_item.tenant_id
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_social_post_approved() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_social_post_approved_notification ON public.social_content_approval_events;
CREATE TRIGGER trg_social_post_approved_notification
  AFTER INSERT ON public.social_content_approval_events
  FOR EACH ROW
  WHEN (NEW.action = 'approved')
  EXECUTE FUNCTION public.notify_social_post_approved();
