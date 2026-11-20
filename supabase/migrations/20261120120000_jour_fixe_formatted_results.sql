ALTER TABLE public.meeting_agenda_items ADD COLUMN result_html text;
ALTER TABLE public.carryover_items ADD COLUMN result_html text;

DO $migration$
DECLARE
  definition text;
  updated_definition text;
BEGIN
  SELECT pg_get_functiondef('public.archive_meeting_with_stafette(uuid)'::regprocedure) INTO definition;
  updated_definition := replace(definition,
    'notes,result_text,assigned_to,order_index,source_meeting_id',
    'notes,result_text,result_html,assigned_to,order_index,source_meeting_id');
  updated_definition := replace(updated_definition,
    'notes,result_text,assigned_to,order_index,original_meeting_id',
    'notes,result_text,result_html,assigned_to,order_index,original_meeting_id');
  updated_definition := replace(updated_definition,
    'a.notes,a.result_text,a.assigned_to,a.order_index',
    'a.notes,a.result_text,a.result_html,a.assigned_to,a.order_index');
  updated_definition := replace(updated_definition,
    'ORDER BY meeting_date LIMIT 1 FOR UPDATE',
    'ORDER BY meeting_date, id LIMIT 1 FOR UPDATE');

  IF updated_definition = definition THEN
    RAISE EXCEPTION 'Jour-fixe carryover logic was not found';
  END IF;
  EXECUTE updated_definition;
END $migration$;
