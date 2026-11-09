-- tasks.source_id is UUID. Briefing task creators incorrectly cast their UUID
-- appointment/preparation IDs to text, causing assignment and follow-up inserts
-- to fail. Repair the installed overloads without changing signatures, roles,
-- permissions, or workflow behavior (including the legacy assignment RPC).
DO $migration$
DECLARE
  routine record;
  definition text;
  corrected text;
  assignment_found boolean := false;
BEGIN
  FOR routine IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname IN (
        'set_appointment_briefing',
        'create_preparation_followup',
        'create_briefing_follow_up_task'
      )
  LOOP
    IF routine.proname = 'set_appointment_briefing' THEN
      assignment_found := true;
    END IF;
    definition := pg_get_functiondef(routine.oid);
    -- In these routines these expressions are used exclusively for source_id.
    -- assigned_to remains text and its casts must stay intact.
    corrected := replace(replace(definition, 'a.id::text', 'a.id'), 'p.id::text', 'p.id');
    IF corrected IS DISTINCT FROM definition THEN
      EXECUTE corrected;
    END IF;
  END LOOP;
  IF NOT assignment_found THEN
    RAISE EXCEPTION 'set_appointment_briefing is missing; apply the briefing workflow migrations first';
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
