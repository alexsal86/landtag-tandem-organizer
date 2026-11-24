-- Neunummeriert (20261124310000 -> 20261124340000), damit die Reihenfolge
-- Dispatcher (…320000) -> Reset (…330000) -> Aufräumen (…340000) lesbar bleibt;
-- der Block prüft seinen Ausgangszustand und ist ohnehin wiederholbar.
--
-- Entfernt den vorberechneten Kalenderlink (deep_link) aus den Daten der
-- Terminerinnerung. Den Pfad bauen die Empfänger selbst aus appointment_id:
-- buildDeepLinkPath im Client, die Erinnerungs-Mail aus derselben ID.
--
-- Die Migration prüft ihren eigenen Ausgangszustand, weil nicht feststeht, ob
-- 20261124260000_appointment_reminder_dispatcher.sql bereits gelaufen ist:
--   * Funktion fehlt        -> nur NOTICE, nichts zu tun
--   * Funktion ohne Feld    -> nur NOTICE, nichts zu tun
--   * Feld vorhanden        -> Funktionskörper ohne deep_link neu erstellen
--   * Feld nicht entfernbar -> Abbruch mit Hinweis statt stillem Auseinanderlaufen
--
-- Die bereits verschickten notifications behalten ihr altes data-JSON; gelesen
-- wird dort ohnehin nur appointment_id.
DO $$
DECLARE
  v_function regprocedure;
  v_definition text;
  v_patched text;
BEGIN
  v_function := to_regprocedure('public.dispatch_due_appointment_reminders(integer)');

  IF v_function IS NULL THEN
    RAISE NOTICE 'dispatch_due_appointment_reminders fehlt – 20261124260000 ist noch nicht gelaufen, nichts zu tun.';
    RETURN;
  END IF;

  v_definition := pg_get_functiondef(v_function);

  IF position('''deep_link''' IN v_definition) = 0 THEN
    RAISE NOTICE 'Erinnerungsdaten schreiben bereits kein deep_link – nichts zu tun.';
    RETURN;
  END IF;

  -- Genau das Element, das die Dispatcher-Migration in jsonb_build_object
  -- geschrieben hat: führendes Komma, Feldname, zusammengesetzter Pfad.
  v_patched := regexp_replace(
    v_definition,
    E',\\s*''deep_link'',\\s*''/calendar\\?highlight=''\\s*\\|\\|\\s*v_appointment\\.id::text',
    '',
    'g'
  );

  IF v_patched = v_definition OR position('''deep_link''' IN v_patched) > 0 THEN
    RAISE EXCEPTION 'deep_link steckt in dispatch_due_appointment_reminders, ließ sich aber nicht automatisch entfernen. Bitte den Funktionskörper manuell prüfen.';
  END IF;

  EXECUTE v_patched;
  RAISE NOTICE 'dispatch_due_appointment_reminders ohne deep_link neu erstellt.';
END
$$;
