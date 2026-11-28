-- Entscheidungs-Meldungen per E-Mail (Resend).
--
-- Die E-Mail-Schalter in den Benachrichtigungseinstellungen waren bisher ohne
-- Wirkung: E-Mail gab es nur für Einladungen. Jetzt stellt jeder Insert einer
-- Entscheidungs-Meldung, für den die Person E-Mail aktiviert hat, genau eine Zeile
-- in eine Outbox. Ein Cron-Worker übernimmt fällige Zeilen atomar, rendert die
-- Meldung und versendet sie über Resend.
--
-- Regeln:
--   1. Nur Typen `task_decision_%`, und nur wenn `email_enabled` und `is_enabled`
--      der Person für diesen Typ gelten (Standard: aus, also Opt-in).
--   2. Ruhezeiten verschieben den Versand (defer_until), statt die Mail zu verlieren.
--   3. Die Zustellfrequenz bleibt wirksam: bei `off`/`gebündelt` entfallen die
--      gebündelten Typen; im Digest-Modus übernimmt die Digest-Meldung die Mail.
--      Das Ergebnis des Erstellers geht weiterhin sofort.
--   4. Fehler beim Einstellen dürfen die Meldung nicht kippen.

CREATE TABLE IF NOT EXISTS public.decision_notification_email_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL UNIQUE REFERENCES public.notifications(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES public.task_decisions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'skipped', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  defer_until timestamptz,
  last_error text,
  claimed_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_notification_email_pending
  ON public.decision_notification_email_dispatches (created_at)
  WHERE status = 'pending';

ALTER TABLE public.decision_notification_email_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.decision_notification_email_dispatches FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_decision_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_type text;
  v_email_enabled boolean;
  v_is_enabled boolean;
  v_mode text;
  v_decision uuid;
  v_creator_result boolean := false;
  v_defer timestamptz;
BEGIN
  SELECT nt.name INTO v_type
  FROM public.notification_types nt
  WHERE nt.id = NEW.notification_type_id;

  IF v_type IS NULL OR v_type NOT LIKE 'task_decision_%' THEN
    RETURN NEW;
  END IF;

  SELECT s.email_enabled, s.is_enabled
    INTO v_email_enabled, v_is_enabled
  FROM public.user_notification_settings s
  WHERE s.user_id = NEW.user_id
    AND s.notification_type_id = NEW.notification_type_id
  LIMIT 1;

  IF coalesce(v_email_enabled, false) = false OR coalesce(v_is_enabled, false) = false THEN
    RETURN NEW;
  END IF;

  -- Gebündelte Typen folgen der Zustellfrequenz; Sofort-Typen (Frist, Rückzug,
  -- Erwähnung, Digest, Tagesüberblick) gehen unabhängig davon per E-Mail.
  IF v_type NOT IN (
       'task_decision_deadline_changed',
       'task_decision_withdrawn',
       'task_decision_trigger_alert',
       'task_decision_mention',
       'task_decision_deadline_reminder',
       'task_decision_daily_digest',
       'task_decision_digest'
     ) THEN
    IF v_type = 'task_decision_completed' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.task_decisions d
        WHERE d.id::text = NEW.data->>'decision_id'
          AND d.created_by = NEW.user_id
      ) INTO v_creator_result;
    END IF;

    SELECT p.delivery_mode INTO v_mode
    FROM public.decision_notification_preferences p
    WHERE p.user_id = NEW.user_id AND p.tenant_id = NEW.tenant_id;

    IF coalesce(v_mode, 'immediate') IN ('off', 'digest') AND NOT v_creator_result THEN
      RETURN NEW;
    END IF;
  END IF;

  BEGIN
    v_decision := nullif(NEW.data->>'decision_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_decision := NULL;
  END;

  v_defer := public.decision_quiet_hours_end_at(NEW.user_id, NEW.tenant_id, v_type, now());

  INSERT INTO public.decision_notification_email_dispatches
    (notification_id, decision_id, tenant_id, user_id, defer_until)
  VALUES (NEW.id, v_decision, NEW.tenant_id, NEW.user_id, v_defer)
  ON CONFLICT (notification_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'E-Mail-Versand für Meldung % konnte nicht eingestellt werden: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_decision_notification_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS decision_notification_email_trigger ON public.notifications;
CREATE TRIGGER decision_notification_email_trigger
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_decision_notification_email();

CREATE OR REPLACE FUNCTION public.claim_decision_notification_email_dispatches(_limit integer DEFAULT 100)
RETURNS TABLE (
  dispatch_id uuid,
  notification_id uuid,
  notification_type_id uuid,
  tenant_id uuid,
  user_id uuid,
  type_name text,
  title text,
  message text,
  priority text,
  decision_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT d.id
    FROM public.decision_notification_email_dispatches d
    WHERE d.status = 'pending'
      AND d.attempts < 3
      AND (d.defer_until IS NULL OR d.defer_until <= now())
      AND d.created_at > now() - interval '7 days'
    ORDER BY d.created_at
    LIMIT greatest(_limit, 1)
    FOR UPDATE OF d SKIP LOCKED
  ), claimed AS (
    UPDATE public.decision_notification_email_dispatches d
    SET status = 'processing', attempts = d.attempts + 1, claimed_at = now()
    FROM candidate c
    WHERE d.id = c.id
    RETURNING d.*
  )
  SELECT c.id, c.notification_id, n.notification_type_id, c.tenant_id, c.user_id,
         nt.name, n.title, n.message, n.priority, c.decision_id
  FROM claimed c
  JOIN public.notifications n ON n.id = c.notification_id
  JOIN public.notification_types nt ON nt.id = n.notification_type_id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_decision_notification_email_dispatches(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_decision_notification_email_dispatches(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_decision_notification_email_dispatch(
  _dispatch_id uuid,
  _outcome text,
  _error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF _outcome NOT IN ('sent', 'skipped', 'retry') THEN
    RAISE EXCEPTION 'Ungültiges Ergebnis: %', _outcome USING ERRCODE = '22023';
  END IF;

  UPDATE public.decision_notification_email_dispatches d
  SET status = CASE
        WHEN _outcome = 'sent' THEN 'sent'
        WHEN _outcome = 'skipped' THEN 'skipped'
        WHEN d.attempts >= 3 THEN 'failed'
        ELSE 'pending'
      END,
      last_error = left(_error, 500),
      processed_at = CASE
        WHEN _outcome = 'retry' AND d.attempts < 3 THEN NULL
        ELSE now()
      END
  WHERE d.id = _dispatch_id;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_decision_notification_email_dispatch(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_decision_notification_email_dispatch(uuid, text, text) TO service_role;

-- Cron alle 5 Minuten: Worker übernimmt und versendet.
DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_cron/pg_net fehlen – Entscheidungs-Meldungen gehen nicht automatisch per E-Mail raus';
    RETURN;
  END IF;

  v_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1);
  v_key := coalesce(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
  );

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'supabase_url/service_role_key fehlen im Vault – Cron dispatch-decision-notification-emails wird nicht eingerichtet';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-decision-notification-emails') THEN
    PERFORM cron.unschedule('dispatch-decision-notification-emails');
  END IF;

  PERFORM cron.schedule(
    'dispatch-decision-notification-emails',
    '*/5 * * * *',
    format(
      $job$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || %L), body := '{}'::jsonb);$job$,
      rtrim(v_url, '/') || '/functions/v1/dispatch-decision-notification-emails',
      v_key
    )
  );
END $$;
