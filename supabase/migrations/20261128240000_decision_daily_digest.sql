-- Freiwilliger Tagesüberblick über mehrere offene Entscheidungen.
-- Opt-in über decision_notification_preferences.daily_digest_enabled. Der lokale
-- 15-Minuten-Digest bleibt davon unabhängig und unverändert.

ALTER TABLE public.decision_notification_preferences
  ADD COLUMN IF NOT EXISTS daily_digest_enabled boolean NOT NULL DEFAULT false;

INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id, 'task_decision_daily_digest', 'Tagesüberblick Entscheidungen',
  'Fasst morgens alle offenen Entscheidungen zusammen, die auf eine Antwort warten.',
  'decisions', true
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_decision_daily_digest_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (NEW.id, 'task_decision_daily_digest', 'Tagesüberblick Entscheidungen',
    'Fasst morgens alle offenen Entscheidungen zusammen, die auf eine Antwort warten.',
    'decisions', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.seed_decision_daily_digest_type() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS seed_decision_daily_digest_type ON public.tenants;
CREATE TRIGGER seed_decision_daily_digest_type
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_decision_daily_digest_type();

CREATE TABLE IF NOT EXISTS public.decision_daily_digest_deliveries (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  digest_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  decision_count integer NOT NULL,
  PRIMARY KEY (user_id, tenant_id, digest_date)
);
ALTER TABLE public.decision_daily_digest_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.decision_daily_digest_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.decision_daily_digest_deliveries TO authenticated;
DROP POLICY IF EXISTS "Users read own daily digest deliveries" ON public.decision_daily_digest_deliveries;
CREATE POLICY "Users read own daily digest deliveries"
  ON public.decision_daily_digest_deliveries FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_tenant_member(tenant_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.set_decision_daily_digest(_tenant_id uuid, _enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_tenant_member(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diesen Mandanten.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.decision_notification_preferences
    (user_id, tenant_id, delivery_mode, daily_digest_enabled, updated_at)
  VALUES (auth.uid(), _tenant_id, 'immediate', coalesce(_enabled, false), now())
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET daily_digest_enabled = coalesce(_enabled, false),
        updated_at = now();

  RETURN jsonb_build_object('tenant_id', _tenant_id, 'daily_digest_enabled', coalesce(_enabled, false));
END;
$$;
REVOKE ALL ON FUNCTION public.set_decision_daily_digest(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_decision_daily_digest(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_decision_daily_digests(_at timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_local timestamp := _at AT TIME ZONE 'Europe/Berlin';
  v_date date := (v_local)::date;
  v_hour integer := extract(hour FROM v_local)::integer;
  v_user RECORD;
  v_count integer;
  v_ids jsonb;
  v_delivery_id uuid;
  v_notification uuid;
  v_created integer := 0;
BEGIN
  -- Morgendliches Fenster; bei Ruhezeiten wird es in der nächsten Stunde erneut
  -- versucht, solange das Fenster offen ist.
  IF v_hour < 6 OR v_hour >= 12 THEN RETURN 0; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('decision_daily_digest_dispatch'));

  FOR v_user IN
    SELECT p.user_id, p.tenant_id
    FROM public.decision_notification_preferences p
    JOIN public.user_tenant_memberships m
      ON m.user_id = p.user_id AND m.tenant_id = p.tenant_id AND m.is_active
    WHERE p.daily_digest_enabled
      AND NOT EXISTS (
        SELECT 1 FROM public.decision_daily_digest_deliveries d
        WHERE d.user_id = p.user_id AND d.tenant_id = p.tenant_id AND d.digest_date = v_date
      )
  LOOP
    IF public.decision_quiet_hours_active(
      v_user.user_id, v_user.tenant_id, 'task_decision_daily_digest', _at
    ) THEN
      CONTINUE;
    END IF;

    SELECT count(*), jsonb_agg(d.id ORDER BY d.response_deadline NULLS LAST, d.created_at)
      INTO v_count, v_ids
    FROM public.task_decisions d
    JOIN public.task_decision_participants p ON p.decision_id = d.id
    WHERE d.tenant_id = v_user.tenant_id
      AND d.status IN ('active', 'open')
      AND p.user_id = v_user.user_id
      AND p.user_id <> d.created_by
      AND NOT EXISTS (
        SELECT 1 FROM public.task_decision_responses r
        WHERE r.participant_id = p.id
          AND r.decision_id = d.id
          AND r.parent_response_id IS NULL
      );

    IF v_count = 0 THEN CONTINUE; END IF;

    INSERT INTO public.decision_daily_digest_deliveries
      (user_id, tenant_id, digest_date, sent_at, decision_count)
    VALUES (v_user.user_id, v_user.tenant_id, v_date, _at, v_count)
    ON CONFLICT (user_id, tenant_id, digest_date) DO NOTHING
    RETURNING user_id INTO v_delivery_id;
    IF v_delivery_id IS NULL THEN CONTINUE; END IF;

    v_notification := public.create_notification(
      v_user.user_id,
      'task_decision_daily_digest',
      CASE WHEN v_count = 1 THEN '1 Entscheidung braucht dich'
           ELSE v_count || ' Entscheidungen brauchen dich' END,
      left(CASE WHEN v_count = 1 THEN 'Eine offene Entscheidung wartet auf deine Antwort.'
           ELSE v_count || ' offene Entscheidungen warten auf deine Antwort.' END, 240),
      jsonb_build_object(
        'daily_digest', true,
        'decision_count', v_count,
        'decision_ids', v_ids,
        'tenant_id', v_user.tenant_id
      ),
      'medium',
      v_user.tenant_id
    );

    IF v_notification IS NULL THEN
      DELETE FROM public.decision_daily_digest_deliveries
      WHERE user_id = v_user.user_id AND tenant_id = v_user.tenant_id AND digest_date = v_date;
      CONTINUE;
    END IF;

    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_decision_daily_digests(timestamptz) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('dispatch-decision-daily-digests')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-decision-daily-digests');
    PERFORM cron.schedule(
      'dispatch-decision-daily-digests',
      '10 * * * *',
      $job$SELECT public.dispatch_decision_daily_digests();$job$
    );
  END IF;
END $$;

-- Der Tagesüberblick ist ein eigenes Opt-in und darf nicht am lokalen Modus
-- scheitern; Ruhezeiten gelten weiterhin.
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
  ) THEN RETURN NULL; END IF;

  IF type_name LIKE 'task_decision_%'
     AND type_name NOT IN ('task_decision_deadline_changed', 'task_decision_withdrawn',
                           'task_decision_trigger_alert', 'task_decision_mention',
                           'task_decision_deadline_reminder', 'task_decision_daily_digest') THEN
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
    AND notification_type_id = notification_type AND data = data_param
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
BEGIN
  IF _type_name IN ('task_decision_deadline_changed', 'task_decision_withdrawn', 'task_decision_trigger_alert') THEN
    RETURN true;
  END IF;
  IF _type_name NOT LIKE 'task_decision_%' THEN RETURN true; END IF;

  IF _type_name NOT IN ('task_decision_digest', 'task_decision_mention',
                        'task_decision_deadline_reminder', 'task_decision_daily_digest') THEN
    SELECT p.delivery_mode INTO v_mode
    FROM public.decision_notification_preferences p
    WHERE p.user_id = _user_id AND p.tenant_id = _tenant_id;
    IF v_mode IN ('off', 'digest') THEN RETURN false; END IF;
  END IF;

  RETURN NOT public.decision_quiet_hours_active(_user_id, _tenant_id, _type_name, _at);
END;
$$;
REVOKE ALL ON FUNCTION public.decision_push_allowed(uuid, uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_push_allowed(uuid, uuid, text, timestamptz) TO authenticated;
