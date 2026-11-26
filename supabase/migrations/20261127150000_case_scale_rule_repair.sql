-- Selbsttest „Fallakte · Ungültige Akten-Größe wird abgewiesen“ (scale-guard)
-- meldet die Zeile ohne 23514: der Update auf case_scale = 'huge' gelingt.
--
-- 20260305153000 legte case_scale und die CHECK-Regel in einem Schritt an –
-- ohne IF NOT EXISTS am Constraint und ohne NOT VALID. ADD CONSTRAINT prüft den
-- Bestand; liegt in case_items oder case_files ein Wert außerhalb von
-- small/large, bricht die Migration ab. Weil case_items zuerst geprüft wird,
-- erhalten beide Tabellen keine Regel, und die später nur ergänzte Spalte
-- (20260305230547) bleibt ungeschützt. Jeder Schreibzugriff auf case_scale ist
-- danach ungeprüft, der Selbsttest schreibt „huge“ erfolgreich.
--
-- Diese Migration stellt die Regel her, ohne sie abzuschwächen:
--   1. Spalte sicherstellen (idempotent).
--   2. Bestand in die geschlossene Wertemenge bringen: bekannte Schreibweisen
--      (klein/groß, klein/gross …) werden übersetzt, alle übrigen Werte auf NULL
--      gesetzt. NULL ist zulässig; die Oberfläche leitet die Größe dann aus dem
--      Aktentyp ab (classifyCaseScale in caseFileSizing.ts) und zeigt keinen
--      falschen Wert. Jede Zeile bleibt dadurch weiter änderbar.
--   3. Constraint anlegen, falls er fehlt oder eine andere Wertemenge prüft, und
--      ihn validieren. Damit gilt die Regel für den Bestand und für jeden neuen
--      Schreibzugriff.

DO $$
DECLARE
  target record;
  definition text;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('case_items', 'case_items_case_scale_check'),
      ('case_files', 'case_files_case_scale_check')
    ) AS t(table_name, check_name)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS case_scale text', target.table_name);

    EXECUTE format($sql$
      UPDATE public.%1$I
         SET case_scale = CASE lower(btrim(case_scale))
           WHEN 'small' THEN 'small'
           WHEN 'klein' THEN 'small'
           WHEN 'kleine' THEN 'small'
           WHEN 'kleiner' THEN 'small'
           WHEN 'large' THEN 'large'
           WHEN 'gross' THEN 'large'
           WHEN 'groß' THEN 'large'
           WHEN 'grosse' THEN 'large'
           WHEN 'große' THEN 'large'
           WHEN 'grosser' THEN 'large'
           WHEN 'großer' THEN 'large'
           ELSE NULL
         END
       WHERE case_scale IS NOT NULL
         AND lower(btrim(case_scale)) NOT IN ('small', 'large')
    $sql$, target.table_name);

    -- Eine abweichende Fassung (etwa die alten deutschen Werte) prüft nicht die
    -- vereinbarte Menge und wird ersetzt; eine passende bleibt unangetastet.
    SELECT pg_get_constraintdef(c.oid) INTO definition
    FROM pg_constraint c
    WHERE c.conrelid = format('public.%I', target.table_name)::regclass
      AND c.conname = target.check_name;

    IF definition IS NOT NULL
       AND NOT (definition ILIKE '%small%' AND definition ILIKE '%large%') THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', target.table_name, target.check_name);
      definition := NULL;
    END IF;

    IF definition IS NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (case_scale IN (''small'', ''large''))',
        target.table_name, target.check_name);
    END IF;

    EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', target.table_name, target.check_name);
  END LOOP;
END $$;

COMMENT ON CONSTRAINT case_files_case_scale_check ON public.case_files IS
  'Nur small und large; NULL leitet die Oberfläche aus dem Aktentyp ab.';
COMMENT ON CONSTRAINT case_items_case_scale_check ON public.case_items IS
  'Nur small und large; NULL leitet die Oberfläche aus dem Aktentyp ab.';
