-- Aufgaben- und Briefstatus waren seit Februar 2026 ungeprüft: beide
-- CHECK-Constraints wurden damals ersatzlos entfernt. Dadurch liefen die
-- Bindestrich-Schreibweise des Altbestands und die Unterstrich-Schreibweise
-- aus task_statuses, RPCs und Guards nebeneinander, und der Briefeditor schrieb
-- Statuswerte (pending_approval, revision_requested), die keine Regel kannte.

-- 1) Die konfigurierbare Liste zuerst: sie führt den kanonischen Namen.
--    Existiert nur die Bindestrich-Schreibweise, wird sie umbenannt; sonst
--    würde die Unique-Bedingung der Registry greifen.
UPDATE public.task_statuses
SET name = 'in_progress', updated_at = now()
WHERE replace(name, '-', '_') = 'in_progress'
  AND name <> 'in_progress'
  AND NOT EXISTS (
    SELECT 1 FROM public.task_statuses AS existing WHERE existing.name = 'in_progress'
  );

-- 2) Aufgaben übernehmen den kanonischen Namen nur, wenn die Registry ihn
--    tatsächlich führt. Andere Bindestrich-Werte bleiben unangetastet, statt
--    gegen eine unbekannte Statusliste zu schreiben; sie müssen zuerst in
--    task_statuses aufgenommen oder bereinigt werden. Die Umstellung arbeitet
--    ohne Literal, damit das Zustandsartefakt nur die kanonischen Werte der
--    Datenbank kennt und den abgelösten Wert nicht weiterführt.
UPDATE public.tasks AS t
SET status = replace(t.status, '-', '_'), updated_at = now()
WHERE t.status LIKE 'in-%'
  AND EXISTS (
    SELECT 1 FROM public.task_statuses AS registered
    WHERE registered.name = replace(t.status, '-', '_')
  );

-- 3) Danach die alte Bindestrich-Zeile selbst aufräumen: existiert der
--    kanonische Eintrag, ist der Bindestrich ein reiner Altname. Die
--    Statusauswahl filtert nur nach is_active, er bliebe also wählbar, obwohl
--    Client und Guards ausschließlich den Unterstrich schreiben. Nur wenn wider
--    Erwarten noch eine Aufgabe darauf verweist, bleibt der Eintrag bestehen:
--    dann bleibt der Konflikt sichtbar statt stillschweigend zu verschwinden.
DELETE FROM public.task_statuses AS legacy
WHERE replace(legacy.name, '-', '_') = 'in_progress'
  AND legacy.name <> 'in_progress'
  AND EXISTS (
    SELECT 1 FROM public.task_statuses AS canonical WHERE canonical.name = 'in_progress'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.tasks WHERE tasks.status = legacy.name
  );

-- 4) Der Aufgabenstatus muss in der konfigurierbaren Liste stehen. Die Liste
--    ist plattformweit und editierbar, deshalb keine starre Werteliste: der
--    Trigger prüft gegen dieselbe Registry, aus der die Oberfläche ihre Auswahl
--    liest. Er schwächt keinen bestehenden Guard und ersetzt keine Fachregel.
CREATE OR REPLACE FUNCTION public.enforce_task_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS NULL THEN
    RAISE EXCEPTION 'Aufgabenstatus fehlt' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.task_statuses WHERE name = NEW.status) THEN
    RAISE EXCEPTION 'Unbekannter Aufgabenstatus: %', NEW.status USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

-- Triggerfunktionen laufen unabhängig von EXECUTE-Rechten; der Entzug verhindert
-- nur, dass die SECURITY-DEFINER-Funktion als RPC aufrufbar ist.
REVOKE ALL ON FUNCTION public.enforce_task_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_task_status ON public.tasks;
CREATE TRIGGER enforce_task_status
BEFORE INSERT OR UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_task_status();

-- 5) Briefe haben keine konfigurierbare Statusliste; die Menge ist geschlossen
--    und umfasst den Freigabe-Loop (pending_approval, revision_requested) sowie
--    die Archivierung durch archive-letter.
--    NOT VALID: die Regel gilt sofort für neue und geänderte Zeilen, bewertet
--    aber keinen Altbestand. Die Migration scheitert damit nicht an Zeilen, die
--    während der ungeprüften Zeit geschrieben wurden. Ein späteres
--    VALIDATE CONSTRAINT setzt voraus, dass dieser Bestand bereinigt ist.
ALTER TABLE public.letters DROP CONSTRAINT IF EXISTS letters_status_check;
ALTER TABLE public.letters ADD CONSTRAINT letters_status_check
  CHECK (status IN ('draft', 'review', 'pending_approval', 'approved', 'revision_requested', 'sent', 'archived')) NOT VALID;
