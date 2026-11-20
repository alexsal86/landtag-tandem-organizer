CREATE OR REPLACE FUNCTION public.save_task_template(
  _id uuid, _tenant_id uuid, _title text, _description text, _first_step text,
  _due_in_days integer, _subtasks jsonb, _is_active boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $function$
DECLARE result_id uuid; step jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_tenant_admin(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'Nur Abgeordnete und Büroleitung dürfen Aufgabenpakete verwalten';
  END IF;
  IF length(trim(_title)) < 2 OR length(trim(_first_step)) < 2 THEN RAISE EXCEPTION 'Titel und erster Schritt sind erforderlich'; END IF;
  IF _due_in_days < 0 OR _due_in_days > 365 THEN RAISE EXCEPTION 'Die Gesamtfrist muss zwischen 0 und 365 Tagen liegen'; END IF;
  IF jsonb_typeof(_subtasks) <> 'array' OR jsonb_array_length(_subtasks) > 30 THEN RAISE EXCEPTION 'Unteraufgaben müssen eine Liste mit höchstens 30 Einträgen sein'; END IF;
  FOR step IN SELECT value FROM jsonb_array_elements(_subtasks) LOOP
    IF jsonb_typeof(step) <> 'object' OR length(trim(coalesce(step->>'title',''))) < 2
       OR coalesce((step->>'offsetDays')::integer,-1) < 0 OR (step->>'offsetDays')::integer > 365 THEN
      RAISE EXCEPTION 'Jede Unteraufgabe benötigt Titel und Frist zwischen 0 und 365 Tagen';
    END IF;
  END LOOP;
  INSERT INTO public.task_templates
    (id,tenant_id,title,description,first_step,due_in_days,subtasks,is_active,created_by)
  VALUES (coalesce(_id,gen_random_uuid()),_tenant_id,trim(_title),trim(coalesce(_description,'')),trim(_first_step),_due_in_days,_subtasks,coalesce(_is_active,true),auth.uid())
  ON CONFLICT (id) DO UPDATE SET title=excluded.title,description=excluded.description,first_step=excluded.first_step,
    due_in_days=excluded.due_in_days,subtasks=excluded.subtasks,is_active=excluded.is_active
    WHERE task_templates.tenant_id=_tenant_id
  RETURNING id INTO result_id;
  IF result_id IS NULL THEN RAISE EXCEPTION 'Aufgabenpaket nicht gefunden'; END IF;
  RETURN result_id;
END;
$function$;