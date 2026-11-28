-- P1.7: Entscheidungs-Meldungen bündeln statt einzeln zuzustellen.
--
-- * Je Mandant konfigurierbar: Reaktionsfenster (bisher fest 5 Minuten) und
--   Digest-Intervall (Standard 15 Minuten).
-- * Offene Kommentar-, Antwort- und Reaktionsmeldungen je Empfänger und Entscheidung
--   werden nach Ablauf des Intervalls zu einer Digest-Meldung zusammengefasst.
-- * Die ersetzten Einzelmeldungen werden als gelesen und als ersetzt markiert.
-- * Push geht nur noch für den Digest raus, nicht für die gebündelten Einzelmeldungen.

CREATE TABLE IF NOT EXISTS public.tenant_notification_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  decision_reaction_window_minutes integer NOT NULL DEFAULT 5
    CHECK (decision_reaction_window_minutes BETWEEN 0 AND 1440),
  decision_digest_minutes integer NOT NULL DEFAULT 15
    CHECK (decision_digest_minutes BETWEEN 1 AND 1440),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.tenant_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read notification timing" ON public.tenant_notification_settings;
CREATE POLICY "Members read notification timing"
  ON public.tenant_notification_settings FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "Office leads configure notification timing" ON public.tenant_notification_settings;
CREATE POLICY "Office leads configure notification timing"
  ON public.tenant_notification_settings FOR ALL TO authenticated
  USING (public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['bueroleitung']))
  WITH CHECK (public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['bueroleitung']));

GRANT SELECT, INSERT, UPDATE ON public.tenant_notification_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.set_decision_notification_timing(
  _tenant_id uuid,
  _reaction_minutes integer,
  _digest_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Bitte anmelden.' USING ERRCODE = '42501';
  END IF;

  IF _tenant_id IS NULL
     OR NOT public.has_active_tenant_role(auth.uid(), _tenant_id, ARRAY['bueroleitung']) THEN
    RAISE EXCEPTION 'Nur die Büroleitung darf die Meldungszeiten ändern.' USING ERRCODE = '42501';
  END IF;

  IF _reaction_minutes IS NULL OR _reaction_minutes NOT BETWEEN 0 AND 1440
     OR _digest_minutes IS NULL OR _digest_minutes NOT BETWEEN 1 AND 1440 THEN
    RAISE EXCEPTION 'Ungültige Zeitfenster.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tenant_notification_settings AS s
    (tenant_id, decision_reaction_window_minutes, decision_digest_minutes, updated_by, updated_at)
  VALUES (_tenant_id, _reaction_minutes, _digest_minutes, auth.uid(), now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET decision_reaction_window_minutes = excluded.decision_reaction_window_minutes,
        decision_digest_minutes = excluded.decision_digest_minutes,
        updated_by = excluded.updated_by,
        updated_at = now();

  RETURN jsonb_build_object('tenant_id', _tenant_id, 'reaction_minutes', _reaction_minutes, 'digest_minutes', _digest_minutes);
END;
$$;

REVOKE ALL ON FUNCTION public.set_decision_notification_timing(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_decision_notification_timing(uuid, integer, integer) TO authenticated;

-- Digest-Typ für bestehende und neue Büros.
INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id, 'task_decision_digest', 'Zusammengefasste Entscheidungs-Meldungen',
       'Mehrere Kommentare oder Reaktionen zu einer Entscheidung wurden gebündelt.', 'decisions', true
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_decision_digest_notification_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (NEW.id, 'task_decision_digest', 'Zusammengefasste Entscheidungs-Meldungen',
          'Mehrere Kommentare oder Reaktionen zu einer Entscheidung wurden gebündelt.', 'decisions', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_decision_digest_notification_type() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS seed_decision_digest_notification_type ON public.tenants;
CREATE TRIGGER seed_decision_digest_notification_type
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_decision_digest_notification_type();

-- Reaktionsfenster kommt jetzt aus der Mandanteneinstellung (Standard 5 Minuten).
CREATE OR REPLACE FUNCTION public.notify_decision_comment_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant uuid;
  v_title text;
  v_creator uuid;
  v_decision uuid;
  v_comment_author uuid;
  v_actor text;
  v_recipient uuid;
  v_reaction_minutes integer;
BEGIN
  BEGIN
    SELECT c.decision_id, c.user_id
      INTO v_decision, v_comment_author
    FROM public.task_decision_comments c
    WHERE c.id = NEW.comment_id;

    IF v_decision IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT td.tenant_id, td.title, td.created_by
      INTO v_tenant, v_title, v_creator
    FROM public.task_decisions td
    WHERE td.id = v_decision;

    IF v_tenant IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT s.decision_reaction_window_minutes INTO v_reaction_minutes
    FROM public.tenant_notification_settings s
    WHERE s.tenant_id = v_tenant;

    IF v_reaction_minutes IS NULL THEN
      v_reaction_minutes := 5;
    END IF;

    SELECT p.display_name
      INTO v_actor
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id AND p.tenant_id = v_tenant
    LIMIT 1;

    FOR v_recipient IN
      SELECT DISTINCT candidate.user_id
      FROM (
        SELECT v_comment_author AS user_id
        UNION
        SELECT v_creator AS user_id
        UNION
        SELECT p.user_id
        FROM public.task_decision_participants p
        WHERE p.decision_id = v_decision
      ) AS candidate
      WHERE candidate.user_id IS NOT NULL
        AND candidate.user_id <> NEW.user_id
    LOOP
      IF NOT public.is_tenant_member(v_tenant, v_recipient) THEN
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.notifications n
        JOIN public.notification_types t ON t.id = n.notification_type_id
        WHERE n.tenant_id = v_tenant
          AND n.user_id = v_recipient
          AND t.tenant_id = v_tenant
          AND t.name = 'task_decision_comment_reaction_received'
          AND n.data->>'comment_id' = NEW.comment_id::text
          AND n.data->>'emoji' = NEW.emoji
          AND n.created_at > now() - make_interval(mins => v_reaction_minutes)
      ) THEN
        CONTINUE;
      END IF;

      PERFORM public.create_notification(
        v_recipient,
        'task_decision_comment_reaction_received',
        'Neue Reaktion',
        left(
          coalesce(v_actor, 'Ein Teammitglied') || ' hat mit ' || NEW.emoji || ' reagiert.',
          240
        ),
        jsonb_build_object(
          'decision_id', v_decision,
          'decision_title', v_title,
          'comment_id', NEW.comment_id,
          'emoji', NEW.emoji,
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
REVOKE ALL ON FUNCTION public.notify_decision_comment_reaction() FROM PUBLIC, anon, authenticated;

-- Push nur für den Digest: gebündelte Einzelmeldungen lösen keinen Push mehr aus.
CREATE OR REPLACE FUNCTION public.handle_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_settings RECORD;
  v_type_name text;
BEGIN
  SELECT nt.name INTO v_type_name
  FROM public.notification_types nt
  WHERE nt.id = NEW.notification_type_id;

  IF v_type_name IN (
    'task_decision_comment_received',
    'task_decision_comment_reply',
    'task_decision_comment_reaction_received'
  ) THEN
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

-- Offene Einzelmeldungen je Entscheidung und Empfänger bündeln.
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
  -- Zwei gleichzeitige Läufe dürfen dieselben Zeilen nicht doppelt bündeln.
  PERFORM pg_advisory_xact_lock(hashtext('decision_notification_digest_flush'));

  FOR v_group IN
    SELECT n.tenant_id,
           n.user_id,
           n.data->>'decision_id' AS decision_id,
           max(coalesce(n.data->>'decision_title', '')) AS decision_title,
           count(*)::integer AS item_count,
           array_agg(n.id) AS notification_ids,
           CASE WHEN bool_or(n.priority IN ('high', 'urgent')) THEN 'high' ELSE 'medium' END AS digest_priority,
           s.decision_digest_minutes
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    LEFT JOIN public.tenant_notification_settings s ON s.tenant_id = n.tenant_id
    WHERE t.name IN (
        'task_decision_comment_received',
        'task_decision_comment_reply',
        'task_decision_comment_reaction_received'
      )
      AND n.data->>'decision_id' IS NOT NULL
      AND NOT n.is_read
      AND coalesce(n.data->>'superseded', 'false') <> 'true'
      AND n.created_at <= now() - make_interval(mins => coalesce(s.decision_digest_minutes, 15))
    GROUP BY n.tenant_id, n.user_id, n.data->>'decision_id', s.decision_digest_minutes
  LOOP
    v_title := CASE
      WHEN v_group.item_count = 1 THEN 'Neue Meldung zu einer Entscheidung'
      ELSE v_group.item_count || ' neue Meldungen zu einer Entscheidung'
    END;
    v_message := left(
      v_group.item_count || ' neue Kommentare oder Reaktionen zu "'
        || coalesce(nullif(v_group.decision_title, ''), 'Entscheidung') || '".',
      240
    );

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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'flush-decision-notification-digests';
    PERFORM cron.schedule(
      'flush-decision-notification-digests',
      '*/5 * * * *',
      $job$SELECT public.flush_decision_notification_digests();$job$
    );
  END IF;
END $$;
