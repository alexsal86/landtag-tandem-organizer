-- Alle verbleibenden Versionskonflikte außerhalb des Mitarbeitergesprächs auf
-- PT409 umstellen: die HR-DSGVO-Erklärung und die Knowledge-RPCs.
--
-- Dieselbe Ursache wie beim Autosave (20261128070000): ein veralteter
-- Versionsstand wurde mit 40001 abgewiesen. 40001 ist die SQLSTATE-Klasse der
-- wiederholbaren Transaktionskonflikte; Zwischenschichten lesen sie als "erneut
-- versuchen", die Antwort bleibt aus, und der Client läuft in die
-- Zeitüberschreitung. Ein Konflikt zwischen zwei Bearbeitern ist aber ein
-- Anwendungsfall: PostgREST trägt ihn mit PT409 als HTTP 409.
--
-- Die betroffenen Funktionen werden nicht neu geschrieben, sondern aus der
-- installierten Fassung abgeleitet: für jede Funktion der Liste wird der
-- Fehlercode im Rumpf ersetzt und die Definition erneut ausgeführt. Damit gilt
-- die Umstellung auch für Instanzen, deren Rümpfe von den Migrationsdateien
-- abweichen, und sie ist beliebig oft einspielbar (beim zweiten Lauf findet die
-- Ersetzung nichts mehr).
--
-- Die Selbsttests der Knowledge-RPCs erkennen den Konflikt bisher über den
-- Bedingungsnamen `serialization_failure` (das ist 40001). Sie müssen PT409
-- mitfangen, sonst schlagen sie fehl, statt den Konflikt zu belegen.
--
-- Nicht enthalten sind die Notiz-RPCs (note_conflict): sie liegen außerhalb
-- dieses Auftrags und bleiben bei 40001.

DO $$
DECLARE
  v_names text[] := ARRAY[
    'save_employee_hr_gdpr_declaration',
    'knowledge_qa_save_answer',
    'knowledge_qa_review',
    'knowledge_qa_set_assignee',
    'knowledge_qa_manage',
    'knowledge_qa_set_tags',
    'knowledge_qa_finish_attachment',
    'knowledge_qa_set_topics',
    'knowledge_qa_source_guard',
    'knowledge_qa_remove_source',
    'knowledge_qa_comment',
    'knowledge_qa_report_outdated',
    'knowledge_qa_selftest',
    'knowledge_qa_manage_selftest'
  ];
  r record;
  v_definition text;
  v_changed integer := 0;
BEGIN
  FOR r IN
    SELECT p.oid, pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prokind = 'f'
      AND p.proname = ANY (v_names)
  LOOP
    v_definition := regexp_replace(
      r.definition,
      $regex$ERRCODE\s*=\s*'40001'$regex$,
      'ERRCODE=''PT409''',
      'gi'
    );
    -- Der Fangzweig der Selbsttests muss beide Codes kennen. Der Schutz gegen
    -- den zweiten Lauf verhindert ein doppeltes Anhängen.
    IF v_definition NOT LIKE '%SQLSTATE ''PT409''%' THEN
      v_definition := regexp_replace(
        v_definition,
        $regex$WHEN\s+serialization_failure$regex$,
        'WHEN serialization_failure OR SQLSTATE ''PT409''',
        'gi'
      );
    END IF;
    IF v_definition <> r.definition THEN
      EXECUTE v_definition;
      v_changed := v_changed + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Konfliktcode PT409: % Funktionen umgestellt', v_changed;
END $$;

-- Nachweis für das Ergebnisfenster des SQL-Editors:
--   umgestellt – Funktionen der Liste, die jetzt PT409 tragen
--   offen      – Funktionen der Liste, die noch 40001 tragen (muss 0 sein)
--   ausserhalb – übrige öffentliche Funktionen mit 40001 (Notiz-RPCs)
WITH namen(proname) AS (
  VALUES ('save_employee_hr_gdpr_declaration'),('knowledge_qa_save_answer'),('knowledge_qa_review'),
    ('knowledge_qa_set_assignee'),('knowledge_qa_manage'),('knowledge_qa_set_tags'),
    ('knowledge_qa_finish_attachment'),('knowledge_qa_set_topics'),('knowledge_qa_source_guard'),
    ('knowledge_qa_remove_source'),('knowledge_qa_comment'),('knowledge_qa_report_outdated'),
    ('knowledge_qa_selftest'),('knowledge_qa_manage_selftest')
), funktionen AS (
  SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p
  JOIN namen n ON n.proname = p.proname
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
)
SELECT
  count(*) FILTER (WHERE definition LIKE '%PT409%')::int AS umgestellt,
  count(*) FILTER (WHERE definition ~ 'ERRCODE\s*=\s*''40001''')::int AS offen,
  (SELECT count(*)::int FROM pg_proc q
    WHERE q.pronamespace = 'public'::regnamespace AND q.prokind = 'f'
      AND q.proname NOT IN (SELECT proname FROM namen)
      AND pg_get_functiondef(q.oid) ~ 'ERRCODE\s*=\s*''40001''') AS ausserhalb
FROM funktionen;
