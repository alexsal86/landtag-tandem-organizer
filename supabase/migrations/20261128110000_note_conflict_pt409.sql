-- Letzte Abweisung derselben Art: save_quick_note meldet einen veralteten
-- Notizstand bisher mit 40001.
--
-- 40001 ist die SQLSTATE-Klasse der wiederholbaren Transaktionskonflikte;
-- Zwischenschichten lesen sie als "erneut versuchen", die Antwort bleibt aus und
-- der Client läuft in die Zeitüberschreitung (so geschehen beim Autosave der
-- Mitarbeitergespräche, siehe 20261128070000). Zwei Bearbeiter derselben Notiz
-- sind aber ein Anwendungsfall: PostgREST trägt den Konflikt mit PT409 als
-- HTTP 409. Die Meldung beginnt weiterhin mit „NOTE_CONFLICT:", damit die
-- vorhandene Erkennung im Client unverändert greift.
--
-- Die Migration schreibt den Rumpf nicht neu, sondern leitet ihn aus der
-- installierten Fassung ab: es gibt zwei Fassungen im Bestand
-- (20261104220000 ohne Schreibquittungen, 20261105215052 mit), und beide müssen
-- auf PT409 umgestellt werden. Die Ersetzung ist beliebig oft einspielbar.

DO $$
DECLARE
  r record;
  v_definition text;
  v_changed integer := 0;
BEGIN
  FOR r IN
    SELECT p.oid, pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prokind = 'f'
      AND p.proname = 'save_quick_note'
  LOOP
    v_definition := regexp_replace(
      r.definition,
      $regex$ERRCODE\s*=\s*'40001'$regex$,
      'ERRCODE=''PT409''',
      'gi'
    );
    IF v_definition <> r.definition THEN
      EXECUTE v_definition;
      v_changed := v_changed + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Notizkonflikt PT409: % Fassungen umgestellt', v_changed;
END $$;

-- Nachweis für das Ergebnisfenster des SQL-Editors:
--   fassungen   – Varianten von save_quick_note
--   umgestellt  – davon mit PT409
--   offen       – davon noch mit 40001 (muss 0 sein)
--   meldung     – die Meldung trägt weiterhin die Marke für den Client
SELECT
  count(*)::int AS fassungen,
  count(*) FILTER (WHERE definition LIKE '%PT409%')::int AS umgestellt,
  count(*) FILTER (WHERE definition ~ 'ERRCODE\s*=\s*''40001''')::int AS offen,
  count(*) FILTER (WHERE definition LIKE '%NOTE_CONFLICT%')::int AS meldung
FROM (
  SELECT pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.prokind = 'f'
    AND p.proname = 'save_quick_note'
) fassungen;
