-- Neunummeriert (vorher 20261124260000): diese Version war durch parallel
-- entstandene Migrationen mehrfach belegt (contact_merge_rpc,
-- freeze_approved_social_content, time_entry_arbzg_pause_repair). Supabase führt
-- schema_migrations nur über die Version – gleichnamige Dateien werden als
-- bereits angewendet übersprungen oder brechen mit 23505 ab. Das Skript ist
-- wiederholbar (IF NOT EXISTS, ON CONFLICT DO NOTHING, DROP TRIGGER IF EXISTS,
-- cron.unschedule vor dem Neuanlegen), damit ein erneuter Lauf nichts doppelt
-- anlegt.
--
-- Termin-Erinnerungen: reminder_minutes wird endlich ausgewertet.
--
-- Bisher wurde reminder_minutes nur gespeichert und im Dialog angeboten; kein
-- Verteiler hat es gelesen. Der einzige appointment_reminder-Trigger feuert bei
-- INSERT ("Neuer Termin erstellt"). Diese Migration ergänzt:
--
--   1. appointment_reminder_dispatches: je Termin und Vorlaufzeit höchstens eine
--      Erinnerung (Unique-Index) – parallele oder wiederholte Läufe erzeugen
--      keinen Doppelversand.
--   2. Benachrichtigungstyp appointment_reminder für alle Mandanten (auch neue),
--      damit create_notification nicht still scheitert.
--   3. dispatch_due_appointment_reminders(): übernimmt fällige Erinnerungen,
--      legt die In-App-Benachrichtigung an (der notifications-Trigger stößt
--      damit auch den Push an) und gibt die übernommenen Zeilen für den
--      optionalen Mailversand zurück.
--   4. Cron alle 5 Minuten auf die Edge Function send-appointment-reminders.

-- 1) Versandprotokoll je Termin und Vorlaufzeit
CREATE TABLE IF NOT EXISTS public.appointment_reminder_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  minutes_before integer NOT NULL CHECK (minutes_before > 0),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  notified_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_reminder_dispatches_unique UNIQUE (appointment_id, minutes_before)
);

CREATE INDEX IF NOT EXISTS idx_appointment_reminder_dispatches_user
  ON public.appointment_reminder_dispatches (user_id, created_at DESC);

-- Fällige Erinnerungen schnell finden, ohne alle Termine zu lesen.
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_due
  ON public.appointments (start_time)
  WHERE reminder_minutes IS NOT NULL;

ALTER TABLE public.appointment_reminder_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.appointment_reminder_dispatches FROM PUBLIC, anon, authenticated;

-- 2) Benachrichtigungstyp je Mandant sicherstellen (bestehende Mandanten)
INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id, 'appointment_reminder', 'Termin-Erinnerung',
       'Erinnerung vor einem Termin (Vorlauf aus dem Termin)', 'calendar', true
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Neue Mandanten erhalten den Typ sofort, sonst schlägt create_notification fehl.
CREATE OR REPLACE FUNCTION public.seed_appointment_reminder_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (NEW.id, 'appointment_reminder', 'Termin-Erinnerung',
          'Erinnerung vor einem Termin (Vorlauf aus dem Termin)', 'calendar', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_appointment_reminder_type ON public.tenants;
CREATE TRIGGER seed_appointment_reminder_type
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_appointment_reminder_type();

REVOKE ALL ON FUNCTION public.seed_appointment_reminder_type() FROM PUBLIC, anon, authenticated;

-- 3) Fällige Erinnerungen übernehmen und Benachrichtigung anlegen.
--    Der Versand wird vor der Benachrichtigung verbucht; nur der Lauf, der die
--    Zeile tatsächlich einfügt (ON CONFLICT DO NOTHING), verschickt sie.
CREATE OR REPLACE FUNCTION public.dispatch_due_appointment_reminders(_limit integer DEFAULT 200)
RETURNS TABLE (
  appointment_id uuid,
  user_id uuid,
  tenant_id uuid,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  location text,
  minutes_before integer,
  notification_id uuid,
  notified boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_appointment record;
  v_dispatch uuid;
  v_notification uuid;
  v_title text;
  v_message text;
BEGIN
  FOR v_appointment IN
    SELECT a.id, a.user_id, a.tenant_id, a.title, a.start_time, a.end_time,
           a.location, a.reminder_minutes
    FROM public.appointments a
    WHERE a.reminder_minutes IS NOT NULL
      AND a.reminder_minutes > 0
      -- Nur noch nicht begonnene Termine: eine Erinnerung nach Terminbeginn
      -- hilft niemandem mehr und wird nicht nachgeholt.
      AND a.start_time > now()
      AND a.start_time - make_interval(mins => a.reminder_minutes) <= now()
      AND coalesce(lower(a.status), '') NOT IN ('cancelled', 'canceled', 'abgesagt')
      AND NOT EXISTS (
        SELECT 1 FROM public.appointment_reminder_dispatches d
        WHERE d.appointment_id = a.id
          AND d.minutes_before = a.reminder_minutes
      )
    ORDER BY a.start_time
    LIMIT greatest(coalesce(_limit, 200), 1)
  LOOP
    INSERT INTO public.appointment_reminder_dispatches (appointment_id, user_id, minutes_before)
    VALUES (v_appointment.id, v_appointment.user_id, v_appointment.reminder_minutes)
    ON CONFLICT (appointment_id, minutes_before) DO NOTHING
    RETURNING id INTO v_dispatch;

    IF v_dispatch IS NULL THEN
      CONTINUE; -- anderer Lauf war schneller
    END IF;

    v_title := coalesce(nullif(btrim(v_appointment.title), ''), 'Termin');
    v_message := 'Ihr Termin "' || v_title || '" beginnt am '
      || to_char(v_appointment.start_time AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY')
      || ' um ' || to_char(v_appointment.start_time AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
      || coalesce(' in ' || nullif(btrim(v_appointment.location), ''), '')
      || '.';

    -- Kein fertiger Link in den Daten: den Kalenderpfad bauen die Empfänger
    -- aus appointment_id (buildDeepLinkPath) bzw. die Mail aus derselben ID,
    -- damit es nur eine Quelle für den Pfad gibt.
    v_notification := NULL;
    BEGIN
      v_notification := public.create_notification(
        v_appointment.user_id,
        'appointment_reminder',
        'Erinnerung: ' || v_title,
        v_message,
        jsonb_build_object(
          'appointment_id', v_appointment.id,
          'start_time', v_appointment.start_time,
          'minutes_before', v_appointment.reminder_minutes
        ),
        'high',
        v_appointment.tenant_id
      );
    EXCEPTION WHEN OTHERS THEN
      -- Ein fehlender Typ oder eine deaktivierte Einstellung darf den Lauf
      -- nicht abbrechen; die Zeile bleibt als "nicht benachrichtigt" sichtbar.
      RAISE WARNING 'Termin-Erinnerung % konnte nicht angelegt werden: %', v_appointment.id, SQLERRM;
    END;

    UPDATE public.appointment_reminder_dispatches d
    SET notification_id = v_notification,
        notified_at = CASE WHEN v_notification IS NULL THEN NULL ELSE now() END
    WHERE d.id = v_dispatch;

    appointment_id := v_appointment.id;
    user_id := v_appointment.user_id;
    tenant_id := v_appointment.tenant_id;
    title := v_title;
    start_time := v_appointment.start_time;
    end_time := v_appointment.end_time;
    location := v_appointment.location;
    minutes_before := v_appointment.reminder_minutes;
    notification_id := v_notification;
    notified := v_notification IS NOT NULL;

    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_due_appointment_reminders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_due_appointment_reminders(integer) TO service_role;

-- 4) Alle 5 Minuten über die Edge Function (legt In-App/Push an, Mail optional).
--    URL und Service-Key kommen aus dem Vault; fehlen sie, wird nur ein Hinweis
--    ausgegeben, statt den Job mit falschem Ziel einzurichten.
DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_cron/pg_net fehlen – Termin-Erinnerungen laufen nicht automatisch';
    RETURN;
  END IF;

  v_url := (
    SELECT decrypted_secret FROM vault.decrypted_secrets
    WHERE name = 'supabase_url' LIMIT 1
  );
  v_key := coalesce(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
  );

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'supabase_url/service_role_key fehlen im Vault – Cron dispatch-appointment-reminders wird nicht eingerichtet';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-appointment-reminders') THEN
    PERFORM cron.unschedule('dispatch-appointment-reminders');
  END IF;

  PERFORM cron.schedule(
    'dispatch-appointment-reminders',
    '*/5 * * * *',
    format(
      $job$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || %L), body := '{}'::jsonb);$job$,
      rtrim(v_url, '/') || '/functions/v1/send-appointment-reminders',
      v_key
    )
  );
END $$;
