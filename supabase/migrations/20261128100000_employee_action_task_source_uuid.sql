-- Maßnahmen-Aufgabe: source_id ist eine uuid, kein Text.
--
-- Der Schritt „Positiver Pfad" des Szenarios employee-meetings scheiterte auf der
-- Instanz mit
--   42804 · column "source_id" is of type uuid but expression is of type text
-- create_meeting_action_task schrieb `a.id::text` in tasks.source_id, während die
-- Spalte seit dem Grundschema (20260305230409) uuid ist und Jour-fixe-Aufgaben
-- dort ebenfalls eine uuid ablegen. Die isolierte Prüfung hatte die Spalte als
-- text angelegt und den Fehler deshalb verdeckt; sie wird mit dieser Änderung auf
-- uuid umgestellt.
--
-- Die Migration ersetzt ausschließlich den Funktionsrumpf (CREATE OR REPLACE,
-- gleiche Signatur, kein Tabellen-DDL) und ist beliebig oft einspielbar.

CREATE OR REPLACE FUNCTION public.create_meeting_action_task(p_action_item_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.employee_meeting_action_items; m public.employee_meetings; mid uuid; owner_id uuid; v_task uuid; title_text text;
BEGIN
  SELECT meeting_id INTO mid FROM public.employee_meeting_action_items WHERE id=p_action_item_id;
  m:=public.require_employee_meeting_access(mid);
  SELECT * INTO a FROM public.employee_meeting_action_items WHERE id=p_action_item_id AND meeting_id=m.id FOR UPDATE;
  IF NOT FOUND OR a.tenant_id<>m.tenant_id THEN RAISE EXCEPTION 'Maßnahme nicht gefunden' USING ERRCODE='42501'; END IF;
  IF m.status<>'acknowledged' THEN RAISE EXCEPTION 'Maßnahmen werden erst nach Bestätigung zu Aufgaben' USING ERRCODE='22023'; END IF;
  IF a.task_id IS NOT NULL THEN RETURN a.task_id; END IF;
  owner_id:=CASE WHEN a.owner='supervisor' THEN m.conducted_by ELSE m.employee_id END;
  IF NOT public.is_tenant_member(m.tenant_id,owner_id) OR (a.owner='both' AND NOT public.is_tenant_member(m.tenant_id,m.conducted_by)) THEN
    RAISE EXCEPTION 'Die verantwortliche Person gehört nicht zum Büro' USING ERRCODE='22023';
  END IF;
  title_text:=left(btrim(regexp_replace(a.description,'<[^>]*>','','g')),220);
  v_task:=gen_random_uuid();
  -- source_id ist uuid (Grundschema 20260305230409): die Maßnahmen-ID ohne
  -- Textumbau ablegen, sonst scheitert die Aufgabe mit 42804.
  INSERT INTO public.tasks(id,user_id,tenant_id,title,description,assigned_to,status,priority,category,due_date,
    ball_owner,ball_assignee_id,next_action,next_action_due,source_type,source_id,timeline)
  VALUES(v_task,m.conducted_by,m.tenant_id,title_text,a.description||E'\n\nMitarbeitergespräch: /employee-meeting/'||m.id,
    owner_id::text,CASE WHEN a.status='completed' THEN 'completed' ELSE 'todo' END,'medium','personal',a.due_date,
    'office',owner_id,CASE WHEN a.status<>'completed' THEN title_text END,a.due_date,'employee_meeting_action',a.id,
    jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','system','at',now(),'actorName','System',
      'text','Maßnahme aus bestätigtem Mitarbeitergespräch übernommen')));
  INSERT INTO public.task_assignees(task_id,user_id,assigned_by) VALUES(v_task,owner_id,auth.uid()) ON CONFLICT DO NOTHING;
  IF a.owner='both' THEN
    INSERT INTO public.task_assignees(task_id,user_id,assigned_by) VALUES(v_task,m.conducted_by,auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.employee_meeting_action_items SET task_id=v_task WHERE id=a.id;
  RETURN v_task;
END $$;

-- Nachweis für das Ergebnisfenster des SQL-Editors.
SELECT
  p.oid::regprocedure::text AS funktion,
  pg_get_functiondef(p.oid) LIKE '%source_id,%' AND pg_get_functiondef(p.oid) NOT LIKE '%a.id::text%' AS schreibt_uuid,
  (SELECT format_type(a.atttypid, a.atttypmod) FROM pg_attribute a
    WHERE a.attrelid = 'public.tasks'::regclass AND a.attname = 'source_id') AS spaltentyp
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'create_meeting_action_task';
