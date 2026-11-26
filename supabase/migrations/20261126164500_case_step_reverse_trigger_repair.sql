-- Rückweg „erledigte Aufgabe schließt den Vorgangsschritt“ wiederherstellen.
--
-- Der Selbsttest meldet im Vorgangs-Lifecycle den Schritt „Aufgabe erledigen
-- schließt den zugehörigen Vorgangsschritt“ mit „Erledigter Schritt bleibt
-- offen“: die verknüpfte Aufgabe ist erledigt, next_action_label/next_action_due_at
-- stehen im Vorgang aber weiterhin. Geschrieben wird dieser Rückweg ausschließlich
-- von Trigger public.case_step_reverse (Funktion public.sync_case_step_from_task).
-- Fehlt der Trigger auf einer Instanz oder läuft dort eine ältere Fassung, bleibt
-- das Erledigen der Aufgabe folgenlos – und zwar ohne Fehlermeldung, weil eine
-- fehlende Triggerfunktion stillschweigend nichts tut. Der Client kann das nicht
-- erkennen: das UPDATE der Aufgabe gelingt, nur der Vorgang bleibt offen.
--
-- Die Regel selbst ist unverändert und geprüft
-- (scripts/test-workflow-consistency.mjs: „Task completion clears the case step“).
-- Diese Migration setzt Funktion und Trigger deshalb erneut. Sie ist
-- wiederholbar, ändert an einer vollständigen Instanz nichts und stellt den
-- Rückweg auf einer Instanz mit fehlendem oder veraltetem Trigger her.

CREATE OR REPLACE FUNCTION public.sync_case_step_from_task() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.source_type IS DISTINCT FROM 'case_step' THEN RETURN NULL; END IF;
 IF auth.uid() IS NOT NULL AND NOT public.user_can_access_case_item(auth.uid(),NEW.source_id) THEN RAISE EXCEPTION 'Kein Zugriff auf den Vorgang' USING ERRCODE='42501'; END IF;
 -- Nur der Abschluss der Aufgabe selbst schließt den Schritt. Wird die Aufgabe
 -- aus der Vorgangsseite heraus beendet (Übergabe nach außen, Schritt geleert),
 -- bleibt der festgelegte Schritt als Wiedervorlage stehen.
 IF NEW.status IN ('completed','cancelled') AND OLD.status IS DISTINCT FROM NEW.status AND pg_trigger_depth()=1 THEN
  UPDATE case_items SET next_action_label=NULL,next_action_due_at=NULL,next_action_assignee_id=NULL WHERE id=NEW.source_id AND tenant_id=NEW.tenant_id;
 ELSIF NEW.status NOT IN ('completed','cancelled') THEN
  UPDATE case_items SET next_action_label=NEW.title,next_action_due_at=NEW.due_date,
   next_action_assignee_id=CASE WHEN NEW.assigned_to ~ '^[0-9a-fA-F-]{36}$' THEN NEW.assigned_to::uuid ELSE next_action_assignee_id END
   WHERE id=NEW.source_id AND tenant_id=NEW.tenant_id AND (NEW.title,NEW.due_date,NEW.assigned_to) IS DISTINCT FROM (OLD.title,OLD.due_date,OLD.assigned_to);
 END IF;
 RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.sync_case_step_from_task() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS case_step_reverse ON public.tasks;
CREATE TRIGGER case_step_reverse
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_case_step_from_task();
