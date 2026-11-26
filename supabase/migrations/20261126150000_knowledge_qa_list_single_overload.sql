-- knowledge_qa_list hatte über mehrere Migrationen hinweg mehrere
-- Überladungen (4, 5, 8 und 10 Argumente). Weil fast alle Argumente Defaults
-- besitzen, ist ein Aufruf mit benannten Argumenten (p_tenant, p_limit, ...)
-- mehrdeutig:
--   Could not choose the best candidate function between:
--   public.knowledge_qa_list(p_tenant => uuid, ...)
-- Die aktuelle Fassung ist die Zehn-Argument-Signatur aus
-- 20261126120000_topic_etappe1_write_paths.sql (p_tag trägt die Themen-ID).
-- Alle älteren Überladungen werden entfernt, damit der RPC wieder eindeutig
-- auflösbar ist.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'knowledge_qa_list'
      AND oidvectortypes(p.proargtypes) <> 'uuid, text, text, integer, jsonb, text, text, text, text, text'
  LOOP
    EXECUTE format('DROP FUNCTION %s', fn.signature);
  END LOOP;

  IF (
    SELECT count(*)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'knowledge_qa_list'
  ) <> 1 THEN
    RAISE EXCEPTION 'knowledge_qa_list: erwartet genau eine Signatur';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
