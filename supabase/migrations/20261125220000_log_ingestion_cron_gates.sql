-- Log-Ingestion, zweite Stufe: geplante Edge-Function-Aufrufe nur bei Arbeit.
--
-- Ausgangslage nach 20261115120000_reduce_log_ingestion.sql: Die E-Mail-Kette
-- prüft bereits in SQL, ob etwas fällig ist. Die übrigen Cron-Jobs riefen ihre
-- Edge Function dagegen bei jedem Tick auf, auch wenn nichts zu tun war:
--
--   dispatch-appointment-reminders    */5     (288 Aufrufe/Tag)
--   poll-answer-followups             */30    ( 48 Aufrufe/Tag)
--   auto-sync-external-calendars      stündl. ( 24 Aufrufe/Tag)
--   suggest-case-escalations-hourly   stündl. ( 24 Aufrufe/Tag)
--   matrix-morning-greetings          stündl. ( 24 Aufrufe/Tag)
--   matrix-morning-greeting-hourly    6-12    (  7 Aufrufe/Tag, reines Duplikat)
--
-- Jeder Aufruf erzeugt Boot-, Request- und Execution-Logs in der Log-Ingestion,
-- unabhängig vom Ergebnis. Diese Migration zieht die Fälligkeitsprüfung nach
-- SQL: Die Function wird nur noch aufgerufen, wenn tatsächlich Arbeit anliegt.
-- Die Prüfungen sind bewusst Über-Approximationen – sie dürfen einen Lauf
-- auslassen, wenn nichts fällig ist, aber niemals Arbeit verschlucken.
--
-- Aufbau (statt fünf kopierter DO-Blöcke):
--
--   * automation_private.dispatch_edge_function()         – Vault-Zugang + POST
--   * automation_private.dispatch_edge_function_if_due()  – Aufruf nur bei Arbeit
--   * Fälligkeitsprüfungen als private SQL-Funktionen, die die bestehenden
--     Datenbankfunktionen mitbenutzen, statt deren Regeln nachzubauen:
--       get_due_appointment_reminders()  – Prädikat des Termin-Verteilers
--       has_due_poll_followups()         – get_due_poll_followups()
--       is_calendar_sync_slot_due()      – calendar_sync_slot() / claim_calendar_sync()
--       has_case_escalation_candidate()  – Schwellen aus suggest-case-escalations
--       has_pending_morning_greeting()   – matrix_morning_settings / matrix_bot_logs
--
-- Der Termin-Verteiler und claim_calendar_sync() delegieren ihrerseits an die
-- gemeinsame Prüfung, damit Erinnerungsfenster, Slot-Vergleich und
-- Übernahme-Frist nicht zwischen Cron-Gate und Function auseinanderlaufen.
--
-- Bewusst keine neuen public-Funktionen: die Helfer liegen in
-- automation_private und sind für Clients gesperrt. Ihre technischen Präfixe
-- (dispatch_, get_, is_, has_) führen sie im Funktionskatalog als
-- Hilfsfunktionen – es entstehen keine Katalogeinträge und kein neuer
-- Anwendungs-RPC. Es ändert sich nur, ob eine Function aufgerufen wird, nicht
-- was sie fachlich tut.
--
-- Wiederholbar: alle betroffenen Jobs werden vor dem Neuanlegen entfernt,
-- Funktionen per CREATE OR REPLACE ersetzt.
-- Ausführen als Datenbankrolle postgres (siehe docs/operations/log-ingestion.md).

-- Manche Supabase-Installationen erlauben postgres nur SELECT auf cron.job.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cron.job TO postgres;

CREATE SCHEMA IF NOT EXISTS automation_private;
REVOKE ALL ON SCHEMA automation_private FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- 1) Ein gemeinsamer Aufruf: Vault-Zugang und HTTP-POST an eine Edge Function.
--    Zusätzliche Header nennen nur den Vault-Namen des Secrets; der Wert wird
--    hier gelesen und steht nie im Cron-Befehl.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION automation_private.dispatch_edge_function(
  p_slug text,
  p_body jsonb DEFAULT '{}'::jsonb,
  p_secret_headers jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text;
  v_key text;
  v_headers jsonb;
  v_header text;
  v_secret_name text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
  WHERE name IN ('supabase_url', 'project_url')
  ORDER BY CASE name WHEN 'supabase_url' THEN 0 ELSE 1 END LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets
  WHERE name IN ('service_role_key', 'SUPABASE_SERVICE_ROLE_KEY')
  ORDER BY CASE name WHEN 'service_role_key' THEN 0 ELSE 1 END LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE EXCEPTION 'Edge Function % braucht supabase_url/project_url und service_role_key im Vault', p_slug;
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_key
  );

  FOR v_header, v_secret_name IN
    SELECT key, value FROM jsonb_each_text(p_secret_headers)
  LOOP
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
    WHERE name = v_secret_name LIMIT 1;

    IF v_secret IS NULL THEN
      RAISE EXCEPTION 'Edge Function % braucht % im Vault', p_slug, v_secret_name;
    END IF;

    v_headers := v_headers || jsonb_build_object(v_header, v_secret);
  END LOOP;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_slug,
    headers := v_headers,
    body := coalesce(p_body, '{}'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION automation_private.dispatch_edge_function(text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;

-- Der Cron-Befehl fragt nur noch nach der Arbeit, nicht mehr nach Vault/HTTP.
CREATE OR REPLACE FUNCTION automation_private.dispatch_edge_function_if_due(
  p_slug text,
  p_due boolean,
  p_body jsonb DEFAULT '{}'::jsonb,
  p_secret_headers jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT coalesce(p_due, false) THEN
    RETURN false;
  END IF;

  PERFORM automation_private.dispatch_edge_function(p_slug, p_body, p_secret_headers);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION automation_private.dispatch_edge_function_if_due(text, boolean, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Fällige Termin-Erinnerungen: das Prädikat des Verteilers, einmal definiert.
--    dispatch_due_appointment_reminders() liest unten aus derselben Funktion.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION automation_private.get_due_appointment_reminders(_limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  tenant_id uuid,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  location text,
  reminder_minutes integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
  LIMIT greatest(coalesce(_limit, 200), 1);
$$;

REVOKE ALL ON FUNCTION automation_private.get_due_appointment_reminders(integer)
  FROM PUBLIC, anon, authenticated;

-- Der öffentliche Verteiler bleibt die einzige Stelle mit Nebenwirkungen,
-- bezieht seine Kandidaten aber aus der gemeinsamen Prüfung.
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
    SELECT d.id, d.user_id, d.tenant_id, d.title, d.start_time, d.end_time,
           d.location, d.reminder_minutes
    FROM automation_private.get_due_appointment_reminders(_limit) d
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
END $$;

-- ---------------------------------------------------------------------------
-- 3) Fällige Abstimmungs-Erinnerungen: nur die Frage, ob get_due_poll_followups()
--    etwas liefert. Die Regel selbst steht dort (und in _shared/pollFollowup.ts).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION automation_private.has_due_poll_followups()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  -- Grenzwerte = Konstanten aus supabase/functions/_shared/pollFollowup.ts,
  -- benannt übergeben, damit eine vertauschte Reihenfolge nicht stillschweigend
  -- andere Regeln prüft.
  SELECT EXISTS (
    SELECT 1 FROM public.get_due_poll_followups(
      _limit => 100,
      _first_delay_hours => 24,
      _repeat_hours => 48,
      _max_attempts => 2,
      _deadline_window_hours => 24,
      _min_gap_hours => 12,
      _claim_timeout_minutes => 15
    )
  );
$$;

REVOKE ALL ON FUNCTION automation_private.has_due_poll_followups()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Kalender-Sync: Slot-Vergleich und Übernahme-Frist an einer Stelle.
--    claim_calendar_sync() nutzt dieselbe Prüfung.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION automation_private.is_calendar_sync_slot_due(
  _now timestamptz,
  _sync_time time,
  _interval_hours integer,
  _timezone text,
  _last_success_slot timestamp,
  _claimed_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  -- Der Slot kommt aus dem bestehenden calendar_sync_slot(); hier steht nur,
  -- wann er als fällig gilt und wann ein laufender Sync als abgebrochen zählt.
  SELECT (_last_success_slot IS NULL
          OR _last_success_slot < public.calendar_sync_slot(
               _now, _sync_time, _interval_hours, _timezone))
     AND (_claimed_at IS NULL
          OR _claimed_at < _now - interval '10 minutes');
$$;

REVOKE ALL ON FUNCTION automation_private.is_calendar_sync_slot_due(timestamptz, time, integer, text, timestamp, timestamptz)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION automation_private.has_due_calendar_sync()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_sync_settings s
    WHERE s.is_enabled
      -- Ohne aktiven externen Kalender gäbe es auch mit fälligem Slot nichts
      -- zu synchronisieren.
      AND EXISTS (
        SELECT 1 FROM public.external_calendars c
        WHERE c.tenant_id = s.tenant_id
          AND c.is_active
          AND c.sync_enabled
      )
      AND automation_private.is_calendar_sync_slot_due(
        now(), s.sync_time, s.sync_interval_hours, s.timezone,
        s.last_success_slot, s.claimed_at
      )
  );
$$;

REVOKE ALL ON FUNCTION automation_private.has_due_calendar_sync()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_calendar_sync(_setting_id uuid)
RETURNS timestamp
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE setting public.calendar_sync_settings; slot timestamp;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
  SELECT * INTO setting FROM public.calendar_sync_settings WHERE id=_setting_id AND is_enabled FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT automation_private.is_calendar_sync_slot_due(
       now(), setting.sync_time, setting.sync_interval_hours, setting.timezone,
       setting.last_success_slot, setting.claimed_at) THEN
    RETURN NULL;
  END IF;
  slot:=public.calendar_sync_slot(now(),setting.sync_time,setting.sync_interval_hours,setting.timezone);
  UPDATE public.calendar_sync_settings SET claimed_slot=slot,claimed_at=now() WHERE id=_setting_id;
  RETURN slot;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Eskalationsvorschläge: nur prüfen, wenn ein offener Vorgang ohne Akte
--    überhaupt einen Grund liefern kann. Schwellen wie THRESHOLDS in
--    suggest-case-escalations; die Function prüft danach genauer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION automation_private.has_case_escalation_candidate()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.case_items i
    WHERE i.status IN ('active', 'pending')
      AND i.case_file_id IS NULL
      AND (
        i.created_at <= now() - interval '21 days'
        OR i.priority = 'urgent'
        OR i.is_legal_relevant
        OR i.is_political_relevant
        OR (SELECT count(*) FROM public.case_item_interactions x
            WHERE x.case_item_id = i.id) > 5
        OR (SELECT count(*) FROM public.case_item_participants p
            WHERE p.case_item_id = i.id) > 3
      )
  );
$$;

REVOKE ALL ON FUNCTION automation_private.has_case_escalation_candidate()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Morgengruß: ein aktiver Gruß in genau dieser Berliner Stunde, der heute
--    noch nicht protokolliert wurde. send-matrix-morning-greeting vergleicht
--    ebenfalls die Berliner Stunde; sent_date schreibt es als UTC-Datum
--    (new Date().toISOString()), deshalb wird hier genauso verglichen.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION automation_private.has_pending_morning_greeting(_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH clock AS (
    SELECT (_now AT TIME ZONE 'Europe/Berlin') AS berlin_ts,
           (_now AT TIME ZONE 'UTC')::date AS utc_date
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.matrix_morning_settings g
    CROSS JOIN clock c
    WHERE g.enabled
      AND extract(hour FROM g.send_time)::int = extract(hour FROM c.berlin_ts)::int
      AND NOT EXISTS (
        SELECT 1 FROM public.matrix_bot_logs l
        WHERE l.user_id = g.user_id
          AND l.message_type = 'morning_greeting'
          AND l.sent_date = c.utc_date
      )
  );
$$;

REVOKE ALL ON FUNCTION automation_private.has_pending_morning_greeting(timestamptz)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7) Cron-Jobs neu setzen: Takt unverändert, Aufruf nur bei Arbeit.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  job record;
BEGIN
  FOR job IN SELECT jobid FROM cron.job
    WHERE jobname IN (
      'dispatch-appointment-reminders',
      'poll-answer-followups',
      'auto-sync-external-calendars',
      'suggest-case-escalations-hourly',
      'matrix-morning-greetings',
      'matrix-morning-greeting-hourly'
    )
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END $$;

-- 1) Termin-Erinnerungen: Der 5-Minuten-Takt bleibt (kurze Vorlaufzeiten wie
--    5 oder 10 Minuten brauchen ihn), aber ohne fällige Erinnerung entsteht kein
--    Function-Aufruf.
SELECT cron.schedule(
  'dispatch-appointment-reminders',
  '*/5 * * * *',
  $cron$
  SELECT automation_private.dispatch_edge_function_if_due(
    'send-appointment-reminders',
    EXISTS (SELECT 1 FROM automation_private.get_due_appointment_reminders(1))
  );
  $cron$
);

-- 2) Abstimmungs-Nachfassen: dieselbe Abfrage, die die Function selbst nutzt.
SELECT cron.schedule(
  'poll-answer-followups',
  '*/30 * * * *',
  $cron$
  SELECT automation_private.dispatch_edge_function_if_due(
    'send-poll-followups',
    automation_private.has_due_poll_followups()
  );
  $cron$
);

-- 3) Kalender-Sync: Slot- und Übernahme-Prüfung wie claim_calendar_sync().
SELECT cron.schedule(
  'auto-sync-external-calendars',
  '0 * * * *',
  $cron$
  SELECT automation_private.dispatch_edge_function_if_due(
    'auto-sync-calendars',
    automation_private.has_due_calendar_sync()
  );
  $cron$
);

-- 4) Eskalationsvorschläge: der AUTOMATION_CRON_SECRET-Wert bleibt im Vault,
--    der Cron-Befehl nennt nur den Namen.
SELECT cron.schedule(
  'suggest-case-escalations-hourly',
  '0 * * * *',
  $cron$
  SELECT automation_private.dispatch_edge_function_if_due(
    'suggest-case-escalations',
    automation_private.has_case_escalation_candidate(),
    jsonb_build_object('action', 'run-check'),
    jsonb_build_object('x-automation-secret', 'AUTOMATION_CRON_SECRET')
  );
  $cron$
);

-- 5) Morgengruß: matrix-morning-greeting-hourly (6-12 Uhr) war ein Duplikat von
--    matrix-morning-greetings (jede Stunde) und ist oben bereits entfernt.
SELECT cron.schedule(
  'matrix-morning-greetings',
  '0 * * * *',
  $cron$
  SELECT automation_private.dispatch_edge_function_if_due(
    'send-matrix-morning-greeting',
    automation_private.has_pending_morning_greeting()
  );
  $cron$
);
